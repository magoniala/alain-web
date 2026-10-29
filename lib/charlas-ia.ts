// IA del carril charlas: lee un correo entrante con todo su contexto y
// devuelve qué es, qué cambia en el CRM y el borrador de respuesta.
//
// Una sola llamada por correo. El conocimiento (guiones, objeciones,
// dossier, bandejas reales, reglas aprendidas) va en el system con
// cache_control, así que de la segunda llamada en adelante dentro de la
// misma ventana se paga a precio de caché.
//
// Coste por modelo (USD por millón de tokens). Fuente: página de precios de
// Anthropic, consultada el 29-10-2026.

import { supabaseCharlas } from "./charlas";

const PRECIOS: Record<string, { entrada: number; salida: number; cacheEscritura: number; cacheLectura: number }> = {
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheEscritura: 2.5, cacheLectura: 0.1 },
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5, cacheEscritura: 0.125, cacheLectura: 0.01 },
};

export const CLASIFICACIONES = [
  "calendario_abierto",
  "calendario_cerrado",
  "pide_info",
  "da_mes",
  "pregunta_precio",
  "lo_decide_otro",
  "reenviado_a",
  "pide_contacto_ayuntamiento",
  "interesado_fechas",
  "no_interesa",
  "acuse_automatico",
  "fuera_de_oficina",
  "otro",
] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];

export interface ResultadoIA {
  clasificacion: Clasificacion;
  confianza: number;
  idioma: "es" | "eu" | "mixto";
  resumen: string;
  datos: {
    mes_reactivacion?: string | null; // AAAA-MM-DD
    persona_nueva?: { nombre?: string | null; email?: string | null; cargo?: string | null } | null;
    n_grupos?: number | null;
    nivel?: string | null;
    motivo?: string | null;
  };
  responder: boolean;
  respuesta: { asunto: string; cuerpo: string; adjuntar_dossier: boolean } | null;
  cambios_crm: {
    estado?: string | null;
    proxima_accion?: string | null;
    fecha_proxima_accion?: string | null;
    calendario_abierto?: string | null;
  };
  nota_para_alain: string | null;
  necesita_alain: boolean; // true = no es algo que el sistema deba contestar solo nunca (nivel C)
}

