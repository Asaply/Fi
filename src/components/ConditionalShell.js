'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { TopbarProvider, TopbarLayout } from './TopbarContext';

export default function ConditionalShell({ children }) {
    const pathname = usePathname();

    if (pathname === '/login' || pathname === '/' || pathname.startsWith('/analyze')) {
        return <>{children}</>;
    }

    return (
        <div className="app-layout">
            <TopbarProvider>
                <Sidebar />
                <TopbarLayout>{children}</TopbarLayout>
                <BottomNav />
            </TopbarProvider>
        </div>
    );
}
