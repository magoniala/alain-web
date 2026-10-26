// Registro de envíos de secuencias en la tabla `envios` (ver envios.sql).
//
// Lo llama sendEmail() después de cada envío. Qué secuencia y qué posición
// es se deduce de la etiqueta de campaña de Mailjet que ya llevaba cada mail
// ("nurture-m3", "mision-m2"…): así el registro cubre también la secuencia
// de nurture sin tocar su cron ni lib/nurture.ts.
//
// Regla de oro: el registro nunca bloquea ni tumba un envío. Si la tabla no
// existe o Supabase falla, se anota en el log y se sigue.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DatosRegistro {
  secuencia: string;
  posicion: number;
}

// Etiquetas fijas de los mails especiales de nurture. Las posiciones son las
// de lib/nurture.ts y app/api/newsletter/cron.
const FIJAS: Record<string, DatosRegistro> = {
  "nurture-recordatorio": { secuencia: "nurture", posicion: -1 },
  "nurture-duplicado": { secuencia: "nurture", posicion: -2 },
  "espalda-ficha-suelta": { secuencia: "nurture", posicion: -2 },
  "nurture-transicion": { secuencia: "nurture", posicion: -3 },
  "comodin-show": { secuencia: "comodin_show", posicion: 1 },
};

const PATRON = /^(nurture|mision|comodin)-m(\d+)$/;

/** Qué secuencia y posición es un envío, por su etiqueta. null = no es de secuencia. */
export function secuenciaDeCampana(campana: string | undefined): DatosRegistro | null {
  if (!campana) return null;
  if (FIJAS[campana]) return FIJAS[campana];
  const m = PATRON.exec(campana);
  return m ? { secuencia: m[1], posicion: Number(m[2]) } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cliente: SupabaseClient | null = null;
function supabase() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

export async function registrarEnvioSecuencia(r: {
  campana: string;
  datos: DatosRegistro;
  email: string;
  customId?: string;
  idioma?: string;
  asunto: string;
  remitente: string;
  estado: "aceptado" | "error";
  error?: string;
  mailjetUuid?: string;
  mailjetId?: string;
}): Promise<void> {
  try {
    const { error } = await supabase()
      .from("envios")
      .insert({
        email: r.email,
        contacto_id: r.customId && UUID.test(r.customId) ? r.customId : null,
        secuencia: r.datos.secuencia,
        posicion: r.datos.posicion,
        idioma: r.idioma === "es" || r.idioma === "eu" ? r.idioma : null,
        campana: r.campana,
        asunto: r.asunto.slice(0, 500),
        remitente: r.remitente,
        estado: r.estado,
        error: r.error?.slice(0, 2000) ?? null,
        mailjet_uuid: r.mailjetUuid ?? null,
        mailjet_id: r.mailjetId ?? null,
      });
    if (error) console.error(`envios: no se ha podido registrar ${r.campana} a ${r.email}:`, error.message);
  } catch (e) {
    console.error(`envios: no se ha podido registrar ${r.campana} a ${r.email}:`, e);
  }
}
