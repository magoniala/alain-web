import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { llamarClaude } from "@/lib/charlas-ia";

// Adapta la hoja de valoración al cliente concreto a partir del contexto que
// Alain escribe (lo que ya sabe de la persona: lesiones, lo que ya preguntó,
// lo que quiere mirar). Devuelve avisos por test (vetado / con precaución /
// conviene / saltar), preguntas extra por sección y cosas a no repetir. No
// borra nada de la hoja: marca y añade.
//
//   POST { contexto, cliente?, edad?, sexo?, parq? }  → { adaptacion }

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TESTS = ["anamnesis", "fcReposo", "antropometria", "sentadilla", "dorsiflexion", "birddog", "pica", "sitToStand", "monopodal", "plancha", "flexiones", "remo", "step", "sentadilla1min", "cuesta"];
const SECCIONES = ["s1", "s2", "fc", "s3", "s4", "s5", "s6", "s7", "s8"];

const INSTRUCCIONES = `Eres el asistente de Alain Zulaika, entrenador personal (Entrenatzaile), en su valoración inicial. La hoja de valoración tiene estas secciones: s1 bienvenida · s2 PAR-Q+ y anamnesis (salud médica, dolor y lesiones, cuerpo, hábitos, contexto y logística, motivación) · fc FC en reposo · s3 control postural (sentadilla, dorsiflexión, bird-dog, pica) · s4 antropometría (cintura, cadera, fotos) · s5 fuerza y equilibrio (sit-to-stand, monopodal, plancha, flexiones, remo) · s6 cardio (step o sentadillas 1 min, test cuesta) · s7 objetivos y cierre · s8 notas.
Tests (ids): ${TESTS.join(", ")}.

Alain te da el CONTEXTO de la persona: lo que ya sabe (lesiones, limitaciones, lo que ya le preguntó en una mini valoración anterior, lo que quiere mirar hoy). Devuelve un JSON que adapte la hoja: qué tests están vetados o con precaución (y por qué, en una línea útil para Alain), cuáles conviene hacer con especial atención, qué preguntas de la anamnesis ya están respondidas y no hay que repetir, y qué preguntas o comprobaciones extra añadir en cada sección por su caso.

Reglas:
- Sé concreto y breve: cada aviso una o dos frases, en castellano, en el tono de un compañero entrenador, sin disclaimers médicos genéricos.
- "vetado" solo si el contexto lo justifica claramente (dolor agudo, lesión reciente, contraindicación evidente); si hay duda, "precaucion" con qué vigilar.
- "conviene" para tests que den información útil para su caso concreto (p. ej. dorsiflexión y sentadilla si hay historial de rodilla).
- No inventes datos del cliente: solo lo que diga el contexto.
- Si el contexto menciona cosas ya preguntadas, ponlas en "no_repetir" con la respuesta resumida, para que Alain las vea sin volver a preguntar.
- Máximo 3 preguntas extra por sección; solo las que de verdad cambien el plan.

Devuelve SOLO este JSON:
{"resumen":"una línea con lo esencial del caso para tener delante","tests":{"<id>":{"nivel":"vetado|precaucion|conviene|saltar","motivo":"…"}},"no_repetir":[{"seccion":"s2","tema":"…","respuesta":"…"}],"extra":{"<seccion>":[{"pregunta":"…","por_que":"…"}]},"material":"qué llevar o preparar si procede (o null)"}`;

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const contexto = String(b.contexto ?? "").trim();
  if (contexto.length < 20) return NextResponse.json({ error: "Escribe algo más de contexto (lesiones, lo que ya sabes, lo que quieres mirar)." }, { status: 400 });
  const usuario = `CLIENTE: ${b.cliente ?? "—"}${b.edad ? ` · ${b.edad} años` : ""}${b.sexo ? ` · ${b.sexo}` : ""}${b.entorno ? ` · valoración ${String(b.entorno).toLowerCase()}` : ""}
${b.parq ? `PAR-Q+: ${b.parq}\n` : ""}
CONTEXTO (escrito por Alain):
${contexto}`;
  try {
    const texto = await llamarClaude({ system: [{ type: "text", text: INSTRUCCIONES }], usuario, maxTokens: 3000, proposito: "valoracion_adaptar" });
    const leer = (t: string) => {
      const limpio = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      return JSON.parse(limpio.slice(limpio.indexOf("{"), limpio.lastIndexOf("}") + 1)) as Record<string, unknown>;
    };
    let j: Record<string, unknown>;
    try {
      j = leer(texto);
    } catch (e) {
      // Comillas sin escapar o JSON cortado: se le pide que lo devuelva bien formado (llamada corta).
      const reparado = await llamarClaude({
        system: [{ type: "text", text: "Devuelve SOLO el JSON que te paso, corregido para que sea JSON válido (comillas internas escapadas, comas, llaves). Si está cortado, ciérralo con lo mínimo. No cambies el contenido." }],
        usuario: `Error al leerlo: ${(e as Error).message}\n\n${texto}`,
        maxTokens: 3000,
        proposito: "reparar_json",
      });
      j = leer(reparado);
    }
    // Saneado: solo ids conocidos.
    const tests: Record<string, { nivel: string; motivo: string }> = {};
    for (const [k, v] of Object.entries((j.tests ?? {}) as Record<string, { nivel?: string; motivo?: string }>)) {
      if (TESTS.includes(k) && v && ["vetado", "precaucion", "conviene", "saltar"].includes(String(v.nivel))) tests[k] = { nivel: String(v.nivel), motivo: String(v.motivo ?? "") };
    }
    const extra: Record<string, { pregunta: string; por_que?: string }[]> = {};
    for (const [k, v] of Object.entries((j.extra ?? {}) as Record<string, { pregunta?: string; por_que?: string }[]>)) {
      if (SECCIONES.includes(k) && Array.isArray(v)) extra[k] = v.filter((x) => x?.pregunta).slice(0, 3).map((x) => ({ pregunta: String(x.pregunta), por_que: x.por_que ? String(x.por_que) : undefined }));
    }
    const no_repetir = (Array.isArray(j.no_repetir) ? j.no_repetir : []).filter((x: { tema?: string }) => x?.tema).slice(0, 12);
    return NextResponse.json({ adaptacion: { resumen: String(j.resumen ?? ""), tests, no_repetir, extra, material: j.material ? String(j.material) : null, contexto, generada_en: new Date().toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo adaptar: ${(e as Error).message}` }, { status: 500 });
  }
}
