import base64
import hashlib
import json
import os
import secrets
import shutil
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from channels.testing.live import ChannelsLiveServerTestCase


class DownloadMediaFileTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.temp_dir = Path(settings.BASE_DIR) / "test_media_root"
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
        cls.temp_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.override_settings_context = override_settings(
            MEDIA_ROOT=self.temp_dir,
            MEDIA_DOWNLOAD_BLOCK_SIZE=64 * 1024,
            MEDIA_DOWNLOAD_BLOCK_SIZE_MAX=128 * 1024,
        )
        self.override_settings_context.enable()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="tester", password="secret")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        self.override_settings_context.disable()

    def _create_media_file(self, name: str, content: bytes) -> Path:
        path = Path(self.temp_dir) / name
        path.write_bytes(content)
        return path

    def test_download_returns_content_length_and_inline_disposition_for_previewable_file(self):
        payload = b"hello world"
        file_path = self._create_media_file("example.txt", payload)
        url = reverse("media-download")
        response = self.client.get(url, {"path": "example.txt"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Length"], str(file_path.stat().st_size))
        self.assertTrue(response["Content-Disposition"].startswith('inline; filename="example.txt"'))
        body = b"".join(response.streaming_content)
        self.assertEqual(body, payload)

    def test_download_ignores_invalid_block_size_and_still_serves_file(self):
        payload = b"\x00" * 1024
        self._create_media_file("binary.dat", payload)
        url = reverse("media-download")
        response = self.client.get(url, {"path": "binary.dat", "block_size": "invalid"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Length"], str(len(payload)))


@override_settings(
    MEDIA_ROOT=Path(settings.BASE_DIR) / "test_media_root",
    CHANNEL_LAYERS={
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
    },
)
class MediaWebsocketTests(ChannelsLiveServerTestCase):
    host = "localhost"
    serve_static = False

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.temp_dir = Path(settings.BASE_DIR) / "test_media_root"
        cls.temp_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="ws-tester", password="secret")
        self.client = APIClient()
        self.assertTrue(self.client.login(username=self.user.username, password="secret"))
        self.client.get(reverse("media-tree"))
        self.http_session = requests.Session()
        parsed = urlparse(self.live_server_url)
        cookie_domain = parsed.hostname
        cookie_values = []
        for cookie_name in ("sessionid", "csrftoken"):
            value = self.client.cookies.get(cookie_name)
            if value and cookie_domain:
                cookie = requests.cookies.create_cookie(
                    name=cookie_name,
                    value=value,
                    domain=cookie_domain,
                    path="/",
                )
                self.http_session.cookies.set_cookie(cookie)
                cookie_values.append(f"{cookie_name}={value}")
        csrf_token = self.http_session.cookies.get("csrftoken")
        headers = {
            "Referer": self.live_server_url,
            "Origin": self.live_server_url,
        }
        if csrf_token:
            headers["X-CSRFToken"] = csrf_token
        if cookie_values:
            headers["Cookie"] = "; ".join(cookie_values)
        self.http_session.headers.update(headers)

    def _open_websocket(self):
        cookie_header = "; ".join(
            f"{cookie.name}={cookie.value}"
            for cookie in self.http_session.cookies
        )
        ws_client = SimpleWebSocketClient(
            host=self.host,
            port=self._port,
            path="/ws/media-updates/",
            origin=self.live_server_url,
            cookie_header=cookie_header or None,
        )
        ws_client.connect()
        return ws_client

    def _receive_json(self, ws_conn):
        try:
            raw = ws_conn.recv_text(timeout=10)
        except (socket.timeout, ConnectionError, RuntimeError) as exc:
            self.fail(f"WebSocket read failed: {exc}")
        return json.loads(raw)

    def _prepare_upload_payload(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
        try:
            tmp.write(b"media payload")
            tmp.flush()
            tmp.seek(0)
            return tmp
        finally:
            tmp.close()

    def test_upload_triggers_media_update(self):
        ws_conn = self._open_websocket()
        try:
            ready = self._receive_json(ws_conn)
            self.assertEqual(ready.get("action"), "ready")

            tmp = self._prepare_upload_payload()
            with open(tmp.name, "rb") as file_obj:
                upload_url = f"{self.live_server_url}{reverse('media-upload')}"
                response = self.http_session.post(
                    upload_url,
                    files={"files": file_obj},
                )
            os.remove(tmp.name)
            self.assertEqual(response.status_code, 201)
            message = self._receive_json(ws_conn)
            self.assertEqual(message.get("action"), "refresh")
        finally:
            ws_conn.close()


class SimpleWebSocketClient:
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __init__(
        self,
        host: str,
        port: int,
        path: str,
        origin: str,
        cookie_header: str | None = None,
        timeout: float = 5.0,
    ):
        self.host = host
        self.port = port
        self.path = path
        self.origin = origin
        self.cookie_header = cookie_header
        self.timeout = timeout
        self.sock: socket.socket | None = None
        self._pending = b""
        self._sec_key = ""

    def connect(self):
        self.sock = socket.create_connection((self.host, self.port))
        self.sock.settimeout(self.timeout)
        self._handshake()

    def close(self):
        if self.sock:
            try:
                self.sock.send(b"\x88\x00")
            except Exception:
                pass
            self.sock.close()
            self.sock = None

    def recv_text(self, timeout: float = 10.0) -> str:
        if not self.sock:
            raise RuntimeError("WebSocket client not connected")
        self.sock.settimeout(timeout)
        opcode, payload = self._recv_frame()
        if opcode == 8:
            raise RuntimeError("WebSocket closed by server")
        if opcode != 1:
            raise RuntimeError(f"Unexpected opcode {opcode}")
        return payload.decode("utf-8")

    def _handshake(self):
        if not self.sock:
            raise RuntimeError("Socket not initialized")
        self._sec_key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
        headers = [
            f"GET {self.path} HTTP/1.1",
            f"Host: {self.host}:{self.port}",
            "Upgrade: websocket",
            "Connection: Upgrade",
            f"Sec-WebSocket-Key: {self._sec_key}",
            "Sec-WebSocket-Version: 13",
            f"Origin: {self.origin}",
        ]
        if self.cookie_header:
            headers.append(f"Cookie: {self.cookie_header}")
        request = "\r\n".join(headers) + "\r\n\r\n"
        self.sock.send(request.encode("ascii"))
        response = self._recv_http_response()
        expected_accept = base64.b64encode(
            hashlib.sha1((self._sec_key + self.GUID).encode("ascii")).digest()
        ).decode("ascii")
        for line in response.splitlines():
            if line.lower().startswith("sec-websocket-accept:"):
                actual_accept = line.split(":", 1)[1].strip()
                if actual_accept != expected_accept:
                    raise RuntimeError("WebSocket handshake did not validate accept key")
                return
        raise RuntimeError("WebSocket handshake response missing accept header")

    def _recv_http_response(self) -> str:
        assert self.sock is not None
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("Connection closed during handshake")
            buf += chunk
        headers, _, tail = buf.partition(b"\r\n\r\n")
        self._pending = tail
        return headers.decode("ascii")

    def _recv_frame(self) -> tuple[int, bytes]:
        header = self._recv_exact(2)
        b1, b2 = header
        length = b2 & 0x7F
        if length == 126:
            length = int.from_bytes(self._recv_exact(2), "big")
        elif length == 127:
            length = int.from_bytes(self._recv_exact(8), "big")
        mask = bool(b2 & 0x80)
        if mask:
            mask_key = self._recv_exact(4)
        else:
            mask_key = None
        payload = self._recv_exact(length) if length else b""
        if mask_key:
            payload = bytes(
                p ^ mask_key[i % 4] for i, p in enumerate(payload)
            )
        return b1 & 0x0F, payload

    def _recv_exact(self, count: int) -> bytes:
        assert self.sock is not None
        parts = []
        remaining = count
        if self._pending:
            chunk = self._pending[:remaining]
            parts.append(chunk)
            self._pending = self._pending[len(chunk):]
            remaining -= len(chunk)
        while remaining:
            chunk = self.sock.recv(remaining)
            if not chunk:
                raise ConnectionError("Connection closed while reading frame")
            parts.append(chunk)
            remaining -= len(chunk)
        return b"".join(parts)
