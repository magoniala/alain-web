import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { horas } from "@/lib/arreta";

// Encuesta anónima de /arreta. ANONIMATO ESTRICTO: este endpoint no lee ni
// guarda IP, user-agent, cabeceras ni cookies; solo el cuerpo JSON. No hay rate
// limit por IP a propósito (exigiría guardar o mirar la IP). El antispam es un
// campo señuelo («web») que una persona no ve.

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const MAX = 1000;
const MAX_CUERPO = 20_000;
const PROBATU = ["bai", "oraindik-ez", "ez"];
const SAIOA_RE = /^[a-z0-9-]{1,60}$/;

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, MAX) : null;
}

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_CUERPO) return NextResponse.json({ error: "Demasiado grande." }, { status: 413 });
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error();
    b = j;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Señuelo relleno = bot. Se le dice que ha ido bien y no se guarda nada.
  if (typeof b.web === "string" && b.web.trim()) return NextResponse.json({ ok: true });

  // Desde el 7-nov la pregunta 1 son las horas de móvil (ahora y deseadas).
  // `probatu` solo se acepta por si alguien tiene abierta la versión anterior.
  const ordu_orain = horas(b.ordu_orain);
  const ordu_nahi = horas(b.ordu_nahi);
  const probatu = typeof b.probatu === "string" && PROBATU.includes(b.probatu) ? b.probatu : null;
  if (!probatu && (ordu_orain === null || ordu_nahi === null)) {
    return NextResponse.json({ error: "horas no válidas." }, { status: 400 });
  }

  const fila = {
    probatu,
    ordu_orain,
    ordu_nahi,
    ikasi: texto(b.ikasi),
    gustatu: texto(b.gustatu),
    gehitu: texto(b.gehitu),
    saioa: typeof b.saioa === "string" && SAIOA_RE.test(b.saioa) ? b.saioa : null,
  };

  const { error } = await supabase.from("arreta_respuestas").insert(fila);
  if (error) {
    console.error("arreta: error al guardar:", error.message);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
