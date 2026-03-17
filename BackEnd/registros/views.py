import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any
from mimetypes import guess_type

from django.conf import settings
from django.http import FileResponse, JsonResponse
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


def _save_pdf_to_facturas(uploaded_file, destination_root: str) -> str:
    os.makedirs(destination_root, exist_ok=True)
    name_root, ext = os.path.splitext(uploaded_file.name)
    target_path = os.path.join(destination_root, uploaded_file.name)
    counter = 1
    while os.path.exists(target_path):
        target_path = os.path.join(
            destination_root,
            f"{name_root}_{counter}{ext}",
        )
        counter += 1
    with open(target_path, "wb") as out_file:
        for chunk in uploaded_file.chunks():
            out_file.write(chunk)
    return target_path

def _build_media_tree(base_path: Path) -> list[dict[str, Any]]:
    entries = []
    for entry in sorted(base_path.iterdir(), key=lambda p: p.name):
        relative_path = os.path.relpath(entry, settings.MEDIA_ROOT).replace("\\", "/")
        if entry.is_dir():
            entries.append(
                {
                    "name": entry.name,
                    "type": "directory",
                    "relative_path": relative_path,
                    "children": _build_media_tree(entry),
                }
            )
        else:
            entries.append(
                {
                    "name": entry.name,
                    "type": "file",
                    "relative_path": relative_path,
                    "size": entry.stat().st_size,
                }
            )
    return entries


def _collect_media_entries() -> list[str]:
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists():
        return []
    record = []
    for file_path in media_root.rglob("*"):
        if not file_path.is_file():
            continue
        stat_result = file_path.stat()
        relative = file_path.relative_to(media_root).as_posix()
        record.append(f"{relative}:{stat_result.st_mtime_ns}:{stat_result.st_size}")
    return sorted(record)


def _compute_media_tree_version() -> str:
    entries = _collect_media_entries()
    if not entries:
        return ""
    digest = hashlib.sha256(";".join(entries).encode("utf-8")).hexdigest()
    return digest



