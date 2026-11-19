import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CLAVE_RE, EMAIL_RE, LIMITES, NOTAS, PERMISOS, UUID_RE, esIdioma, esOrigen, eventoDe, type Nota, type Permiso } from "@/lib/opinion";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Opiniones de familias (/opinion-mirariak2026 y /opinion/<evento>).
//
// El formulario llama aquí en cada paso con TODO lo contestado hasta ese
// momento. La primera vez se crea la fila y se devuelven { id, clave }; las
// siguientes, con ese par, se actualiza la misma fila. Así da igual dónde lo
// dejen: lo contestado queda guardado. Si una llamada falla, la siguiente
// vuelve a mandarlo todo.

// Por debajo de esto no ha dado tiempo ni a leer la primera pregunta.
const MIN_MS = 800;

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

const falla = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return falla("JSON inválido.");
  }

  // Antispam: al bot se le contesta que todo ha ido bien y no se guarda nada.
  const abiertoEn = Number(b.abiertoEn);
  if ((typeof b.web === "string" && b.web.trim()) || !Number.isFinite(abiertoEn) || Date.now() - abiertoEn < MIN_MS) {
    console.warn("opinion: envío descartado por antispam");
    return NextResponse.json({ ok: true });
  }

  const ev = eventoDe(b.evento);
  if (!ev) return falla("Evento no válido.");
  if (!NOTAS.includes(b.nota as Nota)) return falla("Falta la primera respuesta.");

  const email = texto(b.email, LIMITES.email);
  if (email && !EMAIL_RE.test(email)) return falla("Email no válido.");

  let permiso: Permiso | null = null;
  if (b.permiso != null && b.permiso !== "") {
    if (!PERMISOS.includes(b.permiso as Permiso)) return falla("Permiso no válido.");
    permiso = b.permiso as Permiso;
  }
  const nombre = texto(b.nombre, LIMITES.nombre);
  // «Con nombre» sin nombre no es un permiso con nombre: se queda en sin nombre.
  if (permiso === "con_nombre" && !nombre) permiso = "sin_nombre";

  const datos = {
    nota: b.nota as Nota,
    texto_peques: texto(b.textoPeques, LIMITES.texto),
    texto_adulto: texto(b.textoAdulto, LIMITES.texto),
    palabra: texto(b.palabra, LIMITES.palabra),
    mejora_privada: texto(b.mejora, LIMITES.texto),
    permiso,
    // El nombre solo se guarda si ha pedido que salga.
    nombre: permiso === "con_nombre" ? nombre : null,
    email,
    terminado: b.terminado === true,
    idioma: esIdioma(b.idioma) ? b.idioma : "eu",
  };

  // Seguir con una respuesta ya empezada.
  if (b.id != null || b.clave != null) {
    if (typeof b.id !== "string" || !UUID_RE.test(b.id) || typeof b.clave !== "string" || !CLAVE_RE.test(b.clave)) return falla("Respuesta no válida.");
    const { data, error } = await supabase
      .from("opiniones_familias")
      .update({ ...datos, actualizado: new Date().toISOString() })
      .eq("id", b.id)
      .eq("clave", b.clave)
      .eq("evento", ev.clave)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("opinion: error actualizando:", error.message, error.code);
      return falla("Error al guardar.", 500);
    }
    if (!data) return falla("Respuesta no encontrada.", 404);
    return NextResponse.json({ ok: true, id: b.id, clave: b.clave });
  }

  const clave = randomBytes(18).toString("base64url");
  const { data, error } = await supabase
    .from("opiniones_familias")
    .insert({ ...datos, clave, evento: ev.clave, origen: esOrigen(b.origen) ? b.origen : null })
    .select("id")
    .single();
  if (error) {
    console.error("opinion: error guardando:", error.message, error.code);
    return falla("Error al guardar.", 500);
  }
  return NextResponse.json({ ok: true, id: data.id, clave });
}