interface BloqueSystem {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

async function cargarConocimiento(): Promise<string> {
  const { data } = await supabaseCharlas()
    .from("charlas_conocimiento")
    .select("clave, titulo, tipo, texto, orden")
    .eq("activo", true)
    .order("orden")
    .order("clave");
  return (data ?? []).map((c) => `<documento clave="${c.clave}" tipo="${c.tipo}" titulo="${c.titulo}">\n${c.texto}\n</documento>`).join("\n\n");
}

const INSTRUCCIONES = `Eres el asistente comercial de Alain Zulaika, ilusionista que vende a centros educativos de Euskadi una charla con magia en directo sobre la atención ("La atención en la era digital" / "Arreta aro digitalean").

Tu trabajo: leer un correo que ha llegado de un centro, con la ficha del centro y su historial, y devolver un JSON con qué es, qué hay que cambiar en el CRM y, si toca, el borrador de respuesta que Alain enviaría.

Cómo escribe Alain (tienes ejemplos reales en los documentos tipo "ejemplos" — son la referencia principal, imítalos):
- Corto, directo, cercano, sin fórmulas comerciales ni adjetivos vacíos. Frases breves.
- Abre con "Kaixo [nombre]," / "Egun on [nombre]," en euskera, "Hola [nombre]:" o "Buenos días," en castellano. Firma "Ondo izan,\\nAlain Zulaika" o "Un saludo,\\nAlain Zulaika".
- Si el centro escribe en euskera, respondes en euskera. Si escribe en castellano, en castellano. Si la ficha dice euskera "sí" y el correo es mixto, euskera.
- Agradece en una línea cuando procede, sin exagerar. Si se disculpan por tardar, quítale importancia en una línea.
- Cuando adjunta el dossier lo dice así: "Dosierra erantsita duzu: bi orrialde, edukia, formatuak eta prezioak." / "Te adjunto el dossier: dos páginas, contenido, formatos y precios."
- Termina con UNA pregunta fácil de contestar cuando hay que avanzar (nº de grupos, nivel, mes en que deciden).
- Nunca promete lo que no está en los documentos. Nunca inventa referencias, cifras, centros ni testimonios. La única referencia que puede usar es Mendebaldea BHI (tres cursos seguidos, todo 2.º ESO).
- Precios solo los de los documentos (350 € + IVA por aula las tres primeras, 275 € desde la cuarta el mismo día; auditorio 1.200 €). Si piden presupuesto sin decir nº de grupos, pide el dato en vez de dar cifra cerrada.
- No escribas "no supone coste para las familias": quién paga lo decide el centro. Puedes decir que Alain factura al centro, una vez, sin cuota por alumno.
- Sigue las reglas fijas de los documentos (p. ej. la REGLA FIJA de Objeciones sobre noes por precio o fechas) y las reglas aprendidas.

Qué decidir:
- clasificacion: una de calendario_abierto | calendario_cerrado | pide_info | da_mes | pregunta_precio | lo_decide_otro | reenviado_a | pide_contacto_ayuntamiento | interesado_fechas | no_interesa | acuse_automatico | fuera_de_oficina | otro.
  · "reenviado_a": secretaría o alguien dice que lo ha pasado a otra persona.
  · "interesado_fechas": quieren hablar de fechas concretas, formato o cerrar. Esto es un lead caliente.
  · "da_mes": dicen cuándo deciden / cuándo escribirles (enero, mayo, septiembre…).
- confianza: 0 a 1, lo seguro que estás de la clasificación.
- responder: false para acuses automáticos, fuera de oficina y correos que no piden nada y a los que Alain no contestaría.
- respuesta.adjuntar_dossier: true cuando el Flujo dice dossier (piden info, calendario abierto, calendario cerrado sin dossier previo…). Mira el historial: si ya se le envió el dossier, no lo repitas salvo que lo pidan.
- cambios_crm.estado: uno de los estados exactos del CRM ("4 Ha respondido", "5 Dossier enviado", "6 en conversación", "7 Ganado", "8 Perdido", "9 Aparcado (con fecha de reactivación)", "3.9 reenviado - pendiente"…). El estado es el que quedará DESPUÉS de enviar tu respuesta (si adjuntas dossier → "5 Dossier enviado"; si aparcas → "9 Aparcado (con fecha de reactivación)"). null si no cambia.
- cambios_crm.fecha_proxima_accion (AAAA-MM-DD) y proxima_accion (texto corto): según el Flujo. Tras dossier: +7 días naturales para el seguimiento. Si dan un mes: el primer día laborable de ese mes (o el 15 si dicen "mediados"). Hoy es {{HOY}}.
- necesita_alain: true si es un lead caliente (interesado_fechas), si hay queja o tono negativo, si hay dinero o fechas concretas que confirmar, si viene de un ayuntamiento o catálogo, o si no sabes qué responder. En esos casos redacta igualmente el borrador si puedes, pero Alain decide.
- nota_para_alain: una o dos frases sobre algo que deba saber antes de enviar (dato raro, duda, riesgo). null si nada.
- resumen: una línea en castellano para el Registro, al estilo "Responde: calendario cerrado, deciden en mayo".

Devuelve SOLO el JSON, sin texto alrededor, con esta forma exacta:
{"clasificacion":"…","confianza":0.0,"idioma":"es|eu|mixto","resumen":"…","datos":{"mes_reactivacion":null,"persona_nueva":null,"n_grupos":null,"nivel":null,"motivo":null},"responder":true,"respuesta":{"asunto":"…","cuerpo":"…","adjuntar_dossier":false},"cambios_crm":{"estado":null,"proxima_accion":null,"fecha_proxima_accion":null,"calendario_abierto":null},"nota_para_alain":null,"necesita_alain":false}
El asunto de la respuesta es "Re: " + el asunto original (sin duplicar "Re:"). Si responder es false, respuesta es null.`;

export interface EntradaIA {
  centro: Record<string, unknown>;
  registro: { fecha: string | null; canal: string | null; texto: string }[];
  hilo: { direccion: string; fecha: string | null; de: string | null; asunto: string | null; texto: string | null }[];
  correo: { de: string | null; asunto: string | null; fecha: string | null; texto: string };
  instruccion_extra?: string;
}

export async function llamarClaude(opciones: {
  system: BloqueSystem[];
  usuario: string;
  maxTokens?: number;
  proposito: string;
  mensajeId?: string | null;
}): Promise<string> {
  const supabase = supabaseCharlas();
  const { data: cfg } = await supabase.from("charlas_config").select("valor").eq("clave", "modelo").maybeSingle();
  const modelo = (cfg?.valor as string) || "claude-sonnet-5-5";
  const inicio = Date.now();

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: opciones.maxTokens ?? 2000,
      system: opciones.system,
      messages: [{ role: "user", content: opciones.usuario }],
    }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  const uso = cuerpo?.usage ?? {};
  const p = PRECIOS[modelo] ?? PRECIOS["claude-sonnet-5-5"];
  const coste =
    ((uso.input_tokens ?? 0) * p.entrada +
      (uso.output_tokens ?? 0) * p.salida +
      (uso.cache_creation_input_tokens ?? 0) * p.cacheEscritura +
      (uso.cache_read_input_tokens ?? 0) * p.cacheLectura) /
    1_000_000;

