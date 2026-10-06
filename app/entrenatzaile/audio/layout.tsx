import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { AUDIO_TEXTOS } from "@/lib/audio-formularios";

// Lora solo para los titulares de esta página, igual que en /espalda.
const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

// noindex: a esta página no se llega por Google, se llega desde el kit. Que
// no la indexe evita además que un formulario de datos de salud aparezca
// suelto en una búsqueda, sin el contexto de quién lo manda ni para qué.
export const metadata: Metadata = {
  title: `${AUDIO_TEXTOS.titulo} — Entrenatzaile`,
  description: AUDIO_TEXTOS.intro[0],
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/audio",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={lora.variable}>{children}</div>;
}
