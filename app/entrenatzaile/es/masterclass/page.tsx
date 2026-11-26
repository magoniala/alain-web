import type { Metadata } from "next";
import { Landing } from "../../masterclass/_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = {
  title: "Que la espalda no te pare — masterclass en vídeo de Entrenatzaile",
  description: "Una masterclass en vídeo para seguir entrenando todo el cuerpo aunque tengas dolor de espalda. 17 €, en preventa hasta el 9 de diciembre.",
};

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const f = (await searchParams).fase;
  return <Landing idioma="es" faseVista={Array.isArray(f) ? f[0] : f} />;
}
