import { createClient } from "@supabase/supabase-js";
import { normalizarEmail } from "@/lib/nurture";
import { sendEmail, ALAIN_FROM } from "@/lib/email-ses";
import {
  MAIL_RESERVA_CREADORES_ASUNTO,
  envoltorioCreadores,
  mailReservaCreadoresCuerpo,
} from "@/lib/creadores-mails";
import { CONSENT_CREADORES, CONSENT_CREADORES_VERSION } from "@/lib/creadores-formularios";
// limpiarUtm vive en el módulo de Entrenatzaile por ser donde nació, pero no
// tiene nada de esa landing: recorta y limita los cinco parámetros utm_ y el
// referrer. Se reutiliza en vez de copiarlo.
import { limpiarUtm } from "@/lib/entrenatzaile-formularios";
import {
  esHuecoOfrecido,
  formatearHueco,
  huecosDisponibles,
  type Bloqueo,
  type ReservaOcupada,
} from "@/lib/entrenatzaile-huecos";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";

// La agenda es LA MISMA que la de la Hoja de Ruta: misma tabla, mismos
// bloqueos manuales del panel. Aquí se leen todas las reservas de los dos
// tipos, sin filtrar, porque las dos se estorban; `tipo` solo dice qué reglas
// hay que aplicar al calcular. Filtrar por tipo en este select sería
// exactamente el fallo que hay que evitar: ofrecer huecos que la otra página
// ya se ha llevado.
async function cargarContexto() {
  const [reservas, bloqueos] = await Promise.all([
    supabase.from("hoja_ruta_reservas").select("hueco, tipo").not("hueco", "is", null),
    supabase.from("hoja_ruta_bloqueos").select("dia, hora_desde, hora_hasta"),
  ]);

  return {
    ahora: new Date(),
    reservados: (reservas.data ?? []) as ReservaOcupada[],
    bloqueos: (bloqueos.data ?? []) as Bloqueo[],
    tipo: "infoproductos" as const,
    error: reservas.error ?? bloqueos.error,
  };
}

// Huecos que se le ofrecen a quien reserva.
export async function GET() {
  const contexto = await cargarContexto();
  if (contexto.error) {
    console.error("creadores: error calculando la agenda:", contexto.error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json(
    { huecos: huecosDisponibles(contexto) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Paso 1: se guarda el lead ANTES de que elija hueco, igual que en la Hoja de
// Ruta. Si abandona el calendario, la fila queda con su nombre y su correo.
//
// Lo que NO hace este endpoint, y la Hoja de Ruta sí: dar de alta en la
// newsletter. La casilla de esta página solo acepta la política de privacidad
// y no nombra ninguna lista de correo, así que apuntar a alguien aquí sería un
// consentimiento que nadie ha dado. Ver lib/creadores-formularios.ts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { nombre, email, consentDatos } = body;

  const nombreTrim = typeof nombre === "string" ? nombre.trim() : "";
  if (!nombreTrim) {
    return NextResponse.json({ error: "Escribe tu nombre, por favor." }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  if (consentDatos !== true) {
    return NextResponse.json({ error: "Marca la casilla para poder reservar." }, { status: 400 });
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();

  const { data: reserva, error: dbError } = await supabase
    .from("hoja_ruta_reservas")
    .insert({
      nombre: nombreTrim,
      email: emailLower,
      // Lo que decide cuánta agenda bloquea esta cita y, de rebote, que los
      // crons de la Hoja de Ruta no la toquen.
      tipo: "infoproductos",
      consent_datos: true,
      consent_datos_en: ahora,
      // El texto que se graba es el del servidor, no el que mande el
      // navegador: es lo que permite demostrar qué leyó esta persona.
      consent_datos_texto: CONSENT_CREADORES.datos,
      consentimientos_version: CONSENT_CREADORES_VERSION,
      ...limpiarUtm(body.utm),
      creado_en: ahora,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("creadores: insert error:", dbError);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: reserva.id });
}

// Paso 2: el hueco elegido en el calendario.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, hueco } = body;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 400 });
  }
  const huecoTrim = typeof hueco === "string" ? hueco.trim() : "";

  // La disponibilidad se recalcula aquí, no se da por buena la del navegador.
  // Cubre al cliente manipulado y al caso normal: que el hueco se haya
  // ocupado —desde esta página O desde la Hoja de Ruta— mientras rellenaba.
  const contexto = await cargarContexto();
  if (contexto.error) {
    console.error("creadores: error validando el hueco:", contexto.error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }
  if (!esHuecoOfrecido(huecoTrim, contexto)) {
    return NextResponse.json({ error: "Ese hueco ya no está disponible. Elige otro, por favor." }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const { data: reserva, error } = await supabase
    .from("hoja_ruta_reservas")
    .update({ hueco: huecoTrim, hueco_en: ahora })
    .eq("id", id)
    .select("nombre, email")
    .single();

  if (error || !reserva) {
    if (error?.code === "23505") {
      // Lo acaba de rechazar la base de datos: o el índice único del hueco, o
      // el trigger de cruces (una Hoja de Ruta que se ha llevado el día, u
      // otra cita de aquí cuya ventana lo tapa). La comprobación de arriba
      // solo evita ese choque en el caso normal; quien de verdad corta la
      // carrera entre las dos páginas es esto.
      return NextResponse.json(
        { error: "Ese hueco lo acaban de coger. Elige otro, por favor." },
        { status: 409 }
      );
    }
    console.error("creadores: update error:", error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  const cuando = formatearHueco(huecoTrim);

  // Confirmación a quien reserva. Va primero, y en su propio try, porque un
  // fallo aquí no debe dejarme a mí sin enterarme de que hay una cita nueva.
  try {
    await sendEmail(
      reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : (reserva.email as string),
      MAIL_RESERVA_CREADORES_ASUNTO,
      envoltorioCreadores(mailReservaCreadoresCuerpo(reserva.nombre, cuando)),
      ALAIN_FROM
    );
  } catch (err) {
    console.error("creadores: error enviando la confirmación:", reserva.email, err);
  }

  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;
  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">CREADORES · INFOPRODUCTOS</p>
      <table style="width:100%;border-collapse:collapse;">
        ${fila("Nombre", escapar(reserva.nombre ?? ""))}
        ${fila("Email", escapar(reserva.email ?? ""))}
        ${fila("Hueco", escapar(cuando))}
        ${fila("Duración", "media hora")}
      </table>
    </div>
  `;

  try {
    await sendEmail("newsletter@alainzulaika.com", `Creadores — Reserva: ${reserva.nombre}`, html, ALAIN_FROM);
    await supabase.from("hoja_ruta_reservas").update({ aviso_enviado: true, aviso_error: null }).eq("id", id);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("creadores: error enviando el aviso:", mensaje);
    // La reserva ya está guardada: que falle el aviso no puede romperle la
    // reserva a quien acaba de hacerla. Queda registrado en la fila.
    await supabase.from("hoja_ruta_reservas").update({ aviso_enviado: false, aviso_error: mensaje }).eq("id", id);
  }

  return NextResponse.json({ ok: true, cuando });
}
