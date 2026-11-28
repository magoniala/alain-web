// Envío de una tarjeta de la Bandeja de magia (correo) y aplicación de sus
// cambios en la ficha. Antes vivía en app/api/admin/crm/bandeja/route.ts; está
// aquí para que lo use también el envío automático por racha (lib/autoenvio.ts)
// por exactamente el mismo camino que el botón «Enviar».

import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo, ultimoHiloCon } from "@/lib/charlas-correo";
import { fusionarCambios } from "@/lib/bandeja-cambios";
import { fotoFicha, sinActualizadoPor } from "@/lib/bandeja-deshacer";

// Ya salió un correo real a esta ficha hace poco: el panel pregunta a Alain
// antes de mandar otro (evita duplicados por no ver que el anterior ya se envió).
export class EnvioDuplicado extends Error {}
const VENTANA_DUPLICADO_MIN = 30;

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tarea = any;

export async function cargarTarea(id: string): Promise<Tarea> {
  const { data, error } = await supabaseCharlas().from("crm_tareas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Tarea no encontrada.");
  return data;
}

export async function registrarCorreccion(t: Tarea, textoFinal: string, body: Record<string, unknown>) {
  const sb = supabaseCharlas();
  const alt = body.opcion === "b" ? (t.contexto?.alternativa as { cuerpo?: string } | null) : null;
  const borrador = (alt?.cuerpo ?? t.borrador_texto ?? "").trim();
  const editado = textoFinal !== borrador;
  const motivo = typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : null;
  if (editado || body.opcion === "b") {
    await sb.from("crm_correcciones").insert({
      carril: t.carril ?? "magia",
      tarea_id: t.id,
      tipo_mensaje: t.tipo,
      idioma: t.idioma,
      borrador: body.opcion === "b" ? `ELIGIÓ LA ALTERNATIVA (${t.contexto?.alternativa?.etiqueta ?? "B"}) en vez de:\n${t.borrador_texto ?? ""}` : borrador,
      final: textoFinal,
      motivo,
    });
  }
}

export async function enviarMail(body: Record<string, unknown>) {
  const sb = supabaseCharlas();
  const t = await cargarTarea(String(body.id));
  if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
  // Lo que Alain haya corregido a mano en «Qué se apunta en el CRM».
  t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
  const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
  const destinatario = String(body.destinatario ?? t.destinatario ?? "").trim();
  // Hilo en el que va: el correo al que se contesta o, si no hay, el último con esta ficha.
  // Un seguimiento (recordatorio de agencia, etc.) no trae asunto: hereda «Re: …» del hilo.
  let hilo = await hiloDe(t);
  // Leads: si la ficha no tiene hilo guardado, se busca el último correo con esa dirección en el buzón.
  if (!hilo.inReplyTo && t.carril === "entrenatzaile" && destinatario.includes("@") && (await guardarHiloDeBuzon(t.ficha_id, destinatario))) hilo = await hiloDe(t);
  let asunto = String(body.asunto ?? "").trim() || String(t.borrador_asunto ?? "").trim();
  if (!asunto && hilo.asunto) asunto = `Re: ${hilo.asunto}`;
  if (!texto || !destinatario.includes("@")) throw new Error("Faltan texto o destinatario.");
  if (!asunto) throw new Error("No hay ningún correo anterior con esta ficha del que tomar el asunto: escribe uno.");

  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  let prueba = cfg?.valor !== false;
  // Leads de Entrenatzaile: interruptor propio (leads_modo = apagado | prueba | activo). Hasta «activo», los correos solo te llegan a ti.
  if (t.carril === "entrenatzaile") {
    const { data: m } = await sb.from("charlas_config").select("valor").eq("clave", "leads_modo").maybeSingle();
    if (m?.valor !== "activo") prueba = true;
  }

  // Freno anti-duplicados: si ya salió un correo real a esta ficha hace poco,
  // no se manda otro sin confirmación expresa de Alain.
  if (!prueba && body.confirmar_duplicado !== true) {
    const desde = new Date(Date.now() - VENTANA_DUPLICADO_MIN * 60000).toISOString();
    const { data: previos } = await sb
      .from("crm_mensajes")
      .select("fecha, asunto")
      .eq("ficha_id", t.ficha_id)
      .eq("direccion", "saliente")
      .or("tipo_salida.is.null,tipo_salida.neq.prueba")
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(1);
    if (previos?.length) {
      const min = Math.max(1, Math.round((Date.now() - new Date(previos[0].fecha).getTime()) / 60000));
      throw new EnvioDuplicado(`Ya enviaste un correo a esta ficha hace ${min} min («${previos[0].asunto ?? "sin asunto"}»).`);
    }
  }

  const { inReplyTo, referencias } = hilo;

  const envio = await enviarCorreo({ para: destinatario, asunto, texto, inReplyTo, referencias, dossier: null, prueba });
  if (prueba) return { ok: true, prueba: true, enviado_a: envio.para, smtp: envio.smtp };

  const ahora = new Date().toISOString();
  const { data: saliente } = await sb
    .from("crm_mensajes")
    .insert({ ficha_id: t.ficha_id, direccion: "saliente", message_id: envio.messageId, in_reply_to: inReplyTo, referencias, de: "alain@alainzulaika.com", para: [destinatario], asunto, texto, fecha: ahora, estado: "procesado", tarea_id: t.id, tipo_salida: t.tipo })
    .select("id")
    .single();
  await registrarCorreccion(t, texto, body);
  // Si la ficha no tenía email, el de este envío queda apuntado (nunca pisa uno existente).
  const { data: fichaEmail } = await sb.from("crm_fichas").select("email").eq("id", t.ficha_id).single();
  if (fichaEmail && !fichaEmail.email) await sb.from("crm_fichas").update({ email: destinatario.toLowerCase() }).eq("id", t.ficha_id);
  await sb.from("crm_tareas").update({ estado: "enviada", cambios_crm: t.cambios_crm, texto_final: texto, editado: texto !== (t.borrador_texto ?? "").trim(), mensaje_salida_id: saliente?.id ?? null, resuelto_en: ahora, resuelto_por: body.automatico === true ? "sistema" : "alain" }).eq("id", t.id);
  // Ya ha salido un correo a esta ficha: cualquier otra tarjeta abierta para ella
  // queda obsoleta (si no, se queda en la bandeja e invita a enviar lo mismo otra vez).
  await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Ya se envió un correo a esta ficha desde otra tarjeta", resuelto_en: ahora, resuelto_por: "sistema" }).eq("ficha_id", t.ficha_id).eq("estado", "revisar").neq("id", t.id).neq("tipo", "llamada_alain");
  await sb.from("crm_hilos").upsert({ ficha_id: t.ficha_id, canal: "principal", asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: referencias[0] ?? envio.messageId, ultimo_message_id: envio.messageId, ultimo_mensaje_en: ahora }, { onConflict: "ficha_id,canal" });
  await aplicarCambios(t, { canal: "Mail", texto });
  return { ok: true, prueba: false, enviado_a: envio.para, smtp: envio.smtp };
}

