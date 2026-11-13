// Motor de la secuencia «tumision» (9 mails ES/EU, contenido en
// secuencia_mails, editable en /admin → Nurture → «Tumisión · 9 días»).
//
// Quién entra:
//  - Tarjeta del show (/tumision, /es/tumision): mail 1 al instante.
//  - Plataforma de los librillos (/magia-tailerrak), al dejar el email: la
//    plataforma ya le manda su bienvenida al momento, así que el mail 1 de la
//    secuencia sale a las 19:15 de ese día (o del siguiente, si se apunta
//    después de las 19:15). Canal «librillo».
// Los demás mails, uno al día a las 19:15 (hora de Madrid), la misma hora que
// la newsletter diaria. Un mail inactivo se SALTA: sale el siguiente activo en
// ese mismo hueco. Si no queda ninguno activo detrás, la secuencia termina.
// Durante la secuencia la persona NO está en newsletter_contactos; al terminar
// se le da de alta con la marca de transición de hoy (filtroTransicionNewsletter
// en lib/nurture), así que empieza a recibir la diaria AL DÍA SIGUIENTE.
//
// El estado vive en mision_contactos (sql/tumision_motor.sql): la baja
// (/api/mision/baja) y el cambio de idioma (/api/mision/idioma) ya actúan ahí.
//
// Interruptor: secuencias.modo de la fila «tumision».
//   off    → no hace nada; las altas de la tarjeta van a la «mision» de siempre
//            y las de la plataforma no entran en nada (como hasta ahora).
//   prueba → solo EMAILS_PRUEBA_TUMISION entran en tumisión, y en acelerado
//            (cada mail en la siguiente pasada, o al momento con la pasada
//            forzada de /api/admin/tumision). El resto, como en «off».
//   activo → todo el mundo.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import { wrapMision, urlsSecuencia } from "@/lib/secuencias-legacy";
import { altaEmbudo } from "@/lib/embudos";

export const HORA_TUMISION_MIN = 19 * 60 + 15; // 19:15, como la newsletter diaria
export const EMAILS_PRUEBA_TUMISION = ["entrenatzaile@alainzulaika.com", "info@alainzulaika.com"];
// Si una pasada se queda colgada a medias, el candado se libera solo pasado este tiempo.
const CANDADO_MIN = 10;

export type ModoTumision = "off" | "prueba" | "activo";

let cliente: SupabaseClient | null = null;
function db() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

export const esEmailDePrueba = (email: string) => EMAILS_PRUEBA_TUMISION.includes(email.trim().toLowerCase());

// ---------- Horas de Madrid ----------

function partesMadrid(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "0";
  return { fecha: `${g("year")}-${g("month")}-${g("day")}`, minutos: Number(g("hour")) * 60 + Number(g("minute")) };
}

function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** El instante (UTC) de una fecha y hora de Madrid. */
function instanteMadrid(fecha: string, minutos: number): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const reloj = Date.UTC(y, m - 1, d, Math.floor(minutos / 60), minutos % 60);
  const desfase = (ts: number) => {
    const p = partesMadrid(new Date(ts));
    const [yy, mm, dd] = p.fecha.split("-").map(Number);
    return Date.UTC(yy, mm - 1, dd, 0, p.minutos) - ts;
  };
  let ts = reloj - desfase(reloj);
  ts = reloj - desfase(ts); // segunda vuelta por si el cambio de hora cae en medio
  return new Date(ts);
}

/** Las 19:15 del día siguiente (Madrid) al de `ahora`. */
export function huecoDiaSiguiente(ahora: Date): Date {
  return instanteMadrid(sumarDias(partesMadrid(ahora).fecha, 1), HORA_TUMISION_MIN);
}

/** Las 19:15 de hoy si aún no han pasado; si no, las de mañana. */
export function primerHueco(ahora: Date): Date {
  const { fecha, minutos } = partesMadrid(ahora);
  return instanteMadrid(minutos < HORA_TUMISION_MIN ? fecha : sumarDias(fecha, 1), HORA_TUMISION_MIN);
}

// ---------- Interruptor ----------

export async function modoTumision(): Promise<ModoTumision> {
  const { data, error } = await db().from("secuencias").select("modo").eq("slug", "tumision").maybeSingle();
  if (error) {
    console.error("tumision: no se ha podido leer el modo (se trata como off):", error.message);
    return "off";
  }
  return data?.modo === "prueba" || data?.modo === "activo" ? data.modo : "off";
}

