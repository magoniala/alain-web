import type { Metadata } from "next";
import { Lora } from "next/font/google";
import Consentimiento from "../../_components/Consentimiento";
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
  return (
    <div className={lora.variable}>
      {children}
      {/* La única página que pregunta: es por donde entra el tráfico de
          anuncios. Quien decide aquí no vuelve a ver el banner en el resto
          del embudo. */}
      <Consentimiento pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} preguntar />
    </div>
  );
}
