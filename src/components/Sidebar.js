'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Wallet, Users, Target, Home, Activity, LayoutDashboard, TrendingUp } from "lucide-react";
import "./Sidebar.css";

const MODULES_KEY = 'fnce_modules';

function loadModules() {
    try {
        return JSON.parse(localStorage.getItem(MODULES_KEY) || '{}');
    } catch {
        return {};
    }
}

export default function Sidebar() {
    const pathname = usePathname();
    const [modules, setModules] = useState({
        trading: false,
        clientes: false,
        prospectos: false,
        airbnb: false,
    });

    useEffect(() => {
        const sync = () => {
            const m = loadModules();
            setModules(prev => ({ ...prev, ...m }));
        };
        sync();
        window.addEventListener('fnce-modules-changed', sync);
        return () => window.removeEventListener('fnce-modules-changed', sync);
    }, []);

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-icon-wrap">
                    <Image src="/nva-icon.svg" alt="NVA" width={34} height={34} />
                </div>
                <span className="brand-name">NVA</span>
            </div>

            <nav className="sidebar-nav">
                <Link href="/finanzas" className={`nav-item ${pathname === '/finanzas' ? 'active' : ''}`}>
                    <Home size={20} />
                    <span>Finanzas</span>
                </Link>
                <Link href="/portfolio" className={`nav-item ${pathname === '/portfolio' ? 'active' : ''}`}>
                    <Activity size={20} />
                    <span>Portfolio Health</span>
                </Link>
                <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
                    <Wallet size={20} />
                    <span>Resumen</span>
                </Link>

                {modules.trading && (
                    <Link href="/trading" className={`nav-item ${pathname === '/trading' ? 'active' : ''}`}>
                        <TrendingUp size={20} />
                        <span>Trading</span>
                    </Link>
                )}
                {modules.clientes && (
                    <Link href="/clientes" className={`nav-item ${pathname === '/clientes' ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Clientes</span>
                    </Link>
                )}
                {modules.prospectos && (
                    <Link href="/prospectos" className={`nav-item ${pathname === '/prospectos' ? 'active' : ''}`}>
                        <Target size={20} />
                        <span>Prospectos</span>
                    </Link>
                )}
                {modules.airbnb && (
                    <Link href="/airbnb" className={`nav-item ${pathname === '/airbnb' ? 'active' : ''}`}>
                        <Home size={20} />
                        <span>Airbnb</span>
                    </Link>
                )}
            </nav>
        </aside>
    );
}
