// Envío de una tarjeta de la bandeja de charlas y aplicación de sus cambios
// en el CRM. Antes vivía en app/api/admin/charlas/bandeja/route.ts; está aquí
// para que lo use también el envío automático (lib/ayto-autoenvio.ts) con
// exactamente las mismas reglas: freno de duplicados, hilo, correcciones,
// Registro y deshacer.

import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo } from "@/lib/charlas-correo";
import { fusionarCambios, fusionarExtrasLlamada } from "@/lib/bandeja-cambios";
import { leerSesiones, proximaSesion, bonita } from "@/lib/charlas-sesiones";
import { fotoFicha, sinActualizadoPor } from "@/lib/bandeja-deshacer";

// Se lanza cuando ya salió un correo real a este centro hace poco: el panel
// pregunta a Alain antes de mandar otro (evita duplicados por no ver que el
// anterior ya se envió).
export class EnvioDuplicado extends Error {}
const VENTANA_DUPLICADO_MIN = 30;

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tarea = any;

export async function cargarTarea(id: string): Promise<Tarea> {
  const { data, error } = await supabaseCharlas().from("charlas_tareas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Tarea no encontrada.");
  return data;
}

export async function enviar(body: Record<string, unknown>) {
  const supabase = supabaseCharlas();
  const t = await cargarTarea(String(body.id));
  if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
  // Lo que Alain haya corregido a mano en «Qué se apunta en el CRM».
  t.cambios_crm = fusionarExtrasLlamada(fusionarCambios(t.cambios_crm, body.cambios), body.cambios);

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
  } else if (!t.contexto?.hilo_nuevo) {
    // Tarea programada (recordatorio, cierre, reactivación): se responde al
    // último correo del hilo del centro, para que siga siendo un solo hilo.
    // Las que llevan contexto.hilo_nuevo (primer correo a una persona nueva,
    // vía ayuntamientos) abren conversación propia.
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
    .update({ estado: "enviada", texto_final: texto, editado, cambios_crm: t.cambios_crm, mensaje_salida_id: saliente?.id ?? null, resuelto_en: ahora, resuelto_por: body.automatico === true ? "sistema" : "alain", adjuntar_dossier: !!dossier })
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

export async function aplicarCambios(t: Tarea, envio: { dossier: boolean } | null) {
  const supabase = supabaseCharlas();
  const c = (t.cambios_crm ?? {}) as Record<string, unknown>;
  const { data: centro } = await supabase.from("charlas_centros").select("mails_enviados, otros_formatos").eq("id", t.centro_id).single();

  const cambios: Record<string, unknown> = { actualizado_por: "sistema", fecha_ultimo_contacto: hoy() };
  for (const k of ["estado", "proxima_accion", "fecha_proxima_accion", "calendario_abierto", "via"]) if (c[k]) cambios[k] = c[k];
  // Extras de las tarjetas de llamada (lib/bandeja-cambios › fusionarExtrasLlamada): intentos de llamada y correo del AMPA.
  for (const k of ["intentos_llamada", "ampa_email"]) if (c[k]) cambios[k] = c[k];
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
  // Tarjeta «localizar el correo»: con correo, queda como correo del centro (el Mail 1 automático sale solo);
  // sin correo, el centro pasa a la próxima sesión de llamadas (con el teléfono, si Alain lo ha puesto).
  let resumenLocalizar = "";
  if (t.tipo === "localizar_correo") {
    const { data: cc } = await supabase.from("charlas_centros").select("email_centro, responsable_email, telefono").eq("id", t.centro_id).single();
    const mail = (persona?.email ?? "").trim().toLowerCase();
    if (persona?.telefono && !cc?.telefono) cambios.telefono = persona.telefono.trim();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(mail)) {
      if (!cc?.responsable_email && !cc?.email_centro) cambios.email_centro = mail;
      resumenLocalizar = `Correo localizado: ${mail}. El Mail 1 sale solo`;
    } else {
      const f = proximaSesion(hoy(), await leerSesiones());
      cambios.proxima_accion = "Llamada de conserjería (sin correo)";
      cambios.fecha_proxima_accion = f;
      resumenLocalizar = `Sin correo: pasa a la sesión de llamadas del ${bonita(f)}`;
    }
  }
  // Foto de cómo estaba la ficha, para poder deshacerlo desde el panel.
  const antes = await fotoFicha(supabase, "charlas", t.centro_id, Object.keys(cambios));
  await supabase.from("charlas_centros").update(cambios).eq("id", t.centro_id);

  const contactos: string[] = [];
  if (persona?.email) {
    // Si el email ya estaba en los contactos del centro, el índice único lo rechaza y no pasa nada.
    const { data: ct } = await supabase
      .from("charlas_contactos")
      .insert({ centro_id: t.centro_id, nombre: persona.nombre ?? null, email: persona.email.toLowerCase(), cargo: persona.cargo ?? null, telefono: persona.telefono ?? null, rol: "otro", origen: "panel" })
      .select("id")
      .maybeSingle();
    if (ct?.id) contactos.push(ct.id);
  }

  const partes = [];
  if (envio) partes.push(envio.dossier ? `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviada con dossier` : `${t.tipo === "respuesta" ? "Respuesta" : t.tipo.replace(/_/g, " ")} enviado`);
  else if (t.tipo === "llamada_alain") partes.push("Llamada hecha (desde el panel)");
  else if (t.tipo === "localizar_correo") partes.push(resumenLocalizar);
  else if (t.tipo === "aparcar") partes.push("Aparcado sin respuesta");
  if (c.estado) partes.push(`→ ${c.estado}`);
  if (c.fecha_proxima_accion) partes.push(`siguiente: ${c.proxima_accion ?? "acción"} el ${c.fecha_proxima_accion}`);
  else if (c.proxima_accion) partes.push(`siguiente: ${c.proxima_accion}`);
  if (persona?.nombre || persona?.email) partes.push(`contacto${persona.responsable ? " (responsable)" : ""}: ${[persona.nombre, persona.cargo, persona.email, persona.telefono].filter(Boolean).join(" · ")}`);
  if (typeof c.nota === "string" && c.nota) partes.push(c.nota);
  const resumen = partes.join(" · ") || "CRM actualizado";
  const { data: li } = await supabase
    .from("charlas_interacciones")
    .insert({
      centro_id: t.centro_id,
      fecha: hoy(),
      canal: envio ? "Mail" : "Sistema",
      texto: resumen,
      orden: 600,
      origen: "sistema",
    })
    .select("id")
    .single();
  return { resumen, antes, despues: sinActualizadoPor(cambios), interacciones: li?.id ? [li.id as string] : [], contactos };
}
