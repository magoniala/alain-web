// IA del carril de MAGIA (CRM de prospectos: antiguos clientes, recuperar,
// intermediarios, referidos). Misma mecánica que lib/charlas-ia.ts: una
// llamada por tarea o por correo entrante, con el conocimiento del carril
// (Guía comercial, flujos, plantillas, mensajes reales) en el system con caché
// de una hora. Devuelve qué pasa, qué cambia en la ficha y el borrador.
//
// Diferencia principal con charlas: el canal. Un mensaje de WhatsApp es corto,
// sin asunto, con el nombre al principio; un correo lleva asunto y, si es el
// primero del hilo, presentación y firma.

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";

export const CLASIFICACIONES_MAGIA = [
  "interesado",          // quiere repetir / le interesa: pide fecha, formato o precio
  "pide_propuesta",      // pide presupuesto o propuesta por escrito
  "da_fecha",            // propone o confirma una fecha concreta
  "este_ano_no",         // no este año; quizá más adelante
  "no_interesa",         // un no claro
  "recomienda",          // particular que pasa un contacto / referido
  "pregunta",            // pregunta algo (condiciones, duración, espacio…)
  "acuse",               // "ok, lo miro", "gracias", sin contenido
  "fuera_de_oficina",
  "otro",
] as const;
export type ClasificacionMagia = (typeof CLASIFICACIONES_MAGIA)[number];

export interface ResultadoMagia {
  clasificacion: ClasificacionMagia;
  confianza: number;
  idioma: "es" | "eu" | "mixto";
  resumen: string;
  datos: { fecha_evento?: string | null; importe?: string | null; persona_nueva?: { nombre?: string | null; email?: string | null; telefono?: string | null } | null; motivo?: string | null };
  responder: boolean;
  respuesta: { asunto: string | null; cuerpo: string } | null;
  alternativa: { etiqueta: string; etiqueta_principal: string; asunto: string | null; cuerpo: string } | null;
  cambios_crm: { estado?: string | null; proxima_accion?: string | null; fecha_proxima_accion?: string | null };
  nota_para_alain: string | null;
  necesita_alain: boolean;
}

interface BloqueSystem {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" };
}

async function cargarConocimientoMagia(): Promise<string> {
  const { data } = await supabaseCharlas().from("crm_conocimiento").select("clave, titulo, tipo, texto, orden").eq("carril", "magia").eq("activo", true).order("orden").order("clave");
  return (data ?? []).map((c) => `<documento clave="${c.clave}" tipo="${c.tipo}" titulo="${c.titulo}">\n${c.texto}\n</documento>`).join("\n\n");
}

