'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { TopbarProvider, TopbarLayout } from './TopbarContext';

export default function ConditionalShell({ children }) {
    const pathname = usePathname();

    if (pathname === '/login') {
        return <>{children}</>;
    }

    return (
        <TopbarProvider>
            <Sidebar />
            <TopbarLayout>{children}</TopbarLayout>
        </TopbarProvider>
    );
}
