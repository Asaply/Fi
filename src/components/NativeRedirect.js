"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NativeRedirect({ to }) {
    const [isNative, setIsNative] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform()) {
            setIsNative(true);
            window.location.replace(to);
        }
    }, [to]);

    // Hide page content while redirecting in native app
    if (isNative) {
        return <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999 }} />;
    }
    return null;
}
