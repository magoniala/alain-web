// Servidor de la preventa de las masterclasses (diciembre 2026, Entrenatzaile):
// compras, cobro con Stripe Checkout, confirmación desde el webhook, devoluciones,
// recuento del 10-dic, entregas y acceso a los vídeos.
//
// Reglas (qué se vende, quién cuenta, cuánto se devuelve) en lib/preventa-reglas.ts.
// Textos en lib/preventa-textos.ts. Tablas en sql/preventa_masterclass.sql.
//
// SERVIDOR. No importar desde un componente de cliente.

import type Stripe from "stripe";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { altaEmbudo } from "@/lib/embudos";
import {
  FECHAS,
  PRECIO_CENT,
  accesoHasta,
  casoRecuento,
  devolucionTrasRecuento,
  euros,
  faseEn,
  nombreLinea,
  normalizarEmail,
  ofertaPara,
  resultado,
  tieneA,
  tieneB,
  type CompraRegla,
  type Fase,
  type Idioma,
  type Oferta,
  type Producto,
  type Resultado,
} from "@/lib/preventa-reglas";
import {
  BASE_ENT,
  CASILLA_NEWSLETTER,
  correoAcuseDesistimiento,
  correoConfirmacion,
  correoEnlaceAcceso,
  correoEntrega,
  correoRecuento,
  infoPrevia,
  rutaPreventa,
} from "@/lib/preventa-textos";

const DE = resolveNewsletterFrom("entrenatzaile@alainzulaika.com");
const AVISO_INTERNO = "newsletter@alainzulaika.com";
const DE_INTERNO = "Entrenatzaile <alain@alainzulaika.com>";

let cliente: SupabaseClient | null = null;
export function db() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

export interface Compra extends CompraRegla {
  id: string;
  nombre: string | null;
  idioma: Idioma;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  pagado_en: string | null;
  newsletter_ok: boolean;
  confirmacion_enviada: boolean;
  confirmacion_error: string | null;
  created_at: string;
}

const CAMPOS =
  "id, email, nombre, idioma, producto, importe_cent, estado, devuelto_cent, prueba, stripe_session_id, stripe_payment_intent, pagado_en, newsletter_ok, confirmacion_enviada, confirmacion_error, created_at";

// ---------------------------------------------------------------------------
// Reloj y ajustes
// ---------------------------------------------------------------------------

/**
 * La hora "de la preventa". En local y en preview se puede simular con
 * PREVENTA_AHORA=2026-12-06T10:00:00+01:00 para probar las fases; en
 * producción manda siempre el reloj de verdad.
 */
export function ahora(): Date {
  const sim = process.env.PREVENTA_AHORA;
  if (sim && process.env.VERCEL_ENV !== "production") {
    const d = new Date(sim);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function leerConfig(): Promise<Record<string, string>> {
  const { data } = await db().from("preventa_config").select("clave, valor");
  const r: Record<string, string> = {};
  for (const f of data ?? []) if (f.valor != null) r[f.clave] = f.valor;
  return r;
}

export async function guardarConfig(clave: string, valor: string | null) {
  const { error } = await db()
    .from("preventa_config")
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: "clave" });
  if (error) throw new Error(error.message);
}

function correosPrueba(cfg: Record<string, string>): Set<string> {
  return new Set(
    (cfg.correos_prueba ?? "")
      .split(/[,\s;]+/)
      .map((e) => normalizarEmail(e))
      .filter(Boolean)
  );
}

/**
 * La fase que vale para este correo. Para todo el mundo, la del reloj. Para
 * los correos de prueba de Alain (panel → Preventa), la que él haya puesto en
 * "prueba_fase", para poder hacer una compra real de prueba antes del 1-dic.
 */
