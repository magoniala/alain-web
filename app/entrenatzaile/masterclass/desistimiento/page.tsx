import type { Metadata } from "next";
import { Desistimiento } from "../_paginas";

export const metadata: Metadata = { title: "Atzera egiteko formularioa — Entrenatzaile", robots: { index: false, follow: false } };

export default function Page() {
  return <Desistimiento idioma="eu" />;
}
