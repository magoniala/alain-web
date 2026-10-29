import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas, normalizarFrontmatter } from "@/lib/charlas";

// Importa al CRM el JSON que genera scripts/charlas/exportar-vault.py.
//
// Es idempotente: cada centro se localiza por `nombre` (el del fichero .md)
// y se actualiza; si no existe, se crea. Las interacciones con origen
// 'vault' se borran y se vuelven a escribir, las demás (panel, sistema,
// manual) no se tocan. Lo mismo con los contactos de origen 'vault'.
//
// Se usa dos veces: para la carga inicial de las 344 fichas (fase 0) y,
// mientras el vault siga siendo donde Alain apunta cosas a mano, para
// recoger esos apuntes. Cuando el espejo Supabase → vault esté en marcha,
// la dirección normal es la contraria y esto queda para emergencias.

export const maxDuration = 60;

interface LineaRegistro {
  fecha: string | null;
  canal: string | null;
  texto: string;
  raw: string;
}

interface CentroExportado {
  nombre: string;
  frontmatter: Record<string, unknown>;
  registro: LineaRegistro[];
  notas: string;
  secciones_extra: Record<string, string>;
}

interface EventoExportado {
  nombre: string;
  frontmatter: Record<string, unknown>;
  cuerpo: string;
}

interface Exportacion {
  version: number;
  centros: CentroExportado[];
  eventos?: EventoExportado[];
}

