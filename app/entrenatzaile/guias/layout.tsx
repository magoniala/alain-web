import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Por qué tu espalda siempre vuelve a fallar — Entrenatzaile",
  description:
    "La guía honesta sobre el dolor lumbar recurrente: por qué se cura solo, por qué recae, y qué hacer para romper el ciclo. Gratis, junto a dos guías más.",
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/guias",
  },
  openGraph: {
    title: "Por qué tu espalda siempre vuelve a fallar — Entrenatzaile",
    description:
      "La guía honesta sobre el dolor lumbar recurrente: por qué se cura solo, por qué recae, y qué hacer para romper el ciclo.",
    url: "https://entrenatzaile.alainzulaika.com/guias",
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
