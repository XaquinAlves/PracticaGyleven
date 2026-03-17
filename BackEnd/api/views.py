import json
import os
from pathlib import Path
from typing import Any

import environ
import pyotp
from django.contrib.auth import authenticate, login, logout
from django.core.mail import send_mail
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))


ERROR_INVALID_JSON = 'INVALID_JSON_PAYLOAD'
ERROR_CREDENTIALS_REQUIRED = 'CREDENTIALS_REQUIRED'
ERROR_INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
ERROR_AUTH_REQUIRED = 'AUTH_REQUIRED'
ERROR_PASSWORD_REQUIRED = 'PASSWORD_REQUIRED'
ERROR_TOTP_SECRET_MISSING = 'TOTP_SECRET_MISSING'


def _format_error(
    detail: str,
    status_code: int = 400,
    code: str | None = None,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        'status': status_code,
        'detail': detail,
    }
    if code:
        payload['code'] = code
    if errors:
        payload['errors'] = errors
    return JsonResponse(payload, status=status_code)


def _json_error(
    message: str,
    status: int = 400,
    code: str | None = None,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    return _format_error(message, status, code=code, errors=errors)


def get_csrf(request):
    response = JsonResponse({'detail': 'CSRF cookie set'})
    response['X-CSRFToken'] = get_token(request)
    return response


@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido', code=ERROR_INVALID_JSON)

    username = data.get('username')
    password = data.get('password')

    if username is None or password is None:
        return _json_error(
            'Por favor introduzca usuario y contraseña.',
            code=ERROR_CREDENTIALS_REQUIRED,
        )

    user = authenticate(username=username, password=password)

    if user is None:
        return _json_error(
            'Credenciales inválidas.',
            code=ERROR_INVALID_CREDENTIALS,
        )

    login(request, user)
    return JsonResponse({'detail': 'Sesión iniciada con éxito.'})


def logout_view(request):
    if not request.user.is_authenticated:
        return _json_error(
            'No has iniciado sesión.',
            status=401,
            code=ERROR_AUTH_REQUIRED,
        )

    logout(request)
    return JsonResponse({'detail': 'Sesión cerrada con éxito.'})


@ensure_csrf_cookie
def session_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'isAuthenticated': False})

    return JsonResponse({'isAuthenticated': True})


def whoami_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'isAuthenticated': False})

    return JsonResponse({'username': request.user.username})


def change_password_view(request):
    if not request.user.is_authenticated:
        return _json_error(
            'No has iniciado sesión.',
            status=401,
            code=ERROR_AUTH_REQUIRED,
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido', code=ERROR_INVALID_JSON)

    new_password = data.get('password')

    if not new_password:
        return _json_error(
            'Por favor introduce una nueva contraseña.',
            code=ERROR_PASSWORD_REQUIRED,
        )

    request.user.set_password(new_password)
    request.user.save()
    return JsonResponse({'detail': 'Contraseña cambiada con éxito.'})


def send_recovery_email_view(request):
    if not request.user.is_authenticated:
        return _json_error(
            'No has iniciado sesión.',
            status=401,
            code=ERROR_AUTH_REQUIRED,
        )

    # En una aplicaci�n real se enviar�a un correo con un enlace de recuperaci�n.
    return JsonResponse({'detail': 'Se enviará un email de recuperación pronto.'})


def send_totp_token_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido', code=ERROR_INVALID_JSON)

    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return _json_error(
            'Por favor introduce usuario y contraseña.',
            code=ERROR_CREDENTIALS_REQUIRED,
        )

    user = authenticate(username=username, password=password)
    if user is None:
        return _json_error(
            'Credenciales inv�lidas.',
            code=ERROR_INVALID_CREDENTIALS,
        )

    varname = username.upper() + '_TOKEN'
    try:
        secret = env(varname)
    except Exception:
        return _json_error(
            'Falta el token TOTP en la configuración.',
            status=500,
            code=ERROR_TOTP_SECRET_MISSING,
        )

    if isinstance(secret, str):
        totp = pyotp.TOTP(secret, interval=60)
        send_mail(
            'Clave de un solo uso',
            'Aqu� tienes tu clave: ' + totp.now(),
            'xaquinalves@gmail.com',
            [user.email],
            fail_silently=False,
        )

    return JsonResponse({'detail': 'Clave enviada al correo.'})
