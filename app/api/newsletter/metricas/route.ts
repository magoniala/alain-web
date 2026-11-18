import { NextResponse } from "next/server";
import { actualizarMetricas } from "@/lib/newsletter-metricas";

// Pide a Mailjet aperturas, clics y bajas de cada mail diario y las guarda en
// newsletter_campanas.metricas. La llama la tarea programada del bucle de
// aprendizaje (domingo por la noche) con Authorization: Bearer <CRON_SECRET>.
// ?dias=N&saltar=M → mails enviados entre hace N y hace M días (por defecto
// 21 y 0). El histórico se pide por tramos de ~30 días para no pasar de 60 s.
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const dias = Math.min(Math.max(Number(params.get("dias")) || 21, 1), 400);
  const saltar = Math.min(Math.max(Number(params.get("saltar")) || 0, 0), dias);
  try {
    return NextResponse.json(await actualizarMetricas(dias, saltar));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
