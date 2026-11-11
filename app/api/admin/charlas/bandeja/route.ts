import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo } from "@/lib/charlas-correo";
import { procesarMensaje } from "@/lib/charlas-proceso";
import { fusionarCambios } from "@/lib/bandeja-cambios";
import { anadirAlCatalogo, instruccionTrasCompletar } from "@/lib/conocimiento-catalogo";

// Bandeja de charlas en el panel.
//
// GET  → tareas por revisar (calientes primero), correos sin centro,
//        configuración (modo prueba) y coste de la IA.
// POST { accion, … }
//   enviar      { id, asunto, texto, destinatario, adjuntar_dossier, dossier_idioma, motivo? }
//   aplicar     { id, cambios? }             solo aplica los cambios al CRM, sin enviar nada (también con borrador). `cambios` = lo que Alain corrigió a mano (ver lib/bandeja-cambios)
//   aplazar     { id, fecha }                mueve la próxima acción del centro a otro día y cierra la tarjeta sin marcarla como hecha
//   descartar   { id, motivo? }
//   regenerar   { id, instruccion }          rehace el borrador con una indicación de Alain
//   redactar    { id, instruccion? }         tarea sin borrador (revisar_correo, actualizar_crm): la IA escribe una respuesta al último correo del centro
//   completar   { id, clave, texto }         «Me falta información»: guarda el texto en el catálogo de shows (compartido con magia) y rehace el borrador; no envía nada
//   asignar     { mensaje_id, centro_id }    correo huérfano → centro, y se procesa
//   ignorar     { mensaje_id }               correo huérfano que no es de charlas
//   config      { modo_prueba?: boolean, lector_activo?: boolean }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Se lanza cuando ya salió un correo real a este centro hace poco: el panel
// pregunta a Alain antes de mandar otro (evita duplicados por no ver que el
// anterior ya se envió).
class EnvioDuplicado extends Error {}
const VENTANA_DUPLICADO_MIN = 30;

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = supabaseCharlas();

  const [tareas, huerfanos, config, uso, ultimaLectura, errores] = await Promise.all([
    supabase
      .from("charlas_tareas")
      .select(
        "*, centro:charlas_centros(id, nombre, estado, responsable, responsable_email, proxima_accion, fecha_proxima_accion, euskera, localidad, territorio), entrante:charlas_mensajes!charlas_tareas_mensaje_entrante_id_fkey(id, de, asunto, fecha, texto, clasificacion, clasificacion_confianza)"
      )
      .in("estado", ["revisar", "error"])
      .order("nivel", { ascending: false })
      .order("creado_en", { ascending: true }),
    supabase.from("charlas_mensajes").select("id, de, asunto, fecha, texto").eq("estado", "pendiente_asignar").order("fecha", { ascending: false }).limit(30),
    supabase.from("charlas_config").select("clave, valor").in("clave", ["modo_prueba", "lector_activo", "modelo"]),
    supabase.from("charlas_ia_uso").select("creado_en, coste_usd").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("charlas_imap_estado").select("carpeta, ultima_lectura").order("ultima_lectura", { ascending: false }).limit(2),
    supabase.from("charlas_mensajes").select("id, de, asunto, fecha, error").eq("estado", "error").order("fecha", { ascending: false }).limit(10),
  ]);

  // Último correo recibido y último enviado de cada centro con tarjeta (la tarjeta no
  // siempre trae un entrante asociado: tarjetas por fecha, «correo suyo sin respuesta»…).
  const centroIds = [...new Set((tareas.data ?? []).map((t) => t.centro_id as string).filter(Boolean))];
  const ultimos: Record<string, { entrante: unknown; saliente: unknown }> = {};
  if (centroIds.length) {
    const { data: msgs } = await supabase.from("charlas_mensajes").select("id, centro_id, direccion, de, para, asunto, fecha, texto, tipo_salida").in("centro_id", centroIds).order("fecha", { ascending: false }).limit(800);
    for (const m of msgs ?? []) {
      if (m.tipo_salida === "prueba") continue;
      const u = (ultimos[m.centro_id] ??= { entrante: null, saliente: null });
      const k = m.direccion === "entrante" ? "entrante" : "saliente";
      if (!u[k]) u[k] = { id: m.id, direccion: m.direccion, de: m.de, para: m.para, asunto: m.asunto, fecha: m.fecha, texto: (m.texto ?? "").slice(0, 4000) };
    }
  }

  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const hoyISO = hoy();
  const costeHoy = (uso.data ?? []).filter((u) => u.creado_en.slice(0, 10) === hoyISO).reduce((s, u) => s + Number(u.coste_usd), 0);
  const coste30 = (uso.data ?? []).reduce((s, u) => s + Number(u.coste_usd), 0);

  return NextResponse.json({
    tareas: (tareas.data ?? []).map((t) => ({ ...t, ultimos: ultimos[t.centro_id] ?? { entrante: null, saliente: null } })),
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
    if (body.accion === "reintentar_mensaje" && typeof body.mensaje_id === "string") {
      await supabaseCharlas().from("charlas_mensajes").update({ estado: "nuevo", intentos: 0, error: null }).eq("id", body.mensaje_id).eq("estado", "error");
      return NextResponse.json({ ok: true });
    }
    switch (body.accion) {
      case "enviar":
        return NextResponse.json(await enviar(body));
      case "aplicar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
        await aplicarCambios(t, null);
        await supabase.from("charlas_tareas").update({ estado: "hecha", cambios_crm: t.cambios_crm, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "aplazar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const fecha = String(body.fecha ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
        if (fecha < hoy()) throw new Error("Esa fecha ya pasó.");
        await supabase.from("charlas_centros").update({ fecha_proxima_accion: fecha, actualizado_por: "panel" }).eq("id", t.centro_id);
        await supabase.from("charlas_interacciones").insert({ centro_id: t.centro_id, fecha: hoy(), canal: "Sistema", texto: `Aplazado al ${fecha.split("-").reverse().join("-")}: ${String(t.tipo).replace(/_/g, " ")}`, orden: 600, origen: "sistema" });
        await supabase.from("charlas_tareas").update({ estado: "descartada", motivo: `Aplazada al ${fecha}`, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
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
      case "redactar": {
        // Tarjeta sin borrador ("correo suyo sin respuesta", "actualizar ficha"):
        // se le pide a la IA que conteste al último correo entrante del centro,
        // con la indicación de Alain si la hay. La tarjeta actual queda
        // sustituida por la nueva (lo hace procesarMensaje).
        const t = await cargarTarea(String(body.id));
        let mensajeId: string | null = t.mensaje_entrante_id ?? null;
        if (!mensajeId) {
          const { data: ult } = await supabase.from("charlas_mensajes").select("id").eq("centro_id", t.centro_id).eq("direccion", "entrante").order("fecha", { ascending: false }).limit(1).maybeSingle();
          mensajeId = ult?.id ?? null;
        }
        if (!mensajeId) throw new Error("Este centro no tiene ningún correo recibido al que contestar.");
        const extra = String(body.instruccion ?? "").trim();
        const instruccion = `Alain quiere contestar a este correo aunque haya pasado tiempo: redacta la respuesta (responder = true). Si el correo decía que lo pasaban a otra persona o que avisarían, pregunta con naturalidad si hubo novedades, sin presionar.${extra ? ` Indicación de Alain: ${extra}` : ""}`;
        const r = await procesarMensaje(mensajeId, instruccion);
        if (!r.tarea) throw new Error("La IA no ha generado ningún borrador. Prueba a decirle qué quieres contestar.");
        // Si ha salido una tarjeta nueva, la de partida (p. ej. "correo suyo sin
        // respuesta", que no tiene correo entrante asociado) se cierra: si no,
        // se queda debajo del borrador y parece que no se ha enviado nada.
        if (r.tarea !== t.id) {
          await supabase
            .from("charlas_tareas")
            .update({ estado: "descartada", motivo: "Sustituida por el borrador redactado", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" })
            .eq("id", t.id)
            .in("estado", ["revisar", "pendiente"]);
        }
        return NextResponse.json({ ok: true });
      }
      case "completar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const texto = String(body.texto ?? "").trim();
        const { data: c } = await supabase.from("charlas_centros").select("nombre").eq("id", t.centro_id).maybeSingle();
        const doc = await anadirAlCatalogo(String(body.clave ?? ""), texto, `bandeja de charlas · ${c?.nombre ?? "centro"}`);
        // Cuenta como corrección: entra en el repaso semanal de reglas.
        await supabase.from("charlas_correcciones").insert({ tarea_id: t.id, tipo_mensaje: t.contexto?.clasificacion ?? t.tipo, idioma: t.idioma, borrador: t.borrador_texto ?? "", final: "", motivo: `AÑADIDO AL CATÁLOGO («${doc.titulo}»): ${texto}` });
        let mensajeId: string | null = t.mensaje_entrante_id ?? null;
        if (!mensajeId) {
          const { data: ult } = await supabase.from("charlas_mensajes").select("id").eq("centro_id", t.centro_id).eq("direccion", "entrante").order("fecha", { ascending: false }).limit(1).maybeSingle();
          mensajeId = ult?.id ?? null;
        }
        // Sin correo al que contestar: el dato queda guardado y la tarjeta sigue como estaba.
        if (!mensajeId) return NextResponse.json({ ok: true, documento: doc, aviso: "Guardado en el catálogo. Esta tarjeta no tiene correo al que contestar, así que el borrador no se ha rehecho." });
        const r = await procesarMensaje(mensajeId, instruccionTrasCompletar(doc.titulo, texto, String(body.instruccion ?? "")));
        if (r.tarea && r.tarea !== t.id) {
          await supabase.from("charlas_tareas").update({ estado: "descartada", motivo: "Sustituida por el borrador rehecho con el catálogo", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("id", t.id).in("estado", ["revisar", "pendiente"]);
        }
        return NextResponse.json({ ok: true, documento: doc });
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
    if (e instanceof EnvioDuplicado) return NextResponse.json({ error: e.message, duplicado: true }, { status: 409 });
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
  // Lo que Alain haya corregido a mano en «Qué se apunta en el CRM».
  t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);

  const asunto = String(body.asunto ?? t.borrador_asunto ?? "").trim();
  const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
  const destinatario = String(body.destinatario ?? t.destinatario ?? "").trim();
  if (!asunto || !texto || !destinatario.includes("@")) throw new Error("Faltan asunto, texto o destinatario.");
  const dossier = body.adjuntar_dossier ? (body.dossier_idioma === "es" ? "es" : body.dossier_idioma === "eu" ? "eu" : t.idioma === "eu" ? "eu" : "es") : null;

  const { data: cfg } = await supabase.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  const prueba = cfg?.valor !== false;

  // Freno anti-duplicados: si ya salió un correo real a este centro hace poco,
  // no se manda otro sin confirmación expresa de Alain.
  if (!prueba && body.confirmar_duplicado !== true) {
    const desde = new Date(Date.now() - VENTANA_DUPLICADO_MIN * 60000).toISOString();
    const { data: previos } = await supabase
      .from("charlas_mensajes")
      .select("fecha, asunto")
      .eq("centro_id", t.centro_id)
      .eq("direccion", "saliente")
      .or("tipo_salida.is.null,tipo_salida.neq.prueba")
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(1);
    if (previos?.length) {
      const min = Math.max(1, Math.round((Date.now() - new Date(previos[0].fecha).getTime()) / 60000));
      throw new EnvioDuplicado(`Ya enviaste un correo a este centro hace ${min} min («${previos[0].asunto ?? "sin asunto"}»).`);
    }
  }

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
    .update({ estado: "enviada", texto_final: texto, editado, cambios_crm: t.cambios_crm, mensaje_salida_id: saliente?.id ?? null, resuelto_en: ahora, resuelto_por: "alain", adjuntar_dossier: !!dossier })
    .eq("id", t.id);

  // Ya ha salido un correo a este centro: cualquier otra tarjeta de correo
  // abierta para él queda obsoleta (si no, se queda en la bandeja y invita a
  // enviar lo mismo otra vez). Las llamadas no se tocan.
  await supabase
    .from("charlas_tareas")
    .update({ estado: "descartada", motivo: "Ya se envió un correo a este centro desde otra tarjeta", resuelto_en: ahora, resuelto_por: "sistema" })
    .eq("centro_id", t.centro_id)
    .eq("estado", "revisar")
    .neq("id", t.id)
    .neq("tipo", "llamada_alain");

  await supabase
    .from("charlas_hilos")
    .upsert({ centro_id: t.centro_id, canal: "principal", asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: referencias[0] ?? envio.messageId, ultimo_message_id: envio.messageId, ultimo_mensaje_en: ahora }, { onConflict: "centro_id,canal" });
  await aplicarCambios(t, { dossier: !!dossier });
  return { ok: true, prueba: false, enviado_a: envio.para, smtp: envio.smtp };
}

async function aplicarCambios(t: Tarea, envio: { dossier: boolean } | null) {
  const supabase = supabaseCharlas();
  const c = (t.cambios_crm ?? {}) as Record<string, unknown>;
  const { data: centro } = await supabase.from("charlas_centros").select("mails_enviados, otros_formatos").eq("id", t.centro_id).single();

  const cambios: Record<string, unknown> = { actualizado_por: "sistema", fecha_ultimo_contacto: hoy() };
  for (const k of ["estado", "proxima_accion", "fecha_proxima_accion", "calendario_abierto", "via"]) if (c[k]) cambios[k] = c[k];
  const persona = c.contacto_nuevo as { nombre?: string; email?: string; cargo?: string; telefono?: string; responsable?: boolean } | undefined;
  // Persona que ha escrito por otro camino y Alain marca como responsable de la ficha.
  if (persona?.responsable) {
    if (persona.nombre) cambios.responsable = persona.nombre;
    if (persona.email) cambios.responsable_email = persona.email.toLowerCase();
    if (persona.cargo) cambios.responsable_cargo = persona.cargo;
    if (persona.telefono) cambios.responsable_tel = persona.telefono;
  }
  if (envio) cambios.mails_enviados = (centro?.mails_enviados ?? 0) + 1;
  // Qué otro formato se le ha ofrecido al centro (plan de noviembre): se acumula con la fecha, no se pisa.
  if (envio && typeof c.otros_formatos === "string" && c.otros_formatos.trim()) {
    const linea = `${hoy().slice(8, 10)}-${hoy().slice(5, 7)}: ${c.otros_formatos.trim()}`;
    cambios.otros_formatos = centro?.otros_formatos ? `${centro.otros_formatos} · ${linea}` : linea;
  }
  await supabase.from("charlas_centros").update(cambios).eq("id", t.centro_id);

  if (persona?.email) {
    // Si el email ya estaba en los contactos del centro, el índice único lo rechaza y no pasa nada.
    await supabase
      .from("charlas_contactos")
      .insert({ centro_id: t.centro_id, nombre: persona.nombre ?? null, email: persona.email.toLowerCase(), cargo: persona.cargo ?? null, telefono: persona.telefono ?? null, rol: "otro", origen: "panel" })
      .then(() => null, () => null);
  }

  const partes = [];
  if (envio) partes.push(envio.dossier ? `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviada con dossier` : `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviado`);
  else if (t.tipo === "llamada_alain") partes.push("Llamada hecha (desde el panel)");
  else if (t.tipo === "aparcar") partes.push("Aparcado sin respuesta");
  if (c.estado) partes.push(`→ ${c.estado}`);
  if (c.fecha_proxima_accion) partes.push(`siguiente: ${c.proxima_accion ?? "acción"} el ${c.fecha_proxima_accion}`);
  else if (c.proxima_accion) partes.push(`siguiente: ${c.proxima_accion}`);
  if (persona?.nombre || persona?.email) partes.push(`contacto${persona.responsable ? " (responsable)" : ""}: ${[persona.nombre, persona.cargo, persona.email, persona.telefono].filter(Boolean).join(" · ")}`);
  if (typeof c.nota === "string" && c.nota) partes.push(c.nota);
  await supabase.from("charlas_interacciones").insert({
    centro_id: t.centro_id,
    fecha: hoy(),
    canal: envio ? "Mail" : "Sistema",
    texto: partes.join(" · ") || "CRM actualizado",
    orden: 600,
    origen: "sistema",
  });
}
