import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo } from "@/lib/charlas-correo";
import { envioManualAgencia, procesarEntranteMagia, regenerarTareaMagia } from "@/lib/crm-motor";
import { fusionarCambios } from "@/lib/bandeja-cambios";
import { anadirAlCatalogo, instruccionTrasCompletar } from "@/lib/conocimiento-catalogo";

// Bandeja del carril de MAGIA (fase 6a).
//
//   GET  /api/admin/crm/bandeja?carril=magia      → tareas en revisión (con ficha y correo entrante), coste y contadores
//   POST /api/admin/crm/bandeja  { accion, id, … }
//        enviar            → correo por SMTP (como en charlas), hilo y copia en Enviados; aplica cambios en la ficha
//        whatsapp_enviado  → Alain lo ha mandado desde su móvil (enlace wa.me): aplica cambios y apunta el texto en el Registro
//        manual_enviado    → { id, canal: "Formulario web" | "Teléfono", texto }: agencia sin email; Alain lo mandó a mano por su web o lo dijo por teléfono
//        aplicar           → solo los cambios de ficha, sin enviar nada (también con borrador). `cambios` = lo que Alain corrigió a mano (lib/bandeja-cambios)
//        aplazar           → { id, fecha }: mueve la próxima acción de la ficha a otro día y cierra la tarjeta sin marcarla como hecha
//        descartar         → con motivo (alimenta el aprendizaje)
//        rehacer           → regenerar el borrador con una indicación
//        completar         → «Me falta información»: guarda el texto en un documento del catálogo de shows y rehace el borrador (no envía nada)
//        reintentar_mensaje→ un correo entrante que falló vuelve a la cola

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Ya salió un correo real a esta ficha hace poco: el panel pregunta a Alain
// antes de mandar otro (evita duplicados por no ver que el anterior ya se envió).
class EnvioDuplicado extends Error {}
const VENTANA_DUPLICADO_MIN = 30;

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const carril = new URL(req.url).searchParams.get("carril") ?? "magia";
  const [tareas, errores, cfg, uso] = await Promise.all([
    sb
      .from("crm_tareas")
      .select("*, ficha:crm_fichas(id, nombre, segmento, tipo_entidad, estado, canal, idioma, web, responsable, responsable_tel, responsable_email, email, telefono, localidad, ultimo_evento, proxima_accion, fecha_proxima_accion), entrante:crm_mensajes!crm_tareas_mensaje_entrante_id_fkey(id, de, asunto, fecha, texto, clasificacion)")
      .eq("carril", carril)
      .in("estado", ["revisar", "error"])
      .order("urgencia", { ascending: false })
      .order("creado_en", { ascending: true }),
    sb.from("crm_mensajes").select("id, de, asunto, fecha, error").eq("estado", "error").order("fecha", { ascending: false }).limit(10),
    sb.from("charlas_config").select("clave, valor").in("clave", ["magia_activo", "magia_por_dia", "modo_prueba"]),
    sb.from("charlas_ia_uso").select("creado_en, coste_usd, proposito").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()).like("proposito", "magia_%"),
  ]);
  const config = Object.fromEntries((cfg.data ?? []).map((c) => [c.clave, c.valor]));
  const h = hoy();

  // Último correo recibido y último enviado de cada ficha con tarjeta: la tarjeta
  // no siempre trae un entrante asociado (tarjetas por fecha, «buscar email»…).
  const fichaIds = [...new Set((tareas.data ?? []).map((t) => t.ficha_id as string).filter(Boolean))];
  const ultimos: Record<string, { entrante: unknown; saliente: unknown }> = {};
  if (fichaIds.length) {
    const { data: msgs } = await sb.from("crm_mensajes").select("id, ficha_id, direccion, de, para, asunto, fecha, texto, tipo_salida").in("ficha_id", fichaIds).order("fecha", { ascending: false }).limit(600);
    for (const m of msgs ?? []) {
      if (m.tipo_salida === "prueba") continue;
      const u = (ultimos[m.ficha_id] ??= { entrante: null, saliente: null });
      const k = m.direccion === "entrante" ? "entrante" : "saliente";
      if (!u[k]) u[k] = { id: m.id, direccion: m.direccion, de: m.de, para: m.para, asunto: m.asunto, fecha: m.fecha, texto: (m.texto ?? "").slice(0, 4000) };
    }
  }
  // Asunto del hilo abierto con cada ficha: un seguimiento sin asunto propio sale como «Re: …» en ese hilo.
  const hilos: Record<string, string> = {};
  if (fichaIds.length) {
    const { data: hs } = await sb.from("crm_hilos").select("ficha_id, asunto").eq("canal", "principal").in("ficha_id", fichaIds);
    for (const x of hs ?? []) if (x.asunto) hilos[x.ficha_id] = x.asunto;
  }
  return NextResponse.json({
    tareas: (tareas.data ?? []).map((t) => {
      const ult = ultimos[t.ficha_id] ?? { entrante: null, saliente: null };
      const previo = [ult.saliente, ult.entrante].filter(Boolean) as { asunto?: string | null; fecha?: string | null }[];
      previo.sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
      const hilo_asunto = hilos[t.ficha_id] ?? sinPrefijo(previo.find((m) => m.asunto)?.asunto ?? "") ?? null;
      // Agencia sin email: texto del guion para mandarlo a mano por su formulario web.
      const manual = t.tipo === "localizar_contacto" && t.ficha?.segmento === "agencia" ? envioManualAgencia(t.ficha) : null;
      return { ...t, ultimos: ult, hilo_asunto: hilo_asunto || null, manual: manual ? { etiqueta: manual.etiqueta, texto: manual.texto } : null };
    }),
    error_tareas: tareas.error?.message ?? null,
    errores: errores.data ?? [],
    config,
    coste: { hoy_usd: Number(((uso.data ?? []).filter((u) => u.creado_en.slice(0, 10) === h).reduce((s, u) => s + Number(u.coste_usd), 0)).toFixed(3)), ult_30_dias_usd: Number(((uso.data ?? []).reduce((s, u) => s + Number(u.coste_usd), 0)).toFixed(2)) },
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = supabaseCharlas();
  try {
    switch (body.accion) {
      case "enviar":
        return NextResponse.json(await enviarMail(body));
      case "whatsapp_enviado": {
        const t = await cargarTarea(String(body.id));
        t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
        const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
        await registrarCorreccion(t, texto, body);
        await aplicarCambios(t, { canal: "WhatsApp", texto });
        await sb.from("crm_tareas").update({ estado: "enviada", cambios_crm: t.cambios_crm, texto_final: texto, editado: texto !== (t.borrador_texto ?? "").trim(), resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "manual_enviado": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const canal = body.canal === "Teléfono" ? "Teléfono" : "Formulario web";
        const { data: f } = await sb.from("crm_fichas").select("responsable, estado").eq("id", t.ficha_id).single();
        const m = envioManualAgencia({ responsable: f?.responsable ?? null, estado: f?.estado ?? null });
        const texto = String(body.texto ?? m.texto).trim();
        // Los cambios son los del guion (no los de «localizar email», que solo movían la fecha).
        t.cambios_crm = m.cambios;
        await aplicarCambios(t, { canal, texto, que: m.etiqueta });
        await sb.from("crm_tareas").update({ estado: "enviada", cambios_crm: t.cambios_crm, texto_final: texto, editado: texto !== m.texto.trim(), resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "aplicar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
        await aplicarCambios(t, null);
        await sb.from("crm_tareas").update({ estado: "hecha", cambios_crm: t.cambios_crm, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "aplazar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const fecha = String(body.fecha ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
        if (fecha < hoy()) throw new Error("Esa fecha ya pasó.");
        await sb.from("crm_fichas").update({ fecha_proxima_accion: fecha, actualizado_por: "panel" }).eq("id", t.ficha_id);
        await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: "Sistema", texto: `Aplazado al ${fecha.split("-").reverse().join("-")}: ${etiqueta(t.tipo)}`, orden: 600, origen: "sistema" });
        await sb.from("crm_tareas").update({ estado: "descartada", motivo: `Aplazada al ${fecha}`, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "descartar": {
        const t = await cargarTarea(String(body.id));
        const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
        await sb.from("crm_tareas").update({ estado: "descartada", motivo: motivo || null, resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        if (motivo && t.borrador_texto) {
          await sb.from("crm_correcciones").insert({ carril: "magia", tarea_id: t.id, tipo_mensaje: t.tipo, idioma: t.idioma, borrador: t.borrador_texto, final: "", motivo: `DESCARTADO: ${motivo}` });
        }
        return NextResponse.json({ ok: true });
      }
      case "rehacer": {
        const t = await cargarTarea(String(body.id));
        const instruccion = String(body.instruccion ?? "").trim();
        if (!instruccion) throw new Error("Falta la indicación.");
        if (t.mensaje_entrante_id) {
          await procesarEntranteMagia(t.mensaje_entrante_id, instruccion);
        } else {
          await regenerarTareaMagia(t.id, instruccion);
        }
        return NextResponse.json({ ok: true });
      }
      case "redactar": {
        // Tarjeta sin mensaje (p. ej. "correo suyo sin respuesta"): la IA contesta al último entrante de la ficha.
        const t = await cargarTarea(String(body.id));
        const { data: ult } = await sb.from("crm_mensajes").select("id").eq("ficha_id", t.ficha_id).eq("direccion", "entrante").order("fecha", { ascending: false }).limit(1).maybeSingle();
        const extra = String(body.instruccion ?? "").trim();
        if (ult?.id) {
          const r = await procesarEntranteMagia(ult.id, `Alain quiere contestar a este correo aunque haya pasado tiempo: redacta la respuesta (responder = true). Si decían que avisarían o lo pasaban a otra persona, pregunta con naturalidad si hubo novedades.${extra ? ` Indicación de Alain: ${extra}` : ""}`);
          if (!r.tarea) throw new Error("La IA no ha generado ningún borrador. Prueba a decirle qué quieres contestar.");
          // La tarjeta de partida (sin correo entrante asociado) se cierra: si no,
          // se queda debajo del borrador y parece que no se ha enviado nada.
          if (r.tarea !== t.id) {
            await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Sustituida por el borrador redactado", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("id", t.id).in("estado", ["revisar", "pendiente"]);
          }
        } else {
          await regenerarTareaMagia(t.id, `Redacta un mensaje para esta ficha (conMensaje = true).${extra ? ` Indicación de Alain: ${extra}` : ""}`);
        }
        return NextResponse.json({ ok: true });
      }
      case "completar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const texto = String(body.texto ?? "").trim();
        const doc = await anadirAlCatalogo(String(body.clave ?? ""), texto, `bandeja de magia · ${t.ficha_id ? (await sb.from("crm_fichas").select("nombre").eq("id", t.ficha_id).maybeSingle()).data?.nombre ?? "ficha" : "ficha"}`);
        // Cuenta como corrección: entra en el repaso semanal de reglas (crm-aprendizaje).
        await sb.from("crm_correcciones").insert({ carril: "magia", tarea_id: t.id, tipo_mensaje: t.tipo, idioma: t.idioma, borrador: t.borrador_texto ?? "", final: "", motivo: `AÑADIDO AL CATÁLOGO («${doc.titulo}»): ${texto}` });
        const instruccion = instruccionTrasCompletar(doc.titulo, texto, String(body.instruccion ?? ""));
        if (t.mensaje_entrante_id) {
          await procesarEntranteMagia(t.mensaje_entrante_id, instruccion);
        } else {
          const { data: ult } = !t.borrador_texto ? await sb.from("crm_mensajes").select("id").eq("ficha_id", t.ficha_id).eq("direccion", "entrante").order("fecha", { ascending: false }).limit(1).maybeSingle() : { data: null };
          if (ult?.id) {
            const r = await procesarEntranteMagia(ult.id, instruccion);
            if (r.tarea && r.tarea !== t.id) await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Sustituida por el borrador redactado", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("id", t.id).in("estado", ["revisar", "pendiente"]);
          } else {
            await regenerarTareaMagia(t.id, instruccion);
          }
        }
        return NextResponse.json({ ok: true, documento: doc });
      }
      case "reintentar_mensaje": {
        await sb.from("crm_mensajes").update({ estado: "nuevo", intentos: 0, error: null }).eq("id", String(body.mensaje_id)).eq("estado", "error");
        return NextResponse.json({ ok: true });
      }
      case "config": {
        for (const clave of ["magia_activo"]) {
          if (typeof body[clave] === "boolean") await sb.from("charlas_config").upsert({ clave, valor: body[clave], actualizado_en: new Date().toISOString() });
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tarea = any;

async function cargarTarea(id: string): Promise<Tarea> {
  const { data, error } = await supabaseCharlas().from("crm_tareas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Tarea no encontrada.");
  return data;
}

async function registrarCorreccion(t: Tarea, textoFinal: string, body: Record<string, unknown>) {
  const sb = supabaseCharlas();
  const alt = body.opcion === "b" ? (t.contexto?.alternativa as { cuerpo?: string } | null) : null;
  const borrador = (alt?.cuerpo ?? t.borrador_texto ?? "").trim();
  const editado = textoFinal !== borrador;
  const motivo = typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : null;
  if (editado || body.opcion === "b") {
    await sb.from("crm_correcciones").insert({
      carril: "magia",
      tarea_id: t.id,
      tipo_mensaje: t.tipo,
      idioma: t.idioma,
      borrador: body.opcion === "b" ? `ELIGIÓ LA ALTERNATIVA (${t.contexto?.alternativa?.etiqueta ?? "B"}) en vez de:\n${t.borrador_texto ?? ""}` : borrador,
      final: textoFinal,
      motivo,
    });
  }
}

async function enviarMail(body: Record<string, unknown>) {
  const sb = supabaseCharlas();
  const t = await cargarTarea(String(body.id));
  if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
  // Lo que Alain haya corregido a mano en «Qué se apunta en el CRM».
  t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
  const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
  const destinatario = String(body.destinatario ?? t.destinatario ?? "").trim();
  // Hilo en el que va: el correo al que se contesta o, si no hay, el último con esta ficha.
  // Un seguimiento (recordatorio de agencia, etc.) no trae asunto: hereda «Re: …» del hilo.
  const hilo = await hiloDe(t);
  let asunto = String(body.asunto ?? "").trim() || String(t.borrador_asunto ?? "").trim();
  if (!asunto && hilo.asunto) asunto = `Re: ${hilo.asunto}`;
  if (!texto || !destinatario.includes("@")) throw new Error("Faltan texto o destinatario.");
  if (!asunto) throw new Error("No hay ningún correo anterior con esta ficha del que tomar el asunto: escribe uno.");

  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  const prueba = cfg?.valor !== false;

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
  await sb.from("crm_tareas").update({ estado: "enviada", cambios_crm: t.cambios_crm, texto_final: texto, editado: texto !== (t.borrador_texto ?? "").trim(), mensaje_salida_id: saliente?.id ?? null, resuelto_en: ahora, resuelto_por: "alain" }).eq("id", t.id);
  // Ya ha salido un correo a esta ficha: cualquier otra tarjeta abierta para ella
  // queda obsoleta (si no, se queda en la bandeja e invita a enviar lo mismo otra vez).
  await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Ya se envió un correo a esta ficha desde otra tarjeta", resuelto_en: ahora, resuelto_por: "sistema" }).eq("ficha_id", t.ficha_id).eq("estado", "revisar").neq("id", t.id).neq("tipo", "llamada_alain");
  await sb.from("crm_hilos").upsert({ ficha_id: t.ficha_id, canal: "principal", asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: referencias[0] ?? envio.messageId, ultimo_message_id: envio.messageId, ultimo_mensaje_en: ahora }, { onConflict: "ficha_id,canal" });
  await aplicarCambios(t, { canal: "Mail", texto });
  return { ok: true, prueba: false, enviado_a: envio.para, smtp: envio.smtp };
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

function sinPrefijo(a: string | null | undefined): string | null {
  const s = String(a ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim();
  return s || null;
}

async function aplicarCambios(t: Tarea, envio: { canal: string; texto: string; que?: string } | null) {
  const sb = supabaseCharlas();
  const c = (t.cambios_crm ?? {}) as Record<string, unknown>;
  const { data: f } = await sb.from("crm_fichas").select("mails_enviados, email").eq("id", t.ficha_id).single();
  const cambios: Record<string, unknown> = { actualizado_por: "sistema", fecha_ultimo_contacto: hoy(), enviado: false };
  for (const k of ["estado", "proxima_accion", "fecha_proxima_accion"]) if (c[k]) cambios[k] = c[k];
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
  await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: envio ? envio.canal : "Sistema", texto: partes.join(" · ") || "Ficha actualizada", orden: 600, origen: "sistema" });
  // Lo enviado por WhatsApp, formulario web o teléfono no viaja por el servidor: queda en el Registro para que se vea en la ficha.
  if (envio && envio.canal !== "Mail" && envio.texto) {
    await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: envio.canal, texto: envio.texto, orden: 601, origen: "sistema" });
  }
}

function etiqueta(tipo: string) {
  return ({ reactivacion: "Reactivación", recordatorio_1: "Recordatorio 1", recordatorio_2: "Recordatorio 2", recuperacion: "Mensaje de recuperación", check_in: "Check-in", primer_contacto: "Primer contacto", agencia_1a: "Agencia · primer mail (formato)", agencia_1b: "Agencia · primer mail (a quién escribir)", localizar_contacto: "Localizar email de la agencia", propuesta: "Propuesta", seguimiento: "Seguimiento", cierre: "Cierre suave" } as Record<string, string>)[tipo] ?? tipo.replace(/_/g, " ");
}

