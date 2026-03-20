from django.urls import path

from . import views

urlpatterns = [
    path('csrf/', views.get_csrf, name='api-csrf'),
    path('get-totp/', views.send_totp_token_view, name="api-get-totp"),
]