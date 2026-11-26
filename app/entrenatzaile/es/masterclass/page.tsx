import type { Metadata } from "next";
import { Landing } from "../../masterclass/_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = {
  title: "Masterclasses en preventa — Entrenatzaile",
  description: "Por dónde empezar a entrenar a partir de los 50 · Que la espalda no te pare",
};

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const f = (await searchParams).fase;
  return <Landing idioma="es" faseVista={Array.isArray(f) ? f[0] : f} />;
}
