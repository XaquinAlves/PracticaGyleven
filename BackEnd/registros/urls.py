
from django.urls import path

from registros import views

urlpatterns = [
    path('neos/<int:page>', views.get_neos_by_page, name='get-neos-page'),
    path('neos/save/', views.save_neos, name='save-neos'),
    path("imports/facturas", views.leer_factura_pdf, name="leer-facturas"),
    path(
        "imports/facturas/list/",
        views.list_facturas,
        name="listar-facturas",
    ),
    path("media-tree/", views.list_media_structure, name="media-tree"),
    path("media/upload/", views.upload_to_media, name="media-upload"),
]
