// Bandeja general de correo · fase F0 (medir). Diseño: vault →
// "Sistema · Arquitectura v4 — bandeja general de correo".
//
// Apunta en correo_entrada las CABECERAS de todo lo que entra en el buzón
// (también lo que ya llevan charlas o magia, marcado como categoria 'via'),
// y lo clasifica solo con reglas: sin IA, sin cuerpo y sin tocar los flags
// del buzón (imapflow lee con BODY.PEEK).
//
// Regla de oro: nada de aquí puede romper el lector de charlas y magia.
// Si las tablas no existen (SQL sin ejecutar) o falla algo, se desactiva en
// silencio y el lector sigue como siempre.

import { ImapFlow, type FetchMessageObject } from "imapflow";
import { supabaseCharlas } from "./charlas";

export type Tratamiento = "completo" | "solo_fecha" | "solo_cabecera" | "silenciado" | "sin_regla";
export type Categoria = "solicitud" | "conversacion" | "newsletter" | "tramite" | "aviso" | "ruido" | "via" | "sin_clasificar";
export interface Regla {
  patron: string;
  tratamiento: Exclude<Tratamiento, "sin_regla">;
  categoria: Exclude<Categoria, "via" | "sin_clasificar"> | null;
}
export type Reglas = Map<string, Regla>;

/** Cabeceras que pide el lector además de References (para saber si es un envío masivo). */
export const CABECERAS_LECTOR = ["references", "list-unsubscribe", "list-id", "precedence", "auto-submitted"];

const IMAP_HOST = "imap.serviciodecorreo.es";
const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const limpiarId = (id: string | null | undefined) => (id ?? "").trim().replace(/^<|>$/g, "");

/** Valor de una cabecera dentro del bloque que devuelve imapflow (respeta las líneas plegadas). */
export function extraerCabecera(bloque: string | Buffer | null | undefined, nombre: string): string | null {
  if (!bloque) return null;
  const texto = String(bloque).replace(/\r?\n[ \t]+/g, " ");
  const re = new RegExp(`^${nombre.replace(/[-]/g, "\\-")}[ \\t]*:[ \\t]*(.*)$`, "im");
  const m = texto.match(re);
  return m ? m[1].trim() : null;
}

export interface CabecerasMasivo {
  list_unsubscribe: boolean;
  list_id: string | null;
  precedence: string | null;
  auto_submitted: string | null;
}

export function analizarCabeceras(bloque: string | Buffer | null | undefined): CabecerasMasivo {
  return {
    list_unsubscribe: !!extraerCabecera(bloque, "list-unsubscribe"),
    list_id: extraerCabecera(bloque, "list-id"),
    precedence: extraerCabecera(bloque, "precedence")?.toLowerCase() ?? null,
    auto_submitted: extraerCabecera(bloque, "auto-submitted")?.toLowerCase() ?? null,
  };
}

const NO_REPLY = /^(no-?reply|noreply|do-?not-?reply|mailer-daemon|postmaster|notifications?|notificaciones|bounce[s]?)([+.\-_][^@]*)?@/i;

export function esMasivo(c: CabecerasMasivo, de: string): boolean {
  return (
    c.list_unsubscribe ||
    !!c.list_id ||
    (!!c.precedence && /^(bulk|list|junk)/.test(c.precedence)) ||
    (!!c.auto_submitted && !c.auto_submitted.startsWith("no")) ||
    NO_REPLY.test(de)
  );
}

/** Reglas confirmadas por Alain. null = la tabla no existe todavía (no se registra nada). */
export async function cargarReglas(): Promise<Reglas | null> {
  const { data, error } = await supabaseCharlas().from("correo_remitentes").select("patron, tratamiento, categoria").eq("creado_por", "alain");
  if (error) return null;
  return new Map((data ?? []).map((r) => [norm(r.patron as string), r as Regla]));
}

export function reglaDe(reglas: Reglas, de: string): Regla | null {
  const email = norm(de);
  if (!email) return null;
  return reglas.get(email) ?? reglas.get("@" + (email.split("@")[1] ?? "")) ?? null;
}

