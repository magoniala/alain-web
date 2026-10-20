import { createClient } from "@supabase/supabase-js";
import { normalizarEmail } from "@/lib/nurture";
import { sendEmail } from "@/lib/email-ses";
import { enlaceWhatsapp } from "@/lib/entrenatzaile-mails";
import { ACOMPANAMIENTO_AVISO_A, ACOMPANAMIENTO_FROM } from "@/lib/acompanamiento-mails";
import {
  CONDICIONES,
  ETIQUETA_CORTA,
  PREGUNTAS_GENERALES,
  CONSENT_PARQ,
  CONSENT_PARQ_VERSION,
  RESULTADO_ETIQUETA,
  calcularResultado,
  preguntasAplicables,
  type Respuesta,
  type ResultadoParq,
} from "@/lib/parq";
import { TESTS, criterioTests } from "@/lib/parq-criterio";
import { limpiarUtm, type Utm } from "@/lib/entrenatzaile-formularios";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";
const ERROR_FALTA = "Falta alguna respuesta. Vuelve atrás y revisa los pasos, por favor.";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

type FilaRespuesta = { id: string; pregunta: string; respuesta: Respuesta };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const nombre = texto(body.nombre, 120);
  if (!nombre) {
    return NextResponse.json({ error: "Escribe tu nombre, por favor." }, { status: 400 });
  }
  const email = texto(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  const telefono = texto(body.telefono, 40);
  if (telefono.replace(/[\s().+-]/g, "").length < 9) {
    return NextResponse.json({ error: "El número de WhatsApp no es válido." }, { status: 400 });
  }

  // Solo «si» o «no», y solo para preguntas que existen.
  const recibidas: Record<string, Respuesta> = {};
  if (body.respuestas && typeof body.respuestas === "object") {
    for (const [k, v] of Object.entries(body.respuestas as Record<string, unknown>)) {
      if (v === "si" || v === "no") recibidas[k] = v;
    }
  }

  // Lo que se guarda son las preguntas que tocaba hacerle según sus propias
  // respuestas, todas respondidas, con su enunciado. Una subpregunta de una
  // condición a la que dijo «no» no se guarda aunque llegue.
  const aplicables = preguntasAplicables(recibidas);
  if (aplicables.some((p) => !recibidas[p.id])) {
    return NextResponse.json({ error: ERROR_FALTA }, { status: 400 });
  }
  const respuestas: FilaRespuesta[] = aplicables.map((p) => ({
    id: p.id,
    pregunta: p.texto,
    respuesta: recibidas[p.id],
  }));
  const resultado = calcularResultado(recibidas);

  // Única casilla, obligatoria: la base legal del art. 9 para tratar
  // respuestas sobre su salud. Sin ella no se guarda nada.
  if (body.consentDatos !== true) {
    return NextResponse.json(
      { error: "Necesito tu permiso para tratar las respuestas antes de enviarlas." },
      { status: 400 }
    );
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();
  const utm = limpiarUtm(body.utm);

  // Como en /audio: un fallo al guardar no tira el cuestionario. Si la tabla
  // no existe o Supabase está caído, se sigue, y el aviso lo dice arriba.
  let id: string | null = null;
  let dbError: string | null = null;
  const { data: fila, error } = await supabase
    .from("parq_respuestas")
    .insert({
      nombre,
      email: emailLower,
      telefono,
      resultado,
      respuestas,
      consent_datos: true,
      consent_datos_en: ahora,
      consent_datos_texto: CONSENT_PARQ.datos,
      consentimientos_version: CONSENT_PARQ_VERSION,
      ...utm,
      enviado_en: ahora,
    })
    .select("id")
    .single();
  if (error) {
    dbError = error.message;
    console.error("parq: insert error:", error);
  } else {
    id = fila.id;
  }

  let avisoEnviado = false;
  let avisoError: string | null = null;
  try {
    await avisarme({ nombre, email: emailLower, telefono, resultado, respuestas, utm, dbError });
    avisoEnviado = true;
  } catch (err) {
    avisoError = err instanceof Error ? err.message : String(err);
    console.error("parq: error enviando el aviso:", avisoError);
  }

  if (id) {
    await supabase.from("parq_respuestas").update({ aviso_enviado: avisoEnviado, aviso_error: avisoError }).eq("id", id);
  }

  // Solo es un error para quien lo rellena si no se ha guardado Y tampoco me
  // ha llegado el aviso: entonces sus respuestas no están en ninguna parte.
  if (!id && !avisoEnviado) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resultado });
}

