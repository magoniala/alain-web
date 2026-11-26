import type { Metadata } from "next";
import { Acceso } from "../_paginas";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = { title: "Masterclass — Entrenatzaile", robots: { index: false, follow: false } };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Busqueda }) {
  const s = await searchParams;
  return <Acceso idioma="eu" e={uno(s.e)} t={uno(s.t)} />;
}