/**
 * Orden: 1) vía (lo que ya lleva charlas o magia nunca se esconde con una
 * regla), 2) regla del remitente o del dominio, 3) cabeceras de envío
 * masivo o no-reply → aviso, 4) sin clasificar (en F1 lo mirará Haiku).
 */
export function clasificarPorReglas(p: { de: string; masivo: boolean; via: string | null; reglas: Reglas }): {
  tratamiento: Tratamiento;
  categoria: Categoria;
  clasificado_por: "via" | "regla" | "cabeceras" | null;
} {
  const regla = reglaDe(p.reglas, p.de);
  if (p.via) return { tratamiento: regla?.tratamiento ?? "completo", categoria: "via", clasificado_por: "via" };
  if (regla) return { tratamiento: regla.tratamiento, categoria: regla.categoria ?? (p.masivo ? "aviso" : "sin_clasificar"), clasificado_por: "regla" };
  if (p.masivo) return { tratamiento: "sin_regla", categoria: "aviso", clasificado_por: "cabeceras" };
  return { tratamiento: "sin_regla", categoria: "sin_clasificar", clasificado_por: null };
}

/** Fila de correo_entrada a partir de lo que ya tiene el lector (cabeceras, sin cuerpo). */
export function filaEntrada(p: {
  m: FetchMessageObject;
  carpeta: string;
  messageId: string;
  referencias: string[];
  via: string | null;
  viaRef: string | null;
  reglas: Reglas;
  buzon?: string;
}): Record<string, unknown> {
  const env = p.m.envelope ?? {};
  const de = norm(env.from?.[0]?.address);
  const cab = analizarCabeceras(p.m.headers);
  const masivo = esMasivo(cab, de);
  const c = clasificarPorReglas({ de, masivo, via: p.via, reglas: p.reglas });
  return {
    buzon: p.buzon ?? "alain",
    carpeta: p.carpeta,
    uid: p.m.uid,
    message_id: p.messageId,
    in_reply_to: limpiarId(env.inReplyTo) || null,
    referencias: p.referencias,
    direccion: "entrante",
    de: de || null,
    de_nombre: env.from?.[0]?.name || null,
    dominio: de.split("@")[1] || null,
    para: [...(env.to ?? []), ...(env.cc ?? [])].map((a) => norm(a.address)).filter(Boolean),
    asunto: env.subject ?? null,
    fecha: env.date ? new Date(env.date).toISOString() : null,
    masivo,
    cabeceras: cab,
    tratamiento: c.tratamiento,
    categoria: c.categoria,
    clasificado_por: c.clasificado_por,
    via: p.via,
    via_ref: p.viaRef,
    seen_buzon: p.m.flags ? p.m.flags.has("\\Seen") : null,
    estado: "nuevo",
  };
}

