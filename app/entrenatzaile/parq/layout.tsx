import type { Metadata } from "next";
import { PARQ_TEXTOS } from "@/lib/parq";

// noindex: a esta página se llega por un enlace que mando yo, no por Google.
// Como en /audio, evita además que un formulario de datos de salud aparezca
// suelto en una búsqueda.
export const metadata: Metadata = {
  title: `${PARQ_TEXTOS.titulo} — Entrenatzaile`,
  description: PARQ_TEXTOS.intro[0],
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/parq",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
