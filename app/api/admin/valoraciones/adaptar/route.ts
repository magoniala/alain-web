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

Alain te da el CONTEXTO de la persona: lo que ya sabe (lesiones, limitaciones, informes, pauta del fisio, lo que ya le preguntó en una valoración anterior, lo que quiere mirar hoy). Adapta la hoja a su caso. Devuelve un JSON con:

1. "tests": UN AVISO PARA CADA UNO de los ${TESTS.length} tests de la lista, sin saltarte ninguno. nivel: "vetado" (contraindicado por el contexto: p. ej. plancha, flexiones y cualquier empuje si el fisio dice NO empujes), "precaucion" (se hace, con qué vigilar y cuándo parar), "conviene" (da información útil para su caso: dilo y qué mirar), "saltar" (no aporta nada hoy o ya se hizo), "ok" (sin nada especial). motivo: una o dos frases útiles para Alain, concretas, sin disclaimers genéricos.
2. "no_repetir": lo que el contexto diga que YA está valorado o preguntado: una entrada por tema con la respuesta resumida, en la sección que toque (s2 casi siempre). Sé exhaustivo: todo lo que Alain ya sabe debe salir aquí para que no lo pregunte otra vez.
3. "extra": preguntas o comprobaciones nuevas por sección (máximo 3 por sección) que cambien el plan para este caso.
4. "pruebas_extra": pruebas o ejercicios de valoración que NO están en la hoja y que conviene hacer por su caso (p. ej. para un hombro: puntos de entrada de hombro con dolor 0-10, remo con goma a tope bajo, isométrico de rotación externa 20-30 s, face pull suave, retracción escapular, paseo con mancuerna ligera colgando). Si Alain los menciona en el contexto, inclúyelos TODOS tal cual; añade los tuyos si aportan. Cada una con: nombre, en qué sección va (s3 o s5 normalmente), cómo se hace en dos líneas, qué registrar (lista de campos cortos: p. ej. "dolor 0-10", "reps", "segundos", "kg", "observación") y cuándo parar.
5. "material": qué llevar o preparar (o null). "resumen": una línea con lo esencial del caso para tener delante.

Reglas: no inventes datos del cliente; castellano, tono de compañero entrenador; respeta las pautas médicas y del fisio que vengan en el contexto por encima de cualquier otra cosa. Escapa bien las comillas dentro de los textos.

Devuelve SOLO este JSON (sin texto alrededor):
{"resumen":"…","tests":{"sentadilla":{"nivel":"precaucion","motivo":"…"}},"no_repetir":[{"seccion":"s2","tema":"…","respuesta":"…"}],"extra":{"s2":[{"pregunta":"…","por_que":"…"}]},"pruebas_extra":[{"nombre":"…","seccion":"s5","como":"…","registrar":["dolor 0-10","reps"],"parar":"…"}],"material":null}`;

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
    const texto = await llamarClaude({ system: [{ type: "text", text: INSTRUCCIONES }], usuario, maxTokens: 6000, proposito: "valoracion_adaptar" });
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
        maxTokens: 6000,
        proposito: "reparar_json",
      });
      j = leer(reparado);
    }
    // Saneado: solo ids conocidos.
    const tests: Record<string, { nivel: string; motivo: string }> = {};
    for (const [k, v] of Object.entries((j.tests ?? {}) as Record<string, { nivel?: string; motivo?: string }>)) {
      if (TESTS.includes(k) && v && ["vetado", "precaucion", "conviene", "saltar"].includes(String(v.nivel))) tests[k] = { nivel: String(v.nivel), motivo: String(v.motivo ?? "") };
      // "ok" no se guarda: sin aviso.
    }
    const extra: Record<string, { pregunta: string; por_que?: string }[]> = {};
    for (const [k, v] of Object.entries((j.extra ?? {}) as Record<string, { pregunta?: string; por_que?: string }[]>)) {
      if (SECCIONES.includes(k) && Array.isArray(v)) extra[k] = v.filter((x) => x?.pregunta).slice(0, 3).map((x) => ({ pregunta: String(x.pregunta), por_que: x.por_que ? String(x.por_que) : undefined }));
    }
    const no_repetir = (Array.isArray(j.no_repetir) ? j.no_repetir : []).filter((x: { tema?: string }) => x?.tema).slice(0, 25);
    const pruebas_extra = (Array.isArray(j.pruebas_extra) ? (j.pruebas_extra as { nombre?: string; seccion?: string; como?: string; registrar?: unknown; parar?: string }[]) : [])
      .filter((x) => x?.nombre)
      .slice(0, 12)
      .map((x) => ({ nombre: String(x.nombre), seccion: SECCIONES.includes(String(x.seccion)) ? String(x.seccion) : "s5", como: String(x.como ?? ""), registrar: (Array.isArray(x.registrar) ? x.registrar : ["observación"]).map(String).slice(0, 6), parar: x.parar ? String(x.parar) : null }));
    return NextResponse.json({ adaptacion: { resumen: String(j.resumen ?? ""), tests, no_repetir, extra, pruebas_extra, material: j.material ? String(j.material) : null, contexto, generada_en: new Date().toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo adaptar: ${(e as Error).message}` }, { status: 500 });
  }
}
