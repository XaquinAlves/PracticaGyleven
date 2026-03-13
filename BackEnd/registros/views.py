import json
import logging
import os
from pathlib import Path
from typing import Any
from django.conf import settings
from django.http import JsonResponse
import pandas as pd
import re
from datetime import datetime
import requests
from registros.models import NearEarthObject
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)


def _normalize_decimal(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    value = raw_value.strip().replace("€", "").replace(" ", "")
    has_comma = "," in value
    has_dot = "." in value
    if has_comma and has_dot:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "")
            value = value.replace(",", ".")
        else:
            value = value.replace(",", "")
    elif has_comma:
        value = value.replace(",", ".")
    cleaned = re.sub(r"[^\d\.]", "", value)
    return cleaned if cleaned else None


def _extract_invoice_metadata(text: str) -> dict[str, str | None]:
    invoice_number = None
    invoice_date = None
    total = None

    number_match = re.search(
        r"Factura(?:\s+N[oº]?\.?)?[:\s-]*(\w+-?\d+)",
        text,
        flags=re.IGNORECASE,
    )
    if number_match:
        invoice_number = number_match.group(1).strip()

    date_match = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text)
    if date_match:
        invoice_date = date_match.group(1)

    total_match = re.search(
        r"total(?:\s*[:\-\s]*)?([\d\.,]+)",
        text,
        flags=re.IGNORECASE,
    )
    if total_match:
        total = _normalize_decimal(total_match.group(1))

    return {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "total": total,
    }


def _persist_invoices(df: pd.DataFrame):
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    invoices_path = os.path.join(settings.MEDIA_ROOT, "invoices_by_pdf.csv")
    try:
        existing_df = pd.read_csv(invoices_path)
    except FileNotFoundError:
        existing_df = pd.DataFrame()
    if not existing_df.empty:
        combined = pd.concat([existing_df, df], ignore_index=True)
        combined = combined.drop_duplicates(
            subset=["name", "invoice_number", "invoice_date", "total"],
            keep="first",
        )
    else:
        combined = df
    combined.to_csv(invoices_path, index=False)
    logger.info("Invoices table persisted at %s (%d rows)", invoices_path, len(combined))

def _build_media_tree(base_path: Path) -> list[dict[str, Any]]:
    entries = []
    for entry in sorted(base_path.iterdir(), key=lambda p: p.name):
        if entry.is_dir():
            entries.append(
                {
                    "name": entry.name,
                    "type": "directory",
                    "children": _build_media_tree(entry),
                }
            )
        else:
            entries.append(
                {
                    "name": entry.name,
                    "type": "file",
                    "size": entry.stat().st_size,
                }
            )
    return entries


def _sanitize_target_dir(raw_dir: str | None) -> str:
    if not raw_dir:
        return ""
    normalized = raw_dir.strip().replace("\\", "/")
    normalized = normalized.strip("/")
    if not normalized:
        return ""
    parts = [part for part in normalized.split("/") if part and part != "."]
    if any(part == ".." for part in parts):
        raise ValueError("Invalid directory path")
    return "/".join(parts)


# Create your views here.
def get_neos(request):
    api_key = (os.getenv('NASA_API_KEY'));
    response = requests.get('https://api.nasa.gov/neo/rest/v1/neo/browse?api_key={}'.format(api_key))
    data = response.json()
    neosRaw = data.get('near_earth_objects')
    neos = [];
    for neoRaw in neosRaw:
        neo = {
            'id': neoRaw.get('id'),
            'name': neoRaw.get('name'),
            'is_potentially_hazardous_asteroid': neoRaw.get('is_potentially_hazardous_asteroid'),
            'estimated_diameter_km_min': neoRaw.get('estimated_diameter').get('kilometers').get('estimated_diameter_min'),
            'estimated_diameter_km_max': neoRaw.get('estimated_diameter').get('kilometers').get('estimated_diameter_max'),
        }
        neos.append(neo)
    return JsonResponse({'neos': neos})

def get_neos_by_page(request, page):
    api_key = (os.getenv('NASA_API_KEY'));
    response = requests.get('https://api.nasa.gov/neo/rest/v1/neo/browse?api_key={}&page={}'.format(api_key, page));
    data = response.json()
    neosRaw = data.get('near_earth_objects')
    neos = [];
    for neoRaw in neosRaw:
        neo = {
            'id': neoRaw.get('id'),
            'name': neoRaw.get('name'),
            'is_potentially_hazardous_asteroid': neoRaw.get('is_potentially_hazardous_asteroid'),
            'estimated_diameter_km_min': neoRaw.get('estimated_diameter').get('kilometers').get('estimated_diameter_min'),
            'estimated_diameter_km_max': neoRaw.get('estimated_diameter').get('kilometers').get('estimated_diameter_max'),
        }
        neos.append(neo)
    return JsonResponse({'neos': neos})