export async function faseParaEmail(email: string | null): Promise<{ fase: Fase; prueba: boolean }> {
  const real = faseEn(ahora());
  if (!email) return { fase: real, prueba: false };
  const cfg = await leerConfig();
  if (correosPrueba(cfg).has(normalizarEmail(email))) {
    const f = cfg.prueba_fase === "A" || cfg.prueba_fase === "B" ? cfg.prueba_fase : "B";
    return { fase: f, prueba: true };
  }
  return { fase: real, prueba: false };
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function todasLasCompras(): Promise<Compra[]> {
  const { data, error } = await db().from("preventa_compras").select(CAMPOS).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Compra[];
}

export async function comprasDe(email: string): Promise<Compra[]> {
  const { data, error } = await db().from("preventa_compras").select(CAMPOS).ilike("email", normalizarEmail(email));
  if (error) throw new Error(error.message);
  return (data ?? []) as Compra[];
}

export async function excluidos(): Promise<string[]> {
  const { data } = await db().from("preventa_excluidos").select("email");
  return (data ?? []).map((f) => f.email as string);
}

/** Cuenta en vivo (n de 3 por producto). */
export async function cuentaActual(): Promise<Resultado> {
  const [compras, fuera] = await Promise.all([todasLasCompras(), excluidos()]);
  return resultado(compras, fuera);
}

/** El resultado congelado del recuento del 10-dic (o null si aún no se ha hecho). */
export async function recuentoCongelado(): Promise<(Resultado & { en: string }) | null> {
  const cfg = await leerConfig();
  if (!cfg.recuento_resultado) return null;
  try {
    return JSON.parse(cfg.recuento_resultado);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Compra: resumen y Checkout
// ---------------------------------------------------------------------------

export async function ofertaParaEmail(email: string): Promise<{ oferta: Oferta; prueba: boolean }> {
  const { fase, prueba } = await faseParaEmail(email);
  const compras = await comprasDe(email);
  return { oferta: ofertaPara(fase, compras), prueba };
}

export async function crearCheckout(a: {
  email: string;
  nombre: string | null;
  idioma: Idioma;
  newsletter: boolean;
  retorno: { base: string; prefijo: string };
}): Promise<{ url: string } | { error: string; oferta?: Oferta }> {
  const { oferta, prueba } = await ofertaParaEmail(a.email);
  if (oferta.tipo !== "comprar") return { error: oferta.tipo, oferta };

  const lineas = infoPrevia(oferta.producto, oferta.importe_cent, a.idioma);
  const { data: fila, error } = await db()
    .from("preventa_compras")
    .insert({
      email: a.email,
      nombre: a.nombre,
      idioma: a.idioma,
      producto: oferta.producto,
      importe_cent: oferta.importe_cent,
      prueba,
      newsletter_ok: a.newsletter,
      newsletter_texto: a.newsletter ? CASILLA_NEWSLETTER[a.idioma] : null,
      newsletter_at: a.newsletter ? new Date().toISOString() : null,
      info_previa: lineas.join("\n"),
    })
    .select("id")
    .single();
  if (error || !fila) {
    console.error("preventa: no se ha podido guardar la compra:", error?.message);
    return { error: "interno" };
  }

  const { base, prefijo } = a.retorno;
  const pagina = rutaPreventa(a.idioma);
  try {
    const sesion = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: oferta.importe_cent,
            product_data: { name: nombreLinea(oferta.producto, a.idioma) },
          },
        },
      ],
      customer_email: a.email,
      metadata: { tipo: "preventa", compra_id: fila.id, producto: oferta.producto, idioma: a.idioma },
      payment_intent_data: {
        // Con receipt_email Stripe manda el justificante del pago (en live).
        receipt_email: a.email,
        description: nombreLinea(oferta.producto, a.idioma),
        metadata: { tipo: "preventa", compra_id: fila.id },
      },
      // 35 minutos: el mínimo de Stripe es 30. Una sesión abierta antes del
      // cierre se puede terminar de pagar unos minutos después: la oferta se
      // aceptó dentro de plazo.
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
      success_url: `${base}${prefijo}${rutaPreventa(a.idioma, "gracias")}?p=${oferta.producto}`,
      cancel_url: `${base}${prefijo}${pagina}`,
      locale: "es",
      custom_text: {
        submit: { message: lineas.slice(1, 5).join(" ") },
      },
    });
    await db().from("preventa_compras").update({ stripe_session_id: sesion.id }).eq("id", fila.id);
    if (!sesion.url) return { error: "interno" };
    return { url: sesion.url };
  } catch (err) {
    console.error("preventa: error creando la sesión de Stripe:", err);
    await db().from("preventa_compras").update({ estado: "expirado" }).eq("id", fila.id);
    return { error: "stripe" };
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export const esDePreventa = (s: Stripe.Checkout.Session) => s.metadata?.tipo === "preventa";

/** checkout.session.completed de una compra de la preventa. */
export async function confirmarCompraPreventa(sesion: Stripe.Checkout.Session) {
  const id = sesion.metadata?.compra_id;
  if (!id) {
    console.error("preventa webhook: sesión sin compra_id:", sesion.id);
    return;
  }
  if (sesion.payment_status !== "paid") {
    console.error("preventa webhook: sesión completada sin pago:", sesion.id, sesion.payment_status);
    return;
  }
  const paymentIntent = typeof sesion.payment_intent === "string" ? sesion.payment_intent : (sesion.payment_intent?.id ?? null);

  // Segundo candado (el primero es stripe_eventos): solo pasa a pagado una vez.
  const { data: c } = await db()
    .from("preventa_compras")
    .update({ estado: "pagado", stripe_payment_intent: paymentIntent, pagado_en: new Date().toISOString() })
    .eq("id", id)
    .in("estado", ["pendiente", "expirado"])
    .select(CAMPOS)
    .maybeSingle();
  if (!c) return;
  const compra = c as Compra;

  // Newsletter: solo si marcó la casilla (aparte y sin marcar). Al que ya
  // estaba no se le toca nada.
  if (compra.newsletter_ok) {
    await altaEmbudo({ origen: "preventa-masterclass", email: compra.email, nombre: compra.nombre, idioma: compra.idioma }).catch((e) =>
      console.error("preventa: alta en newsletter fallida:", compra.email, e)
    );
  }

  // Confirmación al comprador. Si falla, queda marcado en la fila (el panel
  // lo enseña) y el pago sigue guardado.
  try {
    const { asunto, html } = correoConfirmacion({
      producto: compra.producto,
      importeCent: compra.importe_cent,
      nombre: compra.nombre,
      idioma: compra.idioma,
      accesoHasta: accesoHasta(new Date(compra.pagado_en!)),
    });
    await sendEmail(compra.nombre ? `${compra.nombre} <${compra.email}>` : compra.email, asunto, html, DE);
    await db().from("preventa_compras").update({ confirmacion_enviada: true, confirmacion_error: null }).eq("id", id);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("preventa: pago guardado pero falló la confirmación:", compra.email, err);
    await db().from("preventa_compras").update({ confirmacion_enviada: false, confirmacion_error: m.slice(0, 600) }).eq("id", id);
  }

  // Aviso a Alain, con la cuenta al día y si es una compra repetida.
  try {
    const otras = (await comprasDe(compra.email)).filter((x) => x.id !== compra.id);
    const repetida =
      compra.producto === "B" ? tieneB(otras) : compra.producto === "A" ? tieneA(otras) || tieneB(otras) : tieneA(otras);
    const r = await cuentaActual();
    await sendEmail(
      AVISO_INTERNO,
      `Preventa — ${compra.prueba ? "PRUEBA " : ""}${euros(compra.importe_cent)} · ${compra.producto} · ${compra.nombre ?? compra.email}`,
      `<div style="font-family:monospace;font-size:0.9rem;line-height:1.7;">
        <p><strong>${compra.nombre ?? "(sin nombre)"}</strong> · ${compra.email} · ${compra.idioma}</p>
        <p>Producto: ${compra.producto} · ${euros(compra.importe_cent)}${compra.prueba ? " · COMPRA DE PRUEBA (no cuenta)" : ""}<br>
        Newsletter: ${compra.newsletter_ok ? "sí" : "no"}</p>
        <p>Cuenta: B ${r.cuenta.B} de 3 · A ${r.cuenta.A} de 3</p>
        ${repetida ? "<p><strong>OJO: este correo ya tenía esto comprado. Seguramente pagó dos veces: devuélvele una desde /admin → Preventa.</strong></p>" : ""}
      </div>`,
      DE_INTERNO
    );
  } catch (err) {
    console.error("preventa: error en el aviso interno:", err);
  }
}

export async function marcarExpiradaPreventa(sesion: Stripe.Checkout.Session) {
  const id = sesion.metadata?.compra_id;
  if (!id) return;
  await db().from("preventa_compras").update({ estado: "expirado" }).eq("id", id).eq("estado", "pendiente");
}

// ---------------------------------------------------------------------------
// Devoluciones (desde el panel)
// ---------------------------------------------------------------------------

export type MotivoDevolucion = "umbral_no" | "diferencia_a" | "desistimiento" | "manual";

export async function devolver(compraId: string, importeCent: number, motivo: MotivoDevolucion, nota?: string | null) {
  const { data } = await db().from("preventa_compras").select(CAMPOS).eq("id", compraId).maybeSingle();
  const c = data as Compra | null;
  if (!c) throw new Error("No existe esa compra.");
  if (!c.stripe_payment_intent) throw new Error("Esa compra no tiene pago en Stripe.");
  const queda = c.importe_cent - c.devuelto_cent;
  const importe = Math.min(Math.round(importeCent), queda);
  if (importe <= 0) throw new Error("No queda nada por devolver en esa compra.");

  const refund = await getStripe().refunds.create(
    { payment_intent: c.stripe_payment_intent, amount: importe, metadata: { tipo: "preventa", compra_id: c.id, motivo } },
    // Un doble clic no devuelve dos veces.
    { idempotencyKey: `preventa-${c.id}-${c.devuelto_cent}-${importe}` }
  );
  const nuevo = c.devuelto_cent + importe;
  await db()
    .from("preventa_compras")
    .update({ devuelto_cent: nuevo, estado: nuevo >= c.importe_cent ? "devuelto" : "devuelto_parcial" })
    .eq("id", c.id)
    .eq("devuelto_cent", c.devuelto_cent);
  await db()
    .from("preventa_devoluciones")
    .insert({ compra_id: c.id, importe_cent: importe, motivo, nota: nota ?? null, stripe_refund_id: refund.id });
  return { devuelto_cent: importe, refund: refund.id };
}

/** Lo que el recuento manda devolver y aún no se ha devuelto. */
export async function pendientesSegunRecuento(): Promise<{ compra: Compra; importe: number; motivo: MotivoDevolucion }[]> {
  const r = await recuentoCongelado();
  if (!r) return [];
  const compras = await todasLasCompras();
  return compras
    .map((c) => ({ compra: c, importe: devolucionTrasRecuento(c, r), motivo: (r.llegaB ? "diferencia_a" : "umbral_no") as MotivoDevolucion }))
    .filter((x) => x.importe > 0);
}

export async function devolverSegunRecuento() {
  const hechas: string[] = [];
  const errores: string[] = [];
  for (const p of await pendientesSegunRecuento()) {
    try {
      await devolver(p.compra.id, p.importe, p.motivo, "recuento del 10-dic");
      hechas.push(`${p.compra.email} · ${euros(p.importe)}`);
    } catch (e) {
      errores.push(`${p.compra.email}: ${(e as Error).message}`);
    }
  }
  return { hechas, errores };
}

// ---------------------------------------------------------------------------
// Acceso a los vídeos (área de cliente mínima: enlace firmado por correo)
// ---------------------------------------------------------------------------

function firma(email: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_KEY || "preventa")
    .update(`preventa:${normalizarEmail(email)}`)
    .digest("base64url")
    .slice(0, 32);
}

