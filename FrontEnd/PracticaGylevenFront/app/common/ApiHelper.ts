import Cookies from "js-cookie";

export default class ApiHelper {
    static API_URL = "http://localhost:8000";
    static CSRF = Cookies.get("csrftoken") || "";

    static getCSFR = () => {

    }
}