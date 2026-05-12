'use client';
import { Wallet, Home, PieChart, PiggyBank } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import "./BottomNav.css";

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();

    const navItems = [
        { name: 'Resumen', path: '/dashboard', icon: Wallet },
        { name: 'Finanzas', path: '/finanzas', icon: Home },
        { name: 'Portfolio', path: '/portfolio', icon: PieChart },
        { name: 'Metas', path: '/budgets', icon: PiggyBank },
    ];

    return (
        <div className="bottom-nav-wrapper">
            <nav className="bottom-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.path === '/finanzas'
                        ? pathname === '/finanzas'
                        : item.path === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.path.split('?')[0]);

                    return (
                        <div
                            key={item.name}
                            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => router.push(item.path)}
                        >
                            <div className="icon-container">
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className="nav-label">{item.name}</span>
                        </div>
                    );
                })}

            </nav>
        </div>
    );
}
