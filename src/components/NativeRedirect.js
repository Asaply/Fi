"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NativeRedirect({ to }) {
    const router = useRouter();
    useEffect(() => {
        const isNative = window.Capacitor?.isNativePlatform();
        if (isNative) {
            router.replace(to);
        } else {
            // Web: reveal the page content
            document.getElementById('native-gate')?.remove();
        }
    }, [router, to]);
    return null;
}
