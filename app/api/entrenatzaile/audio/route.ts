import { createClient } from "@supabase/supabase-js";
import { normalizarEmail } from "@/lib/nurture";
import { ALAIN_FROM, sendEmail } from "@/lib/email-ses";
import { enlaceWhatsapp } from "@/lib/entrenatzaile-mails";
import { MAIL_AUDIO_ASUNTO, envoltorioAudio, mailAudioCuerpo } from "@/lib/audio-mails";
import {
  BANDERAS_ROJAS,
  BANDERA_NINGUNA,
  CONSENT_AUDIO,
  CONSENT_AUDIO_VERSION,
  DIAS_SEMANA,
  EJERCICIO_ACTUAL,
  EJERCICIO_OTRO,
  EJERCICIO_SIN_DIAS,
  FRECUENCIA_LUMBAGO,
  PREGUNTAS_AUDIO,
  RANGOS_EDAD,
  TIEMPO_SEMANAL,
  tieneBanderaRoja,
} from "@/lib/audio-formularios";
import { limpiarUtm } from "@/lib/entrenatzaile-formularios";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function texto(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Las opciones cerradas se validan contra la lista del servidor: lo que se
// graba es una de las que de verdad se mostraron, no lo que mande el
// navegador.
function opcion(v: unknown, permitidas: readonly string[]): string | null {
  const t = texto(v, 200);
  return permitidas.includes(t) ? t : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const nombre = texto(body.nombre, 120);
  if (!nombre) {
    return NextResponse.json({ error: "Escribe tu nombre, por favor." }, { status: 400 });
  }
  const email = texto(body.email, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  const telefono = texto(body.telefono, 40);
  if (telefono.replace(/[\s().+-]/g, "").length < 9) {
    return NextResponse.json(
      { error: "El número de WhatsApp no es válido: es donde te llega el audio." },
      { status: 400 }
    );
  }

  const edad = opcion(body.edad, RANGOS_EDAD);
  const frecuencia = opcion(body.frecuencia, FRECUENCIA_LUMBAGO);
  const tiempo = opcion(body.tiempo, TIEMPO_SEMANAL);
  const ejercicio = opcion(body.ejercicio, EJERCICIO_ACTUAL);
  if (!edad || !frecuencia || !tiempo || !ejercicio) {
    return NextResponse.json({ error: "Falta alguna respuesta. Revisa los pasos, por favor." }, { status: 400 });
  }

  const ultimo = texto(body.ultimo);
  const deseo = texto(body.deseo);
  if (!ultimo || !deseo) {
    return NextResponse.json({ error: "Falta alguna respuesta. Revisa los pasos, por favor." }, { status: 400 });
  }
  const extra = texto(body.extra);

  // Las banderas: lista sin repetidos, validada contra la del servidor, y con
  // "Ninguna" excluyente también aquí. No puede quedar vacía: es la pregunta
  // que decide si el audio es el normal o es "ve al médico".
  const banderas = Array.isArray(body.banderas)
    ? [...new Set(body.banderas.map((b: unknown) => texto(b, 200)))].filter((b) =>
        (BANDERAS_ROJAS as readonly string[]).includes(b)
      )
    : [];
  if (!banderas.length) {
    return NextResponse.json(
      { error: "Marca al menos una opción en la lista de señales. Si no te pasa ninguna, marca «Ninguna»." },
      { status: 400 }
    );
  }
  const banderaRoja = tieneBanderaRoja(banderas);
  if (banderaRoja && banderas.includes(BANDERA_NINGUNA)) {
    return NextResponse.json({ error: "«Ninguna» no se puede marcar junto a otra opción." }, { status: 400 });
  }

  // Los días solo tienen sentido si hace algo; el deporte, solo si dijo
  // "otro". Lo que no aplica se guarda vacío en vez de guardarse a medias.
  const dias = ejercicio === EJERCICIO_SIN_DIAS ? null : opcion(body.dias, DIAS_SEMANA);
  if (ejercicio !== EJERCICIO_SIN_DIAS && !dias) {
    return NextResponse.json({ error: "Dime cuántos días a la semana entrenas." }, { status: 400 });
  }
  const ejercicioDetalle = ejercicio === EJERCICIO_OTRO ? texto(body.ejercicioDetalle, 200) : "";
  if (ejercicio === EJERCICIO_OTRO && !ejercicioDetalle) {
    return NextResponse.json({ error: "Dime qué deporte es." }, { status: 400 });
  }

  // Única casilla del formulario, y obligatoria: es la base legal del art. 9
  // para tratar respuestas sobre su espalda. Sin ella no se guarda nada.
  if (body.consentDatos !== true) {
    return NextResponse.json(
      { error: "Necesito tu permiso para tratar las respuestas antes de poder prepararte nada." },
      { status: 400 }
    );
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();
  const utm = limpiarUtm(body.utm);

  const datos = {
    nombre,
    email: emailLower,
    telefono,
    edad_rango: edad,
    frecuencia,
    ultimo_episodio: ultimo,
    banderas,
    bandera_roja: banderaRoja,
    ejercicio,
    ejercicio_detalle: ejercicioDetalle || null,
    dias_semana: dias ? Number(dias) : null,
    tiempo_semanal: tiempo,
    deseo,
    extra: extra || null,
    // Los enunciados tal y como los vio, para que dentro de un año se pueda
    // leer una respuesta y saber a qué contestaba.
    preguntas_mostradas: PREGUNTAS_AUDIO,
    consent_datos: true,
    consent_datos_en: ahora,
    consent_datos_texto: CONSENT_AUDIO.datos,
    consentimientos_version: CONSENT_AUDIO_VERSION,
    ...utm,
    enviado_en: ahora,
  };

  // Se guarda primero, pero un fallo aquí no puede tirar el formulario a la
  // basura: lo que esta persona ha venido a conseguir es el audio, y el audio
  // sale del aviso que me llega a mí. Si la tabla no existe todavía o
  // Supabase está caído, se sigue, y el aviso lo dice en su primera fila.
  let id: string | null = null;
  let dbError: string | null = null;
  const { data: fila, error } = await supabase.from("audio_formularios").insert(datos).select("id").single();
  if (error) {
    dbError = error.message;
    console.error("audio: insert error:", error);
  } else {
    id = fila.id;
  }

  // Confirmación a quien lo rellena. Va en su propio try: que falle no debe
  // dejarme sin enterarme de que hay un formulario nuevo.
  let confirmacionEnviada = false;
  try {
    await sendEmail(
      `${nombre} <${emailLower}>`,
      MAIL_AUDIO_ASUNTO,
      envoltorioAudio(mailAudioCuerpo(nombre, banderaRoja)),
      ALAIN_FROM
    );
    confirmacionEnviada = true;
  } catch (err) {
    console.error("audio: error enviando la confirmación:", emailLower, err);
  }

  let avisoEnviado = false;
  let avisoError: string | null = null;
  try {
    await avisarme({
      nombre,
      email: emailLower,
      telefono,
      edad,
      frecuencia,
      ultimo,
      banderas,
      banderaRoja,
      ejercicio,
      ejercicioDetalle,
      dias,
      tiempo,
      deseo,
      extra,
      utm,
      dbError,
      confirmacionEnviada,
    });
    avisoEnviado = true;
  } catch (err) {
    avisoError = err instanceof Error ? err.message : String(err);
    console.error("audio: error enviando el aviso:", avisoError);
  }

  if (id) {
    await supabase
      .from("audio_formularios")
      .update({ aviso_enviado: avisoEnviado, aviso_error: avisoError, confirmacion_enviada: confirmacionEnviada })
      .eq("id", id);
  }

  // Lo único que de verdad es un error para quien rellena: que no se haya
  // guardado Y tampoco me haya llegado el aviso. Entonces sus respuestas no
  // existen en ninguna parte y hay que decirle que lo intente otra vez.
  if (!id && !avisoEnviado) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Aviso interno. Las respuestas van en el cuerpo del correo, nunca en el
// asunto ni en ninguna URL.
async function avisarme(d: {
  nombre: string;
  email: string;
  telefono: string;
  edad: string;
  frecuencia: string;
  ultimo: string;
  banderas: string[];
  banderaRoja: boolean;
  ejercicio: string;
  ejercicioDetalle: string;
  dias: string | null;
  tiempo: string;
  deseo: string;
  extra: string;
  utm: Record<string, string | undefined>;
  dbError: string | null;
  confirmacionEnviada: boolean;
}) {
  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;

  const wa = enlaceWhatsapp(d.telefono);
  const botonWa = wa
    ? `<p style="margin:0 0 1.2rem 0;"><a href="${wa}" style="display:inline-block;background:#128C7E;color:#ffffff;text-decoration:none;padding:0.7rem 1.4rem;font-family:monospace;font-size:0.9rem;">Abrir WhatsApp con ${escapar(d.nombre)}</a></p>`
    : `<p style="margin:0 0 1.2rem 0;color:#B3261E;">No he podido construir el enlace de WhatsApp con ese número. Hay que escribirlo a mano.</p>`;

  // Lo primero que se lee, antes que cualquier dato: si hay bandera roja, el
  // audio es otro.
  const alarma = d.banderaRoja
    ? `<p style="margin:0 0 1.2rem 0;padding:0.8rem 1rem;background:#fdeceb;border-left:3px solid #B3261E;color:#8c1d18;">BANDERA ROJA — audio corto: que lo vea un médico antes de nada.</p>`
    : "";

  const aviso = (texto: string) =>
    `<p style="margin:0 0 1.2rem 0;padding:0.8rem 1rem;background:#fff7e6;border-left:3px solid #D4860A;color:#7a4e00;">${texto}</p>`;

  const incidencias = [
    d.dbError
      ? aviso(
          `NO SE HA GUARDADO EN SUPABASE (${escapar(d.dbError)}). Las respuestas de abajo son la única copia: guárdalas antes de borrar este correo.`
        )
      : "",
    d.confirmacionEnviada ? "" : aviso("La confirmación a esta persona NO ha salido. No sabe que lo he recibido."),
  ].join("");

  const ejercicio = d.ejercicioDetalle ? `${d.ejercicio} (${d.ejercicioDetalle})` : d.ejercicio;
  const ejercicioFila = d.dias ? `${ejercicio} · ${d.dias} día(s)/semana` : ejercicio;

  const origen = Object.entries(d.utm)
    .map(([k, v]) => `${k}=${escapar(String(v))}`)
    .join("<br>");

  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · /AUDIO</p>
      ${alarma}
      ${incidencias}
      ${botonWa}
      <table style="width:100%;border-collapse:collapse;">
        ${fila(PREGUNTAS_AUDIO.nombre, escapar(d.nombre))}
        ${fila(PREGUNTAS_AUDIO.email, escapar(d.email))}
        ${fila(PREGUNTAS_AUDIO.telefono, escapar(d.telefono))}
        ${fila(PREGUNTAS_AUDIO.edad, escapar(d.edad))}
        ${fila(PREGUNTAS_AUDIO.frecuencia, escapar(d.frecuencia))}
        ${fila(PREGUNTAS_AUDIO.ultimo, escapar(d.ultimo))}
        ${fila(PREGUNTAS_AUDIO.banderas, d.banderas.map((b) => escapar(b)).join("<br>"))}
        ${fila(PREGUNTAS_AUDIO.ejercicio, escapar(ejercicioFila))}
        ${fila(PREGUNTAS_AUDIO.tiempo, escapar(d.tiempo))}
        ${fila(PREGUNTAS_AUDIO.deseo, escapar(d.deseo))}
        ${fila(PREGUNTAS_AUDIO.extra, d.extra ? escapar(d.extra) : "—")}
        ${origen ? fila("Origen", origen) : ""}
      </table>
    </div>
  `;

  await sendEmail(
    "newsletter@alainzulaika.com",
    `${d.banderaRoja ? "⚠ BANDERA ROJA · " : ""}Audio — Nuevo formulario: ${d.nombre}`,
    html,
    ALAIN_FROM
  );
}
