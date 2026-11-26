import type { Metadata } from "next";
import { Gracias } from "../_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = { title: "Entrenatzaile", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const q = await searchParams;
  const b = q.b ?? q.p;
  return <Gracias idioma="eu" bonus={Array.isArray(b) ? b[0] : b} />;
}
