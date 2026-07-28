import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ARCHIVOS: Record<string, { file: string; nombre: string }> = {
  espalda: { file: "espalda.pdf", nombre: "Por que tu espalda siempre vuelve a fallar.pdf" },
  rodillas: { file: "rodillas.pdf", nombre: "Correr no te destroza las rodillas.pdf" },
  ereccion: { file: "ereccion.pdf", nombre: "Lo que nadie te cuenta sobre la ereccion despues de los 50.pdf" },
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
        "Content-Disposition": `attachment; filename="${entry.nombre}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Guía no disponible todavía." }, { status: 404 });
  }
}
