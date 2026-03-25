import Sidebar from "~/common/Sidebar";
import ChangePass from "./ChangePass";
import Activate2FA from "./Activate2FA";

/**
 * Vista que combina el panel lateral con los formularios de configuración.
 */
export default function SettingsView() {
    return (
        <div className="row">
            <Sidebar />
            <ChangePass />
            <Activate2FA />
        </div>
    );
}
