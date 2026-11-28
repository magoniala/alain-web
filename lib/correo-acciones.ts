// Correo en el panel · acciones de las tarjetas, pendientes y avisos al móvil.
// Datos y clasificación: lib/correo-panel.ts. Ruta: /api/admin/correo/panel.
//
// Reglas del encargo del 28-11-2026:
//  · Los pendientes de correo viven SOLO en el panel (sin espejo al vault ni nota diaria).
//  · Los testimonios y las respuestas de newsletter se guardan en Supabase y los
//    vuelca al vault scripts/crm/espejo-correo.mjs en la pasada horaria que ya existe.
//  · `Centros/` es espejo de Supabase: las fichas se cambian aquí (Supabase), nunca en el vault.

import { ImapFlow } from "imapflow";
import { supabaseCharlas } from "./charlas";
import { enviarPush } from "./charlas-push";
import { guardarRegla } from "./correo-general";
import { lineaRegistro } from "./correo-panel";

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const texto = (v: unknown, max = 20000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIAS_PENDIENTE = ["charlas", "magia", "entrenatzaile", "general"];
const PERMISOS = ["solo_anonimo", "con_nombre", "no_consta"] as const;
const DONDE = ["objecion", "dossier", "cierre", "web"];
const ETIQUETA_PERMISO: Record<string, string> = { solo_anonimo: "solo anónimo", con_nombre: "con nombre", no_consta: "permiso no consta" };

async function fila(id: unknown) {
  if (typeof id !== "string" || !id) throw new Error("Falta el correo.");
  const { data, error } = await supabaseCharlas().from("correo_entrada").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("No encuentro ese correo.");
  return data as Record<string, unknown> & { id: string; message_id: string; buzon: string; via: string | null; via_ref: string | null; de: string | null; asunto: string | null; fecha: string | null; texto: string | null; etiquetas: string[] };
}

/** Marca \Seen en INBOX (solo alain@, y solo cuando Alain pulsa Visto o Hecho; leer nunca marca). */
async function marcarLeidos(ids: string[]): Promise<number> {
  const user = process.env.CHARLAS_MAIL_USER;
  const pass = process.env.CHARLAS_MAIL_PASS;
  const limpios = ids.map((i) => i.replace(/^<|>$/g, "")).filter((i) => i && !i.startsWith("sin-id-"));
  if (!user || !pass || !limpios.length) return 0;
  const cliente = new ImapFlow({ host: "imap.serviciodecorreo.es", port: 993, secure: true, auth: { user, pass }, logger: false });
  let marcados = 0;
  try {
    await cliente.connect();
    const lock = await cliente.getMailboxLock("INBOX");
    try {
      const uids: number[] = [];
      for (const id of limpios.slice(0, 80)) {
        for (const forma of [id, `<${id}>`]) {
          const r = ((await cliente.search({ header: { "message-id": forma } }, { uid: true }).catch(() => [])) || []) as number[];
          if (r.length) {
            uids.push(...r);
            break;
          }
        }
      }
      if (uids.length) {
        await cliente.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
        marcados = uids.length;
      }
    } finally {
      lock.release();
    }
  } catch {
    /* si falla el buzón, la tarjeta se cierra igual */
  } finally {
    await cliente.logout().catch(() => {});
  }
  return marcados;
}

async function cerrar(ids: string[], motivo: string) {
  const sb = supabaseCharlas();
  const { data, error } = await sb.from("correo_entrada").update({ estado: "cerrado", cerrado_en: new Date().toISOString(), cerrado_motivo: motivo }).in("id", ids).select("message_id, buzon");
  if (error) throw new Error(error.message);
  const marcados = await marcarLeidos((data ?? []).filter((r) => r.buzon === "alain").map((r) => r.message_id as string));
  return { cerradas: data?.length ?? 0, marcados_en_mail: marcados };
}

async function centroDe(b: Record<string, unknown>): Promise<{ id: string; nombre: string; estado: string; ampa_email: string | null; etiquetas: string[] }> {
  let centroId = texto(b.centro_id, 60);
  if (!centroId && b.id) {
    const f = await fila(b.id);
    if (f.via === "charlas" && f.via_ref) centroId = f.via_ref;
  }
  if (!centroId) throw new Error("Este correo no tiene ficha de charlas. Elige la ficha.");
  const { data } = await supabaseCharlas().from("charlas_centros").select("id, nombre, estado, ampa_email, etiquetas").eq("id", centroId).maybeSingle();
  if (!data) throw new Error("No encuentro esa ficha.");
  return data as { id: string; nombre: string; estado: string; ampa_email: string | null; etiquetas: string[] };
}

export async function accionPanel(b: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sb = supabaseCharlas();
  const accion = texto(b.accion, 40);

  // --- Visto · Hecho · reabrir ------------------------------------------------
  if (accion === "visto" || accion === "hecho") {
    const f = await fila(b.id);
    return { ok: true, ...(await cerrar([f.id], accion)) };
  }
  if (accion === "visto_todos") {
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
    if (!ids.length) return { ok: true, cerradas: 0 };
    return { ok: true, ...(await cerrar(ids, "visto")) };
  }
  if (accion === "reabrir") {
    const f = await fila(b.id);
    await sb.from("correo_entrada").update({ estado: "nuevo", cerrado_en: null, cerrado_motivo: null }).eq("id", f.id);
    return { ok: true };
  }

  // --- «Siempre así con este remitente» ----------------------------------------
  if (accion === "siempre_asi") {
    const f = await fila(b.id);
    const de = (f.de ?? "").toLowerCase();
    if (!de) throw new Error("El correo no tiene remitente.");
    const patron = b.alcance === "dominio" ? "@" + de.split("@")[1] : de;
    const tratamiento = texto(b.tratamiento, 20) || "completo";
    const categoria = texto(b.categoria, 20) || null;
    const r = await guardarRegla({ patron, tratamiento, categoria, nota: "Regla creada desde una tarjeta de Por revisar" });
    // Lo abierto de ese remitente toma ya la categoría de la regla (lo de una vía no se toca).
    if (categoria) {
      const campo = patron.startsWith("@") ? "dominio" : "de";
      const valor = patron.startsWith("@") ? patron.slice(1) : patron;
      await sb.from("correo_entrada").update({ tipo: categoria }).eq(campo, valor).neq("estado", "cerrado").neq("categoria", "via");
    }
    const cierre = categoria === "aviso" || categoria === "ruido" || tratamiento === "silenciado" ? await cerrar([f.id], "visto") : {};
    return { ok: true, patron, reclasificadas: r.reclasificadas, ...cierre };
  }

  // --- Guardar testimonio ----------------------------------------------------
  if (accion === "guardar_testimonio") {
    const f = await fila(b.id);
    const permiso = texto(b.permiso, 20);
    if (!(PERMISOS as readonly string[]).includes(permiso)) throw new Error("El permiso es obligatorio: elige solo anónimo, con nombre o no consta.");
    const via = texto(b.via, 20);
    if (!["charlas", "entrenatzaile", "magia"].includes(via)) throw new Error("Elige la vía (charlas, Entrenatzaile o magia).");
    const cuerpo = texto(b.texto);
    if (!cuerpo) throw new Error("Falta el texto del testimonio.");
    const donde = (Array.isArray(b.donde) ? b.donde : []).filter((x): x is string => typeof x === "string" && DONDE.includes(x));
    const centroId = texto(b.centro_id, 60) || (f.via === "charlas" ? f.via_ref : null) || null;
    const datos = {
      correo_id: f.id,
      message_id: f.message_id,
      fecha: f.fecha ? f.fecha.slice(0, 10) : hoyMadrid(),
      quien: texto(b.quien, 200) || null,
      centro: texto(b.centro, 200) || null,
      centro_id: centroId,
      via,
      idioma: texto(b.idioma, 8) || null,
      permiso,
      donde,
      texto: cuerpo,
      espejado_en: null as string | null,
      vault_nota: null as string | null,
    };
    const { data: ya } = await sb.from("testimonios").select("id").eq("message_id", f.message_id).maybeSingle();
    const { error } = ya ? await sb.from("testimonios").update(datos).eq("id", ya.id) : await sb.from("testimonios").insert(datos);
    if (error) throw new Error(error.message);
    if (centroId) {
      await lineaRegistro(centroId, "Sistema", `Testimonio guardado (${ETIQUETA_PERMISO[permiso]}): «${cuerpo.replace(/\s+/g, " ").slice(0, 90)}…». Está en Testimonios.`, 620).catch(() => null);
    }
    return { ok: true, actualizado: !!ya };
  }

  // --- Guardar respuesta de la newsletter -------------------------------------
  if (accion === "guardar_respuesta") {
    const f = await fila(b.id);
    const respuesta = texto(b.respuesta);
    if (!respuesta) throw new Error("Falta la respuesta.");
    const datos = {
      correo_id: f.id,
      message_id: f.message_id,
      fecha: f.fecha ? f.fecha.slice(0, 10) : hoyMadrid(),
      remitente: f.de,
      nombre: (f.de_nombre as string | null) ?? null,
      newsletter_asunto: texto(b.newsletter_asunto, 300) || (f.newsletter_asunto as string | null) || null,
      pregunta: texto(b.pregunta, 1000) || null,
      respuesta,
      espejado_en: null as string | null,
    };
    const { data: ya } = await sb.from("correo_respuestas_news").select("id").eq("message_id", f.message_id).maybeSingle();
    const { error } = ya ? await sb.from("correo_respuestas_news").update(datos).eq("id", ya.id) : await sb.from("correo_respuestas_news").insert(datos);
    if (error) throw new Error(error.message);
    return { ok: true, actualizado: !!ya };
  }

  // --- Pendientes ----------------------------------------------------------------
  if (accion === "crear_pendiente") {
    const titulo = texto(b.titulo, 200);
    if (!titulo) throw new Error("Falta el título del pendiente.");
    const fecha = texto(b.fecha_limite, 10) || null;
    if (fecha && !FECHA.test(fecha)) throw new Error("La fecha límite no es válida.");
    let correo: Record<string, unknown> | null = null;
    if (b.id) correo = await fila(b.id);
    const via = texto(b.via, 20) || (correo?.via as string | null) || "general";
    if (!VIAS_PENDIENTE.includes(via)) throw new Error("Vía no válida.");
    const { data, error } = await sb
      .from("correo_pendientes")
      .insert({ titulo, fecha_limite: fecha, correo_id: correo ? (correo.id as string) : null, message_id: correo ? (correo.message_id as string) : null, via, creado_por: b.creado_por === "ia" ? "ia" : "alain" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  }
  if (accion === "editar_pendiente") {
    const fecha = texto(b.fecha_limite, 10) || null;
    if (fecha && !FECHA.test(fecha)) throw new Error("La fecha límite no es válida.");
    const titulo = texto(b.titulo, 200);
    if (!titulo) throw new Error("Falta el título.");
    const { error } = await sb.from("correo_pendientes").update({ titulo, fecha_limite: fecha, aviso_vispera: null, aviso_hoy: null }).eq("id", texto(b.pendiente_id, 60));
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (accion === "pendiente_hecho") {
    const { error } = await sb.from("correo_pendientes").update({ estado: "hecho", hecho_en: new Date().toISOString() }).eq("id", texto(b.pendiente_id, 60));
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (accion === "pendiente_deshacer") {
    const id = texto(b.pendiente_id, 60);
    const { data } = await sb.from("correo_pendientes").select("hecho_en").eq("id", id).maybeSingle();
    if (!data?.hecho_en || Date.now() - new Date(data.hecho_en as string).getTime() > 30 * 86400000) throw new Error("Pasaron más de 30 días: ya no se puede deshacer.");
    const { error } = await sb.from("correo_pendientes").update({ estado: "abierto", hecho_en: null }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  // --- Acciones sobre fichas de charlas -----------------------------------------
  if (accion === "ficha_buscar") {
    const q = texto(b.q, 60).replace(/[%,()]/g, " ");
    if (q.length < 2) return { ok: true, fichas: [] };
    const { data } = await sb.from("charlas_centros").select("id, nombre, estado, tipo").ilike("nombre", `%${q}%`).limit(8);
    return { ok: true, fichas: data ?? [] };
  }
  if (accion === "vincular_ficha") {
    const f = await fila(b.id);
    const c = await centroDe({ centro_id: b.centro_id });
    await sb.from("correo_entrada").update({ via_ref: c.id, via: f.via ?? "charlas" }).eq("id", f.id);
    return { ok: true, ficha: c.nombre };
  }
  if (accion === "rechazo") {
    const c = await centroDe(b);
    const motivo = texto(b.motivo, 300);
    if (!motivo) throw new Error("Escribe el motivo del rechazo en una frase.");
    if (c.estado.startsWith("8")) return { ok: true, ya_marcado: true, ficha: c.nombre };
    const { error } = await sb.from("charlas_centros").update({ estado: "8 Perdido", motivo_rechazo: motivo, proxima_accion: null, fecha_proxima_accion: null, actualizado_por: "panel", actualizado_en: new Date().toISOString() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    await sb.from("charlas_estado_log").insert({ centro_id: c.id, de: c.estado, a: "8 Perdido", origen: "panel" });
    await sb.from("charlas_interacciones").insert({ centro_id: c.id, fecha: hoyMadrid(), canal: "Recibido", texto: `Rechazo: ${motivo}. Marcado desde Correo › Por revisar.`, orden: 610, origen: "panel" });
    // Con el rechazo, lo pendiente del centro en la bandeja de charlas sobra.
    await sb.from("charlas_tareas").update({ estado: "descartada", motivo: "Rechazo marcado desde el correo", resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("centro_id", c.id).in("estado", ["revisar", "pendiente"]);
    return { ok: true, ficha: c.nombre };
  }
  if (accion === "ampa") {
    const c = await centroDe(b);
    const email = texto(b.email, 200).toLowerCase();
    if (!EMAIL.test(email)) throw new Error("El email del AMPA no es válido.");
    if (c.ampa_email && c.ampa_email.toLowerCase() !== email && b.sobrescribir !== true) return { ok: false, conflicto: c.ampa_email, ficha: c.nombre };
    if (c.ampa_email?.toLowerCase() === email) return { ok: true, ya_estaba: true, ficha: c.nombre };
    const { error } = await sb.from("charlas_centros").update({ ampa_email: email, actualizado_por: "panel", actualizado_en: new Date().toISOString() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    await sb.from("charlas_interacciones").insert({ centro_id: c.id, fecha: hoyMadrid(), canal: "Recibido", texto: `Contacto del AMPA: ${email} (lo pasan por correo). Guardado desde Correo › Por revisar.`, orden: 610, origen: "panel" });
    return { ok: true, ficha: c.nombre };
  }
  if (accion === "pide_documento") {
    const c = await centroDe(b);
    const nota = texto(b.nota, 300);
    const etiquetas = new Set(c.etiquetas ?? []);
    etiquetas.add("pide documento");
    const { error } = await sb.from("charlas_centros").update({ etiquetas: [...etiquetas], actualizado_por: "panel", actualizado_en: new Date().toISOString() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    await sb.from("charlas_interacciones").insert({ centro_id: c.id, fecha: hoyMadrid(), canal: "Recibido", texto: `Pide documento por escrito${nota ? `: ${nota}` : ""}. Etiqueta «pide documento» desde Correo › Por revisar.`, orden: 610, origen: "panel" });
    if (b.id) {
      const f = await fila(b.id);
      await sb.from("correo_entrada").update({ etiquetas: [...new Set([...(f.etiquetas ?? []), "pide_documento"])] }).eq("id", f.id);
    }
    return { ok: true, ficha: c.nombre };
  }
  throw new Error("Acción desconocida.");
}

// ---------------------------------------------------------------------------
// Avisos al móvil de los pendientes (la víspera y el mismo día). Los llama el
// cron de charlas en cada pasada; cada aviso sale una sola vez por pendiente.
// ---------------------------------------------------------------------------
export async function notificarPendientesCorreo(): Promise<{ avisos: number }> {
  const sb = supabaseCharlas();
  const hoy = hoyMadrid();
  const hora = Number(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()));
  if (hora < 8) return { avisos: 0 };
  const { data, error } = await sb.from("correo_pendientes").select("id, titulo, fecha_limite, aviso_vispera, aviso_hoy").eq("estado", "abierto").not("fecha_limite", "is", null).lte("fecha_limite", new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
  if (error || !data?.length) return { avisos: 0 };
  const sumaDias = (f: string, n: number) => new Date(new Date(f + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
  const diaSemana = new Date(hoy + "T12:00:00Z").getUTCDay(); // 5 = viernes
  let avisos = 0;
  for (const p of data) {
    const limite = p.fecha_limite as string;
    const vencido = limite <= hoy;
    // La víspera; los viernes también avisa de lo que vence en fin de semana o el lunes (el cron no corre sáb-dom).
    const esVispera = limite === sumaDias(hoy, 1) || (diaSemana === 5 && limite > hoy && limite <= sumaDias(hoy, 3));
    if (vencido && p.aviso_hoy !== hoy) {
      const r = await enviarPush({ title: limite < hoy ? "🔴 Pendiente vencido" : "🔴 Pendiente para hoy", body: p.titulo as string, url: "/admin?tab=Por%20revisar", tag: `pend-${p.id}` });
      await sb.from("correo_pendientes").update({ aviso_hoy: hoy, aviso_vispera: p.aviso_vispera ?? hoy }).eq("id", p.id);
      if (r.enviados) avisos++;
    } else if (!vencido && esVispera && p.aviso_vispera == null) {
      const r = await enviarPush({ title: limite === sumaDias(hoy, 1) ? "🟠 Pendiente para mañana" : `🟠 Pendiente el ${limite.split("-").reverse().slice(0, 2).join("/")}`, body: p.titulo as string, url: "/admin?tab=Por%20revisar", tag: `pend-${p.id}` });
      await sb.from("correo_pendientes").update({ aviso_vispera: hoy }).eq("id", p.id);
      if (r.enviados) avisos++;
    }
  }
  return { avisos };
}