function quitarEnlace(v: unknown): string | null {
  // "[[Hernani BHI]]" → "Hernani BHI"
  if (typeof v !== "string") return null;
  const m = /^\[\[([^\]|]+)/.exec(v.trim());
  return m ? m[1].trim() : v.trim() || null;
}

function fechaISO(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  return m ? m[1] : null;
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let datos: Exportacion;
  try {
    datos = (await req.json()) as Exportacion;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!datos || !Array.isArray(datos.centros)) {
    return NextResponse.json({ error: "Falta `centros`." }, { status: 400 });
  }

  const supabase = supabaseCharlas();
  const resumen = { centros_nuevos: 0, centros_actualizados: 0, interacciones: 0, contactos: 0, eventos: 0, errores: [] as string[] };

  // Nombre → id de lo que ya hay, para distinguir nuevo de actualizado.
  const { data: existentes, error: errExist } = await supabase.from("charlas_centros").select("id, nombre");
  if (errExist) return NextResponse.json({ error: errExist.message }, { status: 500 });
  const idPorNombre = new Map((existentes ?? []).map((c) => [c.nombre, c.id as string]));

  // 1. Centros: upsert por nombre, en lotes.
  const filas = datos.centros.map((c) => ({
    nombre: c.nombre,
    ...normalizarFrontmatter(c.frontmatter ?? {}),
    notas: c.notas?.trim() ? c.notas.trim() : null,
    secciones_extra: c.secciones_extra ?? {},
    actualizado_por: "vault",
  }));

  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const { data, error } = await supabase.from("charlas_centros").upsert(lote, { onConflict: "nombre" }).select("id, nombre");
    if (error) {
      resumen.errores.push(`centros lote ${i}: ${error.message}`);
      continue;
    }
    for (const fila of data ?? []) {
      if (idPorNombre.has(fila.nombre)) resumen.centros_actualizados++;
      else resumen.centros_nuevos++;
      idPorNombre.set(fila.nombre, fila.id);
    }
  }

  // 2. Interacciones de origen vault: borrar y reescribir por centro.
  const ids = datos.centros.map((c) => idPorNombre.get(c.nombre)).filter((x): x is string => !!x);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("charlas_interacciones").delete().eq("origen", "vault").in("centro_id", ids.slice(i, i + 200));
    if (error) resumen.errores.push(`borrar interacciones: ${error.message}`);
  }

  const interacciones: Record<string, unknown>[] = [];
  for (const c of datos.centros) {
    const centro_id = idPorNombre.get(c.nombre);
    if (!centro_id) continue;
    c.registro.forEach((l, orden) => {
      if (!l.texto?.trim() && !l.raw?.trim()) return;
      interacciones.push({
        centro_id,
        fecha: fechaISO(l.fecha),
        canal: l.canal,
        texto: (l.texto ?? l.raw ?? "").trim(),
        raw: l.raw ?? null,
        orden,
        origen: "vault",
      });
    });
  }
  for (let i = 0; i < interacciones.length; i += 500) {
    const { error } = await supabase.from("charlas_interacciones").insert(interacciones.slice(i, i + 500));
    if (error) resumen.errores.push(`interacciones lote ${i}: ${error.message}`);
    else resumen.interacciones += Math.min(500, interacciones.length - i);
  }

  // 3. Contactos de origen vault: responsable y AMPA del frontmatter.
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("charlas_contactos").delete().eq("origen", "vault").in("centro_id", ids.slice(i, i + 200));
    if (error) resumen.errores.push(`borrar contactos: ${error.message}`);
  }
  const contactos: Record<string, unknown>[] = [];
  for (const c of datos.centros) {
    const centro_id = idPorNombre.get(c.nombre);
    if (!centro_id) continue;
    const fm = normalizarFrontmatter(c.frontmatter ?? {});
    if (fm.responsable || fm.responsable_email) {
      contactos.push({ centro_id, nombre: fm.responsable, cargo: fm.responsable_cargo, email: fm.responsable_email?.toLowerCase() ?? null, telefono: fm.responsable_tel, rol: "responsable", origen: "vault" });
    }
    if (fm.ampa_contacto || fm.ampa_email) {
      contactos.push({ centro_id, nombre: fm.ampa_contacto, cargo: fm.ampa ? `AMPA · ${fm.ampa}` : "AMPA", email: fm.ampa_email?.toLowerCase() ?? null, telefono: null, rol: "ampa", origen: "vault" });
    }
  }
  // Un mismo email puede repetirse en responsable y AMPA: la UNIQUE lo rechazaría. Se desduplica aquí.
  const vistos = new Set<string>();
  const contactosUnicos = contactos.filter((k) => {
    const clave = `${k.centro_id}|${(k.email as string | null) ?? Math.random()}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
  for (let i = 0; i < contactosUnicos.length; i += 500) {
    const { error } = await supabase.from("charlas_contactos").insert(contactosUnicos.slice(i, i + 500));
    if (error) resumen.errores.push(`contactos lote ${i}: ${error.message}`);
    else resumen.contactos += Math.min(500, contactosUnicos.length - i);
  }

  // 4. Eventos.
  for (const e of datos.eventos ?? []) {
    const fm = e.frontmatter ?? {};
    const centroNombre = quitarEnlace(fm.centro) ?? quitarEnlace(fm.cliente_ficha);
    const fila = {
      nombre: e.nombre,
      centro_id: centroNombre ? idPorNombre.get(centroNombre) ?? null : null,
      fecha_evento: fechaISO(fm.fecha_evento),
      estado_evento: (fm.estado_evento as string) ?? null,
      via_pago: (fm.via_pago as string) ?? null,
      formato: (fm.formato as string) ?? null,
      n_sesiones: numero(fm.n_sesiones),
      importe_base: numero(fm.importe_base),
      importe_total: numero(fm.importe_total),
      importe_neto: numero(fm.importe_neto),
      pago_reserva: fechaISO(fm.pago_reserva),
      pago_resto: fechaISO(fm.pago_resto),
      factura_emitida: fechaISO(fm.factura_emitida),
      vencimiento_factura: fechaISO(fm.vencimiento_factura),
      fecha_cobro: fechaISO(fm.fecha_cobro),
      contacto_dia: (fm.contacto_dia as string) ?? null,
      negocio: (fm.negocio as string) ?? "charlas",
      cuerpo: e.cuerpo ?? null,
      frontmatter: fm,
    };
    const { error } = await supabase.from("charlas_eventos").upsert(fila, { onConflict: "nombre" });
    if (error) resumen.errores.push(`evento ${e.nombre}: ${error.message}`);
    else resumen.eventos++;
  }

  return NextResponse.json({ ok: resumen.errores.length === 0, ...resumen });
}
