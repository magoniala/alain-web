import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { ESPALDA_HERO } from "./_content";

// Lora solo para los titulares de esta landing (y de la página de gracias,
// que cuelga de este layout). El resto del sitio sigue con sus fuentes.
const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

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
  return <div className={lora.variable}>{children}</div>;
}
