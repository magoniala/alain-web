import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo } from "@/lib/charlas-correo";
import { procesarMensaje } from "@/lib/charlas-proceso";

// Bandeja de charlas en el panel.
//
// GET  → tareas por revisar (calientes primero), correos sin centro,
//        configuración (modo prueba) y coste de la IA.
// POST { accion, … }
//   enviar      { id, asunto, texto, destinatario, adjuntar_dossier, dossier_idioma, motivo? }
//   aplicar     { id }                       tarea sin respuesta: solo aplica los cambios al CRM
//   descartar   { id, motivo? }
//   regenerar   { id, instruccion }          rehace el borrador con una indicación de Alain
//   asignar     { mensaje_id, centro_id }    correo huérfano → centro, y se procesa
//   ignorar     { mensaje_id }               correo huérfano que no es de charlas
//   config      { modo_prueba?: boolean, lector_activo?: boolean }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = supabaseCharlas();

  const [tareas, huerfanos, config, uso, ultimaLectura, errores] = await Promise.all([
    supabase
      .from("charlas_tareas")
      .select(
        "*, centro:charlas_centros(id, nombre, estado, responsable, euskera, localidad, territorio), entrante:charlas_mensajes!charlas_tareas_mensaje_entrante_id_fkey(id, de, asunto, fecha, texto, clasificacion, clasificacion_confianza)"
      )
      .in("estado", ["revisar", "error"])
      .order("nivel", { ascending: false })
      .order("creado_en", { ascending: true }),
    supabase.from("charlas_mensajes").select("id, de, asunto, fecha, texto").eq("estado", "pendiente_asignar").order("fecha", { ascending: false }).limit(30),
    supabase.from("charlas_config").select("clave, valor").in("clave", ["modo_prueba", "lector_activo", "modelo"]),
    supabase.from("charlas_ia_uso").select("creado_en, coste_usd").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("charlas_imap_estado").select("carpeta, ultima_lectura").order("ultima_lectura", { ascending: false }).limit(2),
    supabase.from("charlas_mensajes").select("id, asunto, error").eq("estado", "error").limit(10),
  ]);

  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const hoyISO = hoy();
  const costeHoy = (uso.data ?? []).filter((u) => u.creado_en.slice(0, 10) === hoyISO).reduce((s, u) => s + Number(u.coste_usd), 0);
  const coste30 = (uso.data ?? []).reduce((s, u) => s + Number(u.coste_usd), 0);

  return NextResponse.json({
    tareas: tareas.data ?? [],
    error_tareas: tareas.error?.message ?? null,
    huerfanos: huerfanos.data ?? [],
    errores: errores.data ?? [],
    config: cfg,
    coste: { hoy_usd: Number(costeHoy.toFixed(3)), ult_30_dias_usd: Number(coste30.toFixed(2)), llamadas_30_dias: uso.data?.length ?? 0 },
    ultima_lectura: ultimaLectura.data?.[0]?.ultima_lectura ?? null,
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = supabaseCharlas();

  try {
    switch (body.accion) {
      case "enviar":
        return NextResponse.json(await enviar(body));
      case "aplicar": {
        const t = await cargarTarea(String(body.id));
        await aplicarCambios(t, null);
        await supabase.from("charlas_tareas").update({ estado: "hecha", resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "descartar": {
        const t = await cargarTarea(String(body.id));
        const motivo = typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : null;
        await supabase.from("charlas_tareas").update({ estado: "descartada", motivo, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        // Un descarte con motivo también enseña: queda como corrección.
        if (motivo && t.borrador_texto) {
          await supabase.from("charlas_correcciones").insert({
            tarea_id: t.id,
            tipo_mensaje: t.contexto?.clasificacion ?? t.tipo,
            idioma: t.idioma,
            borrador: t.borrador_texto,
            final: "",
            motivo: `DESCARTADO: ${motivo}`,
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "regenerar": {
        const t = await cargarTarea(String(body.id));
        if (!t.mensaje_entrante_id) throw new Error("Esta tarea no viene de un correo.");
        const instruccion = String(body.instruccion ?? "").trim();
        if (!instruccion) throw new Error("Escribe qué quieres que cambie.");
        await procesarMensaje(t.mensaje_entrante_id, instruccion);
        return NextResponse.json({ ok: true });
      }
      case "asignar": {
        const mensajeId = String(body.mensaje_id);
        const centroId = String(body.centro_id);
        const { data: m } = await supabase.from("charlas_mensajes").select("de").eq("id", mensajeId).single();
        await supabase.from("charlas_mensajes").update({ centro_id: centroId, estado: "nuevo", match_por: "manual" }).eq("id", mensajeId);
        // La dirección queda aprendida para la próxima vez.
        if (m?.de) await supabase.from("charlas_contactos").insert({ centro_id: centroId, email: m.de.toLowerCase(), rol: "otro", origen: "panel" }).then(() => null, () => null);
        await procesarMensaje(mensajeId);
        return NextResponse.json({ ok: true });
      }
      case "ignorar": {
        await supabase.from("charlas_mensajes").update({ estado: "ignorado" }).eq("id", String(body.mensaje_id));
        return NextResponse.json({ ok: true });
      }
      case "config": {
        for (const clave of ["modo_prueba", "lector_activo"]) {
          if (typeof body[clave] === "boolean") {
            await supabase.from("charlas_config").upsert({ clave, valor: body[clave], actualizado_en: new Date().toISOString() });
          }
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tarea = any;

async function cargarTarea(id: string): Promise<Tarea> {
  const { data, error } = await supabaseCharlas().from("charlas_tareas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Tarea no encontrada.");
  return data;
}

async function enviar(body: Record<string, unknown>) {
  const supabase = supabaseCharlas();
  const t = await cargarTarea(String(body.id));
  if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);

  const asunto = String(body.asunto ?? t.borrador_asunto ?? "").trim();
  const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
  const destinatario = String(body.destinatario ?? t.destinatario ?? "").trim();
  if (!asunto || !texto || !destinatario.includes("@")) throw new Error("Faltan asunto, texto o destinatario.");
  const dossier = body.adjuntar_dossier ? (body.dossier_idioma === "es" ? "es" : body.dossier_idioma === "eu" ? "eu" : t.idioma === "eu" ? "eu" : "es") : null;

  const { data: cfg } = await supabase.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  const prueba = cfg?.valor !== false;

  // Hilo: se responde al correo que llegó, con sus referencias.
  let inReplyTo: string | null = null;
  let referencias: string[] = [];
  if (t.mensaje_entrante_id) {
    const { data: m } = await supabase.from("charlas_mensajes").select("message_id, referencias").eq("id", t.mensaje_entrante_id).single();
    if (m?.message_id && !m.message_id.startsWith("sin-id-")) {
      inReplyTo = m.message_id;
      referencias = [...(m.referencias ?? []), m.message_id].slice(-15);
    }
  } else {
    // Tarea programada (recordatorio, cierre, reactivación): se responde al
    // último correo del hilo del centro, para que siga siendo un solo hilo.
    const { data: h } = await supabase.from("charlas_hilos").select("ultimo_message_id, message_id_raiz").eq("centro_id", t.centro_id).eq("canal", "principal").maybeSingle();
    if (h?.ultimo_message_id && !h.ultimo_message_id.startsWith("sin-id-")) {
      inReplyTo = h.ultimo_message_id;
      referencias = [...new Set([h.message_id_raiz, h.ultimo_message_id].filter(Boolean) as string[])];
    }
  }

  const envio = await enviarCorreo({ para: destinatario, asunto, texto, inReplyTo, referencias, dossier, prueba });

  if (prueba) {
    // En modo prueba no se toca el CRM ni la tarea, pero el envío queda
    // apuntado (tipo_salida 'prueba') para poder revisar qué dijo el servidor.
    await supabase.from("charlas_mensajes").insert({
      centro_id: t.centro_id,
      direccion: "saliente",
      message_id: envio.messageId,
      de: "alain@alainzulaika.com",
      para: [envio.para],
      asunto: `[PRUEBA → ${destinatario}] ${asunto}`,
      texto,
      fecha: new Date().toISOString(),
      estado: "ignorado",
      tarea_id: t.id,
      tipo_salida: "prueba",
      error: envio.smtp,
    });
    return { ok: true, prueba: true, enviado_a: envio.para, smtp: envio.smtp };
  }

  const ahora = new Date().toISOString();
  const { data: saliente } = await supabase
    .from("charlas_mensajes")
    .insert({
      centro_id: t.centro_id,
      direccion: "saliente",
      message_id: envio.messageId,
      in_reply_to: inReplyTo,
      referencias,
      de: "alain@alainzulaika.com",
      para: [destinatario],
      asunto,
      texto,
      fecha: ahora,
      estado: "procesado",
      tarea_id: t.id,
      tipo_salida: t.contexto?.clasificacion ? `respuesta_${t.contexto.clasificacion}` : t.tipo,
      adjuntos: dossier ? [{ nombre: `dossier_${dossier}.pdf` }] : [],
    })
    .select("id")
    .single();

  // Si eligió la alternativa, lo que cuenta como "borrador" es esa.
  const alt = body.opcion === "b" ? (t.contexto?.alternativa as { asunto?: string; cuerpo?: string } | null) : null;
  const borradorTexto = (alt?.cuerpo ?? t.borrador_texto ?? "").trim();
  const borradorAsunto = (alt?.asunto || t.borrador_asunto || "").trim();
  const editado = texto !== borradorTexto || asunto !== borradorAsunto;
  if (alt) {
    // Elegir la B también enseña: queda como corrección con motivo fijo.
    await supabase.from("charlas_correcciones").insert({
      tarea_id: t.id,
      tipo_mensaje: t.contexto?.clasificacion ?? t.tipo,
      idioma: t.idioma,
      borrador: `Asunto: ${t.borrador_asunto ?? ""}\n\n${t.borrador_texto ?? ""}`,
      final: `Asunto: ${asunto}\n\n${texto}`,
      motivo: `ELIGIÓ LA ALTERNATIVA "${(t.contexto?.alternativa as { etiqueta?: string })?.etiqueta ?? "B"}" en vez de "${t.contexto?.etiqueta_principal ?? "A"}"`,
    });
  }
  if (editado) {
    await supabase.from("charlas_correcciones").insert({
      tarea_id: t.id,
      tipo_mensaje: t.contexto?.clasificacion ?? t.tipo,
      idioma: t.idioma,
      borrador: `Asunto: ${borradorAsunto}\n\n${borradorTexto}`,
      final: `Asunto: ${asunto}\n\n${texto}`,
      motivo: typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : null,
    });
  }

  await supabase
    .from("charlas_tareas")
    .update({ estado: "enviada", texto_final: texto, editado, mensaje_salida_id: saliente?.id ?? null, resuelto_en: ahora, resuelto_por: "alain", adjuntar_dossier: !!dossier })
    .eq("id", t.id);

  await supabase
    .from("charlas_hilos")
    .upsert({ centro_id: t.centro_id, canal: "principal", asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: referencias[0] ?? envio.messageId, ultimo_message_id: envio.messageId, ultimo_mensaje_en: ahora }, { onConflict: "centro_id,canal" });
  await aplicarCambios(t, { dossier: !!dossier });
  return { ok: true, prueba: false, enviado_a: envio.para, smtp: envio.smtp };
}

async function aplicarCambios(t: Tarea, envio: { dossier: boolean } | null) {
  const supabase = supabaseCharlas();
  const c = (t.cambios_crm ?? {}) as Record<string, unknown>;
  const { data: centro } = await supabase.from("charlas_centros").select("mails_enviados").eq("id", t.centro_id).single();

  const cambios: Record<string, unknown> = { actualizado_por: "sistema", fecha_ultimo_contacto: hoy() };
  for (const k of ["estado", "proxima_accion", "fecha_proxima_accion", "calendario_abierto"]) if (c[k]) cambios[k] = c[k];
  if (envio) cambios.mails_enviados = (centro?.mails_enviados ?? 0) + 1;
  await supabase.from("charlas_centros").update(cambios).eq("id", t.centro_id);

  const persona = c.contacto_nuevo as { nombre?: string; email?: string; cargo?: string } | undefined;
  if (persona?.email) {
    await supabase
      .from("charlas_contactos")
      .insert({ centro_id: t.centro_id, nombre: persona.nombre ?? null, email: persona.email.toLowerCase(), cargo: persona.cargo ?? null, rol: "otro", origen: "correo" })
      .then(() => null, () => null);
  }

  const partes = [];
  if (envio) partes.push(envio.dossier ? `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviada con dossier` : `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviado`);
  else if (t.tipo === "llamada_alain") partes.push("Llamada hecha (desde el panel)");
  else if (t.tipo === "aparcar") partes.push("Aparcado sin respuesta");
  if (c.estado) partes.push(`→ ${c.estado}`);
  if (c.fecha_proxima_accion) partes.push(`siguiente: ${c.proxima_accion ?? "acción"} el ${c.fecha_proxima_accion}`);
  await supabase.from("charlas_interacciones").insert({
    centro_id: t.centro_id,
    fecha: hoy(),
    canal: envio ? "Mail" : "Sistema",
    texto: partes.join(" · ") || "CRM actualizado",
    orden: 600,
    origen: "sistema",
  });
}
