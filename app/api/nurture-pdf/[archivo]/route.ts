import { FICHA_ESPALDA_TITULO } from "@/lib/entrenatzaile-formularios";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// El nombre del archivo va sin acentos a propósito: Content-Disposition con
// caracteres no ASCII entre comillas no es válido según la norma y algunos
// clientes lo destrozan. El título con acentos es el de la landing.
const sinAcentos = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// El nombre se resuelve al servir, no al cargar el módulo: así no depende de
// en qué orden se hayan evaluado los módulos.
const ARCHIVOS: Record<string, { file: string; nombre: () => string }> = {
  espalda: { file: "espalda.pdf", nombre: () => `${sinAcentos(FICHA_ESPALDA_TITULO)}.pdf` },
  rodillas: { file: "rodillas.pdf", nombre: () => "Correr no te destroza las rodillas.pdf" },
  ereccion: {
    file: "ereccion.pdf",
    nombre: () => "Lo que nadie te cuenta sobre la ereccion despues de los 50.pdf",
  },
};

export async function GET(_req: Request, ctx: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await ctx.params;
  const entry = ARCHIVOS[archivo];
  if (!entry) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  try {
    const data = await readFile(join(process.cwd(), "assets/nurture-pdfs", entry.file));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${entry.nombre()}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Guía no disponible todavía." }, { status: 404 });
  }
}