def save_neos(request):
    data = json.loads(request.body);
    for neo in data.get('neos'):
        neo_obj = NearEarthObject(
            id=neo.get('id'),
            name=neo.get('name'),
            diameter_min=neo.get('estimated_diameter_km_min'),
            diameter_max=neo.get('estimated_diameter_km_max'),
            is_potentially_hazardous=neo.get('is_potentially_hazardous_asteroid')
        )
        neo_obj.save()
    return JsonResponse({'detail': 'NEOs saved successfully.'})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_facturas(request):
    invoices_path = os.path.join(settings.MEDIA_ROOT, "invoices_by_pdf.csv")
    if not os.path.exists(invoices_path):
        logger.warning("Invoices CSV %s not found", invoices_path)
        return Response([])

    try:
        df = pd.read_csv(invoices_path)
        if "extracted_at" in df.columns:
            df["extracted_at"] = pd.to_datetime(df["extracted_at"]).dt.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
            )
        df["total"] = df.get("total")
        df = df.where(pd.notnull(df))
        raw_records = df.to_dict(orient="records")
        records = []
        for rec in raw_records:
            cleaned = {
                key: (None if pd.isna(value) else value)
                for key, value in rec.items()
            }
            records.append(cleaned)
        return Response(records)
    except Exception as exc:
        logger.error("Failed to read invoices CSV %s: %s", invoices_path, exc)
        return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_to_media(request):
    try:
        target_dir = _sanitize_target_dir(request.data.get("target_dir"))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    files = request.FILES.getlist("files") or request.FILES.getlist("pdfs")
    if not files:
        return Response(
            {"detail": "No se ha enviado ningÃºn archivo."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    destination = (
        settings.MEDIA_ROOT
        if not target_dir
        else os.path.join(settings.MEDIA_ROOT, target_dir)
    )
    os.makedirs(destination, exist_ok=True)

    saved_items = []
    for uploaded_file in files:
        name_root, ext = os.path.splitext(uploaded_file.name)
        stored_path = os.path.join(destination, uploaded_file.name)
        counter = 1
        while os.path.exists(stored_path):
            stored_path = os.path.join(
                destination,
                f"{name_root}_{counter}{ext}",
            )
            counter += 1

        with open(stored_path, "wb") as out_file:
            for chunk in uploaded_file.chunks():
                out_file.write(chunk)

        saved_items.append(
            {
                "original_name": uploaded_file.name,
                "stored_name": os.path.basename(stored_path),
                "relative_path": os.path.relpath(
                    stored_path,
                    settings.MEDIA_ROOT,
                ).replace("\\", "/"),
                "target_dir": target_dir,
                "size": uploaded_file.size,
            }
        )

    records_path = os.path.join(settings.MEDIA_ROOT, "uploaded_files_table.csv")
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    existing_df = pd.DataFrame()
    if os.path.exists(records_path):
        try:
            existing_df = pd.read_csv(records_path)
        except Exception:
            existing_df = pd.DataFrame()

    next_id = 1
    if not existing_df.empty and "id" in existing_df.columns:
        try:
            next_id = int(existing_df["id"].max()) + 1
        except Exception:
            next_id = 1

    username = (
        request.user.get_username()
        if hasattr(request.user, "get_username")
        else str(request.user)
    )
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    upload_records = []
    for item in saved_items:
        upload_records.append(
            {
                "id": next_id,
                "original_name": item["original_name"],
                "uploaded_by": username,
                "uploaded_at": timestamp,
            }
        )
        next_id += 1

    if upload_records:
        new_df = pd.DataFrame(upload_records)
        if not existing_df.empty:
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        else:
            combined_df = new_df
        combined_df.to_csv(records_path, index=False)
        logger.info(
            "Appended %d uploaded file records to %s",
            len(upload_records),
            records_path,
        )

    logger.info(
        "Uploaded %d files to %s",
        len(saved_items),
        target_dir or "media root",
    )
    return Response(saved_items, status=status.HTTP_201_CREATED)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leer_factura_pdf(request):
    files = request.FILES.getlist("pdfs")
    if not files:
        single = request.FILES.get("file")
        files = [single] if single else []

    valid_files = [
        uploaded_file
        for uploaded_file in files
        if uploaded_file and uploaded_file.name.lower().endswith(".pdf")
    ]

    if not valid_files:
        return Response(
            {"error": "Falta el archivo PDF o el formato no es válido"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    invoice_rows = []
    for uploaded_file in valid_files:
        try:
            reader = PdfReader(uploaded_file)
            page_text = "\n".join(page.extract_text() or "" for page in reader.pages)
            metadata = _extract_invoice_metadata(page_text)
            invoice_rows.append(
                {
                    "name": uploaded_file.name,
                    "page_count": len(reader.pages),
                    "invoice_number": metadata["invoice_number"],
                    "invoice_date": metadata["invoice_date"],
                    "total": metadata["total"],
                    "extracted_at": datetime.utcnow().isoformat(),
                }
            )
        except Exception as exc:
            logger.error("PDF parsing failed for %s: %s", uploaded_file.name, exc)
            invoice_rows.append(
                {
                    "name": uploaded_file.name,
                    "error": str(exc),
                }
            )

    successful_invoices = [
        row for row in invoice_rows if "error" not in row
    ]
    if successful_invoices:
        invoice_df = pd.DataFrame(successful_invoices)
        _persist_invoices(invoice_df)

    return Response(invoice_rows)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_media_structure(request):
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists():
        return Response([], status=status.HTTP_200_OK)
    tree = _build_media_tree(media_root)
    return Response(tree)
