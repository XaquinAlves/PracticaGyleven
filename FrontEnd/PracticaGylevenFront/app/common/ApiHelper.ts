import Cookies from "js-cookie";
import { getCSRF as homeGetCSFR }  from "~/routes/home";
export default class ApiHelper {
    static API_URL = "http://localhost:8000";
    static CSRF = Cookies.get("csrftoken") || "";

    static getCSFR = () => {
        homeGetCSFR();
    }
}