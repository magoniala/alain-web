import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { marcarLeidoEnBuzon, quitarCita } from "@/lib/charlas-correo";
import { candidatosHuerfanos } from "@/lib/charlas-emparejar";
import { procesarMensaje } from "@/lib/charlas-proceso";
import { fusionarCambios, fusionarExtrasLlamada } from "@/lib/bandeja-cambios";
import { anadirAlCatalogo, instruccionTrasCompletar } from "@/lib/conocimiento-catalogo";
import { leerSesiones, proximaSesion, bonita } from "@/lib/charlas-sesiones";
import { contextoConDeshacer, deshacer, fotoFicha, recientesDeshacibles, tareaPrevia } from "@/lib/bandeja-deshacer";
import { enviar, aplicarCambios, cargarTarea, EnvioDuplicado } from "@/lib/charlas-envio";
import { guardarPistaParaCentros, pistasAyto } from "@/lib/ayto-municipio";
import { pistaDeLocalidad } from "@/lib/ayto-municipio-reglas";

// Bandeja de charlas en el panel.
//
// GET  → tareas por revisar (calientes primero), correos sin centro,
//        configuración (modo prueba) y coste de la IA.
// POST { accion, … }
//   enviar      { id, asunto, texto, destinatario, adjuntar_dossier, dossier_idioma, motivo? }
//   aplicar     { id, cambios? }             solo aplica los cambios al CRM, sin enviar nada (también con borrador). `cambios` = lo que Alain corrigió a mano (ver lib/bandeja-cambios)
//   aplazar     { id, fecha }                mueve la próxima acción del centro a otro día y cierra la tarjeta sin marcarla como hecha
//   descartar   { id, motivo? }
//   deshacer    { id }                       vuelve atrás un aplicar/aplazar/descartar (lib/bandeja-deshacer); los envíos no
//   regenerar   { id, instruccion }          rehace el borrador con una indicación de Alain
//   redactar    { id, instruccion? }         tarea sin borrador (revisar_correo, actualizar_crm): la IA escribe una respuesta al último correo del centro
//   completar   { id, clave, texto }         «Me falta información»: guarda el texto en el catálogo de shows (compartido con magia) y rehace el borrador; no envía nada
//   asignar     { mensaje_id, centro_id }    correo huérfano → centro, y se procesa
//   ignorar     { mensaje_id }               correo huérfano que no es de charlas
//   config      { modo_prueba?: boolean, lector_activo?: boolean }
//   pista_centros { centro_id, texto }      tarjeta de ayuntamiento: «Guardar para los centros» (lib/ayto-municipio)

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
        "*, centro:charlas_centros(id, nombre, estado, tipo, responsable, responsable_cargo, responsable_email, proxima_accion, fecha_proxima_accion, euskera, localidad, territorio, telefono, intentos_llamada, fecha_ultimo_contacto), entrante:charlas_mensajes!charlas_tareas_mensaje_entrante_id_fkey(id, de, asunto, fecha, texto, clasificacion, clasificacion_confianza)"
      )
      .in("estado", ["revisar", "error"])
      .order("nivel", { ascending: false })
      .order("creado_en", { ascending: true }),
    supabase.from("charlas_mensajes").select("id, de, asunto, fecha, texto, referencias, in_reply_to, match_por").eq("estado", "pendiente_asignar").order("fecha", { ascending: false }).limit(30),
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

  // «Sin emparejar»: centros candidatos para asociar con un toque.
  const candidatos = await candidatosHuerfanos(supabase, (huerfanos.data ?? []).map((h) => ({ ...h, texto: h.texto ? quitarCita(h.texto) : null }))).catch(() => ({} as Record<string, unknown[]>));

  // Pista del ayuntamiento para los centros de su municipio (lib/ayto-municipio): en las tarjetas
  // de centro, la del ayuntamiento de su localidad; en las de ayuntamiento, la suya (para editarla).
  const pistas = await pistasAyto(supabase).catch(() => []);
  const pistaDeTarea = (t: { centro?: { id?: string; tipo?: string | null; localidad?: string | null } | null }) => {
    if (!t.centro) return null;
    const p = t.centro.tipo === "ayuntamiento" ? pistas.find((x) => x.id === t.centro?.id) ?? null : pistaDeLocalidad(pistas, t.centro.localidad);
    return p?.pista_para_centros ? { ayuntamiento: p.nombre, texto: p.pista_para_centros } : null;
  };

  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const recientes = await recientesDeshacibles(supabase, "charlas").catch(() => []);
  const hoyISO = hoy();
  const costeHoy = (uso.data ?? []).filter((u) => u.creado_en.slice(0, 10) === hoyISO).reduce((s, u) => s + Number(u.coste_usd), 0);
  const coste30 = (uso.data ?? []).reduce((s, u) => s + Number(u.coste_usd), 0);

  return NextResponse.json({
    tareas: (tareas.data ?? []).map((t) => ({ ...t, ultimos: ultimos[t.centro_id] ?? { entrante: null, saliente: null }, pista_ayto: pistaDeTarea(t) })),
    error_tareas: tareas.error?.message ?? null,
    huerfanos: (huerfanos.data ?? []).map((h) => ({ id: h.id, de: h.de, asunto: h.asunto, fecha: h.fecha, texto: h.texto, rescatado: h.match_por === "rescate", candidatos: candidatos[h.id] ?? [] })),
    errores: errores.data ?? [],
    recientes,
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
        const previa = tareaPrevia(t);
        t.cambios_crm = fusionarExtrasLlamada(fusionarCambios(t.cambios_crm, body.cambios), body.cambios);
        const huella = await aplicarCambios(t, null);
        // La tarjeta queda atendida: el correo que la originó deja de salir como nuevo en Mail.
        const leido = await correoLeido(supabase, "charlas_mensajes", t.mensaje_entrante_id);
        await supabase
          .from("charlas_tareas")
          .update({ estado: "hecha", cambios_crm: t.cambios_crm, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: { ...contextoConDeshacer(t.contexto, { accion: "aplicar", tarea_previa: previa, ...huella }), ...(leido ? { leido_buzon: leido } : {}) } })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "aplazar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const fecha = String(body.fecha ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
        if (fecha < hoy()) throw new Error("Esa fecha ya pasó.");
        // Motivo obligatorio (decisión de Alain, 23-11-2026): queda en el Registro.
        const motivoAplazar = String(body.motivo ?? "").trim();
        if (motivoAplazar.length < 3) throw new Error("Falta el motivo del aplazamiento.");
        const previa = tareaPrevia(t);
        const antes = await fotoFicha(supabase, "charlas", t.centro_id, ["fecha_proxima_accion"]);
        const texto = `Aplazado al ${fecha.split("-").reverse().join("-")}: ${String(t.tipo).replace(/_/g, " ")} · motivo: ${motivoAplazar}`;
        await supabase.from("charlas_centros").update({ fecha_proxima_accion: fecha, actualizado_por: "panel" }).eq("id", t.centro_id);
        const { data: li } = await supabase.from("charlas_interacciones").insert({ centro_id: t.centro_id, fecha: hoy(), canal: "Sistema", texto, orden: 600, origen: "sistema" }).select("id").single();
        await supabase
          .from("charlas_tareas")
          .update({ estado: "descartada", motivo: `Aplazada al ${fecha}: ${motivoAplazar}`, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: contextoConDeshacer(t.contexto, { accion: "aplazar", resumen: texto, tarea_previa: previa, antes, despues: { fecha_proxima_accion: fecha }, interacciones: li?.id ? [li.id] : [] }) })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "descartar": {
        const t = await cargarTarea(String(body.id));
        const motivo = typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : null;
        const previa = tareaPrevia(t);
        // Un descarte con motivo también enseña: queda como corrección.
        let correccion: string | null = null;
        if (motivo && t.borrador_texto) {
          const { data: co } = await supabase.from("charlas_correcciones").insert({
            tarea_id: t.id,
            tipo_mensaje: t.contexto?.clasificacion ?? t.tipo,
            idioma: t.idioma,
            borrador: t.borrador_texto,
            final: "",
            motivo: `DESCARTADO: ${motivo}`,
          }).select("id").single();
          correccion = co?.id ?? null;
        }
        // «Localizar el correo» descartada = no se ha encontrado: el centro pasa a la próxima sesión de llamadas.
        if (t.tipo === "localizar_correo") {
          const f = proximaSesion(hoy(), await leerSesiones());
          await supabase.from("charlas_centros").update({ proxima_accion: "Llamada de conserjería (sin correo)", fecha_proxima_accion: f, actualizado_por: "panel" }).eq("id", t.centro_id);
          await supabase.from("charlas_interacciones").insert({ centro_id: t.centro_id, fecha: hoy(), canal: "Sistema", texto: `Correo no localizado: pasa a la sesión de llamadas del ${bonita(f)}`, orden: 600, origen: "sistema" });
        }
        await supabase
          .from("charlas_tareas")
          .update({ estado: "descartada", motivo, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: contextoConDeshacer(t.contexto, { accion: "descartar", resumen: `Descartada: ${String(t.tipo).replace(/_/g, " ")}`, tarea_previa: previa, antes: {}, despues: {}, interacciones: [], correcciones: correccion ? [correccion] : [] }) })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "deshacer":
        return NextResponse.json(await deshacer(supabase, "charlas", String(body.id)));
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
        // procesar = false → solo se asocia (correo ya atendido, p. ej. de los rescatados): sin tarjeta nueva.
        const procesar = body.procesar !== false;
        const { data: m } = await supabase.from("charlas_mensajes").select("de, asunto, fecha").eq("id", mensajeId).single();
        await supabase.from("charlas_mensajes").update({ centro_id: centroId, estado: procesar ? "nuevo" : "procesado", match_por: "manual" }).eq("id", mensajeId);
        // La dirección queda aprendida para la próxima vez.
        if (m?.de) await supabase.from("charlas_contactos").insert({ centro_id: centroId, email: m.de.toLowerCase(), rol: "otro", origen: "panel" }).then(() => null, () => null);
        if (procesar) await procesarMensaje(mensajeId);
        else
          await supabase.from("charlas_interacciones").insert({
            centro_id: centroId,
            fecha: (m?.fecha ?? new Date().toISOString()).slice(0, 10),
            canal: "Recibido",
            texto: `Correo de ${m?.de ?? "¿?"} asociado a mano desde «Sin emparejar»: ${m?.asunto ?? "(sin asunto)"}`,
            orden: 600,
            origen: "panel",
          });
        return NextResponse.json({ ok: true });
      }
      case "ignorar": {
        await supabase.from("charlas_mensajes").update({ estado: "ignorado" }).eq("id", String(body.mensaje_id));
        return NextResponse.json({ ok: true });
      }
      case "pista_centros": {
        const r = await guardarPistaParaCentros(String(body.centro_id ?? ""), String(body.texto ?? ""));
        return NextResponse.json({ ok: true, ...r, aviso: r.centros.length ? `Guardada y copiada en el Registro de: ${r.centros.join(", ")}.` : "Guardada. No hay centros de este municipio en el CRM." });
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

/** Marca como leído en el buzón el correo que originó la tarjeta (si lo hay). Nunca impide cerrar la tarjeta. */
async function correoLeido(sb: ReturnType<typeof supabaseCharlas>, tabla: "charlas_mensajes" | "crm_mensajes", mensajeId: string | null | undefined) {
  if (!mensajeId) return null;
  const { data } = await sb.from(tabla).select("message_id").eq("id", mensajeId).maybeSingle();
  if (!data?.message_id) return { marcado: false, error: "correo no encontrado" };
  return marcarLeidoEnBuzon(data.message_id);
}
