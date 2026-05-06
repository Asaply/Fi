import { Inter, Geist_Mono } from "next/font/google";
import ConditionalShell from "@/components/ConditionalShell";
import { Toaster } from "sonner";
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
  title: "NVA - Tu dinero en claro",
  description: "Sube tu estado de cuenta y descubre en que gastas en segundos.",
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${geistMono.variable}`}>
        <ConditionalShell>{children}</ConditionalShell>
        <Toaster position="bottom-right" theme="dark" richColors />
      </body>
    </html>
  );
}
