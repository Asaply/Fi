import { Inter, Geist_Mono } from "next/font/google";
import ConditionalShell from "@/components/ConditionalShell";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: {
    default: 'NVA — Finalmente, entiende tu dinero.',
    template: '%s | NVA',
  },
  description: 'NVA analiza tus estados de cuenta, gastos e inversiones y te explica tu situación financiera en segundos. Compatible con Nu, BBVA, Banorte, Santander y más.',
  metadataBase: new URL('https://nva.lat'),
  keywords: ['finanzas personales', 'estado de cuenta', 'análisis financiero', 'gastos', 'presupuesto', 'México', 'BBVA', 'Nu', 'Banorte', 'inversiones', 'portafolio'],
  authors: [{ name: 'NVA' }],
  creator: 'NVA',
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: 'https://nva.lat',
    siteName: 'NVA',
    title: 'NVA — Finalmente, entiende tu dinero.',
    description: 'Sube tu estado de cuenta y en 30 segundos tienes claridad total sobre tus finanzas. Compatible con todos los bancos de México.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NVA — Finanzas Personales' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NVA — Finalmente, entiende tu dinero.',
    description: 'Sube tu estado de cuenta y en 30 segundos tienes claridad total sobre tus finanzas.',
    images: ['/og-image.png'],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/nva-icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NVA",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          if (window.webkit && window.webkit.messageHandlers && window.location.pathname === '/') {
            document.documentElement.style.visibility = 'hidden';
            window.location.replace('/login');
          }
        `}} />
      </head>
      <body className={`${inter.variable} ${geistMono.variable}`}>
        <ConditionalShell>{children}</ConditionalShell>
        <Toaster position="bottom-right" theme="dark" richColors />
        <Analytics />
      </body>
    </html>
  );
}
