import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "7 de cada 10 lumbagos recaen. Rompe el ciclo. — Entrenatzaile",
  description:
    "Cinco recursos de Alain Zulaika para romper el ciclo del lumbago: el protocolo del día 1 al mes 3, la guía de los primeros días, dos registros y la infografía. 24,19 € IVA incluido.",
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/otra-vez-lumbago",
  },
  openGraph: {
    title: "7 de cada 10 lumbagos recaen. Rompe el ciclo.",
    description:
      "Cinco recursos de Alain Zulaika para romper el ciclo del lumbago: protocolo del día 1 al mes 3, registros e infografía.",
    url: "https://entrenatzaile.alainzulaika.com/otra-vez-lumbago",
    siteName: "Entrenatzaile",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/otra-vez-lumbago/kit.png", width: 1536, height: 864 }],
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
