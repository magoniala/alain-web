import type { Metadata } from "next";
import { ESPALDA_HERO } from "./_content";

export const metadata: Metadata = {
  title: `${ESPALDA_HERO.titulo} — Entrenatzaile`,
  description: ESPALDA_HERO.subtitulo,
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/espalda",
  },
  openGraph: {
    title: `${ESPALDA_HERO.titulo} — Entrenatzaile`,
    description: ESPALDA_HERO.subtitulo,
    url: "https://entrenatzaile.alainzulaika.com/espalda",
    siteName: "Entrenatzaile",
    locale: "es_ES",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
