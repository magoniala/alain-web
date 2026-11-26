import type { Metadata } from "next";
import { Landing } from "./_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = {
  title: "Masterclassak aurrez salgai — Entrenatzaile",
  description: "Zer egin 50 urtetik aurrera entrenatzen hasteko · Bizkarrak ez zaitzala gelditu",
};

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const f = (await searchParams).fase;
  return <Landing idioma="eu" faseVista={Array.isArray(f) ? f[0] : f} />;
}
