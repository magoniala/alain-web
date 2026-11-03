import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { enlaceWaConfirmacion, WA_MENSAJE_CONFIRMACION, cuandoParaWhatsApp } from "@/lib/entrenatzaile-wa";
import { formatearHueco } from "@/lib/entrenatzaile-huecos";
import { reservaConfirmada as confirmada } from "@/lib/hoja-ruta-bandeja";

// Bandeja de reservas de la Hoja de Ruta (panel → Hoja de Ruta, arriba).
//
// Una reserva "pide WhatsApp" cuando está confirmada y Alain aún no lo mandó:
//   gratis  → en cuanto elige hueco (pago_estado NULL)
//   de pago → cuando el webhook la marca 'pagado' (o 'pagado_fuera_de_plazo')
// Las pendientes de pago se enseñan aparte, sin botón: el WhatsApp va al pagar.
//
//   GET  → { pendientes_wa, esperando_pago, recientes }
//   POST { accion: "wa_enviado", id, nota? } | { accion: "descartar", id, nota? } | { accion: "deshacer", id }

export const dynamic = "force-dynamic";

const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const CAMPOS = "id, nombre, email, telefono, hueco, hueco_en, tipo, elegibilidad, dias_desde_alta, pago_estado, pagado_en, creado_en, wa_confirmacion_en, wa_confirmacion_nota, panel_descartada_en, panel_nota, cancelada_en";


export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const desde = new Date(Date.now() - 45 * 86400000).toISOString();
  const { data, error } = await sb().from("hoja_ruta_reservas").select(CAMPOS).not("hueco", "is", null).is("cancelada_en", null).gte("creado_en", desde).order("hueco_en", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message, falta_sql: /wa_confirmacion_en|panel_/.test(error.message) }, { status: 500 });
  const filas = (data ?? []).map((r) => {
    const wa = enlaceWaConfirmacion({ telefono: r.telefono, nombre: r.nombre, hueco: r.hueco });
    const nombre = (r.nombre ?? "").trim().split(/\s+/)[0] ?? "";
    const texto = WA_MENSAJE_CONFIRMACION.replace("Buenas, [nombre].", nombre ? `Buenas, ${nombre}.` : "Buenas.").replace("[cuando]", cuandoParaWhatsApp(r.hueco));
    return { ...r, confirmada: confirmada(r), cuando: formatearHueco(r.hueco), wa_url: wa.url, wa_con_numero: wa.conNumero, wa_texto: texto };
  });
  const ahora = Date.now();
  const pendientes_wa = filas.filter((r) => r.confirmada && !r.wa_confirmacion_en && !r.panel_descartada_en && new Date(r.hueco).getTime() > ahora - 3 * 3600 * 1000);
  const esperando_pago = filas.filter((r) => r.pago_estado === "pendiente");
  const recientes = filas.filter((r) => (r.wa_confirmacion_en || r.panel_descartada_en) && new Date(r.hueco_en ?? r.creado_en).getTime() > ahora - 14 * 86400000).slice(0, 20);
  return NextResponse.json({ pendientes_wa, esperando_pago, recientes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  const s = sb();
  const ahora = new Date().toISOString();
  if (b.accion === "wa_enviado") {
    const { error } = await s.from("hoja_ruta_reservas").update({ wa_confirmacion_en: ahora, wa_confirmacion_nota: b.nota ? String(b.nota).slice(0, 500) : null, panel_descartada_en: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (b.accion === "descartar") {
    const { error } = await s.from("hoja_ruta_reservas").update({ panel_descartada_en: ahora, panel_nota: b.nota ? String(b.nota).slice(0, 500) : null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (b.accion === "deshacer") {
    const { error } = await s.from("hoja_ruta_reservas").update({ wa_confirmacion_en: null, wa_confirmacion_nota: null, panel_descartada_en: null, panel_nota: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
