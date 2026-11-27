import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { resolveNewsletterFrom, sendEmail } from "@/lib/email-ses";
import { GRUPOS, enlaceBaja, grupoDe } from "@/lib/grupos-envio";
import { EMAIL_RE, claveDe, htmlGrupo, versionCompleta, type Campos, type Destinatario, type Idioma, type Version } from "@/lib/grupos-envio-html";

// Envíos a grupos de contactos (/admin → Newsletter → Grupos).
//
// GET  ?grupo=…&clave=…  → grupos, mails guardados y, si se pide un grupo, a
//                          quién le llegaría (con su idioma), a quién no y por
//                          qué, y quién lo tiene ya.
// POST guardar  → guarda el borrador del mail (asunto, preheader y cuerpo ES/EU).
// POST prueba   → manda las versiones escritas SOLO a la dirección de prueba.
//                 No apunta nada.
// POST enviar   → envío real del mail GUARDADO, un correo por persona. Solo
//                 desde producción y con la confirmación escrita «ENVIAR <n>».
//                 Va por tandas; lo ya enviado no se repite (UNIQUE clave+email).
//
// Mismo sistema y remitente que la newsletter: Mailjet, newsletter@alainzulaika.com.
// Etiqueta de campaña `grupo-<clave>` para ver aperturas y clics.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const EN_PRODUCCION = process.env.VERCEL_ENV === "production";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";
const PRUEBA_POR_DEFECTO = "contacto@alainzulaika.com";
const TANDA = 20;
const FROM = resolveNewsletterFrom("newsletter@alainzulaika.com");

type Envio = { email: string; estado: "pendiente" | "aceptado" | "error"; error: string | null; enviado_en: string | null };
type Fila = Destinatario & { baja: boolean; envio: Envio | null };
type FilaMail = {
  clave: string; grupo: string;
  subject_es: string | null; preheader_es: string | null; body_es: string | null;
  subject_eu: string | null; preheader_eu: string | null; body_eu: string | null;
  actualizado: string;
};

const base = (req: Request) => {
  const host = req.headers.get("host") || "alainzulaika.com";
  return `${host.includes("localhost") ? "http" : "https"}://${host}`;
};

const version = (v: unknown): Version => {
  const o = (v ?? {}) as Partial<Version>;
  return { subject: String(o.subject ?? ""), preheader: String(o.preheader ?? ""), body: String(o.body ?? "") };
};
const camposDe = (v: unknown): Campos => {
  const o = (v ?? {}) as Partial<Campos>;
  return { es: version(o.es), eu: version(o.eu) };
};
const camposDeFila = (m: FilaMail): Campos => ({
  es: { subject: m.subject_es ?? "", preheader: m.preheader_es ?? "", body: m.body_es ?? "" },
  eu: { subject: m.subject_eu ?? "", preheader: m.preheader_eu ?? "", body: m.body_eu ?? "" },
});

/** Destinatarios de un grupo con lo ya enviado de ese mail y las bajas. */
async function cargar(grupoClave: string, clave: string | null) {
  const g = grupoDe(grupoClave);
  if (!g) return { error: "Grupo no válido." as const };
  const s = sb();
  const { destinatarios, excluidos } = await g.cargar(s);

  let faltaSql = false;
  const { data: bajas, error: e1 } = await s.from("grupos_bajas").select("email");
  if (e1) faltaSql = true;
  const { data: envios, error: e2 } = clave
    ? await s.from("grupos_envios").select("email, estado, error, enviado_en").eq("clave", clave)
    : { data: [], error: null };
  if (e2) faltaSql = true;

  // Bajas de la newsletter: solo se avisa; decide Alain.
  const emails = destinatarios.map((d) => d.email);
  const bajasNl = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await s.from("newsletter_contactos").select("email").eq("unsubscribed", true).in("email", emails.slice(i, i + 200));
    for (const r of (data ?? []) as { email: string }[]) bajasNl.add(r.email.trim().toLowerCase());
  }

  const deBaja = new Set(((bajas ?? []) as { email: string }[]).map((b) => b.email.trim().toLowerCase()));
  const porEmail = new Map(((envios ?? []) as Envio[]).map((e) => [e.email, e]));
  const lista: Fila[] = destinatarios.map((d) => ({
    ...d,
    notas: bajasNl.has(d.email) ? [...d.notas, "se dio de baja de la newsletter"] : d.notas,
    baja: deBaja.has(d.email),
    envio: porEmail.get(d.email) ?? null,
  }));
  lista.sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email, "es"));
  return { grupo: g, destinatarios: lista, excluidos, faltaSql };
}


