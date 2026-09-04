import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { PASOS_EMBUDO } from "@/lib/landing-eventos";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Una fila de la vista espalda_embudo: un día, un anuncio, y cuántas
// sesiones alcanzaron cada paso.
interface FilaEmbudo {
  dia: string;
  utm_content: string;
  sesiones: number;
  submit_error: number;
  [paso: string]: string | number;
}

interface Paso {
  clave: string;
  etiqueta: string;
  sesiones: number;
  pctTotal: number | null;
  caida: number | null;
}

function num(fila: FilaEmbudo, clave: string): number {
  if (clave === "page_view") return fila.sesiones;
  const v = fila[clave];
  return typeof v === "number" ? v : 0;
}

// El embudo de un conjunto de filas: cuánta gente llega a cada paso, qué
// porcentaje del total es, y cuánta se ha caído desde el paso anterior.
function embudo(filas: FilaEmbudo[]): Paso[] {
  const total = filas.reduce((acc, f) => acc + f.sesiones, 0);
  let anterior: number | null = null;

  return PASOS_EMBUDO.map(({ clave, etiqueta }) => {
    const sesiones = filas.reduce((acc, f) => acc + num(f, clave), 0);
    const paso: Paso = {
      clave,
      etiqueta,
      sesiones,
      pctTotal: total > 0 ? Math.round((1000 * sesiones) / total) / 10 : null,
      caida: anterior && anterior > 0 ? Math.round(1000 - (1000 * sesiones) / anterior) / 10 : null,
    };
    anterior = sesiones;
    return paso;
  });
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const landing = url.searchParams.get("landing") || "espalda";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Faltan fechas." }, { status: 400 });
  }

  // La vista ya viene agregada por día y anuncio, así que lo que llega
  // aquí son decenas de filas, no miles de eventos.
  const { data, error } = await supabase
    .from("espalda_embudo")
    .select("*")
    .eq("landing", landing)
    .gte("dia", from)
    .lte("dia", to);

  if (error) {
    console.error("embudo query error:", error);
    return NextResponse.json({ error: "Error consultando el embudo." }, { status: 500 });
  }

  const filas = (data ?? []) as FilaEmbudo[];

  // Por anuncio: el que más tráfico trae, primero.
  const porContent = new Map<string, FilaEmbudo[]>();
  for (const f of filas) {
    const k = f.utm_content || "(sin dato)";
    porContent.set(k, [...(porContent.get(k) ?? []), f]);
  }
  const anuncios = [...porContent.entries()]
    .map(([utmContent, fs]) => ({ utmContent, pasos: embudo(fs) }))
    .sort((a, b) => b.pasos[0].sesiones - a.pasos[0].sesiones);

  // Por día: la línea gruesa, para ver si algo se rompió un día concreto.
  const porDia = new Map<string, FilaEmbudo[]>();
  for (const f of filas) porDia.set(f.dia, [...(porDia.get(f.dia) ?? []), f]);
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, fs]) => ({
      fecha,
      sesiones: fs.reduce((a, f) => a + f.sesiones, 0),
      formStart: fs.reduce((a, f) => a + num(f, "form_start"), 0),
      submitOk: fs.reduce((a, f) => a + num(f, "submit_ok"), 0),
    }));

  return NextResponse.json(
    {
      total: embudo(filas),
      errores: filas.reduce((a, f) => a + (f.submit_error || 0), 0),
      anuncios,
      dias,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
