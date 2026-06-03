import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any, TypedDict, cast
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
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from datetime import timedelta
from django.utils import timezone
import threading
import time
from django.conf import settings as django_settings
import threading


logger = logging.getLogger(__name__)
# Constantes y variables
_NEOS_CACHE_KEY = "neos_page_0"
_NEOS_CACHE_TTL = timedelta(minutes=15)
_neos_cache: dict[str, dict[str, Any]] = {}
_MIN_NEOS_PAGE = 0
_INVOICES_CACHE_TTL = timedelta(minutes=5)
_invoices_cache: dict[str, Any] = {}
_MEDIA_STRUCTURE_CACHE_TTL = timedelta(minutes=2)
_media_structure_cache: dict[str, Any] = {}
_MEDIA_TREE_WATCHER_INTERVAL = getattr(
    django_settings, "MEDIA_TREE_WATCHER_INTERVAL", 15
)
_MEDIA_TREE_WATCHER_ENABLED = getattr(
    django_settings, "MEDIA_TREE_WATCHER_ENABLED", True
)
_media_tree_watcher_thread: threading.Thread | None = None
_media_tree_watcher_hash = ""
class NeosResponse(TypedDict):
    neos: list[dict[str, Any]]

def compute_hash(payload: NeosResponse) -> str:
    """
    Genera un hash SHA-256 determinista del payload de NEOs.
    El diccionario debe contener la clave "neos" con la lista de asteroides,
    lo que permite detectar cambios sin almacenar el objeto completo.
    """
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

# Normaliza un decimal
def _normalize_decimal(raw_value: str | None) -> str | None:
    """
    Normaliza un número en formato libre (con comas, puntos o símbolos como €)
    y devuelve la representación con punto decimal sin espacios ni caracteres extraños.
    Utiliza el string original o None para detectar valores vacíos.
    """
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

#Extrae los metadatos de una factura
def _extract_invoice_metadata(text: str) -> dict[str, str | None]:
    """
    Extrae número, fecha y total aproximado de un texto OCR de factura.
    Devuelve diccionario con los campos encontrados o None si no existen.
    """
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

