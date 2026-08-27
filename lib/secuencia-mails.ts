import { createClient } from "@supabase/supabase-js";
import { cuerpoDelMail, sustituirMarcadores } from "@/lib/email-markdown";
import type { Secuencia } from "@/lib/secuencias";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export interface MailSecuencia {
  asunto: string;
  cuerpo: string;
  remitente: string | null;
}

// Marcadores que puede usar cada secuencia en el cuerpo. Se le enseñan a
// Alain en el editor, para que sepa qué puede escribir sin adivinarlo.
export const MARCADORES: Partial<Record<Secuencia, Array<{ clave: string; descripcion: string }>>> = {
  comodin: [
    { clave: "tutorial", descripcion: "Enlace al tutorial del truco" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
    { clave: "entrenamiento", descripcion: "Mailto preguntando por entrenamiento" },
  ],
  mision: [
    { clave: "tutorial", descripcion: "Enlace al tutorial del truco" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
    { clave: "entrenamiento", descripcion: "Mailto preguntando por entrenamiento" },
  ],
  contacto: [{ clave: "nombre", descripcion: "Nombre de quien escribe" }],
  belaustegi: [{ clave: "nombre", descripcion: "Nombre de quien escribe" }],
  valoracion: [{ clave: "nombre", descripcion: "Nombre de quien valora" }],
  arrogante: [{ clave: "tiktok", descripcion: "Enlace al TikTok" }],
  comodin_show: [{ clave: "show", descripcion: "Enlace al show completo" }],
  guias: [
    { clave: "nombre", descripcion: "Nombre de pila" },
    { clave: "guias", descripcion: "Lista de las guías que se adjuntan" },
    { clave: "sorpresa", descripcion: "Párrafo de la guía de regalo (vacío si no hay)" },
    { clave: "extra_asunto", descripcion: "Coletilla del asunto cuando hay guía de regalo" },
  ],
  entrenatzaile_valoracion: [
    { clave: "nombre", descripcion: "Nombre de quien reserva" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
  ],
};

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
  valores?: Record<string, string>
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
    cuerpo: cuerpoDelMail(data.cuerpo_html, data.formato, data.preheader, valores),
    remitente: data.remitente,
  };
}
