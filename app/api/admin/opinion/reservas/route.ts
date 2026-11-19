import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { ALAIN_FROM, sendEmail } from "@/lib/email-ses";
import type { FilaReserva } from "@/lib/mirariak";
import { CAMPANA_OPINION, eventoDe, mailOpinion, type EventoOpinion, type Idioma } from "@/lib/opinion";
import { destinatariosDeReservas, type Destinatario } from "@/lib/opinion-reservas";

// «Pedir opinión a las reservas de este evento» (/admin → Mirariak 2026).
//
// GET  ?evento=…  → a quién le llegaría (sin duplicados), a quién no y por
//                   qué, la vista previa del mail en ES y EU y lo ya enviado.
// POST prueba     → manda las dos versiones SOLO a Alain. No apunta nada.
// POST enviar     → envío real, un correo por persona. Solo si el evento
//                   tiene el envío abierto (lib/opinion.ts) y llega la
//                   confirmación escrita «ENVIAR <n>» con el número exacto de
//                   destinatarios. Va por tandas; lo ya enviado no se repite.
//
// Nadie entra en la newsletter ni en ninguna secuencia: es sendEmail() a
// secas, con una etiqueta de campaña propia para ver aperturas y clics.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// El envío de prueba va siempre aquí, lo pida quien lo pida.
const ALAIN = "contacto@alainzulaika.com";
const TANDA = 20;

type Envio = { email: string; estado: "pendiente" | "aceptado" | "error"; error: string | null; enviado_en: string | null; idioma: string };

async function cargar(ev: EventoOpinion) {
  const s = sb();
  if (ev.reservas !== "mirariak2026") return { error: "Este evento no tiene reservas en el panel." as const };
  const { data: filas, error } = await s.from("mirariak2026_reservas").select("*").order("created_at", { ascending: true });
  if (error) return { error: error.message };

  // Si las tablas nuevas aún no existen, la vista previa funciona igual.
  let faltaSql = false;
  const { data: envios, error: e2 } = await s.from("opinion_envios").select("email, estado, error, enviado_en, idioma").eq("evento", ev.clave);
  if (e2) faltaSql = true;
  const { data: opiniones, error: e3 } = await s.from("opiniones_familias").select("email, origen").eq("evento", ev.clave);
  if (e3) faltaSql = true;

  const calc = destinatariosDeReservas((filas ?? []) as FilaReserva[]);
  const porEmail = new Map(((envios ?? []) as Envio[]).map((x) => [x.email, x]));
  const yaOpino = new Set(((opiniones ?? []) as { email: string | null }[]).map((o) => (o.email ?? "").trim().toLowerCase()).filter(Boolean));
  return { ...calc, envios: porEmail, yaOpino, faltaSql, respuestas: (opiniones ?? []).length, respuestasMail: ((opiniones ?? []) as { origen: string | null }[]).filter((o) => o.origen === "mail").length };
}

/** Los que quedan por recibirlo: ni enviados, ni a medias, ni excluidos a mano, ni con opinión ya dejada. */
function pendientes(c: { destinatarios: Destinatario[]; envios: Map<string, Envio>; yaOpino: Set<string> }, excluir: Set<string>) {
  return c.destinatarios.filter((d) => {
    if (excluir.has(d.email) || c.yaOpino.has(d.email)) return false;
    const e = c.envios.get(d.email);
    return !e || e.estado === "error";
  });
}

