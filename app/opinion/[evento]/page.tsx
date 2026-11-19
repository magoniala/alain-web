import type { Metadata } from "next";
import { eventoDe } from "@/lib/opinion";
import { PaginaOpinion, type Busqueda } from "../pagina";

type Params = Promise<{ evento: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ev = eventoDe((await params).evento);
  return {
    title: { absolute: `${ev?.nombre ?? "Alain Zulaika"} — Zure iritzia · Tu opinión` },
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Busqueda }) {
  return <PaginaOpinion evento={(await params).evento} searchParams={searchParams} />;
}
