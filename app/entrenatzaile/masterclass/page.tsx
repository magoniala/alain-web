import type { Metadata } from "next";
import { Landing } from "./_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = {
  title: "Bizkarrak ez zaitzala gelditu — Entrenatzaileren bideozko masterclassa",
  description: "Bideozko masterclass bat, bizkarreko mina izan arren gorputz osoa entrenatzen jarraitzeko. 17 €, abenduaren 9ra arte aurrez salgai.",
};

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const f = (await searchParams).fase;
  return <Landing idioma="eu" faseVista={Array.isArray(f) ? f[0] : f} />;
}
