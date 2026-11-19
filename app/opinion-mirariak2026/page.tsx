import type { Metadata } from "next";
import { PaginaOpinion, type Busqueda } from "../opinion/pagina";

// noindex: se llega por el cartel de la salida, el mail a las reservas o de
// viva voz, no por Google.
export const metadata: Metadata = {
  title: { absolute: "Mirariak 2026 — Zure iritzia · Tu opinión" },
  robots: { index: false, follow: false },
};

export default function Page({ searchParams }: { searchParams: Busqueda }) {
  return <PaginaOpinion evento="mirariak2026" searchParams={searchParams} />;
}
