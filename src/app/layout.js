import { Inter } from "next/font/google";
import ConditionalShell from "@/components/ConditionalShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "FNCE",
  description: "Internal agency management dashboard",
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
    <html lang="en">
      <body className={`${inter.variable}`}>
        <div className="app-layout">
          <ConditionalShell>{children}</ConditionalShell>
        </div>
      </body>
    </html>
  );
}
