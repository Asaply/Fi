'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Target, CircleDollarSign, Home, LayoutTemplate, LineChart } from "lucide-react";
import { useTopbar } from "./TopbarContext";
import "./Sidebar.css";

export default function Sidebar() {
    const pathname = usePathname();
    const { customDashboards } = useTopbar();

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <CircleDollarSign className="brand-icon" size={24} />
                <span className="brand-name">FNCE</span>
            </div>

            <nav className="sidebar-nav">
                <Link href="/finanzas" className={`nav-item ${pathname === '/finanzas' ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Finanzas</span>
                </Link>
                <Link href="/clientes" className={`nav-item ${pathname === '/clientes' ? 'active' : ''}`}>
                    <Users size={20} />
                    <span>Clientes</span>
                </Link>
                <Link href="/prospectos" className={`nav-item ${pathname === '/prospectos' ? 'active' : ''}`}>
                    <Target size={20} />
                    <span>Prospectos</span>
                </Link>
                <Link href="/airbnb" className={`nav-item ${pathname === '/airbnb' ? 'active' : ''}`}>
                    <Home size={20} />
                    <span>Airbnb</span>
                </Link>
                <Link href="/trading" className={`nav-item ${pathname === '/trading' ? 'active' : ''}`}>
                    <LineChart size={20} />
                    <span>Trading</span>
                </Link>

                {customDashboards && customDashboards.length > 0 && (
                    <div className="sidebar-section">
                        <span className="section-title">Mis Dashboards</span>
                        {customDashboards.map(dashboard => (
                            <Link
                                key={dashboard.id}
                                href={`/dashboards/${dashboard.id}`}
                                className={`nav-item ${pathname === `/dashboards/${dashboard.id}` ? 'active' : ''}`}
                            >
                                <LayoutTemplate size={20} />
                                <span>{dashboard.name}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </nav>
        </aside>
    );
}
