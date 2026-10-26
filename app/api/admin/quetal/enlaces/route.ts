import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { FECHA_RE, LIMITES, esIdioma, esTipo } from "@/lib/quetal";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const CAMPOS = "id, token, tipo_evento, nombre_evento, fecha_evento, entidad, contacto_nombre, idioma, created_at, usado, respondido_at";

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.from("feedback_links").select(CAMPOS).order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enlaces: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

// Un enlace por evento. El token son 18 bytes aleatorios en base64url (24
// caracteres): no se puede adivinar ni recorrer.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const txt = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, LIMITES.corto) : "");
  const nombre_evento = txt(b.nombre_evento);
  const entidad = txt(b.entidad);
  const contacto_nombre = txt(b.contacto_nombre);
  const fecha = typeof b.fecha_evento === "string" ? b.fecha_evento : "";

  if (!esTipo(b.tipo_evento)) return NextResponse.json({ error: "Elige el tipo de evento." }, { status: 400 });
  if (!esIdioma(b.idioma)) return NextResponse.json({ error: "Idioma no válido." }, { status: 400 });
  if (!nombre_evento || !entidad || !contacto_nombre) return NextResponse.json({ error: "Faltan el evento, la entidad o el nombre." }, { status: 400 });
  if (fecha && (!FECHA_RE.test(fecha) || Number.isNaN(Date.parse(fecha)))) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });

  const { data, error } = await supabase
    .from("feedback_links")
    .insert({
      token: randomBytes(18).toString("base64url"),
      tipo_evento: b.tipo_evento,
      nombre_evento,
      fecha_evento: fecha || null,
      entidad,
      contacto_nombre,
      idioma: b.idioma,
    })
    .select(CAMPOS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enlace: data });
}