const INSTRUCCIONES = `Eres el asistente comercial de Alain Zulaika, ilusionista (Elgoibar, Gipuzkoa) que vende shows y magia de cerca a ayuntamientos, empresas, asociaciones, hostelería y particulares. Trabajas sobre su CRM de prospectos: antiguos clientes a reactivar, propuestas antiguas a recuperar, intermediarios y referidos.

Tu trabajo: con la ficha del cliente, su Registro y, si lo hay, el último intercambio, devolver un JSON con qué pasa, qué cambia en la ficha y el borrador del mensaje que Alain enviaría por el canal que toque.

Cómo escribe Alain (los documentos tipo "ejemplos" son la referencia: imítalos):
- Cercano y directo, sin fórmulas comerciales. Frases cortas. Párrafos cortos separados por una línea en blanco ("\\n\\n" en el JSON); nunca un bloque seguido.
- WhatsApp: mensaje corto (2-4 frases), sin asunto (asunto null), empieza con el nombre ("Ey Iván", "Kaixo Leire!") y termina con una pregunta fácil o una propuesta concreta. Sin firma salvo "Alain" si queda natural.
- Correo: asunto corto y concreto. Si es el primer correo del hilo, presentación en una línea y firma "Un saludo,\\nAlain Zulaika" / "Ondo izan,\\nAlain Zulaika". Dentro de un hilo ya abierto, sin saludo ni firma (regla aprendida 1).
- Idioma: el de la ficha (idioma eu/es) o el que use el cliente en su mensaje. Si la ficha es un ayuntamiento o institución en euskera, euskera.
- Un solo mensaje, una sola petición. Si hay que avanzar, termina con la pregunta que lo desbloquea (fecha, formato, a quién va la propuesta).
- Precios: solo los que aparezcan en la ficha (ultimo_evento), en el Registro o en los guiones. Siempre "+ IVA". Si no hay dato, no inventes cifra: propón hablarlo o pide lo que falte. Nunca bajes un precio: si dudan, se reduce el compromiso (un día de prueba, menos horas), no el precio.
- Octubre-noviembre con empresas y ayuntamientos: el gancho es Navidad y fin de año (ver Antiguos · Reactivación). Con particulares no se pide repetir: se pide una recomendación (variante C).
- Nunca inventes referencias, cifras ni eventos. Lo que hubo con este cliente está en ultimo_evento y en el Registro.
- Sigue la Guía comercial, los flujos y las reglas aprendidas. Los niveles de cobro (1 particular, 2 empresa estructurada, 3 público/ayuntamiento) deciden cómo se cierra; eso lo decide Alain, tú lo recuerdas en nota_para_alain cuando toque propuesta.

Qué decidir:
- clasificacion: una de interesado | pide_propuesta | da_fecha | este_ano_no | no_interesa | recomienda | pregunta | acuse | fuera_de_oficina | otro.
- responder: false para acuses vacíos, fuera de oficina y cuando lo siguiente es una llamada o una propuesta que debe preparar Alain (entonces lo dices en nota_para_alain).
- cambios_crm.estado: uno de los estados exactos de la Guía comercial ("3 Primer mensaje enviado", "4 Ha respondido", "5 Propuesta enviada", "6 En conversación", "7 Ganado", "8 Perdido", "9 Aparcado"). Es el estado que quedará DESPUÉS de enviar tu mensaje. null si no cambia.
- cambios_crm.fecha_proxima_accion (AAAA-MM-DD) y proxima_accion (texto corto) según el flujo del segmento. Hoy es {{HOY}}.
- necesita_alain: true si hay dinero o fechas concretas que confirmar, una queja, una propuesta que redactar o algo que no sabes contestar. Redacta igualmente el borrador si puedes.
- alternativa: cuando haya DOS formas razonables de contestar y la elección sea de Alain (p. ej. "cerrar fecha ya" frente a "proponer llamada"), redacta las dos completas; "respuesta" es la recomendada. NUNCA escribas "tendrías que añadirlo tú". null si solo hay una forma sensata.
- nota_para_alain: una o dos frases sobre lo que deba saber antes de enviar. null si nada.
- resumen: una línea en castellano para el Registro ("Responde: les interesa, preguntan por diciembre").

Devuelve SOLO el JSON, sin texto alrededor, con esta forma exacta:
{"clasificacion":"…","confianza":0.0,"idioma":"es|eu|mixto","resumen":"…","datos":{"fecha_evento":null,"importe":null,"persona_nueva":null,"motivo":null},"responder":true,"respuesta":{"asunto":null,"cuerpo":"…"},"alternativa":null,"cambios_crm":{"estado":null,"proxima_accion":null,"fecha_proxima_accion":null},"nota_para_alain":null,"necesita_alain":false}`;

export interface EntradaMagia {
  ficha: Record<string, unknown>;
  registro: { fecha: string | null; canal: string | null; texto: string }[];
  hilo: { direccion: string; fecha: string | null; de: string | null; asunto: string | null; texto: string | null }[];
  correo?: { de: string | null; asunto: string | null; fecha: string | null; texto: string } | null;
  programada?: { tipo: string; canal: "mail" | "whatsapp"; instrucciones: string; destinatario: string | null } | null;
  instruccion_extra?: string;
}

