import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient


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
