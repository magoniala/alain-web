import type { Metadata } from "next";
import { Desistimiento } from "../../../masterclass/_paginas";

export const metadata: Metadata = { title: "Formulario de desistimiento — Entrenatzaile", robots: { index: false, follow: false } };

export default function Page() {
  return <Desistimiento idioma="es" />;
}
