import json

from django.contrib.auth import authenticate, login, logout, views as auth_views
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST
from django.core.mail import send_mail
from pathlib import Path
import environ
import os
import pyotp

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

def get_csrf(request):
    response = JsonResponse({'detail': 'CSRF cookie set'})
    response['X-CSRFToken'] = get_token(request)
    return response


@require_POST
def login_view(request):
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')

    if username is None or password is None:
        return JsonResponse({'detail': 'Por favor introduzca usuario y contraseña.'}, status=400)

    user = authenticate(username=username, password=password)

    if user is None:
        return JsonResponse({'detail': 'Credenciales invalidas.'}, status=400)

    login(request, user)
    return JsonResponse({'detail': 'Sesión iniciada con exito.'})


def logout_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'No has iniciado sesión.'}, status=400)

    logout(request)
    return JsonResponse({'detail': 'Sesión cerradda con éxito.'})


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
        return JsonResponse({'detail': 'No has iniciado sesión.'}, status=400)

    data = json.loads(request.body)
    new_password = data.get('password')

    if new_password is None:
        return JsonResponse({'detail': 'Por favor introduce una nueva contraseña.'}, status=400)

    request.user.set_password(new_password)
    request.user.save()
    return JsonResponse({'detail': 'Contraseña cambiada con exito.'})

def send_recovery_email_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'No has iniciado sesión.'}, status=400)

    # In a real application, this would send an email with a recovery link
def send_totp_token_view(request):
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')
    user = authenticate(username=username, password=password)
    if user is None:
        return JsonResponse({'detail': 'Invalid credentials.'}, status=400)

    varname = username.upper() + "_TOKEN"
    secret = env(varname)
    if (type(secret) == str):
        totp = pyotp.TOTP(secret, interval=60);
        send_mail(
            "Clave de un solo uso",
            "Aquí tienes tu clave: " + totp.now(),
            "xaquinalves@gmail.com",
            [user.email],
            fail_silently=False
        )

    return JsonResponse({'Mensaje': "Clave enviada al correo"})