  await supabase.from("charlas_ia_uso").insert({
    modelo,
    proposito: opciones.proposito,
    mensaje_id: opciones.mensajeId ?? null,
    tokens_entrada: uso.input_tokens ?? 0,
    tokens_salida: uso.output_tokens ?? 0,
    tokens_cache_escritura: uso.cache_creation_input_tokens ?? 0,
    tokens_cache_lectura: uso.cache_read_input_tokens ?? 0,
    coste_usd: Number(coste.toFixed(5)),
    duracion_ms: Date.now() - inicio,
    error: r.ok ? null : JSON.stringify(cuerpo?.error ?? cuerpo).slice(0, 500),
  });

  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${cuerpo?.error?.message ?? "error"}`);
  const texto = (cuerpo.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return texto;
}

function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const ini = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no devolvió JSON.");
  return JSON.parse(limpio.slice(ini, fin + 1));
}

function hoyMadrid(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

export async function procesarConIA(entrada: EntradaIA, mensajeId?: string | null): Promise<ResultadoIA> {
  const conocimiento = await cargarConocimiento();
  const system: BloqueSystem[] = [
    { type: "text", text: INSTRUCCIONES.replace("{{HOY}}", hoyMadrid()) },
    { type: "text", text: `<conocimiento>\n${conocimiento}\n</conocimiento>`, cache_control: { type: "ephemeral" } },
  ];

  const usuario = [
    `<ficha_centro>\n${JSON.stringify(entrada.centro, null, 1)}\n</ficha_centro>`,
    `<registro>\n${entrada.registro.map((r) => `- ${r.fecha ?? "¿?"} · ${r.canal ?? ""} · ${r.texto}`).join("\n")}\n</registro>`,
    entrada.hilo.length
      ? `<hilo_anterior>\n${entrada.hilo
          .map((m) => `[${m.direccion === "saliente" ? "ALAIN" : "CENTRO"} · ${m.fecha ?? ""} · ${m.de ?? ""}]\nAsunto: ${m.asunto ?? ""}\n${(m.texto ?? "").slice(0, 2500)}`)
          .join("\n---\n")}\n</hilo_anterior>`
      : "",
    `<correo_nuevo>\nDe: ${entrada.correo.de}\nFecha: ${entrada.correo.fecha}\nAsunto: ${entrada.correo.asunto}\n\n${entrada.correo.texto.slice(0, 8000)}\n</correo_nuevo>`,
    entrada.instruccion_extra ? `<instruccion_de_alain>\n${entrada.instruccion_extra}\n</instruccion_de_alain>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const texto = await llamarClaude({ system, usuario, proposito: entrada.instruccion_extra ? "regenerar" : "procesar_entrante", mensajeId, maxTokens: 2500 });
  const r = extraerJSON(texto) as ResultadoIA;

  if (!(CLASIFICACIONES as readonly string[]).includes(r.clasificacion)) r.clasificacion = "otro";
  r.confianza = Math.max(0, Math.min(1, Number(r.confianza) || 0));
  r.datos = r.datos ?? {};
  r.cambios_crm = r.cambios_crm ?? {};
  if (r.cambios_crm.fecha_proxima_accion && !/^\d{4}-\d{2}-\d{2}$/.test(r.cambios_crm.fecha_proxima_accion)) r.cambios_crm.fecha_proxima_accion = null;
  if (!r.responder) r.respuesta = null;
  return r;
}
