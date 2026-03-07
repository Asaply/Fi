import Link from "next/link";
import { LayoutDashboard, Users, Target, CircleDollarSign } from "lucide-react";
import "./Sidebar.css";

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <CircleDollarSign className="brand-icon" size={24} />
                <span className="brand-name">FNCE</span>
            </div>

            <nav className="sidebar-nav">
                <Link href="/finanzas" className="nav-item">
                    <LayoutDashboard size={20} />
                    <span>Finanzas</span>
                </Link>
                <Link href="/clientes" className="nav-item">
                    <Users size={20} />
                    <span>Clientes</span>
                </Link>
                <Link href="/prospectos" className="nav-item">
                    <Target size={20} />
                    <span>Prospectos</span>
                </Link>
            </nav>
        </aside>
    );
}
