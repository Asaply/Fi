'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Target, Home, LineChart, Activity, Wallet } from "lucide-react";
import "./Sidebar.css";

const showBeta = process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES === 'true';

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-icon-wrap">
                    <Image src="/nva-icon.svg" alt="NVA" width={18} height={18} />
                </div>
                <span className="brand-name">NVA</span>
            </div>

            <nav className="sidebar-nav">
                <Link href="/finanzas" className={`nav-item ${pathname === '/finanzas' ? 'active' : ''}`}>
                    <Wallet size={20} />
                    <span>Finanzas</span>
                </Link>
                <Link href="/trading" className={`nav-item ${pathname === '/trading' ? 'active' : ''}`}>
                    <LineChart size={20} />
                    <span>Trading</span>
                </Link>
                <Link href="/portfolio" className={`nav-item ${pathname === '/portfolio' ? 'active' : ''}`}>
                    <Activity size={20} />
                    <span>Portfolio Health</span>
                </Link>
                <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Resumen</span>
                </Link>

                {showBeta && (
                    <>
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
                    </>
                )}
            </nav>
        </aside>
    );
}
