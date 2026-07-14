import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Valoración gratuita para tu cambio físico — Entrenatzaile",
  description:
    "Un mapa personalizado para tu cambio físico: qué priorizar, qué evitar, qué esperar en 3 y en 12 meses. Valoración inicial gratuita para las primeras 10 personas.",
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/es",
    languages: {
      eu: "https://entrenatzaile.alainzulaika.com",
      es: "https://entrenatzaile.alainzulaika.com/es",
    },
  },
  openGraph: {
    title: "Valoración gratuita para tu cambio físico — Entrenatzaile",
    description:
      "Un mapa personalizado para tu cambio físico: qué priorizar, qué evitar, qué esperar en 3 y en 12 meses.",
    url: "https://entrenatzaile.alainzulaika.com/es",
    siteName: "Entrenatzaile",
    locale: "es_ES",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