/** Guarda filas sin lanzar nunca: devuelve cuántas se mandaron o el error. */
export async function guardarEntradas(filas: Record<string, unknown>[]): Promise<{ guardadas: number; error?: string }> {
  if (!filas.length) return { guardadas: 0 };
  try {
    const { error } = await supabaseCharlas().from("correo_entrada").upsert(filas, { onConflict: "message_id", ignoreDuplicates: true });
    if (error) return { guardadas: 0, error: error.message };
    return { guardadas: filas.length };
  } catch (e) {
    return { guardadas: 0, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Histórico: una sola vez, las cabeceras de los últimos N días de INBOX
// (por defecto 30), por tandas y fuera de las ventanas de IA. El avance se
// guarda en charlas_config.correo_historico; al terminar, hecho = true.
// ---------------------------------------------------------------------------
interface EstadoHistorico {
  hecho?: boolean;
  uidvalidity?: string;
  ultimo_uid?: number;
  tope_uid?: number;
  guardadas?: number;
  error?: string;
}

async function leerEstado(): Promise<EstadoHistorico> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", "correo_historico").maybeSingle();
  return (data?.valor as EstadoHistorico) ?? {};
}
async function guardarEstado(e: EstadoHistorico) {
  await supabaseCharlas()
    .from("charlas_config")
    .upsert({ clave: "correo_historico", valor: { ...e, en: new Date().toISOString() }, actualizado_en: new Date().toISOString() })
    .then(() => null, () => null);
}

/** message_id → vía, a partir de lo que ya guardaron charlas y magia en el periodo. */
async function viasConocidas(desde: Date): Promise<Map<string, { via: string; ref: string | null }>> {
  const supabase = supabaseCharlas();
  const vias = new Map<string, { via: string; ref: string | null }>();
  for (const [tabla, via, col] of [["charlas_mensajes", "charlas", "centro_id"], ["crm_mensajes", "magia", "ficha_id"]] as const) {
    for (let i = 0; ; i += 1000) {
      const { data, error } = await supabase.from(tabla).select(`message_id, ${col}`).gte("fecha", desde.toISOString()).range(i, i + 999);
      if (error || !data) break;
      for (const r of data as unknown as Record<string, string | null>[]) if (r.message_id) vias.set(r.message_id, { via, ref: r[col] ?? null });
      if (data.length < 1000) break;
    }
  }
  return vias;
}

export async function indexarHistorico(opciones: { presupuestoMs: number }): Promise<{ hecho: boolean; guardadas: number; restantes?: number; error?: string } | null> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const estado = await leerEstado();
  if (estado.hecho) return null;
  const reglas = await cargarReglas();
  if (!reglas) return null; // SQL sin ejecutar
  const user = process.env.CHARLAS_MAIL_USER;
  const pass = process.env.CHARLAS_MAIL_PASS;
  if (!user || !pass) return null;

  const { data: dias } = await supabase.from("charlas_config").select("valor").eq("clave", "correo_historico_dias").maybeSingle();
  const desde = new Date(Date.now() - Number(dias?.valor ?? 30) * 86400000);
  const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: { user, pass }, logger: false });
  let guardadas = 0;
  try {
    await cliente.connect();
    const lock = await cliente.getMailboxLock("INBOX");
    try {
      const uidvalidity = String(cliente.mailbox ? cliente.mailbox.uidValidity : "");
      const mismo = estado.uidvalidity === uidvalidity;
      let uids = ((await cliente.search({ since: desde }, { uid: true })) || []) as number[];
      uids.sort((a, b) => a - b);
      // Tope fijo: lo que llegue después lo apunta el lector normal.
      const tope = mismo && estado.tope_uid ? estado.tope_uid : (uids[uids.length - 1] ?? 0);
      const desdeUid = mismo ? Number(estado.ultimo_uid ?? 0) : 0;
      uids = uids.filter((u) => u > desdeUid && u <= tope);
      guardadas = mismo ? Number(estado.guardadas ?? 0) : 0;
      const vias = await viasConocidas(desde);
      let ultimo = desdeUid;
      for (let i = 0; i < uids.length; i += 100) {
        if (Date.now() - inicio > opciones.presupuestoMs) break;
        const tanda = uids.slice(i, i + 100);
        const msgs: FetchMessageObject[] = await cliente.fetchAll(tanda.join(","), { uid: true, envelope: true, flags: true, headers: CABECERAS_LECTOR }, { uid: true });
        const filas: Record<string, unknown>[] = [];
        for (const m of msgs) {
          const env = m.envelope ?? {};
          const messageId = limpiarId(env.messageId) || `sin-id-INBOX-${uidvalidity}-${m.uid}`;
          const refs = [
            ...new Set(
              [limpiarId(env.inReplyTo), ...Array.from(String(extraerCabecera(m.headers, "references") ?? "").matchAll(/<([^>]+)>/g)).map((x) => x[1].trim())].filter(Boolean),
            ),
          ];
          const v = vias.get(messageId) ?? null;
          filas.push(filaEntrada({ m, carpeta: "INBOX", messageId, referencias: refs, via: v?.via ?? null, viaRef: v?.ref ?? null, reglas }));
        }
        const r = await guardarEntradas(filas);
        if (r.error) {
          await guardarEstado({ ...estado, uidvalidity, tope_uid: tope, ultimo_uid: ultimo, guardadas, error: r.error });
          return { hecho: false, guardadas, error: r.error };
        }
        guardadas += r.guardadas;
        ultimo = tanda[tanda.length - 1];
        await guardarEstado({ uidvalidity, tope_uid: tope, ultimo_uid: ultimo, guardadas, hecho: false });
      }
      const restantes = uids.filter((u) => u > ultimo).length;
      if (restantes === 0) await guardarEstado({ uidvalidity, tope_uid: tope, ultimo_uid: ultimo, guardadas, hecho: true });
      return { hecho: restantes === 0, guardadas, restantes };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { hecho: false, guardadas, error: (e as Error).message };
  } finally {
    await cliente.logout().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Otros buzones (newsletter@, entrenatzaile@, los de niala.es). Lector aparte
// y solo de cabeceras: el de alain@ (leerBuzon, con charlas y magia) no se
// toca. Cada buzón se activa solo cuando su contraseña está en Vercel:
//   MAIL_PASS_<CLAVE>   obligatoria
//   MAIL_USER_<CLAVE>   opcional (por defecto, la propia dirección)
//   MAIL_HOST_<CLAVE>   opcional (por defecto, imap.serviciodecorreo.es, Arsys)
// La primera vez lee los últimos 30 días; después, solo lo nuevo. El avance
// va en charlas_config.correo_cursor_<id>.
// ---------------------------------------------------------------------------
export const BUZONES_EXTRA = [
  { id: "newsletter", direccion: "newsletter@alainzulaika.com", clave: "NEWSLETTER" },
  { id: "entrenatzaile", direccion: "entrenatzaile@alainzulaika.com", clave: "ENTRENATZAILE" },
  { id: "registros_niala", direccion: "registros@niala.es", clave: "REGISTROS_NIALA" },
  { id: "newsletter_niala", direccion: "newsletter@niala.es", clave: "NEWSLETTER_NIALA" },
] as const;

export function configBuzon(b: (typeof BUZONES_EXTRA)[number]) {
  return {
    ...b,
    host: process.env[`MAIL_HOST_${b.clave}`] || IMAP_HOST,
    user: process.env[`MAIL_USER_${b.clave}`] || b.direccion,
    pass: process.env[`MAIL_PASS_${b.clave}`] || "",
  };
}

interface Cursor {
  uidvalidity?: string;
  ultimo_uid?: number;
  guardadas?: number;
  al_dia?: boolean;
  error?: string | null;
  en?: string;
}

async function leerUnBuzon(b: ReturnType<typeof configBuzon>, reglas: Reglas, hasta: number): Promise<Cursor> {
  const supabase = supabaseCharlas();
  const clave = `correo_cursor_${b.id}`;
  const { data } = await supabase.from("charlas_config").select("valor").eq("clave", clave).maybeSingle();
  const previo = (data?.valor as Cursor) ?? {};
  const guardar = async (c: Cursor) => {
    await supabase
      .from("charlas_config")
      .upsert({ clave, valor: { ...c, en: new Date().toISOString() }, actualizado_en: new Date().toISOString() })
      .then(() => null, () => null);
    return c;
  };
  const cliente = new ImapFlow({ host: b.host, port: 993, secure: true, auth: { user: b.user, pass: b.pass }, logger: false });
  let estado: Cursor = { ...previo, error: null };
  try {
    await cliente.connect();
    const lock = await cliente.getMailboxLock("INBOX");
    try {
      const uidvalidity = String(cliente.mailbox ? cliente.mailbox.uidValidity : "");
      const mismo = previo.uidvalidity === uidvalidity && Number(previo.ultimo_uid) > 0;
      let ultimo = mismo ? Number(previo.ultimo_uid) : 0;
      let uids = (mismo
        ? ((await cliente.search({ uid: `${ultimo + 1}:*` }, { uid: true })) || [])
        : ((await cliente.search({ since: new Date(Date.now() - 30 * 86400000) }, { uid: true })) || [])) as number[];
      uids = uids.filter((u) => u > ultimo).sort((a, b) => a - b);
      let guardadas = mismo ? Number(previo.guardadas ?? 0) : 0;
      estado = { uidvalidity, ultimo_uid: ultimo, guardadas, al_dia: uids.length === 0, error: null };
      for (let i = 0; i < uids.length; i += 100) {
        if (Date.now() > hasta) break;
        const tanda = uids.slice(i, i + 100);
        const msgs: FetchMessageObject[] = await cliente.fetchAll(tanda.join(","), { uid: true, envelope: true, flags: true, headers: CABECERAS_LECTOR }, { uid: true });
        const filas = msgs.map((m) => {
          const env = m.envelope ?? {};
          const messageId = limpiarId(env.messageId) || `sin-id-${b.id}-${uidvalidity}-${m.uid}`;
          const refs = [...new Set([limpiarId(env.inReplyTo), ...Array.from(String(extraerCabecera(m.headers, "references") ?? "").matchAll(/<([^>]+)>/g)).map((x) => x[1].trim())].filter(Boolean))];
          return filaEntrada({ m, carpeta: "INBOX", messageId, referencias: refs, via: null, viaRef: null, reglas, buzon: b.id });
        });
        const r = await guardarEntradas(filas);
        if (r.error) return await guardar({ ...estado, error: r.error });
        guardadas += r.guardadas;
        ultimo = tanda[tanda.length - 1];
        estado = { uidvalidity, ultimo_uid: ultimo, guardadas, al_dia: ultimo >= uids[uids.length - 1], error: null };
        await guardar(estado);
      }
      return await guardar(estado);
    } finally {
      lock.release();
    }
  } catch (e) {
    const x = e as Error & { authenticationFailed?: boolean; responseText?: string };
    const msg = x.authenticationFailed ? "Usuario o contraseña incorrectos" : x.responseText || x.message;
    return await guardar({ ...estado, error: msg });
  } finally {
    await cliente.logout().catch(() => {});
  }
}

/** Lee lo nuevo de los buzones con contraseña. Nunca lanza. */
export async function leerBuzonesExtra(opciones: { presupuestoMs: number }): Promise<Record<string, Cursor | "sin_contraseña"> | null> {
  const reglas = await cargarReglas().catch(() => null);
  if (!reglas) return null; // SQL sin ejecutar
  const hasta = Date.now() + opciones.presupuestoMs;
  const res: Record<string, Cursor | "sin_contraseña"> = {};
  for (const base of BUZONES_EXTRA) {
    const b = configBuzon(base);
    if (!b.pass) {
      res[b.id] = "sin_contraseña";
      continue;
    }
    if (Date.now() > hasta) break;
    res[b.id] = await leerUnBuzon(b, reglas, hasta).catch((e) => ({ error: (e as Error).message }));
  }
  return res;
}

/** Estado de cada buzón para el panel (sin enseñar nunca contraseñas). */
export async function estadoBuzones() {
  const claves = ["correo_historico", ...BUZONES_EXTRA.map((b) => `correo_cursor_${b.id}`)];
  const { data } = await supabaseCharlas().from("charlas_config").select("clave, valor").in("clave", claves);
  const v = new Map((data ?? []).map((r) => [r.clave as string, r.valor as Record<string, unknown>]));
  return [
    { id: "alain", direccion: "alain@alainzulaika.com", configurado: true, variable: null as string | null, estado: v.get("correo_historico") ?? null },
    ...BUZONES_EXTRA.map((b) => ({ id: b.id, direccion: b.direccion, configurado: !!configBuzon(b).pass, variable: `MAIL_PASS_${b.clave}`, estado: v.get(`correo_cursor_${b.id}`) ?? null })),
  ];
}

// ---------------------------------------------------------------------------
// Panel · Bandeja general › Remitentes (F0)
// ---------------------------------------------------------------------------

/** Dominios de correo personal o compartidos: una regla de dominio aquí taparía a medio mundo. */
export const DOMINIOS_GENERICOS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "live.es", "msn.com",
  "yahoo.com", "yahoo.es", "ymail.com", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me", "gmx.com", "gmx.es",
  "euskalnet.net", "telefonica.net", "movistar.es", "hezkuntza.net", "ikastola.eus",
]);

