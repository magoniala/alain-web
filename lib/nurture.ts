import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

export function wrapNurture(cuerpoHtml: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}`;
  const idiomaUrl = `${BASE_URL}/newsletter/idioma?email=${encodeURIComponent(email)}`;
  const bajaText = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  const idiomaText = isEu ? "Hizkuntza aldatu" : "Cambiar idioma";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${cuerpoHtml}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
        <p style="margin:0;"><a href="${idiomaUrl}" style="color:#bbb;">${idiomaText}</a> · <a href="${bajaUrl}" style="color:#bbb;">${bajaText}</a></p>
      </div>
    </div>
  `;
}

export interface NurtureContacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string | null;
  posicion_secuencia: number;
  fecha_ultimo_mail_secuencia: string | null;
}

export const CANDADO_STALE_MS = 5 * 60 * 1000; // 5 min: si un intento se quedó a medias (crash), se puede reclamar de nuevo

// Envía a `contacto` el mail que le toca según su posicion_secuencia.
//
// Regla dura: posicion_secuencia y fecha_ultimo_mail_secuencia NUNCA se
// tocan hasta que sendEmail() confirma el envío sin lanzar excepción. Si
// Mailjet falla, el contacto se queda exactamente como estaba (misma
// posición, sin fecha) — el cron lo recoge en la siguiente pasada porque
// para él no ha cambiado nada. Nunca al revés.
//
// El anti-carrera (para que el cron y un envío inmediato desde
// /api/leads/entrada no dupliquen un envío si coinciden) usa un candado
// aparte, enviando_secuencia_desde, que no tiene nada que ver con "enviado
// de verdad": se libera tanto si el envío sale bien como si falla. Si un
// intento se queda a medias por un cuelgue del proceso, el candado caduca
// solo a los 5 minutos y se puede reclamar de nuevo.
export async function enviarMailSecuencia(
  contacto: NurtureContacto
): Promise<{ enviado: boolean; motivo?: "sin-contenido" | "raced" | "error-envio" }> {
  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("posicion, asunto, cuerpo_html, remitente")
    .eq("posicion", contacto.posicion_secuencia)
    .eq("activo", true)
    .maybeSingle();

  if (!mail) return { enviado: false, motivo: "sin-contenido" };

  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();
  const { data: claimed } = await supabase
    .from("newsletter_contactos")
    .update({ enviando_secuencia_desde: new Date().toISOString() })
    .eq("id", contacto.id)
    .eq("posicion_secuencia", contacto.posicion_secuencia)
    .or(`enviando_secuencia_desde.is.null,enviando_secuencia_desde.lt.${staleThreshold}`)
    .select("id");

  if (!claimed?.length) return { enviado: false, motivo: "raced" };

  const isEu = contacto.idioma === "eu";
  const html = wrapNurture(mail.cuerpo_html ?? "", contacto.email, isEu);

  try {
    await sendEmail(
      contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
      mail.asunto ?? "",
      html,
      resolveNewsletterFrom(mail.remitente)
    );
  } catch (err) {
    console.error("nurture send error:", contacto.email, err);
    // Liberamos el candado; NO tocamos posicion_secuencia ni
    // fecha_ultimo_mail_secuencia — el contacto queda tal cual estaba.
    await supabase.from("newsletter_contactos").update({ enviando_secuencia_desde: null }).eq("id", contacto.id);
    return { enviado: false, motivo: "error-envio" };
  }

  // Envío confirmado por Mailjet: ahora sí avanzamos posición y marcamos la fecha.
  const siguientePosicion = contacto.posicion_secuencia + 1;
  const { count: quedan } = await supabase
    .from("secuencia_mails")
    .select("posicion", { count: "exact", head: true })
    .gte("posicion", siguientePosicion)
    .eq("activo", true);

  await supabase
    .from("newsletter_contactos")
    .update({
      posicion_secuencia: siguientePosicion,
      secuencia_completada: (quedan ?? 0) === 0,
      fecha_ultimo_mail_secuencia: new Date().toISOString(),
      enviando_secuencia_desde: null,
    })
    .eq("id", contacto.id);

  return { enviado: true };
}