function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const ini = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no devolvió JSON.");
  return JSON.parse(limpio.slice(ini, fin + 1));
}

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export async function procesarMagiaConIA(entrada: EntradaMagia, mensajeId?: string | null): Promise<ResultadoMagia> {
  const conocimiento = await cargarConocimientoMagia();
  const system: BloqueSystem[] = [
    { type: "text", text: INSTRUCCIONES.replace("{{HOY}}", hoyMadrid()) },
    { type: "text", text: `<conocimiento>\n${conocimiento}\n</conocimiento>`, cache_control: { type: "ephemeral", ttl: "1h" } },
  ];
  const usuario = [
    `<ficha>\n${JSON.stringify(entrada.ficha, null, 1)}\n</ficha>`,
    `<registro>\n${entrada.registro.map((r) => `- ${r.fecha ?? ""} · ${r.canal ?? ""} · ${r.texto}`).join("\n") || "(vacío)"}\n</registro>`,
    entrada.hilo.length
      ? `<hilo_anterior>\n${entrada.hilo.map((m) => `[${m.direccion === "saliente" ? "ALAIN" : "CLIENTE"} · ${m.fecha ?? ""} · ${m.de ?? ""}]\n${m.asunto ? `Asunto: ${m.asunto}\n` : ""}${(m.texto ?? "").slice(0, 2500)}`).join("\n---\n")}\n</hilo_anterior>`
      : "",
    entrada.correo ? `<mensaje_nuevo>\nDe: ${entrada.correo.de}\nFecha: ${entrada.correo.fecha}\nAsunto: ${entrada.correo.asunto}\n\n${entrada.correo.texto.slice(0, 8000)}\n</mensaje_nuevo>` : "",
    entrada.programada
      ? `<tarea_programada tipo="${entrada.programada.tipo}" canal="${entrada.programada.canal}">\nNo ha llegado ningún mensaje nuevo. Toca esta acción del flujo porque ha llegado su fecha. Canal: ${entrada.programada.canal === "whatsapp" ? "WhatsApp (mensaje corto, sin asunto)" : "correo"}. Destinatario: ${entrada.programada.destinatario ?? "(sin dato)"}.\n${entrada.programada.instrucciones}\nDevuelve el JSON de siempre: clasificacion "otro", confianza 1, resumen = qué se hace, responder true salvo que la instrucción diga lo contrario, y cambios_crm con el estado y la fecha que indica la instrucción.\n</tarea_programada>`
      : "",
    entrada.instruccion_extra ? `<instruccion_de_alain>\n${entrada.instruccion_extra}\n</instruccion_de_alain>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const texto = await llamarClaude({ system, usuario, proposito: entrada.instruccion_extra ? "magia_regenerar" : entrada.programada ? "magia_programada" : "magia_entrante", mensajeId, maxTokens: 3500 });
  let r: ResultadoMagia;
  try {
    r = extraerJSON(texto) as ResultadoMagia;
  } catch (e) {
    const reparado = await llamarClaude({
      system: [{ type: "text", text: "Devuelve SOLO el JSON que te paso, corregido para que sea JSON válido. Si está cortado, ciérralo con lo mínimo. No cambies el contenido." }],
      usuario: `Error al leerlo: ${(e as Error).message}\n\n${texto}`,
      proposito: "reparar_json",
      mensajeId,
      maxTokens: 3500,
    });
    r = extraerJSON(reparado) as ResultadoMagia;
  }
  if (!(CLASIFICACIONES_MAGIA as readonly string[]).includes(r.clasificacion)) r.clasificacion = "otro";
  r.confianza = Math.max(0, Math.min(1, Number(r.confianza) || 0));
  r.datos = r.datos ?? {};
  r.cambios_crm = r.cambios_crm ?? {};
  if (r.cambios_crm.fecha_proxima_accion && !/^\d{4}-\d{2}-\d{2}$/.test(r.cambios_crm.fecha_proxima_accion)) r.cambios_crm.fecha_proxima_accion = null;
  if (!r.responder) r.respuesta = null;
  if (!r.respuesta || !r.alternativa?.cuerpo) r.alternativa = null;
  return r;
}