const TRATAMIENTOS = ["completo", "solo_fecha", "solo_cabecera", "silenciado"] as const;
const CATEGORIAS = ["solicitud", "conversacion", "newsletter", "tramite", "aviso", "ruido"] as const;

export interface FilaRemitente {
  de: string;
  nombre: string | null;
  dominio: string;
  n: number;
  masivos: number;
  ultimo_asunto: string | null;
  ultima_fecha: string | null;
  categoria: Categoria;
  via: string | null;
  buzones: string[];
}

export interface PanelRemitentes {
  sin_tabla?: boolean;
  desde: string | null;
  total: number;
  dias_laborables: number;
  por_categoria: Record<string, number>;
  remitentes: FilaRemitente[];
  reglas: { patron: string; tratamiento: string; categoria: string | null; nota: string | null; creado_por: string }[];
  /** Dominios masivos sin regla (≥ 4 en el periodo y ≥ 80 % masivo): candidatos a silenciar. */
  sugerencias_silenciar: { dominio: string; n: number }[];
  historico: Record<string, unknown> | null;
  genericos: string[];
  buzones: Awaited<ReturnType<typeof estadoBuzones>>;
}

function diasLaborables(desde: Date, hasta: Date): number {
  let n = 0;
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  while (d <= hasta) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.max(1, n);
}

