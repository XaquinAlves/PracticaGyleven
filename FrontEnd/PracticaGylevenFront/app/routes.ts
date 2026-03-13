import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@react-router/dev/routes";

export default [
    layout("./protected/RedirectAuthenticated.tsx", [
        route("/login", "./session/Login.tsx"),
        route("/login-2fa", "./session/Login2FA.tsx"),
        route("/recover-pass", "./session/RecoverPass.tsx"),
        route("/accounts/password/reset/key/:key/", "./session/ResetPass.tsx"),
    ]),

    layout("./session/SessionGate.tsx", [
        index("routes/home.tsx"),
        route("/inicio", "./Inicio.tsx"),
        route("/neos", "./neos/NeosView.tsx"),
        route("/settings", "./settings/SettingsView.tsx"),
        route("/invoices", "./imports/invoices/InvoicesView.tsx"),
        route("/media", "./media/MediaView.tsx"),
    ]),
] satisfies RouteConfig;
