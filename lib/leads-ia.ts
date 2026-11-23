// IA de los LEADS de Entrenatzaile (23-11-2026): redacta el borrador de una tarjeta
// (check-in, seguimiento, respuesta a un correo suyo…) con el protocolo de Alain
// (Vías/Entrenatzaile/Guiones/, en crm_conocimiento carril "entrenatzaile", que el
// espejo horario recarga desde el vault) y el contexto de la ficha (Su caso,
// Mensajes ya enviados, Registro, correos). Nunca envía: Alain revisa siempre
// (salvo los tipos que lleguen a la racha de envío automático, lib/autoenvio.ts).
// Mismo cliente y mismo tope de gasto que el resto (llamarClaude).

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";

const PASO: Record<string, string> = {
  check_in: "Check-in único a un lead aparcado (guion «Check-in»): una línea de contexto y una pregunta, sin venta ni enlaces, sin mencionar la Hoja de Ruta. Si la próxima acción de la ficha trae ya la pregunta, úsala. Si lo derivaste a un médico, pregunta si fue y qué le dijeron.",
  seguimiento: "Seguimiento del D4 en el mismo hilo (guion «Seguimiento»): una pregunta MÁS FÁCIL que la del primer mensaje, de elegir entre dos o de sí/no, sobre lo mismo que escribió. 2-4 líneas. Sin «¿viste mi correo?» ni culpa. Sin mencionar la Hoja de Ruta.",
  respuesta: "Te ha escrito: contesta a su último mensaje (guion «Conversación»): reconoce lo que cuenta en concreto, una o dos preguntas como mucho para entender su caso. Si ya ha habido 2-3 intercambios y tienes su caso claro, resume su caso en dos frases y propón la Hoja de Ruta (guion «Propuesta Hoja de Ruta»), respetando la regla de la ventana gratuita del Flujo.",
  recordatorio: "Mensaje breve que pide la próxima acción de la ficha. Si no está claro qué hay que decir, escribe el mensaje más corto y útil posible y explícalo en la nota.",
};

const REGLAS = `Eres Álex, el asistente de Alain Zulaika, entrenador personal (Entrenatzaile: entrenamiento online para gente con dolor de espalda que quiere volver a moverse). Redactas el mensaje que Alain manda a un lead. Alain lo revisa antes de enviarlo.

Cómo escribe Alain:
- De tú, frases cortas, directo y cálido. Nada de "espero que estés muy bien", "desde Entrenatzaile" ni fórmulas comerciales.
- Comillas rectas "así". NUNCA « ». Sin separadores (---, ***), sin listas, sin negritas: es un mensaje a una persona.
- Párrafos cortos separados por una línea en blanco ("\\n\\n" en el JSON).
- WhatsApp o Instagram: empieza "Hola [nombre]," y sin firma. Correo: empieza "Hola [nombre]," y termina con una línea en blanco y "Alain".
- Nombre: el de pila tal como lo escribe la persona (si el nombre de la ficha es un apodo o unas iniciales, usa "Hola," sin nombre).

Reglas de contenido:
- Solo lo que está en la ficha, su caso, el Registro, los mensajes y los correos. Nada inventado.
- No repitas una pregunta que ya se le hizo (mira «Mensajes» y los correos).
- Ni diagnósticos ni promesas de resultado. Si cuenta un síntoma de alarma, sugiere que lo vea un médico.
- Sigue el guion del paso al pie de la letra (los guiones están en <conocimiento>).

Devuelve SOLO un JSON: {"cuerpo": "el mensaje", "asunto": null, "nota": "una línea para Alain si hay algo que deba saber o revisar; si no, null"}. El asunto va null salvo que se pida un correo nuevo sin hilo.`;

async function conocimiento(): Promise<string> {
  const { data } = await supabaseCharlas().from("crm_conocimiento").select("clave, titulo, texto").eq("carril", "entrenatzaile").eq("activo", true).order("orden");
  return (data ?? []).map((c) => `<guion clave="${c.clave}" titulo="${c.titulo}">\n${c.texto}\n</guion>`).join("\n\n");
}

export interface BorradorIA {
  cuerpo: string;
  asunto: string | null;
  nota: string | null;
}

