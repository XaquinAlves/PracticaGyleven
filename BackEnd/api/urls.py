from django.urls import path

from . import views

urlpatterns = [
    path('csrf/', views.get_csrf, name='api-csrf'),
    path('session/', views.session_view, name='api-session'),
    path('whoami/', views.whoami_view, name='api-whoami'),
    path('get-totp/', views.send_totp_token_view, name="api-get-totp"),
]