/** Busca en el buzón el último correo con `email` y lo deja como hilo abierto de la ficha. */
export async function guardarHiloDeBuzon(fichaId: string, email: string): Promise<{ asunto: string | null; fecha: string | null } | null> {
  const h = await ultimoHiloCon(email);
  if (!h) return null;
  await supabaseCharlas()
    .from("crm_hilos")
    .upsert({ ficha_id: fichaId, canal: "principal", asunto: sinPrefijo(h.asunto), message_id_raiz: h.referencias[0] ?? h.messageId, ultimo_message_id: h.messageId, ultimo_mensaje_en: h.fecha }, { onConflict: "ficha_id,canal" });
  return { asunto: sinPrefijo(h.asunto), fecha: h.fecha };
}

/**
 * Hilo de correo de la tarea: el entrante al que contesta; si no hay, el hilo
 * abierto de la ficha (crm_hilos, que también recoge lo enviado desde Mail del Mac);
 * y si tampoco, el último correo real con la ficha.
 */
async function hiloDe(t: Tarea): Promise<{ inReplyTo: string | null; referencias: string[]; asunto: string | null }> {
  const sb = supabaseCharlas();
  const valido = (id: string | null | undefined) => !!id && !id.startsWith("sin-id-");
  if (t.mensaje_entrante_id) {
    const { data: m } = await sb.from("crm_mensajes").select("message_id, referencias, asunto").eq("id", t.mensaje_entrante_id).single();
    if (m && valido(m.message_id)) return { inReplyTo: m.message_id, referencias: [...(m.referencias ?? []), m.message_id].slice(-15), asunto: sinPrefijo(m.asunto) };
    return { inReplyTo: null, referencias: [], asunto: sinPrefijo(m?.asunto) };
  }
  const { data: h } = await sb.from("crm_hilos").select("ultimo_message_id, message_id_raiz, asunto").eq("ficha_id", t.ficha_id).eq("canal", "principal").maybeSingle();
  if (h && valido(h.ultimo_message_id)) {
    return { inReplyTo: h.ultimo_message_id, referencias: [...new Set([h.message_id_raiz, h.ultimo_message_id].filter(Boolean) as string[])], asunto: sinPrefijo(h.asunto) };
  }
  const { data: m } = await sb
    .from("crm_mensajes")
    .select("message_id, referencias, asunto")
    .eq("ficha_id", t.ficha_id)
    .or("tipo_salida.is.null,tipo_salida.neq.prueba")
    .not("message_id", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (m && valido(m.message_id)) return { inReplyTo: m.message_id, referencias: [...(m.referencias ?? []), m.message_id].slice(-15), asunto: sinPrefijo(m.asunto) };
  return { inReplyTo: null, referencias: [], asunto: sinPrefijo(h?.asunto) };
}

export function sinPrefijo(a: string | null | undefined): string | null {
  const s = String(a ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim();
  return s || null;
}

export async function aplicarCambios(t: Tarea, envio: { canal: string; texto: string; que?: string } | null) {
  const sb = supabaseCharlas();
  const c = (t.cambios_crm ?? {}) as Record<string, unknown>;
  const { data: f } = await sb.from("crm_fichas").select("mails_enviados, email").eq("id", t.ficha_id).single();
  const cambios: Record<string, unknown> = { actualizado_por: "sistema", fecha_ultimo_contacto: hoy(), enviado: false };
  for (const k of ["estado", "proxima_accion", "fecha_proxima_accion"]) if (c[k]) cambios[k] = c[k];
  // Leads: tras un check-in la ficha se queda sin fecha (sigue en el diario); un null explícito borra la fecha.
  if (t.carril === "entrenatzaile" && "fecha_proxima_accion" in c && c.fecha_proxima_accion === null) cambios.fecha_proxima_accion = null;
  // Un paso automático (sin envío) no es un contacto: no toca la fecha del último contacto.
  if (!envio && t.carril === "entrenatzaile" && t.resuelto_por_sistema === true) delete cambios.fecha_ultimo_contacto;
  const persona = c.contacto_nuevo as { nombre?: string; email?: string; telefono?: string; cargo?: string; responsable?: boolean } | undefined;
  // El email de un contacto apuntado a mano queda también como email de la ficha si no tenía (no pisa el existente).
  if (persona?.email && !f?.email) cambios.email = persona.email.toLowerCase();
  // Persona que ha escrito por otro camino y Alain marca como responsable de la ficha.
  if (persona?.responsable) {
    if (persona.nombre) cambios.responsable = persona.nombre;
    if (persona.email) cambios.responsable_email = persona.email.toLowerCase();
    if (persona.cargo) cambios.responsable_cargo = persona.cargo;
    if (persona.telefono) cambios.responsable_tel = persona.telefono;
  }
  if (envio?.canal === "Mail") cambios.mails_enviados = (f?.mails_enviados ?? 0) + 1;
  // Leads: el contador (mensajes_enviados en el vault) cuenta cualquier canal.
  if (envio && t.carril === "entrenatzaile") cambios.mails_enviados = (f?.mails_enviados ?? 0) + 1;
  // Foto de cómo estaba la ficha, para poder deshacerlo desde el panel.
  const antes = await fotoFicha(sb, "crm", t.ficha_id, Object.keys(cambios));
  await sb.from("crm_fichas").update(cambios).eq("id", t.ficha_id);

  const partes: string[] = [];
  const que = envio?.que ?? (t.tipo === "respuesta" ? "Respuesta" : etiqueta(t.tipo));
  if (envio) partes.push(`${que} enviad${/a$/.test(que) ? "a" : "o"} por ${envio.canal}`);
  else if (t.tipo === "llamada_alain") partes.push("Gestionado desde el panel");
  else if (t.tipo === "aparcar") partes.push("Aparcado sin respuesta");
  if (c.estado) partes.push(`→ ${c.estado}`);
  if (c.fecha_proxima_accion) partes.push(`siguiente: ${c.proxima_accion ?? "acción"} el ${c.fecha_proxima_accion}`);
  if (persona?.nombre || persona?.email) partes.push(`contacto${persona.responsable ? " (responsable)" : " nuevo"}: ${[persona.nombre, persona.cargo, persona.email, persona.telefono].filter(Boolean).join(" · ")}`);
  if (typeof c.nota === "string" && c.nota) partes.push(c.nota);
  const resumen = partes.join(" · ") || "Ficha actualizada";
  const interacciones: string[] = [];
  const { data: li } = await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: envio ? envio.canal : "Sistema", texto: resumen, orden: 600, origen: "sistema" }).select("id").single();
  if (li?.id) interacciones.push(li.id);
  // Lo enviado por WhatsApp, formulario web o teléfono no viaja por el servidor: queda en el Registro para que se vea en la ficha.
  if (envio && envio.canal !== "Mail" && envio.texto) {
    await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: envio.canal, texto: envio.texto, orden: 601, origen: "sistema" });
  }
  return { resumen, antes, despues: sinActualizadoPor(cambios), interacciones };
}

export function etiqueta(tipo: string) {
  return ({ hr_preparacion: "Mensaje 2 (preparación)", hr_confirmacion: "Mensaje 3 (confirmación 24 h)", hr_no_aparece: "Mensaje 4 (no aparece)", hr_cierre: "Mensaje 5 (cierre)", reactivacion: "Reactivación", recordatorio_1: "Recordatorio 1", recordatorio_2: "Recordatorio 2", recuperacion: "Mensaje de recuperación", check_in: "Check-in", primer_contacto: "Primer contacto", agencia_1a: "Agencia · primer mail (formato)", agencia_1b: "Agencia · primer mail (a quién escribir)", localizar_contacto: "Localizar email de la agencia", propuesta: "Propuesta", seguimiento: "Seguimiento", cierre: "Cierre suave", aviso_validez: "Aviso de fin de validez (MSG 06)", pedir_no: "Pedir el no (MSG 07)", fin_validez: "Presupuesto vencido sin respuesta", evento_paso: "Mensaje del protocolo de evento", crear_evento: "Crear evento" } as Record<string, string>)[tipo] ?? tipo.replace(/_/g, " ");
}
