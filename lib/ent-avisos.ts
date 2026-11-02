// App de Entrenatzaile · fase 7b: envío de los avisos del protocolo.
//
// Lo llama el cron cada 10 minutos. Manda lo que toque (programado_para ya
// pasada, estado 'programado') por el canal del cliente:
//   push  → notificación de la app instalada (tabla ent_push); si el cliente
//           no tiene ningún dispositivo suscrito, cae a correo.
//   email → correo desde el buzón de charlas (alain@), texto plano.
//   whatsapp → todavía no (fase 7b-bis, cuando haya número con la API de Meta):
//           mientras tanto cae a push/correo y la tarjeta del panel lo dice.
// Los formularios (canal 'app') no se envían: son una pantalla de la app que
// aparece cuando toca; el aviso solo sirve para que la app sepa qué enseñar.
// "Si no ha registrado" se omite si el cliente ya registró la sesión.
// Activación: charlas_config.ent_avisos_envio = true.

import webpush from "web-push";
import { supabaseCharlas } from "./charlas";
import { enviarCorreo } from "./charlas-correo";

let vapid = false;
function prepararVapid() {
  if (vapid) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:alain@alainzulaika.com", pub, priv);
  vapid = true;
  return true;
}

export interface ResumenEnvioAvisos {
  activo: boolean;
  enviados: number;
  omitidos: number;
  errores: string[];
}

/** Manda una notificación a todos los dispositivos de un cliente. */
export async function pushCliente(clienteId: string, aviso: { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!prepararVapid()) return 0;
  const sb = supabaseCharlas();
  const { data: subs } = await sb.from("ent_push").select("*").eq("cliente_id", clienteId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.claves as { p256dh: string; auth: string } }, JSON.stringify(aviso), { TTL: 60 * 60 * 6, urgency: "high" });
      ok++;
      await sb.from("ent_push").update({ ultimo_envio: new Date().toISOString(), fallos: 0 }).eq("id", s.id);
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410 || (s.fallos ?? 0) >= 4) await sb.from("ent_push").delete().eq("id", s.id);
      else await sb.from("ent_push").update({ fallos: (s.fallos ?? 0) + 1 }).eq("id", s.id);
    }
  }
  return ok;
}

const TITULO: Record<string, string> = {
  aviso_dia_antes: "Mañana toca entrenar",
  recordatorio_dia: "Hoy toca",
  si_no_registra: "¿Cómo ha ido hoy?",
  formulario_recuperacion: "Un minuto: ¿cómo te has levantado?",
  resumen_domingo: "Resumen de la semana",
  manual: "Entrenatzaile",
};

export async function enviarAvisosPendientes(opciones: { presupuestoMs: number }): Promise<ResumenEnvioAvisos> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res: ResumenEnvioAvisos = { activo: true, enviados: 0, omitidos: 0, errores: [] };
  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "ent_avisos_envio").maybeSingle();
  if (cfg?.valor !== true) return { ...res, activo: false };

  // Lo que toca ahora (y no hace más de 3 horas: lo más viejo se da por perdido, no se manda a deshora).
  const ahora = new Date();
  const { data: avisos } = await sb
    .from("ent_avisos")
    .select("*, cliente:ent_clientes(id, nombre, email, idioma, aviso_canal, token, estado), sesion:ent_sesiones(id, nombre, fecha, estado)")
    .eq("estado", "programado")
    .lte("programado_para", ahora.toISOString())
    .order("programado_para")
    .limit(40);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.alainzulaika.com").replace(/\/$/, "");

  for (const a of avisos ?? []) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const c = a.cliente as { id: string; nombre: string; email: string | null; aviso_canal: string; token: string | null; estado: string } | null;
    const s = a.sesion as { id: string; nombre: string; fecha: string; estado: string } | null;
    const viejo = ahora.getTime() - new Date(a.programado_para).getTime() > 3 * 3600 * 1000;
    const marcar = async (estado: string, error: string | null = null) => sb.from("ent_avisos").update({ estado, error, enviado_en: estado === "enviado" ? new Date().toISOString() : null }).eq("id", a.id);

    if (!c || c.estado !== "activo" || viejo || c.aviso_canal === "ninguno") {
      await marcar("omitido", viejo ? "Fuera de hora: no se manda a deshora" : null);
      res.omitidos++;
      continue;
    }
    // Formularios: solo cambian de estado; la app los enseña cuando toca.
    if (a.canal === "app" || a.tipo === "formulario_post") {
      await marcar("enviado");
      res.enviados++;
      continue;
    }
    // "Si no ha registrado": si ya registró, no se manda.
    if (a.tipo === "si_no_registra" && s && ["hecha", "incompleta", "saltada", "movida"].includes(s.estado)) {
      await marcar("omitido", "Ya había registrado la sesión");
      res.omitidos++;
      continue;
    }
    const texto = (a.texto ?? "").trim();
    if (!texto) {
      await marcar("omitido", "Sin texto");
      res.omitidos++;
      continue;
    }
    const url = `${base}/app/${c.token}${s ? `?sesion=${s.id}` : a.tipo === "formulario_recuperacion" ? "?form=recuperacion" : ""}`;
    try {
      let hecho = false;
      let error: string | null = null;
      if (c.aviso_canal === "push" || c.aviso_canal === "whatsapp") {
        const n = await pushCliente(c.id, { title: TITULO[a.tipo] ?? "Entrenatzaile", body: texto, url, tag: `ent-${a.id}` });
        hecho = n > 0;
        if (!hecho && c.aviso_canal === "whatsapp") error = "WhatsApp aún no disponible; sin dispositivo push";
      }
      if (!hecho && c.email) {
        await enviarCorreo({ para: c.email, asunto: TITULO[a.tipo] ?? "Entrenatzaile", texto: `${texto}\n\nAbrir la app: ${url}\n\n— Alain` });
        hecho = true;
      }
      if (hecho) {
        await marcar("enviado");
        res.enviados++;
      } else {
        await marcar("error", error ?? "Sin dispositivo suscrito ni correo");
        res.errores.push(`${c.nombre}: ${error ?? "sin canal"}`);
      }
    } catch (e) {
      await marcar("error", (e as Error).message);
      res.errores.push(`${c.nombre}: ${(e as Error).message}`);
    }
  }
  return res;
}

/** Avisos a Alain sobre lo registrado (molestia, sesión no hecha, hito…): van al push del panel. */
export async function alertasParaAlain(): Promise<{ avisos: number }> {
  const sb = supabaseCharlas();
  const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: forms } = await sb.from("ent_formularios").select("id, alerta, tipo, cliente:ent_clientes(nombre)").gte("creado_en", desde).not("alerta", "is", null);
  if (!forms?.length) return { avisos: 0 };
  const { enviarPush } = await import("./charlas-push");
  let n = 0;
  for (const f of forms) {
    const c = f.cliente as unknown as { nombre: string } | null;
    const r = await enviarPush({ title: `Entrenatzaile · ${c?.nombre ?? "cliente"}`, body: f.alerta as string, url: "/admin?tab=Entrenatzaile&app=1", tag: `ent-alerta-${f.id}` }).catch(() => ({ enviados: 0 }));
    n += r.enviados;
  }
  return { avisos: n };
}
