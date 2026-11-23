import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { marcarLeidoEnBuzon } from "@/lib/charlas-correo";
import { envioManualAgencia, procesarEntranteMagia, regenerarTareaMagia } from "@/lib/crm-motor";
import { fusionarCambios } from "@/lib/bandeja-cambios";
import { anadirAlCatalogo, instruccionTrasCompletar } from "@/lib/conocimiento-catalogo";
import { cerrarTareasObsoletasMagia } from "@/lib/crm-tareas-obsoletas";
import { contextoConDeshacer, deshacer, fotoFicha, recientesDeshacibles, tareaPrevia } from "@/lib/bandeja-deshacer";
import { cargarTarea, enviarMail, aplicarCambios, etiqueta, registrarCorreccion, sinPrefijo, EnvioDuplicado, guardarHiloDeBuzon } from "@/lib/crm-envio";
import { cerrarTareasObsoletasLeads, tareasPorFechaLeads } from "@/lib/leads-motor";

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
//        deshacer          → { id }: vuelve atrás un aplicar/aplazar/descartar (lib/bandeja-deshacer); los envíos no
//        (GET y motor cierran solas las tarjetas programadas que ya no tocan: lib/crm-tareas-obsoletas)
//        rehacer           → regenerar el borrador con una indicación
//        completar         → «Me falta información»: guarda el texto en un documento del catálogo de shows y rehace el borrador (no envía nada)
//        reintentar_mensaje→ un correo entrante que falló vuelve a la cola
//
// Leads de Entrenatzaile (?carril=entrenatzaile, 23-11-2026): mismas acciones y además
//        ha_contestado     → { id, texto }: ha respondido (WhatsApp, Instagram…): lo apunta, pasa a 3 En conversación y cierra la tarjeta
//        enviado_fuera     → { id, canal, texto }: lo mandó por otro camino (Mail del Mac, otro WhatsApp, Instagram)
//        buscar_hilo       → { id }: busca en el buzón el último correo con su email para seguir en el mismo hilo
// «aplazar» pide fecha y MOTIVO en todos los carriles (decisión de Alain, 23-11).

export const maxDuration = 60;
export const dynamic = "force-dynamic";