// Aviso interno. Las respuestas van en el cuerpo, nunca en el asunto: el
// asunto lleva solo el resultado y el nombre.
async function avisarme(d: {
  nombre: string;
  email: string;
  telefono: string;
  resultado: ResultadoParq;
  respuestas: FilaRespuesta[];
  utm: Utm;
  dbError: string | null;
}) {
  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;

  const wa = enlaceWhatsapp(d.telefono);
  const botonWa = wa
    ? `<p style="margin:0 0 1.2rem 0;"><a href="${wa}" style="display:inline-block;background:#128C7E;color:#ffffff;text-decoration:none;padding:0.7rem 1.4rem;font-family:monospace;font-size:0.9rem;">Abrir WhatsApp con ${escapar(d.nombre)}</a></p>`
    : `<p style="margin:0 0 1.2rem 0;color:#B3261E;">No he podido construir el enlace de WhatsApp con ese número. Hay que escribirlo a mano.</p>`;

  const colorResultado = d.resultado === "consultar" ? "#B3261E" : d.resultado === "apto" ? "#1E7B3A" : "#D4860A";
  const cabecera = `<p style="margin:0 0 1.2rem 0;padding:0.8rem 1rem;background:#fff;border-left:3px solid ${colorResultado};font-size:1rem;"><strong>${RESULTADO_ETIQUETA[d.resultado]}</strong></p>`;

  const incidencia = d.dbError
    ? `<p style="margin:0 0 1.2rem 0;padding:0.8rem 1rem;background:#fff7e6;border-left:3px solid #D4860A;color:#7a4e00;">NO SE HA GUARDADO EN SUPABASE (${escapar(d.dbError)}). Este correo es la única copia: guárdalo.</p>`
    : "";

  const resumen = resumenBanderas(d.respuestas) + bloqueValoracion(d.respuestas);

  // Los «sí» primero y marcados: es lo que hay que leer. Los «no» debajo,
  // para tener el cuestionario entero.
  const sis = d.respuestas.filter((r) => r.respuesta === "si");
  const nos = d.respuestas.filter((r) => r.respuesta === "no");
  const lista = (rs: FilaRespuesta[], marca: string) =>
    rs.map((r) => fila(`${marca} ${r.id.toUpperCase()}`, escapar(r.pregunta))).join("");

  const origen = Object.entries(d.utm)
    .map(([k, v]) => `${k}=${escapar(String(v))}`)
    .join("<br>");

  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · /PARQ</p>
      ${cabecera}
      ${incidencia}
      ${resumen}
      ${botonWa}
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.2rem;">
        ${fila("Nombre", escapar(d.nombre))}
        ${fila("Email", escapar(d.email))}
        ${fila("WhatsApp", escapar(d.telefono))}
        ${origen ? fila("Origen", origen) : ""}
      </table>
      <p style="margin:0 0 0.4rem 0;"><strong>Detalle · respondió «sí» (${sis.length})</strong></p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.2rem;">${sis.length ? lista(sis, "SÍ") : fila("—", "Ninguna")}</table>
      <p style="margin:0 0 0.4rem 0;"><strong>Respondió «no» (${nos.length})</strong></p>
      <table style="width:100%;border-collapse:collapse;">${lista(nos, "no")}</table>
    </div>
  `;

  await sendEmail(
    ACOMPANAMIENTO_AVISO_A,
    `PAR-Q+ · ${RESULTADO_ETIQUETA[d.resultado]} · ${d.nombre}`,
    html,
    ACOMPANAMIENTO_FROM
  );
}

// Resumen visual de las banderas, lo primero que se lee tras el resultado:
// las preguntas generales marcadas como etiquetas, y una tarjeta por cada
// condición que dijo tener. En rojo lo que es bandera (una subpregunta en
// «sí»); en verde la condición que tiene pero sin ninguna bandera.
// Maquetado con tablas y estilos en línea, que es lo que respetan los
// clientes de correo.
function resumenBanderas(respuestas: FilaRespuesta[]): string {
  const r = new Map(respuestas.map((x) => [x.id, x.respuesta]));
  const etiqueta = (id: string) => escapar(ETIQUETA_CORTA[id] ?? id.toUpperCase());

  const chip = (texto: string, rojo: boolean) =>
    `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:12px;font-family:Arial,sans-serif;font-size:12px;line-height:1.4;${
      rojo ? "background:#fdeceb;color:#8c1d18;border:1px solid #f4c7c3;" : "background:#e7f4ea;color:#1e7b3a;border:1px solid #bfe3c8;"
    }">${texto}</span>`;

  const generalesSi = PREGUNTAS_GENERALES.filter((p) => r.get(p.id) === "si");
  const bloqueGenerales = generalesSi.length
    ? generalesSi.map((p) => chip(etiqueta(p.id), true)).join("")
    : chip("Todo «no»", false);

  const condiciones = CONDICIONES.filter((c) => r.get(c.id) === "si");
  const tarjetas = condiciones
    .map((c) => {
      const banderas = c.subpreguntas.filter((s) => r.get(s.id) === "si");
      const rojo = banderas.length > 0;
      const cuerpo = rojo
        ? banderas
            .map((s) => `<div style="padding:3px 0;color:#8c1d18;">⚑ ${etiqueta(s.id)}</div>`)
            .join("")
        : `<div style="padding:3px 0;color:#1e7b3a;">La tiene, sin banderas (todas sus preguntas en «no»)</div>`;
      return `
        <tr><td style="padding:0 0 8px 0;">
          <table role="presentation" style="width:100%;border-collapse:separate;border-radius:8px;background:#ffffff;border:1px solid ${rojo ? "#f4c7c3" : "#bfe3c8"};border-left:4px solid ${rojo ? "#b3261e" : "#1e7b3a"};">
            <tr><td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;line-height:1.45;">
              <div style="font-weight:bold;color:#1a1a1a;margin-bottom:2px;">${etiqueta(c.id)}${rojo ? ` <span style="color:#b3261e;">· ${banderas.length} bandera${banderas.length === 1 ? "" : "s"}</span>` : ""}</div>
              ${cuerpo}
            </td></tr>
          </table>
        </td></tr>`;
    })
    .join("");

  const seguimiento = generalesSi.length
    ? condiciones.length
      ? `<p style="margin:12px 0 6px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#777;">Seguimiento · condiciones que dice tener</p>
         <table role="presentation" style="width:100%;border-collapse:collapse;">${tarjetas}</table>`
      : `<p style="margin:12px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:#1e7b3a;">En el seguimiento no marcó ninguna condición.</p>`
    : "";

  return `
    <div style="margin:0 0 1.2rem 0;padding:12px 14px;background:#ffffff;border:1px solid #e3e3e3;border-radius:8px;">
      <p style="margin:0 0 6px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#777;">Preguntas generales</p>
      ${bloqueGenerales}
      ${seguimiento}
    </div>`;
}

