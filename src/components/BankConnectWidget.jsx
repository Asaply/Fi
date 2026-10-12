"use client";
// ⚠️ INACTIVO / DORMIDO — La conexión bancaria (Belvo) NO está habilitada en la
// app. Este componente no se renderiza en ninguna pantalla. Se conserva junto con
// las rutas src/app/api/belvo/* para una futura activación. Ver docs/BELVO_INTEGRATION.md.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

export default function BankConnectWidget({ onSuccess }) {
    const [isWidgetReady, setIsWidgetReady] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        // Checar si ya existe
        if (typeof window !== "undefined" && window.belvoSDK) {
            setIsWidgetReady(true);
            return;
        }

        // Forzar inyección nativa al DOM (evita bugs de next/script)
        const script = document.createElement("script");
        script.src = "https://cdn.belvo.io/belvo-widget-1-stable.js";
        script.async = true;
        script.onload = () => setIsWidgetReady(true);
        script.onerror = () => console.error("Fallo al cargar el script de Belvo");
        document.body.appendChild(script);

        return () => {
            // cleanup is generally not necessary for CDN scripts but good practice
        };
    }, []);

    const handleConnectBank = async () => {
        setIsConnecting(true);
        try {
            // 1. Conseguir el access token del backend
            const tokenResponse = await fetch(`${API_BASE}/api/belvo/token`);
            const tokenData = await tokenResponse.json();

            if (!tokenData.accessToken) {
                toast.error("Error obteniendo el token seguro de Belvo.");
                setIsConnecting(false);
                return;
            }

            // 2. Levantar el Widget de Belvo en pantalla
            if (typeof window !== "undefined" && window.belvoSDK) {
                window.belvoSDK.createWidget(tokenData.accessToken, {
                    // Opciones de configuración (idioma, etc)
                    locale: "es",
                    callback: async (link, institution) => {
                        // callback se activa cuando el usuario completa su inicio de sesión en el banco de forma exitosa.
                        console.log("Banco Conectado Exitosamente:", link, institution);
                        toast.success(`Cuenta de ${institution.name} vinculada con éxito. Bajando transacciones...`);
                        
                        // Enviamos el 'link_id' de vuelta al componente padre para que lo procese
                        if (onSuccess) {
                            onSuccess(link, institution);
                        }
                        setIsConnecting(false);
                    },
                    onExit: (data) => {
                        console.log("Widget closed by user", data);
                        setIsConnecting(false);
                    },
                    onEvent: (data) => {
                        console.log("Belvo Event:", data);
                    }
                }).build();
            } else {
                toast.error("El SDK de Belvo aún no ha cargado. Verifica tu conexión a internet.");
                setIsConnecting(false);
            }
        } catch (error) {
            console.error("Link Error:", error);
            toast.error("Ocurrió un error inicializando el entorno seguro.");
            setIsConnecting(false);
        }
    };

    return (
        <>
            <div id="belvo" />
            <button
                onClick={handleConnectBank}
                className="btn-cta-primary"
                disabled={isConnecting}
            >
                <Landmark size={18} />
                {isConnecting ? 'Conectando...' : 'Conectar Banco Automáticamente'}
            </button>
        </>
    );
}
