import type { Metadata } from "next";
import { Gracias } from "../_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = { title: "Entrenatzaile", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const p = (await searchParams).p;
  return <Gracias idioma="eu" producto={Array.isArray(p) ? p[0] : p} />;
}