export async function redactarLead(opciones: { fichaId: string; tipo: string; canal: string; entranteId?: string | null; instruccion?: string; sinHilo?: boolean }): Promise<BorradorIA> {
  const sb = supabaseCharlas();
  const [{ data: f }, { data: registro }, { data: hilo }, guiones] = await Promise.all([
    sb.from("crm_fichas").select("nombre, estado, canal, proxima_accion, fecha_proxima_accion, fecha_ultimo_contacto, mails_enviados, datos, cuerpo_antes, cuerpo_despues").eq("id", opciones.fichaId).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", opciones.fichaId).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    sb.from("crm_mensajes").select("id, direccion, fecha, de, asunto, texto").eq("ficha_id", opciones.fichaId).order("fecha", { ascending: false }).limit(6),
    conocimiento(),
  ]);
  if (!f) throw new Error("Ficha no encontrada.");
  const datos = (f.datos ?? {}) as Record<string, unknown>;
  const mensajesNota = String(f.cuerpo_despues ?? "").replace(/^## Notas[\s\S]*$/m, "");
  const entrante = opciones.entranteId ? (hilo ?? []).find((m) => m.id === opciones.entranteId) : null;
  const usuario = [
    `<paso tipo="${opciones.tipo}" canal="${opciones.canal}">${PASO[opciones.tipo] ?? PASO.recordatorio}${opciones.sinHilo && opciones.canal === "mail" ? " No hay hilo de correo anterior: pon un asunto corto." : ""}</paso>`,
    `<ficha nombre="${f.nombre}" estado="${f.estado}" canal="${f.canal ?? ""}" tirada="${datos.tirada ?? ""}" entro="${datos.fecha_entrada ?? ""}" ventana_gratis_hasta="${datos.ventana_hasta ?? ""}" proxima_accion="${String(f.proxima_accion ?? "").replace(/"/g, "'")}" />`,
    `<respuesta_formulario>${datos.respuesta ?? ""}</respuesta_formulario>`,
    `<su_caso>\n${String(f.cuerpo_antes ?? "").slice(-4000)}\n</su_caso>`,
    `<mensajes_ya_enviados>\n${mensajesNota.slice(-6000)}\n</mensajes_ya_enviados>`,
    `<registro>\n${(registro ?? []).slice(-30).map((r) => `- ${r.fecha ?? ""} · ${r.canal ?? ""} · ${r.texto}`).join("\n")}\n</registro>`,
    `<correos>\n${(hilo ?? []).reverse().map((m) => `[${m.direccion} ${m.fecha?.slice(0, 10) ?? ""}] ${m.asunto ?? ""}\n${String(m.texto ?? "").slice(0, 2500)}`).join("\n\n")}\n</correos>`,
    entrante ? `<contesta_a>\n${String(entrante.texto ?? "").slice(0, 4000)}\n</contesta_a>` : "",
    opciones.instruccion ? `<indicacion_de_alain>${opciones.instruccion}</indicacion_de_alain>` : "",
    `Hoy es ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full" }).format(new Date())}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const texto = await llamarClaude({
    system: [
      { type: "text", text: REGLAS },
      { type: "text", text: `<conocimiento>\n${guiones}\n</conocimiento>`, cache_control: { type: "ephemeral", ttl: "1h" } },
    ],
    usuario,
    proposito: "leads_borrador",
    maxTokens: 1500,
  });
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const j = JSON.parse(limpio.slice(limpio.indexOf("{"), limpio.lastIndexOf("}") + 1)) as Partial<BorradorIA>;
  // Las comillas de Alain son las rectas; se corrigen por si acaso, y fuera separadores.
  const cuerpo = String(j.cuerpo ?? "").replace(/[«»]/g, '"').replace(/^\s*(-{3,}|\*{3,})\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!cuerpo) throw new Error("La IA no ha devuelto el mensaje.");
  return { cuerpo, asunto: j.asunto ? String(j.asunto) : null, nota: j.nota ? String(j.nota) : null };
}

/** Rehace el borrador de una tarjeta de leads con IA (botón «Redactar con IA» o pasada automática). */
export async function redactarTareaLead(tareaId: string, instruccion?: string): Promise<void> {
  const sb = supabaseCharlas();
  const { data: t } = await sb.from("crm_tareas").select("*").eq("id", tareaId).single();
  if (!t) throw new Error("Tarea no encontrada.");
  const { data: h } = await sb.from("crm_hilos").select("ultimo_message_id").eq("ficha_id", t.ficha_id).eq("canal", "principal").maybeSingle();
  const canal = t.contexto?.instagram ? "instagram" : t.canal;
  const b = await redactarLead({ fichaId: t.ficha_id, tipo: t.tipo, canal, entranteId: t.mensaje_entrante_id, instruccion, sinHilo: !h?.ultimo_message_id && !t.mensaje_entrante_id });
  const notaBase = String(t.nota_para_alain ?? "").split(" · ").filter((x: string) => !/^Plantilla|^Redactado con IA/.test(x)).join(" · ");
  await sb
    .from("crm_tareas")
    .update({ borrador_texto: b.cuerpo, borrador_asunto: b.asunto ?? t.borrador_asunto, nota_para_alain: [notaBase, `Redactado con IA${instruccion ? ` («${instruccion}»)` : ""}`, b.nota].filter(Boolean).join(" · "), contexto: { ...(t.contexto ?? {}), redaccion: "ia" } })
    .eq("id", tareaId);
}