def _json_error(detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    return Response({"detail": detail}, status=status_code)


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


def _important_files_csv_path() -> str:
    return os.path.join(settings.MEDIA_ROOT, "important_files.csv")


def _sanitize_relative_path(raw_path: str) -> str:
    normalized = raw_path.strip().replace("\\", "/")
    normalized = normalized.strip("/")
    if not normalized:
        raise ValueError("Invalid relative path")
    parts = [part for part in normalized.split("/") if part and part != "."]
    if not parts:
        raise ValueError("Invalid relative path")
    if any(part == ".." for part in parts):
        raise ValueError("Invalid relative path")
    return "/".join(parts)


def _load_important_records() -> pd.DataFrame:
    columns = ["relative_path", "is_important", "marked_at", "marked_by"]
    csv_path = _important_files_csv_path()
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
        except Exception:
            df = pd.DataFrame(columns=columns)
    else:
        df = pd.DataFrame(columns=columns)

    for column in columns:
        if column not in df.columns:
            df[column] = False if column == "is_important" else None

    df = df[columns]
    df["relative_path"] = df["relative_path"].fillna("").astype(str)
    df["is_important"] = df["is_important"].fillna(False).map(bool)
    return df


def _persist_important_records(df: pd.DataFrame):
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    df.to_csv(_important_files_csv_path(), index=False)


def _is_previewable_mime(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    previewable_prefixes = ("image/", "text/")
    previewable_exact = {
        "application/pdf",
        "application/json",
        "application/xml",
        "text/html",
    }
    return any(mime_type.startswith(prefix) for prefix in previewable_prefixes) or (
        mime_type in previewable_exact
    )


# Create your views here.
def get_neos(request):
    api_key = os.getenv("NASA_API_KEY")
    if not api_key:
        return _json_error(
            "Falta la clave NASA_API_KEY en el servidor",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    try:
        response = requests.get(
            "https://api.nasa.gov/neo/rest/v1/neo/browse",
            params={"api_key": api_key},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        neos_raw = data.get("near_earth_objects", [])
        neos = []
        for neo_raw in neos_raw:
            estimated = neo_raw.get("estimated_diameter", {}).get("kilometers", {})
            neos.append(
                {
                    "id": neo_raw.get("id"),
                    "name": neo_raw.get("name"),
                    "is_potentially_hazardous_asteroid": neo_raw.get(
                        "is_potentially_hazardous_asteroid"
                    ),
                    "estimated_diameter_km_min": estimated.get(
                        "estimated_diameter_min"
                    ),
                    "estimated_diameter_km_max": estimated.get(
                        "estimated_diameter_max"
                    ),
                }
            )
        return JsonResponse({"neos": neos})
    except requests.RequestException as exc:
        logger.exception("Failed to fetch NEOS: %s", exc)
        return Response(
            {"detail": "No se pudo obtener los asteroides cercanos"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

def get_neos_by_page(request, page):
    api_key = os.getenv("NASA_API_KEY")
    if not api_key:
        return _json_error(
            "Falta la clave NASA_API_KEY en el servidor",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    try:
        page_number = int(page)
        if page_number < 0:
            raise ValueError("Página inválida")
    except ValueError as exc:
        return _json_error(str(exc), status.HTTP_400_BAD_REQUEST)

    try:
        response = requests.get(
            "https://api.nasa.gov/neo/rest/v1/neo/browse",
            params={"api_key": api_key, "page": page_number},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        neos_raw = data.get("near_earth_objects", [])
        neos = []
        for neo_raw in neos_raw:
            estimated = neo_raw.get("estimated_diameter", {}).get("kilometers", {})
            neos.append(
                {
                    "id": neo_raw.get("id"),
                    "name": neo_raw.get("name"),
                    "is_potentially_hazardous_asteroid": neo_raw.get(
                        "is_potentially_hazardous_asteroid"
                    ),
                    "estimated_diameter_km_min": estimated.get(
                        "estimated_diameter_min"
                    ),
                    "estimated_diameter_km_max": estimated.get(
                        "estimated_diameter_max"
                    ),
                }
            )
        return JsonResponse({"neos": neos})
    except requests.RequestException as exc:
        logger.exception("Failed to fetch NEOS page %s: %s", page_number, exc)
        return Response(
            {"detail": "No se pudo obtener los asteroides cercanos"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

def save_neos(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError as exc:
        return _json_error("JSON inválido", status.HTTP_400_BAD_REQUEST)

    neos_data = payload.get("neos")
    if not isinstance(neos_data, list):
        return _json_error("'neos' debe ser una lista", status.HTTP_400_BAD_REQUEST)

    try:
        for neo in neos_data:
            neo_obj = NearEarthObject(
                id=neo.get("id"),
                name=neo.get("name"),
                diameter_min=neo.get("estimated_diameter_km_min"),
                diameter_max=neo.get("estimated_diameter_km_max"),
                is_potentially_hazardous=neo.get(
                    "is_potentially_hazardous_asteroid"
                ),
            )
            neo_obj.save()
    except Exception as exc:
        logger.exception("Failed to save NEOS: %s", exc)
        return Response(
            {"detail": "Error al guardar los NEOs"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    return JsonResponse({"detail": "NEOs saved successfully."})


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
        return Response(
            {"detail": "No se pudo leer la lista de facturas"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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
            {"detail": "No se ha enviado ningún archivo."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
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
    except Exception as exc:
        logger.exception("Failed to upload media files: %s", exc)
        return Response(
            {"detail": "No se pudo subir los archivos."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
    try:
        facturas_dir = os.path.join(settings.MEDIA_ROOT, "Facturas")
        invoice_rows = []
        for uploaded_file in valid_files:
            saved_path = None
            relative_path = None
            try:
                saved_path = _save_pdf_to_facturas(uploaded_file, facturas_dir)
                relative_path = os.path.relpath(saved_path, settings.MEDIA_ROOT).replace("\\", "/")
                reader = PdfReader(saved_path)
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
                        "stored_path": relative_path,
                    }
                )
            except Exception as exc:
                logger.error("PDF parsing failed for %s: %s", uploaded_file.name, exc)
                invoice_rows.append(
                    {
                        "name": uploaded_file.name,
                        "error": str(exc),
                        "stored_path": relative_path,
                    }
                )

        successful_invoices = [row for row in invoice_rows if "error" not in row]
        if successful_invoices:
            invoice_df = pd.DataFrame(successful_invoices)
            _persist_invoices(invoice_df)

        return Response(invoice_rows)
    except Exception as exc:
        logger.exception("Failed to process invoices: %s", exc)
        return Response(
            {"detail": "Error al procesar las facturas"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_media_structure(request):
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists():
        return Response([], status=status.HTTP_200_OK)
    try:
        tree = _build_media_tree(media_root)
        return Response(tree)
    except Exception as exc:
        logger.exception("Failed to build media structure: %s", exc)
        return Response(
            {"detail": "Error al obtener la estructura de medios"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def media_tree_version(request):
    try:
        version = _compute_media_tree_version()
        return Response({"tree_version": version})
    except Exception as exc:
        logger.exception("Failed to compute media tree version: %s", exc)
        return Response(
            {"detail": "Error al calcular la versión de medios"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_media_file(request):
    #Obtiene el parametro de la ruta del archivo a descargar, y comprueba que es válido
    relative_path = request.query_params.get("path")
    if not relative_path:
        return Response(
            {"detail": "Se requiere el parámetro 'path'"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        sanitized = _sanitize_relative_path(relative_path)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    file_path = Path(settings.MEDIA_ROOT) / sanitized
    if not file_path.exists() or not file_path.is_file():
        return Response(
            {"detail": "Archivo no encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )

    #Comprobado que el archivo existe, comprueba si es visualizable por el navegadir
    mime_type, _ = guess_type(str(file_path))
    as_attachment = not _is_previewable_mime(mime_type)

    #Define el tamaño de bloque de la descarga
    raw_block = request.query_params.get("block_size")
    default_block = getattr(settings, "MEDIA_DOWNLOAD_BLOCK_SIZE", 64 * 1024)
    max_block_size = getattr(settings, "MEDIA_DOWNLOAD_BLOCK_SIZE_MAX", 512 * 1024)

    try:
        block_size = int(raw_block) if raw_block is not None else default_block
    except ValueError:
        block_size = default_block

    block_size = max(1, min(block_size, max_block_size))

    #Construimos la respuesta
    response = FileResponse(
        file_path.open("rb"),
        as_attachment=as_attachment,
        filename=file_path.name,
    )
    response.block_size = block_size
    if mime_type:
        response["Content-Type"] = mime_type
    if not as_attachment:
        response["Content-Disposition"] = f'inline; filename="{file_path.name}"'

    response["Content-Length"] = file_path.stat().st_size

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_important_files(request):
    try:
        df = _load_important_records()
        records = df.to_dict(orient="records")
        return Response(records)
    except Exception as exc:
        logger.exception("Failed to read important files: %s", exc)
        return Response(
            {"detail": "Error al cargar archivos importantes"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_important_file(request):
    relative_path = request.data.get("relative_path")
    important_flag = request.data.get("important")

    if not relative_path or not isinstance(relative_path, str):
        return Response(
            {"detail": "Campo 'relative_path' obligatorio"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        sanitized_path = _sanitize_relative_path(relative_path)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if important_flag is None:
        return Response(
            {"detail": "Campo 'important' obligatorio"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(important_flag, str):
        important_bool = important_flag.strip().lower() in (
            "true",
            "1",
            "yes",
            "y",
            "t",
        )
    else:
        important_bool = bool(important_flag)

    try:
        df = _load_important_records()
        username = (
            request.user.get_username()
            if hasattr(request.user, "get_username")
            else str(request.user)
        )
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        mask = df["relative_path"] == sanitized_path
        if mask.any():
            df.loc[
                mask,
                ["is_important", "marked_at", "marked_by"],
            ] = important_bool, timestamp, username
        else:
            new_row = pd.DataFrame(
                [
                    {
                        "relative_path": sanitized_path,
                        "is_important": important_bool,
                        "marked_at": timestamp,
                        "marked_by": username,
                    }
                ]
            )
            df = pd.concat([df, new_row], ignore_index=True)

        _persist_important_records(df)
        return Response(
            {
                "relative_path": sanitized_path,
                "is_important": important_bool,
                "marked_at": timestamp,
                "marked_by": username,
            }
        )
    except Exception as exc:
        logger.exception("Failed to toggle important file: %s", exc)
        return Response(
            {"detail": "Error al marcar el archivo importante"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
