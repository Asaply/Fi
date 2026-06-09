"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NativeRedirect({ to }) {
    const [hiding, setHiding] = useState(false);
    const router = useRouter();
    useEffect(() => {
        if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform()) {
            setHiding(true);
            router.replace(to);
        }
    }, [router, to]);
    // Cover the page with black while router navigates
    return hiding ? <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} /> : null;
}
