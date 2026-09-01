import { createClient } from "@supabase/supabase-js";
import { cuerpoDelMail, sustituirMarcadores } from "@/lib/email-markdown";
import type { Secuencia } from "@/lib/secuencias";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export interface MailSecuencia {
  asunto: string;
  cuerpo: string;
  remitente: string | null;
}

/**
 * Carga un mail de una secuencia y devuelve el cuerpo ya convertido a HTML.
 *
 * Si no hay fila para el idioma pedido, cae al castellano: es preferible que
 * a alguien le llegue el correo en el idioma equivocado a que no le llegue.
 * Si no hay fila ninguna, o está inactiva, devuelve null y quien llama decide
 * qué hacer (los envíos que tienen versión en código tiran de ella).
 */
export async function cargarMailSecuencia(
  secuencia: Secuencia,
  posicion: number,
  idioma: string = "es",
  valores?: Record<string, string>,
  // Bloques {{#si_algo}} … {{/si_algo}} que solo salen si se cumplen. Ver
  // resolverBloques() en lib/email-markdown.
  condiciones?: Record<string, boolean>
): Promise<MailSecuencia | null> {
  const buscar = async (lang: string) =>
    supabase
      .from("secuencia_mails")
      .select("asunto, cuerpo_html, remitente, formato, preheader")
      .eq("secuencia", secuencia)
      .eq("posicion", posicion)
      .eq("idioma", lang)
      .eq("activo", true)
      .maybeSingle();

  let { data } = await buscar(idioma);
  if (!data && idioma !== "es") ({ data } = await buscar("es"));
  if (!data) return null;

  return {
    // Los marcadores también valen en el asunto: hay correos cuyo asunto
    // cambia según el caso (por ejemplo, si hay guía sorpresa o no).
    asunto: valores ? sustituirMarcadores(data.asunto ?? "", valores) : (data.asunto ?? ""),
    cuerpo: cuerpoDelMail(data.cuerpo_html, data.formato, data.preheader, valores, condiciones),
    remitente: data.remitente,
  };
}
