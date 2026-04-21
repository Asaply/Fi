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
  title: "FNCE",
  description: "Tus finanzas personales en un solo lugar.",
  manifest: "/manifest.json",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FNCE",
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
        <div className="app-layout">
          <ConditionalShell>{children}</ConditionalShell>
        </div>
        <Toaster position="bottom-right" theme="dark" richColors />
      </body>
    </html>
  );
}
