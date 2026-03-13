import Sidebar from "~/common/Sidebar";
import ChangePass from "./ChangePass";
import Activate2FA from "./Activate2FA";

export default function SettingsView() {
    return (
        <div className="row">
            <Sidebar />
            <ChangePass />
            <Activate2FA />
        </div>
    );
}
