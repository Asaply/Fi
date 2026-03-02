import { Plus, User } from "lucide-react";
import "./Topbar.css";

export default function Topbar() {
    const currentMonth = new Date().toLocaleString("es-MX", { month: "long" });

    return (
        <header className="topbar">
            <div className="topbar-left">
                <span className="current-month">Dashboard / {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}</span>
            </div>

            <div className="topbar-right">
                <button className="btn-primary icon-btn">
                    <Plus size={18} />
                    <span>Nuevo</span>
                </button>
                <div className="profile-icon">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