async function posicionesActivas(idioma: "es" | "eu"): Promise<number[] | null> {
  const { data, error } = await db()
    .from("secuencia_mails")
    .select("posicion")
    .eq("secuencia", "tumision")
    .eq("idioma", idioma)
    .eq("activo", true)
    .gte("posicion", 1)
    .order("posicion", { ascending: true });
  if (error) {
    console.error("tumision: no se han podido leer los mails activos:", error.message);
    return null;
  }
  return (data ?? []).map((r) => r.posicion as number);
}

/**
 * ¿Entra este email en tumisión? Solo si el modo lo deja y hay al menos un
 * mail activo en su idioma: con todo inactivo, mejor la «mision» de siempre
 * que dejar a alguien esperando un correo que no existe.
 */
export async function tumisionDisponible(email: string, idioma: "es" | "eu"): Promise<{ usar: boolean; modo: ModoTumision }> {
  const modo = await modoTumision();
  if (modo === "off" || (modo === "prueba" && !esEmailDePrueba(email))) return { usar: false, modo };
  const activas = await posicionesActivas(idioma);
  return { usar: !!activas && activas.length > 0, modo };
}

// ---------- Altas ----------

/** Alta desde la plataforma de los librillos (siempre en euskera). */
export async function apuntarTumisionLibrillo(email: string, ahora = new Date()): Promise<"apuntado" | "ya-estaba" | "no" | "error"> {
  const disp = await tumisionDisponible(email, "eu");
  if (!disp.usar) return "no";
  const proximo = disp.modo === "prueba" ? ahora : primerHueco(ahora);
  const { error } = await db()
    .from("mision_contactos")
    .insert({ email, idioma: "eu", canal: "librillo", tumision_pos: 1, tumision_proximo: proximo.toISOString() });
  if (error) {
    if (error.code === "23505") return "ya-estaba";
    console.error("tumision: error en el alta del librillo:", error.message);
    return "error";
  }
  return "apuntado";
}

// ---------- Envío ----------

export type PasoTumision =
  | { estado: "enviado"; posicion: number; siguiente: number | null }
  | { estado: "terminado"; newsletter: "alta" | "ya-estaba" | "error" }
  | { estado: "nada" | "off" | "sin-mails" | "error"; motivo?: string };

async function terminar(email: string, idioma: "es" | "eu", canal: string | null, ahora: Date): Promise<"alta" | "ya-estaba" | "error"> {
  await db()
    .from("mision_contactos")
    .update({ tumision_pos: null, tumision_proximo: null, tumision_enviando_desde: null, tumision_fin_at: ahora.toISOString() })
    .eq("email", email);

  // Alta en la diaria con la transición «hecha hoy»: el filtro de la
  // newsletter le deja fuera hoy y le incluye desde mañana. A quien ya estaba
  // en newsletter_contactos no se le toca nada.
  const r = await altaEmbudo({
    origen: canal === "librillo" ? "magia-tailerrak" : "tumision",
    email,
    idioma,
    camposExtra: { transicion_para: partesMadrid(ahora).fecha, transicion_enviada_en: ahora.toISOString() },
  });
  if (canal === "librillo") {
    const { error } = await db()
      .from("magia_usuarios")
      .update({ newsletter_alta_at: ahora.toISOString() })
      .eq("email", email)
      .is("newsletter_alta_at", null);
    if (error) console.error("tumision: no se ha podido marcar newsletter_alta_at:", error.message);
  }
  if (r.error) return "error";
  return r.creado ? "alta" : "ya-estaba";
}

/**
 * Manda a este email el mail que le toca (o el siguiente activo) y deja
 * programado el próximo. Con `forzar` (solo pruebas) no espera a su hora.
 */
