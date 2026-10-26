import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-ses";
import {
  EMAIL_RE,
  FECHA_RE,
  LIMITES,
  PERMISOS,
  PREGUNTAS_TIPO,
  REPETIR,
  REPETIR_CORTO,
  TIPO_CORTO,
  TOKEN_RE,
  VALORACIONES,
  esIdioma,
  esTipo,
  preguntaVisible,
  type Permiso,
  type Repetir,
  type TipoEvento,
} from "@/lib/quetal";
import { QUETAL_TEXTOS } from "@/lib/quetal-textos";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Por debajo de esto no lo ha rellenado una persona: son seis pasos.
const MIN_MS = 3000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function falla(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return falla("JSON inválido.");
  }

  // Antispam. Al bot se le contesta que todo ha ido bien, para que no
  // aprenda a esquivarlo; no se guarda nada.
  const abiertoEn = Number(b.abiertoEn);
  if ((typeof b.web === "string" && b.web.trim()) || !Number.isFinite(abiertoEn) || Date.now() - abiertoEn < MIN_MS) {
    console.warn("quetal: envío descartado por antispam");
    return NextResponse.json({ ok: true });
  }

  const idioma = esIdioma(b.idioma) ? b.idioma : "eu";

  // Enlace. Con token, el tipo de evento lo manda el enlace, no el cliente.
  type Link = { id: string; tipo_evento: TipoEvento; usado: boolean };
  let link: Link | null = null;
  if (b.token != null) {
    if (typeof b.token !== "string" || !TOKEN_RE.test(b.token)) return falla("Enlace no válido.");
    const { data, error } = await supabase.from("feedback_links").select("id, tipo_evento, usado").eq("token", b.token).maybeSingle();
    if (error) {
      console.error("quetal: error leyendo el enlace:", error.message);
      return falla("Error al leer el enlace.", 500);
    }
    if (!data) return falla("Enlace no válido.");
    if (data.usado) return falla("Ya respondido.", 409);
    link = data as Link;
  }

  const tipo = link?.tipo_evento ?? b.tipo;
  if (!esTipo(tipo)) return falla("Tipo de evento no válido.");

  const nombre = texto(b.nombre, LIMITES.corto);
  const entidad = texto(b.entidad, LIMITES.corto);
  const nombreEvento = texto(b.nombreEvento, LIMITES.corto);
  const testimonio = texto(b.testimonio, LIMITES.largo);
  if (!nombre || !entidad || !nombreEvento || !testimonio) return falla("Faltan campos obligatorios.");

  let fecha: string | null = null;
  if (b.fecha != null && b.fecha !== "") {
    if (typeof b.fecha !== "string" || !FECHA_RE.test(b.fecha) || Number.isNaN(Date.parse(b.fecha))) return falla("Fecha no válida.");
    fecha = b.fecha;
  }
  if (!link && !fecha) return falla("Falta la fecha.");

  const email = texto(b.email, LIMITES.email);
  if (email && !EMAIL_RE.test(email)) return falla("Email no válido.");

  const nps = b.nps;
  if (typeof nps !== "number" || !Number.isInteger(nps) || nps < 0 || nps > 10) return falla("NPS no válido.");

  const permiso = b.permiso as Permiso;
  if (!PERMISOS.includes(permiso)) return falla("Permiso no válido.");
  if (b.privacidad !== true) return falla("Falta aceptar la privacidad.");

  let repetir: Repetir | null = null;
  if (b.repetir != null) {
    if (!REPETIR.includes(b.repetir as Repetir)) return falla("Valor de repetir no válido.");
    repetir = b.repetir as Repetir;
  }

  const vals = (b.valoraciones ?? {}) as Record<string, unknown>;
  const valoraciones: Record<string, number | null> = {};
  for (const k of VALORACIONES) {
    const v = vals[k];
    if (v == null) valoraciones[k] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) valoraciones[k] = v;
    else return falla("Valoración no válida.");
  }

  // Preguntas del tipo: se guardan con el enunciado y la etiqueta tal como
  // se mostraron, sacados de aquí, no de lo que mande el navegador.
  const T = QUETAL_TEXTOS[idioma];
  const crudas = (typeof b.respuestasTipo === "object" && b.respuestasTipo ? b.respuestasTipo : {}) as Record<string, unknown>;
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(crudas)) if (typeof v === "string") r[k] = v;
  const respuestasTipo: { id: string; pregunta: string; respuesta: string }[] = [];
  for (const q of PREGUNTAS_TIPO[tipo]) {
    if (!preguntaVisible(q, r)) continue;
    const v = r[q.id]?.trim();
    if (!v) continue;
    if (q.tipo === "opcion") {
      if (!(q.opciones as string[]).includes(v)) return falla("Opción no válida.");
      respuestasTipo.push({ id: q.id, pregunta: T.preguntasTipo[q.id], respuesta: T.opciones[v as keyof typeof T.opciones] });
    } else {
      respuestasTipo.push({ id: q.id, pregunta: T.preguntasTipo[q.id], respuesta: v.slice(0, LIMITES.respuesta) });
    }
  }

  const fila = {
    link_id: link?.id ?? null,
    idioma,
    tipo_evento: tipo,
    nombre_evento: nombreEvento,
    fecha_evento: fecha,
    nombre,
    cargo: texto(b.cargo, LIMITES.corto),
    entidad,
    email,
    nps,
    testimonio,
    momento: texto(b.momento, LIMITES.respuesta),
    dudas_previas: texto(b.dudas, LIMITES.respuesta),
    respuestas_tipo: respuestasTipo,
    ...valoraciones,
    comentario_trato: texto(b.comentarioTrato, LIMITES.respuesta),
    repetir,
    referido_nombre: texto(b.referidoNombre, LIMITES.corto),
    referido_contacto: texto(b.referidoContacto, LIMITES.email),
    referido_permiso_mencion: b.referidoPermiso === true,
    mejora_privada: texto(b.mejora, LIMITES.largo),
    permiso_publicacion: permiso,
    permiso_logo: (permiso === "completo" || permiso === "entidad") && b.permisoLogo === true,
    permiso_fotos: b.permisoFotos === true,
    privacidad_aceptada: true,
  };

  // Primero se guarda; el enlace se marca después. Si el insert falla, el
  // enlace sigue sirviendo. Dos envíos a la vez con el mismo enlace los
  // para el índice único de link_id (23505).
  const { data: guardada, error } = await supabase.from("feedback_organizadores").insert(fila).select("id").single();
  if (error) {
    if (error.code === "23505") return falla("Ya respondido.", 409);
    console.error("quetal: error guardando:", error.message, error.code, error.details);
    return falla("Error al guardar.", 500);
  }

  if (link) {
    const { error: e2 } = await supabase
      .from("feedback_links")
      .update({ usado: true, respondido_at: new Date().toISOString() })
      .eq("id", link.id);
    // No es grave: la respuesta está guardada y el índice único impide otra.
    if (e2) console.error("quetal: respuesta guardada pero el enlace no se ha marcado:", e2.message);
  }

  // Aviso a Alain.
  const referido = fila.referido_nombre || fila.referido_contacto;
  let avisoError: string | null = null;
  try {
    const p = (k: string, v: string | null | undefined) => (v ? `<p><strong>${k}:</strong> ${esc(v)}</p>` : "");
    await sendEmail(
      "contacto@alainzulaika.com",
      `[Valoración] ${entidad} · NPS ${nps}`,
      `<h2>Nueva valoración de ${esc(entidad)}</h2>
        ${p("Entidad", entidad)}
        ${p("Evento", `${nombreEvento} (${TIPO_CORTO[tipo]}${fecha ? `, ${fecha}` : ""})`)}
        ${p("Quién", [nombre, fila.cargo].filter(Boolean).join(" · "))}
        <p><strong>NPS:</strong> ${nps}</p>
        <p><strong>Testimonio:</strong></p>
        <blockquote style="margin:0 0 1em;padding-left:12px;border-left:3px solid #2ED3E6;white-space:pre-wrap">${esc(testimonio)}</blockquote>
        ${p("¿Repetir?", repetir ? REPETIR_CORTO[repetir] : "Sin contestar")}
        ${
          referido
            ? p("Referido", `${[fila.referido_nombre, fila.referido_contacto].filter(Boolean).join(" · ")}${fila.referido_permiso_mencion ? " (puedes mencionarle)" : " (sin permiso para mencionarle)"}`)
            : "<p><strong>Referido:</strong> no</p>"
        }
        <p><a href="https://alainzulaika.com/admin?tab=${encodeURIComponent("Opiniones eventos")}">Verla en /admin</a></p>`,
      "Web <alain@alainzulaika.com>"
    );
  } catch (e) {
    avisoError = e instanceof Error ? e.message : String(e);
    console.error("quetal: el aviso no ha salido:", avisoError);
  }
  await supabase
    .from("feedback_organizadores")
    .update({ aviso_enviado: !avisoError, aviso_error: avisoError })
    .eq("id", guardada.id);

  return NextResponse.json({ ok: true });
}
