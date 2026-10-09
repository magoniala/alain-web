import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "7 de cada 10 lumbagos recaen. Rompe el ciclo. — Entrenatzaile",
  description:
    "Protocolo de 32 páginas de Alain Zulaika para romper el ciclo del lumbago. Filtro de 30 segundos. Del día 1 al mes 3. 24,19 € IVA incluido.",
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/otra-vez-lumbago",
  },
  openGraph: {
    title: "7 de cada 10 lumbagos recaen. Rompe el ciclo.",
    description:
      "Protocolo de 32 páginas de Alain Zulaika para romper el ciclo del lumbago. Filtro de 30 segundos. Del día 1 al mes 3.",
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