export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const s = sb();

  let faltaSql = false;
  const { data: mails, error } = await s.from("grupos_mails").select("*").order("actualizado", { ascending: false });
  if (error) faltaSql = true;
  const { data: enviados } = await s.from("grupos_envios").select("clave, estado");
  const cuenta = new Map<string, number>();
  for (const r of (enviados ?? []) as { clave: string; estado: string }[]) if (r.estado === "aceptado") cuenta.set(r.clave, (cuenta.get(r.clave) ?? 0) + 1);

  const clave = q.get("clave") ? claveDe(q.get("clave")!) : null;
  const filaMail = ((mails ?? []) as FilaMail[]).find((m) => m.clave === clave) ?? null;
  const grupoPedido = q.get("grupo") || filaMail?.grupo || null;

  let detalle: Awaited<ReturnType<typeof cargar>> | null = null;
  if (grupoPedido) {
    try {
      detalle = await cargar(grupoPedido, clave);
    } catch (e) {
      return NextResponse.json({ error: `No se ha podido leer el grupo: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
    if ("error" in detalle) return NextResponse.json({ error: detalle.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      grupos: GRUPOS.map(({ clave, nombre, descripcion }) => ({ clave, nombre, descripcion })),
      mails: ((mails ?? []) as FilaMail[]).map((m) => ({ clave: m.clave, grupo: m.grupo, asunto: m.subject_es || m.subject_eu || "", actualizado: m.actualizado, enviados: cuenta.get(m.clave) ?? 0 })),
      mail: filaMail ? { clave: filaMail.clave, grupo: filaMail.grupo, campos: camposDeFila(filaMail) } : null,
      destinatarios: detalle && !("error" in detalle) ? detalle.destinatarios : [],
      excluidos: detalle && !("error" in detalle) ? detalle.excluidos : [],
      faltaSql: faltaSql || (detalle && !("error" in detalle) ? detalle.faltaSql : false),
      enProduccion: EN_PRODUCCION,
      remitente: FROM,
      pruebaA: PRUEBA_POR_DEFECTO,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Los que tendrán el mail al terminar (los ya enviados cuentan): el número de «ENVIAR <n>». */
const cuentaTotal = (lista: Fila[], excluir: Set<string>, idiomas: Set<Idioma>) =>
  lista.filter((d) => !excluir.has(d.email) && !d.baja && (d.envio?.estado === "aceptado" || d.envio?.estado === "pendiente" || idiomas.has(d.idioma))).length;

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as {
    accion?: string; clave?: string; grupo?: string; campos?: unknown; a?: string;
    confirmar?: string; excluir?: unknown; saltar?: unknown;
  };
  const s = sb();

  if (b.accion === "guardar") {
    const clave = claveDe(b.clave ?? "");
    if (!clave) return NextResponse.json({ error: "Ponle un nombre al envío (p. ej. «videos-mirariak»)." }, { status: 400 });
    if (!grupoDe(b.grupo)) return NextResponse.json({ error: "Elige un grupo." }, { status: 400 });
    const c = camposDe(b.campos);
    // Un mail que ya ha salido a alguien no cambia de grupo: el registro de
    // a quién le llegó es de ese grupo.
    const { data: previa } = await s.from("grupos_mails").select("grupo").eq("clave", clave).maybeSingle();
    if (previa && previa.grupo !== b.grupo) {
      const { count } = await s.from("grupos_envios").select("id", { count: "exact", head: true }).eq("clave", clave);
      if (count) return NextResponse.json({ error: `«${clave}» ya ha salido al grupo ${previa.grupo}. Para otro grupo, guárdalo con otro nombre.` }, { status: 409 });
    }
    const { error } = await s.from("grupos_mails").upsert({
      clave, grupo: b.grupo,
      subject_es: c.es.subject, preheader_es: c.es.preheader, body_es: c.es.body,
      subject_eu: c.eu.subject, preheader_eu: c.eu.preheader, body_eu: c.eu.body,
      actualizado: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: `No se ha guardado: ${error.message}. ¿Falta ejecutar sql/envios_grupos.sql?` }, { status: 500 });
    return NextResponse.json({ ok: true, clave });
  }

  if (b.accion === "prueba") {
    const a = (b.a ?? PRUEBA_POR_DEFECTO).trim().toLowerCase();
    if (!EMAIL_RE.test(a)) return NextResponse.json({ error: "La dirección de prueba no es válida." }, { status: 400 });
    const c = camposDe(b.campos);
    const clave = claveDe(b.clave ?? "") || "prueba";
    const hechos: Idioma[] = [];
    try {
      for (const idioma of ["eu", "es"] as const) {
        if (!versionCompleta(c[idioma])) continue;
        const html = htmlGrupo(c[idioma], idioma, enlaceBaja(base(req), a, idioma, clave));
        await sendEmail(a, `[PRUEBA ${idioma.toUpperCase()}] ${c[idioma].subject}`, html, FROM, undefined, { campana: `grupo-${clave}-prueba`, idioma });
        hechos.push(idioma);
      }
    } catch (e) {
      return NextResponse.json({ error: `No ha salido (${hechos.length} enviados): ${e instanceof Error ? e.message : e}` }, { status: 502 });
    }
    if (!hechos.length) return NextResponse.json({ error: "No hay ninguna versión con asunto y cuerpo." }, { status: 400 });
    return NextResponse.json({ ok: true, enviadoA: a, versiones: hechos });
  }

  if (b.accion !== "enviar") return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  if (!EN_PRODUCCION) {
    return NextResponse.json({ error: "El envío real solo sale desde producción (alainzulaika.com/admin). Aquí funcionan la vista previa y la prueba." }, { status: 403 });
  }

  // Se envía lo GUARDADO, no lo que haya en pantalla: así lo enviado es
  // exactamente lo que queda registrado en grupos_mails.
  const clave = claveDe(b.clave ?? "");
  const { data: m, error: e0 } = await s.from("grupos_mails").select("*").eq("clave", clave).maybeSingle();
  if (e0) return NextResponse.json({ error: "Falta ejecutar sql/envios_grupos.sql en Supabase." }, { status: 409 });
  if (!m) return NextResponse.json({ error: "Guarda el mail antes de enviarlo." }, { status: 400 });
  const campos = camposDeFila(m as FilaMail);
  const idiomas = new Set((["es", "eu"] as const).filter((i) => versionCompleta(campos[i])));
  if (!idiomas.size) return NextResponse.json({ error: "El mail guardado no tiene ninguna versión con asunto y cuerpo." }, { status: 400 });

  const c = await cargar((m as FilaMail).grupo, clave);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  if (c.faltaSql) return NextResponse.json({ error: "Falta ejecutar sql/envios_grupos.sql en Supabase: sin esas tablas no se puede garantizar un solo correo por persona." }, { status: 409 });

  const conjunto = (v: unknown) => new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()));
  const excluir = conjunto(b.excluir);
  const total = cuentaTotal(c.destinatarios, excluir, idiomas);
  if ((b.confirmar ?? "").trim().toUpperCase() !== `ENVIAR ${total}`) {
    return NextResponse.json({ error: `Falta la confirmación: escribe «ENVIAR ${total}».`, total }, { status: 400 });
  }

  const saltar = conjunto(b.saltar);
  const cola = c.destinatarios.filter(
    (d) => !excluir.has(d.email) && !d.baja && !saltar.has(d.email) && idiomas.has(d.idioma) && (!d.envio || d.envio.estado === "error")
  );
  const errores: { email: string; error: string }[] = [];
  let enviados = 0;
  for (const d of cola.slice(0, TANDA)) {
    // Reservar la fila ANTES de enviar: (clave, email) es único, así que dos
    // pulsaciones a la vez no pueden escribir dos veces a la misma persona.
    const v = campos[d.idioma];
    if (d.envio?.estado === "error") {
      const { data } = await s.from("grupos_envios").update({ estado: "pendiente", error: null }).eq("clave", clave).eq("email", d.email).eq("estado", "error").select("id");
      if (!data?.length) continue;
    } else {
      const { error } = await s.from("grupos_envios").insert({ clave, grupo: (m as FilaMail).grupo, email: d.email, nombre: d.nombre || null, idioma: d.idioma, asunto: v.subject });
      if (error) continue; // ya la tiene otra petición
    }
    try {
      await sendEmail(d.email, v.subject, htmlGrupo(v, d.idioma, enlaceBaja(BASE_URL, d.email, d.idioma, clave)), FROM, undefined, { campana: `grupo-${clave}`, customId: d.email, idioma: d.idioma });
      await s.from("grupos_envios").update({ estado: "aceptado", enviado_en: new Date().toISOString() }).eq("clave", clave).eq("email", d.email);
      enviados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push({ email: d.email, error: msg });
      await s.from("grupos_envios").update({ estado: "error", error: msg.slice(0, 500) }).eq("clave", clave).eq("email", d.email);
    }
  }
  // Si en una tanda no sale ninguno, se para: algo falla y seguir no lo arregla.
  const quedan = enviados === 0 ? 0 : Math.max(cola.length - TANDA, 0);
  return NextResponse.json({ ok: true, enviados, errores, quedan, total });
}
