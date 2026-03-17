import json
import os
from pathlib import Path

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


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': message}, status=status)


def get_csrf(request):
    response = JsonResponse({'detail': 'CSRF cookie set'})
    response['X-CSRFToken'] = get_token(request)
    return response


@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido')

    username = data.get('username')
    password = data.get('password')

    if username is None or password is None:
        return _json_error('Por favor introduzca usuario y contraseña.')

    user = authenticate(username=username, password=password)

    if user is None:
        return _json_error('Credenciales inválidas.')

    login(request, user)
    return JsonResponse({'detail': 'Sesión iniciada con éxito.'})


def logout_view(request):
    if not request.user.is_authenticated:
        return _json_error('No has iniciado sesión.')

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
        return _json_error('No has iniciado sesión.')

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido')

    new_password = data.get('password')

    if not new_password:
        return _json_error('Por favor introduce una nueva contraseña.')

    request.user.set_password(new_password)
    request.user.save()
    return JsonResponse({'detail': 'Contraseña cambiada con éxito.'})


def send_recovery_email_view(request):
    if not request.user.is_authenticated:
        return _json_error('No has iniciado sesión.')

    # En una aplicaci�n real se enviar�a un correo con un enlace de recuperaci�n.
    return JsonResponse({'detail': 'Se enviará un email de recuperación pronto.'})


def send_totp_token_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return _json_error('JSON inválido')

    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return _json_error('Por favor introduce usuario y contraseña.')

    user = authenticate(username=username, password=password)
    if user is None:
        return _json_error('Credenciales inv�lidas.')

    varname = username.upper() + '_TOKEN'
    try:
        secret = env(varname)
    except Exception:
        return _json_error('Falta el token TOTP en la configuración.', 500)

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