export function firmaValida(email: string, t: string): boolean {
  const a = Buffer.from(firma(email));
  const b = Buffer.from(t ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function enlaceAcceso(email: string, l: Idioma): string {
  return `${BASE_ENT}${rutaPreventa(l, "acceso")}?e=${encodeURIComponent(normalizarEmail(email))}&t=${firma(email)}`;
}

export interface VideoDisponible {
  producto: "A" | "B";
  url: string | null;
  hasta: Date;
}

/**
 * Lo que este correo puede ver ahora: lo que tiene, de un producto que llegó
 * a 3 en el recuento, cuya fecha de entrega ya pasó y dentro de los 24 meses.
 */
export async function videosDe(email: string): Promise<{ disponibles: VideoDisponible[]; proximas: ("A" | "B")[] }> {
  const [compras, r, cfg] = await Promise.all([comprasDe(email), recuentoCongelado(), leerConfig()]);
  const t = ahora();
  const disponibles: VideoDisponible[] = [];
  const proximas: ("A" | "B")[] = [];
  const primeraFecha = (pred: (c: Compra) => boolean) =>
    compras
      .filter((c) => pred(c) && c.pagado_en)
      .map((c) => new Date(c.pagado_en!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

  const ver = (p: "A" | "B", tiene: boolean, llega: boolean, entrega: Date, pred: (c: Compra) => boolean) => {
    if (!tiene || !llega) return;
    if (t < entrega) return void proximas.push(p);
    const desde = primeraFecha(pred);
    if (!desde) return;
    const hasta = accesoHasta(desde);
    if (t > hasta) return;
    disponibles.push({ producto: p, url: cfg[`video_${p}`] || null, hasta });
  };
  // Las compras de prueba de Alain también ven el vídeo: así puede comprobar la entrega.
  ver("B", tieneB(compras), !!r?.llegaB, FECHAS.entregaB, (c) => c.estado === "pagado" || c.estado === "devuelto_parcial");
  ver("A", tieneA(compras), !!r?.llegaA, FECHAS.entregaA, (c) => c.producto !== "B" && c.estado === "pagado" && c.devuelto_cent === 0);
  return { disponibles, proximas };
}

/** "Perdí el enlace": se lo reenvía si tiene alguna compra vigente. No dice si existe o no. */
export async function reenviarEnlace(email: string, l: Idioma) {
  const compras = await comprasDe(email);
  if (!tieneB(compras)) return;
  const { asunto, html } = correoEnlaceAcceso({ idioma: l, enlace: enlaceAcceso(email, l) });
  await sendEmail(email, asunto, html, DE);
}

// ---------------------------------------------------------------------------
// Desistimiento (formulario de la web)
// ---------------------------------------------------------------------------

export async function registrarDesistimiento(a: { email: string; nombre: string | null; mensaje: string | null; idioma: Idioma }) {
  const { error } = await db().from("preventa_desistimientos").insert(a);
  if (error) throw new Error(error.message);
  const compras = await comprasDe(a.email);
  await sendEmail(
    AVISO_INTERNO,
    `Preventa — DESISTIMIENTO: ${a.nombre ?? a.email}`,
    `<div style="font-family:monospace;font-size:0.9rem;line-height:1.7;">
      <p><strong>${a.nombre ?? "(sin nombre)"}</strong> · ${a.email}</p>
      <p>${(a.mensaje ?? "").replace(/</g, "&lt;")}</p>
      <p>Compras de ese correo: ${compras.length ? compras.map((c) => `${c.producto} ${euros(c.importe_cent)} (${c.estado})`).join(" · ") : "NINGUNA con ese correo: búscalo por nombre"}</p>
      <p>Plazo legal para devolver: 14 días naturales desde hoy. Se hace en /admin → Preventa → Devolver (motivo: desistimiento).</p>
    </div>`,
    DE_INTERNO
  ).catch((e) => console.error("preventa: aviso de desistimiento fallido:", e));
  const acuse = correoAcuseDesistimiento({ idioma: a.idioma, nombre: a.nombre });
  await sendEmail(a.email, acuse.asunto, acuse.html, DE).catch((e) => console.error("preventa: acuse de desistimiento fallido:", e));
}

// ---------------------------------------------------------------------------
// Cron: recuento (10-dic) y entregas (28-dic, 10-ene). Va en la pasada de
// /api/charlas/cron (cada 10 min). Cada correo se apunta en preventa_envios
// antes de salir, así que nunca sale dos veces.
// ---------------------------------------------------------------------------

async function apuntar(clave: string, email: string): Promise<boolean> {
  const { error } = await db().from("preventa_envios").insert({ clave, email: normalizarEmail(email) });
  if (!error) return true;
  if (error.code !== "23505") console.error("preventa: no se ha podido apuntar el envío:", clave, email, error.message);
  return false;
}

async function desapuntar(clave: string, email: string) {
  await db().from("preventa_envios").delete().eq("clave", clave).eq("email", normalizarEmail(email));
}

/** Agrupa las compras por correo (la persona es el correo). */
function porPersona(compras: Compra[]) {
  const m = new Map<string, Compra[]>();
  for (const c of compras) {
    const e = normalizarEmail(c.email);
    m.set(e, [...(m.get(e) ?? []), c]);
  }
  return m;
}

const ultimo = (cs: Compra[]) => [...cs].sort((a, b) => (b.pagado_en ?? "").localeCompare(a.pagado_en ?? ""))[0];

export async function cronPreventa(): Promise<Record<string, unknown>> {
  const t = ahora();
  if (t < FECHAS.recuento) return { fase: faseEn(t) };
  const salida: Record<string, unknown> = {};

  // 1) Recuento: se congela una vez y se avisa a todos.
  let r = await recuentoCongelado();
  if (!r) {
    const vivo = await cuentaActual();
    r = { ...vivo, en: t.toISOString() };
    await guardarConfig("recuento_resultado", JSON.stringify(r));
    salida.recuento = r;
    const pendientes = await pendientesSegunRecuento();
    await sendEmail(
      AVISO_INTERNO,
      `Preventa — RECUENTO: B ${r.cuenta.B} de 3 (${r.llegaB ? "LLEGA" : "no llega"}) · A ${r.cuenta.A} de 3 (${r.llegaA ? "LLEGA" : "no llega"})`,
      `<div style="font-family:monospace;font-size:0.9rem;line-height:1.7;">
        <p>B: ${r.cuenta.B} de 3 · ${r.llegaB ? "se graba" : "NO se graba"}<br>A: ${r.cuenta.A} de 3 · ${r.llegaA ? "se graba" : "NO se graba"}</p>
        <p>Los compradores reciben ahora el aviso automático.</p>
        <p>Devoluciones pendientes: ${pendientes.length} (${euros(pendientes.reduce((s, p) => s + p.importe, 0))}). ${pendientes.length ? "Hazlas en /admin → Preventa → «Devolver lo del recuento»." : ""}</p>
      </div>`,
      DE_INTERNO
    ).catch((e) => console.error("preventa: aviso del recuento fallido:", e));
  }

  const compras = (await todasLasCompras()).filter((c) => c.estado !== "pendiente" && c.estado !== "expirado");
  const personas = porPersona(compras);

  // 2) Aviso del recuento a cada comprador (sin las compras de prueba).
  let avisos = 0;
  for (const [email, cs] of personas) {
    const reales = cs.filter((c) => !c.prueba);
    const caso = casoRecuento(reales, r);
    if (!caso) continue;
    if (!(await apuntar("recuento", email))) continue;
    const u = ultimo(reales);
    const { asunto, html } = correoRecuento({
      caso,
      nombre: u.nombre,
      idioma: u.idioma,
      devolverCent: reales.reduce((s, c) => s + devolucionTrasRecuento(c, r!), 0),
      comproA: tieneA(reales),
    });
    try {
      await sendEmail(u.nombre ? `${u.nombre} <${email}>` : email, asunto, html, DE);
      avisos++;
    } catch (e) {
      console.error("preventa: aviso de recuento fallido:", email, e);
      await desapuntar("recuento", email);
    }
  }
  salida.avisos_recuento = avisos;

  // 3) Entregas: B el 28-dic, A el 10-ene. Solo con el vídeo puesto en el panel.
  const cfg = await leerConfig();
  for (const p of ["B", "A"] as const) {
    const entrega = p === "B" ? FECHAS.entregaB : FECHAS.entregaA;
    const llega = p === "B" ? r.llegaB : r.llegaA;
    if (t < entrega || !llega) continue;
    if (!cfg[`video_${p}`]) {
      const hoy = t.toISOString().slice(0, 10);
      if (await apuntar(`falta_video_${p}`, hoy))
        await sendEmail(
          AVISO_INTERNO,
          `Preventa — FALTA EL VÍDEO de ${p}: no se ha entregado`,
          `<p>Hoy toca entregar ${p} y no hay vídeo puesto. Ponlo en /admin → Preventa y la entrega sale sola en la siguiente pasada.</p>`,
          DE_INTERNO
        ).catch(() => null);
      salida[`entrega_${p}`] = "falta el vídeo";
      continue;
    }
    let enviados = 0;
    for (const [email, cs] of personas) {
      const tiene = p === "B" ? tieneB(cs) : tieneA(cs);
      if (!tiene) continue;
      if (!(await apuntar(`entrega_${p}`, email))) continue;
      const u = ultimo(cs);
      const desde = cs.map((c) => c.pagado_en).filter(Boolean).sort()[0]!;
      const { asunto, html } = correoEntrega({
        producto: p,
        nombre: u.nombre,
        idioma: u.idioma,
        enlace: enlaceAcceso(email, u.idioma),
        accesoHasta: accesoHasta(new Date(desde)),
      });
      try {
        await sendEmail(u.nombre ? `${u.nombre} <${email}>` : email, asunto, html, DE);
        enviados++;
      } catch (e) {
        console.error("preventa: entrega fallida:", p, email, e);
        await desapuntar(`entrega_${p}`, email);
      }
    }
    salida[`entrega_${p}`] = enviados;
  }
  return salida;
}

/** Para la landing: ¿ya hay 3? (no se enseña el contador mientras no se llegue). */
export async function yaHayTres(): Promise<{ A: boolean; B: boolean }> {
  try {
    const r = await cuentaActual();
    return { A: r.llegaA, B: r.llegaB };
  } catch {
    return { A: false, B: false };
  }
}

export const PRECIOS = PRECIO_CENT;
export type { Producto };
