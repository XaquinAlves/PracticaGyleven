# Formato estándar de errores API

Todas las respuestas erróneas que consume el frontend siguen este esquema para que podamos mostrar mensajes consistentes y documentar los servicios rápidamente:

- **status** *(número)*: código HTTP devuelto por el servidor.
- **detail** *(string)*: mensaje legible destinado a las vistas (lo que mostraría un ErrorAlert). Es obligatorio.
- **code** *(string, opcional)*: identificador lógico (p.ej. NEO_FETCH_FAILED) que usa el backend o la API para agrupar errores.
- **errors** *(objeto, opcional)*: lista de errores por campo ({ fieldName: [ mensaje, ...] }), útil para formularios validados.

El helper parseApiError en pp/common/apiError.ts encapsula la lógica de parseo; lo importan los servicios (MediaModel, InvoicesModel, NeosModel, etc.) antes de lanzar el Error en cada fetch.

## Códigos de error del backend de sesión

El backend en BackEnd/api/views.py añade un campo code consistente para que las vistas puedan mapearlo directamente contra la librería messageCatalog o detectar flujos específicos:

| Código | HTTP | Cuándo se devuelve |
| --- | --- | --- |
| INVALID_JSON_PAYLOAD | 400 | El cuerpo de la petición no era JSON válido.
| CREDENTIALS_REQUIRED | 400 | Faltaba usuario y/o contraseña en el login/2FA/reenvío de token.
| INVALID_CREDENTIALS | 401 | Las credenciales introducidas son erróneas en el login o el flujo 2FA.
| AUTH_REQUIRED | 401 | Se intentó acceder a un recurso protegido sin haber iniciado sesión (cerrar sesión, cambiar contraseña, recuperar contraseña, enviar token).
| PASSWORD_REQUIRED | 400 | El formulario de cambio de contraseña se envió sin el nuevo password.
| TOTP_SECRET_MISSING | 500 | El servidor no tiene configurado el secreto TOTP para generar el token de inicio de sesión.

Los servicios del frontend pueden usar este listado como referencia rápida cuando decidan mostrar ErrorAlert específicos o traducir códigos a mensajes localizados.