export async function avanzarTumision(email: string, opciones: { forzar?: boolean; ahora?: Date } = {}): Promise<PasoTumision> {
  const ahora = opciones.ahora ?? new Date();
  const modo = await modoTumision();
  if (modo === "off") return { estado: "off" };
  if (modo === "prueba" && !esEmailDePrueba(email)) return { estado: "off", motivo: "modo prueba y no es email de prueba" };
  if (opciones.forzar && modo !== "prueba") return { estado: "off", motivo: "forzar solo en modo prueba" };

  // Candado: una sola pasada se queda con este contacto.
  const iso = ahora.toISOString();
  const rancio = new Date(ahora.getTime() - CANDADO_MIN * 60 * 1000).toISOString();
  let q = db()
    .from("mision_contactos")
    .update({ tumision_enviando_desde: iso })
    .eq("email", email)
    .eq("unsubscribed", false)
    .not("tumision_pos", "is", null)
    .or(`tumision_enviando_desde.is.null,tumision_enviando_desde.lt.${rancio}`);
  if (!opciones.forzar) q = q.lte("tumision_proximo", iso);
  const { data: filas, error } = await q.select("email, idioma, canal, tumision_pos");
  if (error) {
    console.error("tumision: error al reclamar el envío:", email, error.message);
    return { estado: "error", motivo: error.message };
  }
  const fila = filas?.[0];
  if (!fila) return { estado: "nada" };

  const soltar = () => db().from("mision_contactos").update({ tumision_enviando_desde: null }).eq("email", email);
  const idioma: "es" | "eu" = fila.idioma === "eu" ? "eu" : "es";
  const isEu = idioma === "eu";

  const activas = await posicionesActivas(idioma);
  if (!activas || activas.length === 0) {
    // Todo inactivo (o no se ha podido leer): no se da por terminada, se espera.
    await soltar();
    return { estado: "sin-mails" };
  }
  const posicion = activas.find((p) => p >= fila.tumision_pos);
  if (posicion === undefined) return { estado: "terminado", newsletter: await terminar(email, idioma, fila.canal, ahora) };

  const mail = await cargarMailSecuencia("tumision", posicion, idioma, urlsSecuencia("mision", email, isEu));
  if (!mail) {
    await soltar();
    return { estado: "sin-mails", motivo: `mail ${posicion} no disponible` };
  }

  try {
    await sendEmail(email, mail.asunto, wrapMision(mail.cuerpo, email, isEu), resolveNewsletterFrom(mail.remitente), undefined, {
      campana: `tumision-m${posicion}`,
      customId: email,
      idioma,
    });
  } catch (err) {
    // La hora programada no se toca: se reintenta en la siguiente pasada.
    console.error(`tumision: fallo enviando el mail ${posicion} a ${email}:`, err);
    await soltar();
    return { estado: "error", motivo: String(err) };
  }

  const siguiente = activas.find((p) => p > posicion) ?? null;
  if (siguiente === null) {
    await db().from("mision_contactos").update({ tumision_ultimo_envio: iso }).eq("email", email);
    await terminar(email, idioma, fila.canal, ahora);
    return { estado: "enviado", posicion, siguiente: null };
  }
  const proximo = modo === "prueba" ? ahora : huecoDiaSiguiente(ahora);
  await db()
    .from("mision_contactos")
    .update({ tumision_pos: siguiente, tumision_proximo: proximo.toISOString(), tumision_ultimo_envio: iso, tumision_enviando_desde: null })
    .eq("email", email);
  return { estado: "enviado", posicion, siguiente };
}

/** Una pasada del cron: todos a los que ya les toca. `forzar`: solo pruebas, sin esperar a la hora. */
export async function pasadaTumision(opciones: { forzar?: boolean } = {}) {
  const modo = await modoTumision();
  const resumen = { modo, enviados: 0, terminados: 0, fallos: 0, detalle: [] as Array<{ email: string; paso: PasoTumision }> };
  if (modo === "off") return resumen;
  if (opciones.forzar && modo !== "prueba") return resumen;

  let q = db().from("mision_contactos").select("email").not("tumision_pos", "is", null).eq("unsubscribed", false);
  if (!opciones.forzar) q = q.lte("tumision_proximo", new Date().toISOString());
  const { data, error } = await q;
  if (error) {
    console.error("tumision: error buscando a quién le toca:", error.message);
    resumen.fallos++;
    return resumen;
  }
  const emails = (data ?? []).map((r) => r.email as string).filter((e) => modo === "activo" || esEmailDePrueba(e));
  for (const email of emails) {
    const paso = await avanzarTumision(email, { forzar: opciones.forzar });
    if (paso.estado === "enviado") resumen.enviados++;
    if (paso.estado === "terminado" || (paso.estado === "enviado" && paso.siguiente === null)) resumen.terminados++;
    if (paso.estado === "error") resumen.fallos++;
    resumen.detalle.push({ email, paso });
  }
  return resumen;
}