# Guarda una factura en media/invoices_by_pdf.csv
def _records_from_dataframe(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Normaliza un DataFrame convertido a records, reemplazando NaN por None y
    asegurando que todas las claves sean strings para serializar en JSON o comparaciones.
    """
    df = df.where(pd.notnull(df))
    raw_records = df.to_dict(orient="records")
    result: list[dict[str, Any]] = []
    for rec in raw_records:
        normalized: dict[str, Any] = {}
        for key, value in rec.items():
            normalized_key = str(key)
            normalized[normalized_key] = None if pd.isna(value) else value
        result.append(normalized)
    return result


def _compute_records_hash(records: list[dict[str, Any]]) -> str:
    """
    Calcula SHA-256 de la lista de registros de facturas, útil para emitir hashes
    válidos en el canal y detectar cambios en los imports.
    """
    serialized = json.dumps(records, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _persist_invoices(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Añade facturas nuevas a media/invoices_by_pdf.csv, elimina duplicados conocidos,
    limpia la cache de facturas y devuelve la lista preparada para publicar su hash.
    """
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
    _invalidate_invoices_cache()
    return _records_from_dataframe(combined)


def _get_cached_invoices() -> list[dict[str, Any]] | None:
    """Recupera la entrada de cache de facturas si sigue vigente."""
    entry = _invoices_cache.get("entry")
    if not entry:
        return None
    if entry["expires_at"] <= timezone.now():
        _invoices_cache.pop("entry", None)
        return None
    return cast(list[dict[str, Any]], entry["records"])


def _set_invoices_cache(records: list[dict[str, Any]]) -> None:
    """Guarda los registros de facturas junto con el momento de expiración."""
    _invoices_cache["entry"] = {
        "records": records,
        "expires_at": timezone.now() + _INVOICES_CACHE_TTL,
    }


def _invalidate_invoices_cache() -> None:
    """Elimina la entrada de cache para forzar recálculo posterior."""
    _invoices_cache.pop("entry", None)

# Sube el pdf de la factura a Media/Facturas/{archivo.pdf}
def _save_pdf_to_facturas(uploaded_file, destination_root: str) -> str:
    """
    Guarda el archivo PDF recibido bajo Media/Facturas y evita colisiones agregando sufijos.
    Devuelve la ruta absoluta donde fue almacenado.
    """
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

# Devuelve un mapeado de una ruta con carpetas y archivos
def _build_media_tree(base_path: Path) -> list[dict[str, Any]]:
    """
    Recorre recursivamente el contenido de MEDIA_ROOT para construir la estructura JSON
    que expone el endpoint /registros/media-tree/.
    """
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
    """Lista todos los archivos con su timestamp y tamaño para calcular un hash único."""
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
    """Genera el hash SHA-256 de la lista ordenada de entradas recogidas."""
    entries = _collect_media_entries()
    if not entries:
        return ""
    digest = hashlib.sha256(";".join(entries).encode("utf-8")).hexdigest()
    return digest


# Formatea una respuesta de error
def _format_error(
    detail: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    code: str | None = None,
    errors: dict[str, list[str]] | None = None,
):
    """
    Construye un payload uniforme para errores de API con detalle, estado, código y errores.
    """
    payload: dict[str, Any] = {
        "detail": detail,
        "status": status_code,
    }
    if code:
        payload["code"] = code
    if errors:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def _json_error(detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    """Devuelve una Response de error simple reutilizando el formateo estándar."""
    return _format_error(detail, status_code)


def _sanitize_target_dir(raw_dir: str | None) -> str:
    """
    Limpia una ruta de destino para subidas de media: elimina barras redundantes y bloquea '..'.
    Devuelve cadena vacía si solo venía vacío o relativo inválido.
    """
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
    """Devuelve la ruta absoluta del CSV de archivos importantes dentro de MEDIA_ROOT."""
    return os.path.join(settings.MEDIA_ROOT, "important_files.csv")


def _sanitize_relative_path(raw_path: str) -> str:
    """
    Normaliza la ruta relativa de un archivo/carpetas, quita '../' y valida que no quede vacía.
    """
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
    """
    Lee el CSV de archivos importantes y devuelve DataFrame con columnas estandarizadas.
    """
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
    """
    Persiste el DataFrame de registros importantes en disco y mantiene la carpeta media existente.
    """
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    df.to_csv(_important_files_csv_path(), index=False)


def _get_cached_media_structure() -> tuple[list[dict[str, Any]], str] | None:
    """Retorna el árbol de media/version almacenado en cache si no expiró."""
    entry = _media_structure_cache.get("entry")
    if not entry:
        return None
    if entry["expires_at"] <= timezone.now():
        _media_structure_cache.pop("entry", None)
        return None
    return cast(tuple[list[dict[str, Any]], str], (entry["tree"], entry["version"]))


def _set_media_structure_cache(tree: list[dict[str, Any]], version: str) -> None:
    """Persist o en memoria el árbol con su versión hash para evitar recálculos frecuentes."""
    _media_structure_cache["entry"] = {
        "tree": tree,
        "version": version,
        "expires_at": timezone.now() + _MEDIA_STRUCTURE_CACHE_TTL,
    }


def _invalidate_media_structure_cache() -> None:
    """Borra la cache del árbol de media para forzar recálculo en la próxima petición."""
    _media_structure_cache.pop("entry", None)


def _publish_media_tree_change(new_version: str) -> None:
    """Publica un evento de refresh del recurso media con el hash calculado del árbol."""
    payload = {
        "action": "refresh",
        "timestamp": datetime.utcnow().isoformat(),
    }
    publish_media_update(payload, resource="media", hash_value=new_version)


def _media_tree_watcher_loop(interval: int):
    """Hilo que periódicamente recalcula la versión del árbol y publica cambios si detecta variación."""
    global _media_tree_watcher_hash
    while True:
        try:
            version = _compute_media_tree_version()
            if version and version != _media_tree_watcher_hash:
                _media_tree_watcher_hash = version
                _invalidate_media_structure_cache()
                _publish_media_tree_change(version)
        except Exception:
            logger.exception("Watcher falló al comprobar la estructura de medios.")
        time.sleep(interval)


def _start_media_tree_watcher():
    """Inicializa y arranca el hilo watcher que vigila el hash del media tree."""
    global _media_tree_watcher_thread, _media_tree_watcher_hash
    if _media_tree_watcher_thread is not None:
        return
    _media_tree_watcher_hash = _compute_media_tree_version()
    thread = threading.Thread(
        target=_media_tree_watcher_loop,
        args=(_MEDIA_TREE_WATCHER_INTERVAL,),
        daemon=True,
        name="media-tree-watcher",
    )
    _media_tree_watcher_thread = thread
    thread.start()



def _is_previewable_mime(mime_type: str | None) -> bool:
    """Indica si un MIME puede abrirse inline (imagen, texto, pdf, xml, html)."""
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

def _get_cached_neos() -> tuple[NeosResponse, str] | None:
    """Recupera la tupla (respuesta, hash) de la página 0 si aún no expiró."""
    entry = _neos_cache.get(_NEOS_CACHE_KEY)
    if not entry:
        return None
    if entry["expires_at"] <= timezone.now():
        _neos_cache.pop(_NEOS_CACHE_KEY, None)
        return None
    return cast(tuple[NeosResponse, str], (entry["response"], entry["hash"]))


def _set_cached_neos(response: NeosResponse, response_hash: str) -> None:
    """Guarda la respuesta y su hash con expiración para la página 0."""
    _neos_cache[_NEOS_CACHE_KEY] = {
        "response": response,
        "hash": response_hash,
        "expires_at": timezone.now() + _NEOS_CACHE_TTL,
    }


def _invalidate_neos_cache() -> None:
    """Elimina la caché de NEOS para forzar refetches futuros."""
    _neos_cache.pop(_NEOS_CACHE_KEY, None)
# Public Views


def publish_neos_update(hash_value: str | None = None) -> None:
    """Publica un refresh con resource=neos para notificar cambios en la página 0."""
    payload = {
        "action": "refresh",
        "timestamp": datetime.utcnow().isoformat(),
    }
    publish_media_update(payload, resource="neos", hash_value=hash_value)

def fetch_from_external_api(page: int) -> NeosResponse | Response:
    """
    Consulta la API de NASA para obtener asteroides paginados y normaliza su schema.
    Devuelve Response de error en caso de fallo HTTP o JSON malformado.
    """
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
        return {"neos": neos}
    except requests.RequestException as exc:
        logger.exception("Failed to fetch NEOS page %s: %s", page_number, exc)
        return _format_error(
            "No se pudo obtener los asteroides cercanos",
            status.HTTP_502_BAD_GATEWAY,
            code="NEO_FETCH_PAGE_FAILED",
        )

@api_view(["GET"])
def get_neos_by_page(request, page: int):
    """
    Endpoint que devuelve la página solicitada de NEOS, usa cache para page=0 y actualiza hashes.
    Publica hash cuando cambia el contenido y controla errores 400/502.
    """
    previous_entry: tuple[NeosResponse, str] | None = None
    cached_entry: tuple[NeosResponse, str] | None = None
    if page == _MIN_NEOS_PAGE:
        cached_entry = _get_cached_neos()
        if cached_entry:
            cached_response, cached_hash = cached_entry
            return JsonResponse(
                {
                    "neos": cached_response["neos"],
                    "tree_hash": cached_hash,
                    "cached": True,
                }
            )

    response = fetch_from_external_api(page)
    if isinstance(response, Response):
        return response

    if page == _MIN_NEOS_PAGE:
        previous_entry = cached_entry
        response_hash = compute_hash(response)
        _set_cached_neos(response, response_hash)
        if previous_entry is None or response_hash != previous_entry[1]:
            publish_neos_update(response_hash)

    return JsonResponse({"neos": response["neos"], "cached": False})

def save_neos(request):
    """
    Guarda en la base de datos los NEOS enviados y publica un refresh con resource=neos y hash.
    Maneja excepciones logueando errores y responde 200 con mensaje de éxito.
    """
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
        return _format_error(
            "Error al guardar los NEOs",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="NEO_SAVE_FAILED",
        )
    _invalidate_neos_cache()
    payload_hash = compute_hash({"neos": neos_data})
    publish_neos_update(payload_hash)
    return JsonResponse({"detail": "NEOs saved successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_facturas(request):
    """
    Lista las facturas registradas leyendo invoices_by_pdf.csv y usa cache TTL para evitar relecturas.
    Publica hash sólo cuando se invalida la cache por nuevos registros.
    """
    cached = _get_cached_invoices()
    if cached is not None:
        return Response(cached)

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
        records = _records_from_dataframe(df)
        _set_invoices_cache(records)
        return Response(records)
    except Exception as exc:
        logger.error("Failed to read invoices CSV %s: %s", invoices_path, exc)
        return _format_error(
            "No se pudo leer la lista de facturas",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INVOICES_READ_FAILED",
        )


def publish_media_update(
    payload: dict[str, Any],
    resource: str = "media",
    hash_value: str | None = None,
) -> None:
    """
    Publica un evento 'media.update' en el grupo media-tree con payload, resource y hash.
    Añade timestamp y registra en logs el channel layer utilizado.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning("No se pudo notificar media-tree: channel layer no disponible")
        return
    payload_data = dict(payload)
    payload_data["resource"] = resource
    if hash_value:
        payload_data["hash"] = hash_value
    logger.info(
        "Publishing via channel layer %s (%s) payload=%s",
        channel_layer.__class__.__name__,
        id(channel_layer),
        payload_data,
    )
    async_to_sync(channel_layer.group_send)(
        "media-tree",
        {
            "type": "media.update",
            "data": payload_data,
        },
    )


if _MEDIA_TREE_WATCHER_ENABLED:
    _start_media_tree_watcher()

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_to_media(request):
    """
    Recibe archivos multipart/form-data, los guarda en MEDIA_ROOT, genera registros históricos
    y publica resource=media con el hash actualizado del árbol.
    """
    try:
        target_dir = _sanitize_target_dir(request.data.get("target_dir"))
    except ValueError as exc:
        return _format_error(
            str(exc),
            status.HTTP_400_BAD_REQUEST,
            code="INVALID_MEDIA_PAYLOAD",
        )

    files = request.FILES.getlist("files") or request.FILES.getlist("pdfs")
    if not files:
        return _format_error(
            "No se ha enviado ningún archivo.",
            status.HTTP_400_BAD_REQUEST,
            code="FILES_REQUIRED",
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
        _invalidate_media_structure_cache()
        media_version = _compute_media_tree_version()
        payload = {
            "action": "refresh",
            "uploaded": len(saved_items),
            "target_dir": target_dir or "",
            "timestamp": datetime.utcnow().isoformat(),
        }
        publish_media_update(
            payload,
            resource="media",
            hash_value=media_version,
        )
        return Response(saved_items, status=status.HTTP_201_CREATED)
    except Exception as exc:
        logger.exception("Failed to upload media files: %s", exc)
        return _format_error(
            "No se pudo subir los archivos.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="MEDIA_UPLOAD_FAILED",
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leer_factura_pdf(request):
    """
    Procesa PDFs recibidos, extrae metadatos, los persiste y publica eventos de media/invoices.
    Responde con el detalle de cada intento (exitoso o con error).
    """
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
        return _format_error(
            "Falta el archivo PDF o el formato no es válido",
            status.HTTP_400_BAD_REQUEST,
            code="PDF_REQUIRED",
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
        invoice_records: list[dict[str, Any]] = []
        if successful_invoices:
            invoice_df = pd.DataFrame(successful_invoices)
            invoice_records = _persist_invoices(invoice_df)
        _invalidate_media_structure_cache()
        media_version = _compute_media_tree_version()
        timestamp = datetime.utcnow().isoformat()
        payload = {
            "action": "refresh",
            "uploaded": len(invoice_rows),
            "target_dir": "/Facturas/",
            "timestamp": timestamp,
        }
        publish_media_update(
            payload,
            resource="media",
            hash_value=media_version,
        )
        if invoice_records:
            invoice_hash = _compute_records_hash(invoice_records)
            publish_media_update(
                {
                    "action": "refresh",
                    "uploaded": len(successful_invoices),
                    "timestamp": timestamp,
                },
                resource="invoices",
                hash_value=invoice_hash,
            )
        return Response(invoice_rows)
    except Exception as exc:
        logger.exception("Failed to process invoices: %s", exc)
        return _format_error(
            "Error al procesar las facturas",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INVOICE_PROCESS_FAILED",
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_media_structure(request):
    """
    Devuelve la estructura completa de MEDIA_ROOT, usando cache para evitar recomputar cada vez.
    """
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists():
        return Response([], status=status.HTTP_200_OK)
    try:
        cached = _get_cached_media_structure()
        if cached is not None:
            tree, _ = cached
            return Response(tree)

        tree = _build_media_tree(media_root)
        version = _compute_media_tree_version()
        _set_media_structure_cache(tree, version)
        return Response(tree)
    except Exception as exc:
        logger.exception("Failed to build media structure: %s", exc)
        return _format_error(
            "Error al obtener la estructura de medios",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="MEDIA_STRUCTURE_FAILED",
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def media_tree_version(request):
    """
    Calcula y devuelve el hash actual del árbol de media; usa el cache si sigue vigente.
    """
    try:
        cached = _get_cached_media_structure()
        if cached is not None:
            _, version = cached
            return Response({"tree_version": version})
        version = _compute_media_tree_version()
        return Response({"tree_version": version})
    except Exception as exc:
        logger.exception("Failed to compute media tree version: %s", exc)
        return _format_error(
            "Error al calcular la versión de medios",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="MEDIA_VERSION_FAILED",
        )

def _parse_block_size(
    raw_block: str | None,
    default_block: int,
    max_block_size: int,
) -> tuple[int, Response | None]:
    """
    Valida y normaliza el tamaño de bloque deseado para descargas parciales.
    Retorna el block_size ajustado y un Response de error cuando los valores son inválidos.
    """
    if raw_block is None:
        return default_block, None
    try:
        block_size = int(raw_block)
    except ValueError:
        logger.debug("Invalid block_size %s, using default %d", raw_block, default_block)
        return default_block, None
    if block_size < 1:
        return default_block, None
    if block_size > max_block_size:
        return max_block_size, None
    return block_size, None

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_media_file(request):
    """
    Descarga un archivo dentro de MEDIA_ROOT con control de path, MIME y block_size seguro.
    Retorna FileResponse con block_size y Content-Disposition adecuados.
    """
    #Obtiene el parametro de la ruta del archivo a descargar, y comprueba que es válido
    relative_path = request.query_params.get("path")
    if not relative_path:
        return _format_error(
            "Se requiere el parámetro 'path'",
            status.HTTP_400_BAD_REQUEST,
            code="MISSING_PATH",
        )
    try:
        sanitized = _sanitize_relative_path(relative_path)
    except ValueError as exc:
        return _format_error(
            str(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_PATH",
        )

    file_path = Path(settings.MEDIA_ROOT) / sanitized
    if not file_path.exists() or not file_path.is_file():
        return _format_error(
            "Archivo no encontrado",
            status.HTTP_404_NOT_FOUND,
            code="FILE_NOT_FOUND",
        )

    #Comprobado que el archivo existe, comprueba si es visualizable por el navegadir
    mime_type, _ = guess_type(str(file_path))
    as_attachment = not _is_previewable_mime(mime_type)

    #Define el tamaño de bloque de la descarga
    raw_block = request.query_params.get("block_size")
    default_block = getattr(settings, "MEDIA_DOWNLOAD_BLOCK_SIZE", 64 * 1024)
    max_block_size = getattr(settings, "MEDIA_DOWNLOAD_BLOCK_SIZE_MAX", 512 * 1024)
    block_size, validation_error = _parse_block_size(
        raw_block,
        default_block,
        max_block_size,
    )
    if validation_error:
        return validation_error

    #Construimos la respuesta
    response = FileResponse(
        file_path.open("rb"),
        as_attachment=as_attachment,
        filename=file_path.name,
    )
    response.block_size = int(block_size)
    if mime_type:
        response["Content-Type"] = mime_type
    if not as_attachment:
        response["Content-Disposition"] = f'inline; filename="{file_path.name}"'

    response["Content-Length"] = file_path.stat().st_size

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_important_files(request):
    """
    Lista los registros guardados de archivos marcados como importantes (CSV).
    """
    try:
        df = _load_important_records()
        records = df.to_dict(orient="records")
        return Response(records)
    except Exception as exc:
        logger.exception("Failed to read important files: %s", exc)
        return _format_error(
            "Error al cargar archivos importantes",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="IMPORTANT_FILES_FAILED",
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_important_file(request):
    """
    Marca o desmarca un archivo como importante, actualiza el CSV y publica resource=media.
    Valida el relative_path y el flag antes de persistir.
    """
    relative_path = request.data.get("relative_path")
    important_flag = request.data.get("important")

    if not relative_path or not isinstance(relative_path, str):
        return _format_error(
            "Campo 'relative_path' obligatorio",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="RELATIVE_PATH_REQUIRED",
        )

    try:
        sanitized_path = _sanitize_relative_path(relative_path)
    except ValueError as exc:
        return _format_error(
            str(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_RELATIVE_PATH",
        )

    if important_flag is None:
        return _format_error(
            "Campo 'important' obligatorio",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="IMPORTANT_FLAG_REQUIRED",
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
        payload = {
            "action": "refresh",
            "updated_path": sanitized_path,
            "is_important": important_bool,
            "timestamp": datetime.utcnow().isoformat(),
        }
        _persist_important_records(df)
        _invalidate_media_structure_cache()
        media_version = _compute_media_tree_version()
        publish_media_update(
            payload,
            resource="media",
            hash_value=media_version,
        )
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
        return _format_error(
            "Error al marcar el archivo importante",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="IMPORTANT_FILE_TOGGLE_FAILED",
        )
