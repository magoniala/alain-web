import type { Metadata } from "next";
import { ACOMPANAMIENTO_TEXTOS } from "@/lib/acompanamiento";

// noindex: se llega desde la newsletter, no por Google. Y es un formulario
// que pide datos de salud, que no debe aparecer suelto en una búsqueda.
export const metadata: Metadata = {
  title: `${ACOMPANAMIENTO_TEXTOS.titulo} — Entrenatzaile`,
  description: ACOMPANAMIENTO_TEXTOS.intro[0],
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/acompanamiento",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
