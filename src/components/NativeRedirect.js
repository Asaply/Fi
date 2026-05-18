"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NativeRedirect({ to }) {
    const router = useRouter();
    useEffect(() => {
        if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform()) {
            router.replace(to);
        }
    }, [router, to]);
    return null;
}