export async function panelRemitentes(dias = 30): Promise<PanelRemitentes> {
  const supabase = supabaseCharlas();
  const desde = new Date(Date.now() - dias * 86400000);
  const filas: { buzon: string; de: string | null; de_nombre: string | null; dominio: string | null; masivo: boolean; asunto: string | null; fecha: string | null; categoria: Categoria; via: string | null }[] = [];
  for (let i = 0; i < 30000; i += 1000) {
    const { data, error } = await supabase
      .from("correo_entrada")
      .select("buzon, de, de_nombre, dominio, masivo, asunto, fecha, categoria, via")
      .eq("direccion", "entrante")
      .gte("fecha", desde.toISOString())
      .order("fecha", { ascending: false })
      .range(i, i + 999);
    if (error) {
      return { sin_tabla: true, desde: null, total: 0, dias_laborables: 1, por_categoria: {}, remitentes: [], reglas: [], sugerencias_silenciar: [], historico: null, genericos: [...DOMINIOS_GENERICOS], buzones: [] };
    }
    filas.push(...((data ?? []) as typeof filas));
    if (!data || data.length < 1000) break;
  }
  const [{ data: reglas }, { data: hist }, buzones] = await Promise.all([
    supabase.from("correo_remitentes").select("patron, tratamiento, categoria, nota, creado_por").order("patron"),
    supabase.from("charlas_config").select("valor").eq("clave", "correo_historico").maybeSingle(),
    estadoBuzones(),
  ]);

  const porCategoria: Record<string, number> = {};
  const porDe = new Map<string, FilaRemitente>();
  let primera: string | null = null;
  for (const f of filas) {
    porCategoria[f.categoria] = (porCategoria[f.categoria] ?? 0) + 1;
    if (f.fecha && (!primera || f.fecha < primera)) primera = f.fecha;
    const de = f.de ?? "(sin remitente)";
    const r = porDe.get(de);
    if (!r) {
      // Las filas vienen de la más nueva a la más vieja: la primera manda en asunto, fecha y categoría.
      porDe.set(de, { de, nombre: f.de_nombre, dominio: f.dominio ?? "", n: 1, masivos: f.masivo ? 1 : 0, ultimo_asunto: f.asunto, ultima_fecha: f.fecha, categoria: f.categoria, via: f.via, buzones: [f.buzon] });
    } else {
      r.n++;
      if (f.masivo) r.masivos++;
      if (!r.via && f.via) r.via = f.via;
      if (!r.buzones.includes(f.buzon)) r.buzones.push(f.buzon);
    }
  }

  const conRegla = new Set((reglas ?? []).filter((r) => r.creado_por === "alain").map((r) => r.patron));
  const porDominio = new Map<string, { n: number; masivos: number }>();
  for (const r of porDe.values()) {
    if (!r.dominio) continue;
    const d = porDominio.get(r.dominio) ?? { n: 0, masivos: 0 };
    d.n += r.n;
    d.masivos += r.masivos;
    porDominio.set(r.dominio, d);
  }
  const sugerencias = [...porDominio.entries()]
    .filter(([d, v]) => !DOMINIOS_GENERICOS.has(d) && !conRegla.has("@" + d) && v.n >= 4 && v.masivos / v.n >= 0.8)
    .map(([dominio, v]) => ({ dominio, n: v.n }))
    .sort((a, b) => b.n - a.n);

  const desdeReal = primera ? new Date(primera) : desde;
  return {
    desde: primera,
    total: filas.length,
    dias_laborables: diasLaborables(desdeReal, new Date()),
    por_categoria: porCategoria,
    remitentes: [...porDe.values()].sort((a, b) => b.n - a.n),
    reglas: (reglas ?? []) as PanelRemitentes["reglas"],
    sugerencias_silenciar: sugerencias,
    historico: (hist?.valor as Record<string, unknown>) ?? null,
    genericos: [...DOMINIOS_GENERICOS],
    buzones,
  };
}

