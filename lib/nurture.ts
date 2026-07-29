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

// Envía a `contacto` el mail que le toca según su posicion_secuencia, con
// claim atómico para que dos llamadas concurrentes (el cron y un envío
// inmediato desde /api/leads/entrada, por ejemplo) nunca dupliquen un envío.
// Si falla el envío, NO se revierte el claim de fecha_ultimo_mail_secuencia
// a propósito: eso es lo que hace que el cron lo recoja como "pendiente" en
// la siguiente pasada — no hace falta ningún campo ni lógica de reintento
// aparte, ya sale gratis de este mismo mecanismo.
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

  const nowIso = new Date().toISOString();
  let claimQuery = supabase
    .from("newsletter_contactos")
    .update({ fecha_ultimo_mail_secuencia: nowIso })
    .eq("id", contacto.id)
    .eq("posicion_secuencia", contacto.posicion_secuencia);
  claimQuery = contacto.fecha_ultimo_mail_secuencia
    ? claimQuery.eq("fecha_ultimo_mail_secuencia", contacto.fecha_ultimo_mail_secuencia)
    : claimQuery.is("fecha_ultimo_mail_secuencia", null);
  const { data: claimed } = await claimQuery.select("id");
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
    return { enviado: false, motivo: "error-envio" };
  }

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
    })
    .eq("id", contacto.id);

  return { enviado: true };
}
