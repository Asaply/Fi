import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "IntegraWeb – Diseño Web para Negocios Locales en Chihuahua",
  description:
    "Creamos sitios web profesionales para negocios locales en Chihuahua, México. Demo gratis, entrega en 7-10 días y pago dividido. ¡Empieza hoy!",
  keywords: [
    "diseño web Chihuahua",
    "páginas web Chihuahua",
    "desarrollo web Chihuahua",
    "agencia web Chihuahua",
    "sitio web para negocios Chihuahua",
  ],
  authors: [{ name: "IntegraWeb", url: "https://integraweb.mx" }],
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL("https://integraweb.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://integraweb.vercel.app",
    title: "IntegraWeb – Diseño Web para Negocios en Chihuahua",
    description:
      "Sitios web profesionales para negocios locales en Chihuahua. Demo gratis, entrega en 7-10 días. ¡Cotiza ahora!",
    siteName: "IntegraWeb",
    locale: "es_MX",
    images: [
      {
        url: "/img/og-preview.jpg",
        width: 1200,
        height: 630,
        alt: "IntegraWeb – Agencia de Diseño Web en Chihuahua",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IntegraWeb – Diseño Web en Chihuahua",
    description:
      "Sitios web profesionales para negocios locales. Demo gratis y entrega en 7-10 días.",
    images: ["/img/og-preview.jpg"],
  },
};

export function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "IntegraWeb",
    description:
      "Agencia de diseño y desarrollo web para negocios locales en Chihuahua, México. Sitios profesionales con SEO local, entrega rápida y demo gratis.",
    url: "https://integraweb.vercel.app",
    telephone: "+52-614-487-1556",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Chihuahua",
      addressRegion: "Chihuahua",
      addressCountry: "MX",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 28.6353,
      longitude: -106.0889,
    },
    areaServed: {
      "@type": "City",
      name: "Chihuahua",
    },
    serviceType: [
      "Diseño Web",
      "Desarrollo Web",
      "SEO Local",
      "Mantenimiento Web",
      "Hosting",
    ],
    priceRange: "$$",
    openingHours: "Mo-Fr 09:00-18:00",
    sameAs: ["https://wa.me/526144871556"],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${inter.variable}`}>
        <LocalBusinessSchema />
        <div className="app-layout">
          <Sidebar />
          <div className="main-area">
            <Topbar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