const base = (req: Request) => {
  const host = req.headers.get("host") || "alainzulaika.com";
  return `${host.includes("localhost") ? "http" : "https"}://${host}`;
};

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const ev = eventoDe(new URL(req.url).searchParams.get("evento"));
  if (!ev) return NextResponse.json({ error: "Evento no válido." }, { status: 400 });
  const c = await cargar(ev);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 500 });

  const idiomas: Idioma[] = ["eu", "es"];
  return NextResponse.json(
    {
      evento: { clave: ev.clave, nombre: ev.nombre, ruta: ev.ruta },
      envioRealAbierto: ev.envioRealAbierto,
      faltaSql: c.faltaSql,
      destinatarios: c.destinatarios.map((d) => {
        const e = c.envios.get(d.email);
        return { ...d, envio: e ? { estado: e.estado, error: e.error, enviado_en: e.enviado_en } : null, yaOpino: c.yaOpino.has(d.email) };
      }),
      excluidos: c.excluidos,
      pasesConControl: c.pasesConControl,
      pasesSinControl: c.pasesSinControl,
      respuestas: c.respuestas,
      respuestasMail: c.respuestasMail,
      // Los enlaces de la vista previa apuntan a donde se está mirando (preview o producción).
      vistaPrevia: Object.fromEntries(idiomas.map((i) => [i, mailOpinion(ev, { nombre: i === "eu" ? "Ane" : "Ana", idioma: i, base: base(req) })])),
      pruebaA: ALAIN,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { accion?: string; evento?: string; confirmar?: string; excluir?: unknown; saltar?: unknown };
  const ev = eventoDe(b.evento);
  if (!ev) return NextResponse.json({ error: "Evento no válido." }, { status: 400 });

  // Prueba: las dos versiones, solo a Alain, con el enlace de donde se esté
  // probando (así el formulario que abre es el del preview).
  if (b.accion === "prueba") {
    const hechos: string[] = [];
    try {
      for (const idioma of ["eu", "es"] as const) {
        const m = mailOpinion(ev, { nombre: "Alain", idioma, base: base(req) });
        await sendEmail(ALAIN, `[PRUEBA ${idioma.toUpperCase()}] ${m.asunto}`, m.html, ALAIN_FROM, undefined, { campana: `${CAMPANA_OPINION(ev)}-prueba` });
        hechos.push(idioma);
      }
    } catch (e) {
      return NextResponse.json({ error: `No ha salido (${hechos.length} de 2 enviados): ${e instanceof Error ? e.message : e}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, enviadoA: ALAIN, versiones: hechos });
  }

  if (b.accion !== "enviar") return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  if (!ev.envioRealAbierto) {
    return NextResponse.json({ error: "El envío real de este evento está cerrado (lib/opinion.ts → envioRealAbierto). Antes hay que decidir lo de privacidad." }, { status: 403 });
  }

  const c = await cargar(ev);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 500 });
  if (c.faltaSql) return NextResponse.json({ error: "Falta ejecutar sql/opiniones_eventos.sql en Supabase: sin esa tabla no se puede garantizar un solo correo por persona." }, { status: 409 });

  const lista = (v: unknown) => new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()));
  const excluir = lista(b.excluir);
  // La confirmación lleva el número de personas que habrán recibido el correo
  // cuando termine la operación (las ya enviadas cuentan): es el mismo número
  // en todas las tandas.
  const hecho = (d: Destinatario) => ["aceptado", "pendiente"].includes(c.envios.get(d.email)?.estado ?? "");
  const total = c.destinatarios.filter((d) => !excluir.has(d.email) && (hecho(d) || !c.yaOpino.has(d.email))).length;
  if ((b.confirmar ?? "").trim().toUpperCase() !== `ENVIAR ${total}`) {
    return NextResponse.json({ error: `Falta la confirmación: escribe «ENVIAR ${total}».`, total }, { status: 400 });
  }
  // `saltar`: los que ya han fallado en esta misma operación (no se reintentan
  // en cada tanda; se reintentan al volver a pulsar).
  const saltar = lista(b.saltar);
  const cola = pendientes(c, excluir).filter((d) => !saltar.has(d.email));

  const s = sb();
  const errores: { email: string; error: string }[] = [];
  let enviados = 0;
  for (const d of cola.slice(0, TANDA)) {
    // Reservar la fila ANTES de enviar: (evento, email) es único, así que dos
    // pulsaciones a la vez no pueden escribir dos veces a la misma persona.
    const previa = c.envios.get(d.email);
    if (previa?.estado === "error") {
      const { data } = await s.from("opinion_envios").update({ estado: "pendiente", error: null }).eq("evento", ev.clave).eq("email", d.email).eq("estado", "error").select("id");
      if (!data?.length) continue;
    } else {
      const { error } = await s.from("opinion_envios").insert({ evento: ev.clave, email: d.email, nombre: d.nombre, idioma: d.idioma });
      if (error) continue; // ya la tiene otra petición
    }
    try {
      const m = mailOpinion(ev, { nombre: d.nombre, idioma: d.idioma });
      await sendEmail(d.email, m.asunto, m.html, ALAIN_FROM, undefined, { campana: CAMPANA_OPINION(ev), idioma: d.idioma });
      await s.from("opinion_envios").update({ estado: "aceptado", enviado_en: new Date().toISOString() }).eq("evento", ev.clave).eq("email", d.email);
      enviados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push({ email: d.email, error: msg });
      await s.from("opinion_envios").update({ estado: "error", error: msg.slice(0, 500) }).eq("evento", ev.clave).eq("email", d.email);
    }
  }
  // Si en una tanda no sale ninguno, se para: algo falla (Mailjet, red) y
  // seguir llamando no lo arregla.
  const quedan = enviados === 0 ? 0 : Math.max(cola.length - TANDA, 0);
  return NextResponse.json({ ok: true, enviados, errores, quedan, total });
}