// Qué tests de la valoración online se pueden hacer con estas respuestas.
// Criterio propio (lib/parq-criterio.ts), no del PAR-Q+.
function bloqueValoracion(respuestas: FilaRespuesta[]): string {
  const criterio = criterioTests(respuestas.filter((r) => r.respuesta === "si").map((r) => r.id));
  const de = (nivel: string) => criterio.filter((c) => c.nivel === nivel);
  const fuente = "font-family:Arial,sans-serif;font-size:13px;line-height:1.45;";
  const titulo = (texto: string, color: string) =>
    `<p style="margin:10px 0 4px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${color};font-weight:bold;">${texto}</p>`;

  const conMotivo = (lista: ReturnType<typeof de>, color: string) =>
    lista
      .map(
        (c) =>
          `<div style="${fuente}padding:3px 0;"><strong style="color:${color};">${escapar(TESTS[c.test])}</strong>${
            c.motivos.length ? `<br><span style="color:#555;">${c.motivos.map(escapar).join("<br>")}</span>` : ""
          }</div>`
      )
      .join("");

  const no = de("no");
  const pre = de("precaucion");
  const si = de("si");

  return `
    <div style="margin:0 0 1.2rem 0;padding:12px 14px;background:#ffffff;border:1px solid #e3e3e3;border-radius:8px;">
      <p style="margin:0 0 2px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#777;">En la valoración online</p>
      ${no.length ? titulo(`No hacer (${no.length})`, "#b3261e") + conMotivo(no, "#b3261e") : ""}
      ${pre.length ? titulo(`Con precaución (${pre.length})`, "#9a6400") + conMotivo(pre, "#9a6400") : ""}
      ${titulo(`Se puede (${si.length})`, "#1e7b3a")}
      <div style="${fuente}color:#1e7b3a;">${si.map((c) => escapar(TESTS[c.test])).join(" · ")}</div>
      <p style="margin:10px 0 0 0;font-family:Arial,sans-serif;font-size:11px;color:#999;">Criterio propuesto a partir de las banderas, no del PAR-Q+. Ante la duda, lo que diga su médico.</p>
    </div>`;
}
