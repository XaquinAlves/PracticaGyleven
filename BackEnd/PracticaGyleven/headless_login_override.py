from http import HTTPStatus

from allauth.headless.account import views as headless_account_views
from allauth.headless.internal.restkit.response import APIResponse


class GenericLoginView(headless_account_views.LoginView):
    def handle_invalid_input(self, input):
        return APIResponse(
            self.request,
            status=HTTPStatus.BAD_REQUEST,
            errors=[
                {
                    "message": "Usuario y/o contraseña incorrectos.",
                    "code": "INVALID_CREDENTIALS",
                }
            ],
        )


# Replace the headless login view with the generic version before URLs are built.
headless_account_views.LoginView = GenericLoginView