/** Normaliza y valida un patrón: 'x@dominio.com' o '@dominio.com'. Lanza con un mensaje para el panel. */
export function validarPatron(patron: unknown): string {
  const p = norm(String(patron ?? ""));
  if (!/^[^@\s]*@[\w-]+(\.[\w-]+)+$/.test(p)) throw new Error("Patrón inválido: usa un email (x@dominio.com) o un dominio (@dominio.com).");
  if (p.startsWith("@") && DOMINIOS_GENERICOS.has(p.slice(1))) throw new Error(`${p} es un dominio de correo personal o compartido: pon la regla al email concreto.`);
  return p;
}

export async function guardarRegla(b: { patron: unknown; tratamiento: unknown; categoria?: unknown; nota?: unknown }): Promise<{ patron: string; reclasificadas: number }> {
  const patron = validarPatron(b.patron);
  if (!TRATAMIENTOS.includes(b.tratamiento as (typeof TRATAMIENTOS)[number])) throw new Error("Tratamiento inválido.");
  const categoria = b.categoria == null || b.categoria === "" ? null : String(b.categoria);
  if (categoria && !CATEGORIAS.includes(categoria as (typeof CATEGORIAS)[number])) throw new Error("Categoría inválida.");
  const { error } = await supabaseCharlas()
    .from("correo_remitentes")
    .upsert({ patron, tratamiento: b.tratamiento, categoria, nota: typeof b.nota === "string" && b.nota.trim() ? b.nota.trim() : null, creado_por: "alain", actualizado_en: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { patron, reclasificadas: await reclasificar(patron) };
}

export async function quitarRegla(patronEntrada: unknown): Promise<{ patron: string; reclasificadas: number }> {
  const patron = norm(String(patronEntrada ?? ""));
  if (!patron) throw new Error("Falta el patrón.");
  const { error } = await supabaseCharlas().from("correo_remitentes").delete().eq("patron", patron);
  if (error) throw new Error(error.message);
  return { patron, reclasificadas: await reclasificar(patron) };
}

/** Vuelve a clasificar lo ya apuntado de ese email o dominio con las reglas de ahora (lo de una vía no se toca). */
async function reclasificar(patron: string): Promise<number> {
  const supabase = supabaseCharlas();
  const reglas = (await cargarReglas()) ?? new Map();
  const campo = patron.startsWith("@") ? "dominio" : "de";
  const valor = patron.startsWith("@") ? patron.slice(1) : patron;
  const { data } = await supabase.from("correo_entrada").select("id, de, masivo, tratamiento, categoria, clasificado_por").eq(campo, valor).neq("categoria", "via").limit(5000);
  const grupos = new Map<string, string[]>();
  for (const f of data ?? []) {
    if (f.clasificado_por === "alain" || f.clasificado_por === "ia") continue; // decisiones por correo: se respetan
    const c = clasificarPorReglas({ de: f.de ?? "", masivo: !!f.masivo, via: null, reglas });
    if (c.tratamiento === f.tratamiento && c.categoria === f.categoria && c.clasificado_por === f.clasificado_por) continue;
    const k = JSON.stringify(c);
    grupos.set(k, [...(grupos.get(k) ?? []), f.id as string]);
  }
  let n = 0;
  for (const [k, ids] of grupos) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("correo_entrada").update(JSON.parse(k)).in("id", ids.slice(i, i + 200));
      if (!error) n += Math.min(200, ids.length - i);
    }
  }
  return n;
}