const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const carril = new URL(req.url).searchParams.get("carril") ?? "magia";
  // Tarjetas programadas cuya ficha ya no está en la fase en que se crearon (p. ej. pasada a 8 Perdido): se cierran solas
  // y quedan en «Últimos cambios» con «Deshacer». Si falla, la bandeja se carga igual.
  const cerradas_solas = carril === "magia" ? await cerrarTareasObsoletasMagia(sb).catch(() => []) : [];
  if (carril === "entrenatzaile") await cerrarTareasObsoletasLeads().catch(() => 0);
  const camposFicha = carril === "entrenatzaile" ? ", datos, cuerpo_antes, mails_enviados, fecha_ultimo_contacto" : "";
  const [tareas, errores, cfg, uso] = await Promise.all([
    sb
      .from("crm_tareas")
      .select(`*, ficha:crm_fichas(id, nombre, segmento, tipo_entidad, estado, canal, idioma, web, responsable, responsable_tel, responsable_email, email, telefono, localidad, ultimo_evento, proxima_accion, fecha_proxima_accion${camposFicha}), entrante:crm_mensajes!crm_tareas_mensaje_entrante_id_fkey(id, de, asunto, fecha, texto, clasificacion)`)
      .eq("carril", carril)
      .in("estado", ["revisar", "error"])
      .order("urgencia", { ascending: false })
      .order("creado_en", { ascending: true }),
    sb.from("crm_mensajes").select("id, de, asunto, fecha, error").eq("estado", "error").order("fecha", { ascending: false }).limit(10),
    sb.from("charlas_config").select("clave, valor").in("clave", ["magia_activo", "magia_por_dia", "modo_prueba", "leads_modo"]),
    sb.from("charlas_ia_uso").select("creado_en, coste_usd, proposito").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()).like("proposito", "magia_%"),
  ]);
  const config = Object.fromEntries((cfg.data ?? []).map((c) => [c.clave, c.valor]));
  const recientes = await recientesDeshacibles(sb, "crm", { carril }).catch(() => []);
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
    cerradas_solas,
    errores: errores.data ?? [],
    recientes,
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
        const previa = tareaPrevia(t);
        t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
        const huella = await aplicarCambios(t, null);
        // La tarjeta queda atendida: el correo que la originó deja de salir como nuevo en Mail.
        const leido = await correoLeido(sb, "crm_mensajes", t.mensaje_entrante_id);
        await sb
          .from("crm_tareas")
          .update({ estado: "hecha", cambios_crm: t.cambios_crm, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: { ...contextoConDeshacer(t.contexto, { accion: "aplicar", tarea_previa: previa, ...huella }), ...(leido ? { leido_buzon: leido } : {}) } })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "aplazar": {
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const fecha = String(body.fecha ?? "");
        const motivoAplazar = String(body.motivo ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
        if (fecha < hoy()) throw new Error("Esa fecha ya pasó.");
        if (motivoAplazar.length < 3) throw new Error("Falta el motivo del aplazamiento.");
        const previa = tareaPrevia(t);
        const antes = await fotoFicha(sb, "crm", t.ficha_id, ["fecha_proxima_accion"]);
        const texto = `Aplazado al ${fecha.split("-").reverse().join("-")}: ${etiqueta(t.tipo)} · motivo: ${motivoAplazar}`;
        await sb.from("crm_fichas").update({ fecha_proxima_accion: fecha, actualizado_por: "panel" }).eq("id", t.ficha_id);
        const { data: li } = await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: "Sistema", texto, orden: 600, origen: "sistema" }).select("id").single();
        await sb
          .from("crm_tareas")
          .update({ estado: "descartada", motivo: `Aplazada al ${fecha}: ${motivoAplazar}`, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: contextoConDeshacer(t.contexto, { accion: "aplazar", resumen: texto, tarea_previa: previa, antes, despues: { fecha_proxima_accion: fecha }, interacciones: li?.id ? [li.id] : [] }) })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "descartar": {
        const t = await cargarTarea(String(body.id));
        const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
        const previa = tareaPrevia(t);
        let correccion: string | null = null;
        if (motivo && t.borrador_texto) {
          const { data: co } = await sb.from("crm_correcciones").insert({ carril: t.carril ?? "magia", tarea_id: t.id, tipo_mensaje: t.tipo, idioma: t.idioma, borrador: t.borrador_texto, final: "", motivo: `DESCARTADO: ${motivo}` }).select("id").single();
          correccion = co?.id ?? null;
        }
        await sb
          .from("crm_tareas")
          .update({ estado: "descartada", motivo: motivo || null, resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: contextoConDeshacer(t.contexto, { accion: "descartar", resumen: `Descartada: ${etiqueta(t.tipo)}`, tarea_previa: previa, antes: {}, despues: {}, interacciones: [], correcciones: correccion ? [correccion] : [] }) })
          .eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "deshacer":
        return NextResponse.json(await deshacer(sb, "crm", String(body.id)));
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
        if (["apagado", "prueba", "activo"].includes(String(body.leads_modo))) await sb.from("charlas_config").upsert({ clave: "leads_modo", valor: String(body.leads_modo), actualizado_en: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      }
      case "ha_contestado": {
        // Leads: ha respondido por un canal que el sistema no lee (WhatsApp, Instagram) o por correo antes de que se lea.
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const texto = String(body.texto ?? "").trim();
        if (!texto) throw new Error("Pega o resume lo que te ha dicho.");
        const previa = tareaPrevia(t);
        const { data: f } = await sb.from("crm_fichas").select("datos").eq("id", t.ficha_id).single();
        const antes = await fotoFicha(sb, "crm", t.ficha_id, ["estado", "proxima_accion", "fecha_proxima_accion", "datos"]);
        const manana = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(Date.now() + 86400000));
        const despues = { estado: "3 En conversación", proxima_accion: "Contestar (menos de 24 h; una o dos preguntas)", fecha_proxima_accion: manana, datos: { ...(f?.datos ?? {}), respondio: "sí" } };
        await sb.from("crm_fichas").update({ ...despues, actualizado_por: "panel" }).eq("id", t.ficha_id);
        const { data: li } = await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: "Recibido", texto: `Responde: ${texto} · → 3 En conversación`, orden: 610, origen: "panel" }).select("id").single();
        await sb.from("crm_tareas").update({ estado: "hecha", resuelto_en: new Date().toISOString(), resuelto_por: "alain", contexto: contextoConDeshacer(t.contexto, { accion: "aplicar", resumen: "Ha contestado → 3 En conversación", tarea_previa: previa, antes, despues, interacciones: li?.id ? [li.id] : [] }) }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "enviado_fuera": {
        // Leads: el mensaje salió por otro camino (Mail del Mac, el WhatsApp de la magia, Instagram).
        const t = await cargarTarea(String(body.id));
        if (t.estado !== "revisar" && t.estado !== "error") throw new Error(`La tarea ya está ${t.estado}.`);
        const canal = ["Mail", "WhatsApp", "Instagram"].includes(String(body.canal)) ? String(body.canal) : "Otra vía";
        const texto = String(body.texto ?? t.borrador_texto ?? "").trim();
        t.cambios_crm = fusionarCambios(t.cambios_crm, body.cambios);
        await registrarCorreccion(t, texto, body);
        await aplicarCambios(t, { canal, texto, que: `${etiqueta(t.tipo)} (enviado fuera del panel)` });
        await sb.from("crm_tareas").update({ estado: "enviada", cambios_crm: t.cambios_crm, texto_final: texto, editado: texto !== (t.borrador_texto ?? "").trim(), resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("id", t.id);
        return NextResponse.json({ ok: true });
      }
      case "motor_leads":
        // «Buscar lo que toca ahora» en la pestaña de leads: la misma pasada que hace el cron.
        return NextResponse.json({ ok: true, ...(await tareasPorFechaLeads({ presupuestoMs: 40000 })) });
      case "buscar_hilo": {
        const t = await cargarTarea(String(body.id));
        const email = String(body.destinatario ?? t.destinatario ?? "").trim();
        if (!email.includes("@")) throw new Error("La tarjeta no tiene email.");
        const h = await guardarHiloDeBuzon(t.ficha_id, email);
        return NextResponse.json({ ok: true, encontrado: !!h, asunto: h?.asunto ?? null, fecha: h?.fecha ?? null });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof EnvioDuplicado) return NextResponse.json({ error: e.message, duplicado: true }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Marca como leído en el buzón el correo que originó la tarjeta (si lo hay). Nunca impide cerrar la tarjeta. */
async function correoLeido(sb: ReturnType<typeof supabaseCharlas>, tabla: "charlas_mensajes" | "crm_mensajes", mensajeId: string | null | undefined) {
  if (!mensajeId) return null;
  const { data } = await sb.from(tabla).select("message_id").eq("id", mensajeId).maybeSingle();
  if (!data?.message_id) return { marcado: false, error: "correo no encontrado" };
  return marcarLeidoEnBuzon(data.message_id);
}
