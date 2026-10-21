// Qué partes de la valoración inicial online se pueden hacer según lo que
// alguien ha marcado en el PAR-Q+.
//
// El PAR-Q+ no lo dice test por test: solo da tres resultados. Esto es un
// criterio propio, conservador, con la lógica habitual del cribado previo al
// ejercicio (ACSM / ePARmed-X+): lo que sube mucho la tensión o el pulso
// (step, plancha isométrica, fuerza) se corta ante problemas cardiacos,
// respiratorios o de tensión no controlados; lo que puede acabar en caída
// (monopodal) se corta ante mareos, desmayos o ictus; y lo que carga la
// columna va con precaución si hay fractura, osteoporosis o espondilolistesis.
// Es una propuesta para revisar, no un criterio médico: ante la duda manda
// lo que diga su médico.
//
// Lo usan el aviso de /parq y la hoja de valoración de /admin.

import { CONDICIONES, PREGUNTAS_GENERALES } from "./parq";

export type NivelTest = "si" | "precaucion" | "no";

export const TESTS = {
  anamnesis: "Anamnesis",
  fcReposo: "FC en reposo",
  antropometria: "Antropometría (cintura y fotos)",
  sentadilla: "Sentadilla",
  dorsiflexion: "Dorsiflexión de tobillo",
  birddog: "Bird-dog",
  pica: "Disociación lumbopélvica (pica)",
  sitToStand: "Sit-to-stand 30 s",
  monopodal: "Apoyo monopodal",
  plancha: "Plancha frontal",
  flexiones: "Flexiones adaptadas",
  remo: "Remo TRX",
  step: "2-minute step",
  sentadilla1min: "Sentadillas en 1 minuto",
  cuesta: "Test cuesta",
} as const;

export type Test = keyof typeof TESTS;

// Lo que no supone esfuerzo: siempre se puede.
const BASE: Test[] = ["anamnesis", "fcReposo", "antropometria"];
const MOV: Test[] = ["sentadilla", "dorsiflexion", "birddog", "pica"];
const EQ: Test[] = ["monopodal"];
const FZA: Test[] = ["sitToStand", "plancha", "flexiones", "remo"];
const CARDIO: Test[] = ["step", "sentadilla1min", "cuesta"];
const FISICO: Test[] = [...MOV, ...EQ, ...FZA, ...CARDIO];

type Regla = { tests: Test[]; nivel: Exclude<NivelTest, "si">; motivo: string }[];

const p = (tests: Test[], motivo: string): Regla[number] => ({ tests, nivel: "precaucion", motivo });
const n = (tests: Test[], motivo: string): Regla[number] => ({ tests, nivel: "no", motivo });

// Por id de pregunta (generales, condiciones y subpreguntas). Solo cuentan
// las respondidas con «sí».
const REGLAS: Record<string, Regla> = {
  // Generales
  g2: [n(FISICO, "Dolor en el pecho: nada de esfuerzo hasta que lo vea su médico.")],
  g3: [
    n(EQ, "Mareos o pérdida de conocimiento: riesgo de caída sin nadie al lado."),
    p([...CARDIO, "sitToStand"], "Mareos o pérdida de conocimiento: parar al primer síntoma, silla cerca."),
  ],
  g6: [p(["sentadilla", "sitToStand", "sentadilla1min", "plancha", "flexiones"], "Problema osteoarticular: preguntar la zona y no cargarla.")],
  g7: [n(FISICO, "Su médico le pide actividad solo con supervisión médica: online no lo es.")],

  // 1 · Artritis, osteoporosis, espalda
  c1a: [p([...MOV, ...FZA], "Artritis/espalda mal controlada: rango sin dolor, parar si molesta.")],
  c1b: [
    p([...MOV, ...FZA], "Fractura, osteoporosis o espondilolistesis: sin flexión cargada de columna, rango cómodo."),
    p(EQ, "Huesos frágiles: una caída puede ser fractura. Junto a pared o respaldo."),
  ],
  c1c: [
    p(EQ, "Corticoides largos: hueso más frágil. Junto a pared o respaldo."),
    p(FZA, "Corticoides largos: progresión suave."),
  ],

  // 2 · Cáncer
  c2a: [n(CARDIO, "Cáncer de pulmón, mieloma o cabeza/cuello: sin test cardio hasta su visto bueno."), p(FZA, "Cáncer: cargas suaves.")],
  c2b: [
    n(CARDIO, "En tratamiento oncológico: sin test cardio hasta el visto bueno de oncología."),
    p([...FZA, ...EQ], "En tratamiento oncológico: fatiga y neuropatía posibles."),
  ],

  // 3 · Corazón
  c3a: [n([...FZA, ...CARDIO], "Problema cardiaco mal controlado: nada de esfuerzo sin visto bueno de cardiología."), p(MOV, "Cardiaco: sin apnea.")],
  c3b: [n(CARDIO, "Arritmia en tratamiento: sin test cardio sin visto bueno."), n(["plancha"], "Arritmia: sin isométricos con apnea."), p(FZA, "Arritmia: respirar en cada repetición.")],
  c3c: [n([...FZA, ...CARDIO], "Insuficiencia cardiaca: nada de esfuerzo sin visto bueno de cardiología."), p(MOV, "Insuficiencia cardiaca: sin apnea.")],
  c3d: [n(CARDIO, "Coronaria e inactivo: sin test cardio sin visto bueno."), n(["plancha"], "Coronaria: sin isométricos con apnea."), p(FZA, "Coronaria: respirar en cada repetición.")],

  // 4 · Tensión
  c4a: [n(["plancha"], "Tensión mal controlada: el isométrico la dispara."), p([...CARDIO, ...FZA], "Tensión mal controlada: intensidad moderada, sin apnea.")],
  c4b: [
    n([...CARDIO, "plancha"], "Tensión ≥160/90 o desconocida: que se la tome antes. Sin step ni plancha hasta saberla."),
    p(FZA, "Tensión alta: sin apnea, intensidad moderada."),
  ],

  // 5 · Metabólica
  c5a: [p([...CARDIO, ...FZA], "Azúcar mal controlado: preguntar cómo está hoy y tener algo dulce a mano.")],
  c5b: [p([...CARDIO, ...FZA, ...EQ], "Hipoglucemias con ejercicio: algo dulce a mano y parar si tiembla o se marea.")],
  c5c: [
    n(["plancha"], "Complicaciones de la diabetes (vista, corazón): sin isométricos con apnea."),
    p([...CARDIO, ...FZA], "Complicaciones de la diabetes: intensidad moderada."),
    p(EQ, "Posible pérdida de sensibilidad en los pies: junto a pared o respaldo."),
  ],
  c5d: [p([...CARDIO, ...FZA], "Otra enfermedad metabólica: intensidad moderada.")],
  c5e: [p(CARDIO, "Quiere hacer ejercicio muy intenso: en la valoración no se lleva nada a máximo.")],

  // 6 · Salud mental
  c6a: [p(FISICO, "Salud mental no controlada: explicar cada test antes, ritmo suyo, parar si se agobia.")],
  c6b: [p([...MOV, ...FZA, ...EQ], "Síndrome de Down con afectación de espalda: sin carga cervical ni flexión forzada.")],

  // 7 · Respiratoria
  c7a: [n(CARDIO, "Respiratoria mal controlada: sin test cardio."), p(FZA, "Respiratoria: pausas entre tests.")],
  c7b: [n(CARDIO, "Oxígeno bajo: sin test cardio."), p(FZA, "Oxígeno bajo: pausas largas, parar si le falta el aire.")],
  c7c: [n(CARDIO, "Asma con síntomas ahora: sin test cardio hoy."), p(FZA, "Asma: inhalador de rescate a mano.")],
  c7d: [n([...CARDIO, "plancha"], "Hipertensión pulmonar: sin esfuerzo cardio ni isométrico."), p(FZA, "Hipertensión pulmonar: muy suave.")],

  // 8 · Lesión medular: la batería estándar no aplica
  c8: [n(FISICO, "Lesión medular: la batería estándar no aplica. Valoración adaptada.")],

  // 9 · Ictus
  c9: [p(EQ, "Antecedente de ictus: junto a pared o respaldo.")],
  c9a: [n(CARDIO, "Ictus mal controlado: sin test cardio."), p(FZA, "Ictus: intensidad moderada.")],
  c9b: [n(EQ, "Dificultad para caminar: sin monopodal."), p([...MOV, ...CARDIO, "sitToStand"], "Dificultad para caminar: sentadilla a silla y apoyo cerca.")],
  c9c: [n(FISICO, "Ictus o afectación nerviosa en los últimos 6 meses: nada físico sin visto bueno de neurología.")],

  // 10 · Otras
  c10a: [n(EQ, "Desmayo o conmoción en 12 meses: sin monopodal."), p(CARDIO, "Desmayo o conmoción reciente: parar al primer síntoma.")],
  c10b: [p([...EQ, ...CARDIO], "Otra enfermedad (epilepsia, neurológica, riñón…): preguntar qué es antes de los tests.")],
  c10c: [p([...FZA, ...CARDIO], "Dos o más enfermedades: intensidad moderada y pausas.")],
};

export type CriterioTest = { test: Test; nivel: NivelTest; motivos: string[] };

const PESO: Record<NivelTest, number> = { si: 0, precaucion: 1, no: 2 };

// ids → criterio por test. Ante varias reglas para un mismo test manda la
// más restrictiva, pero se guardan todos los motivos.
export function criterioTests(idsSi: readonly string[]): CriterioTest[] {
  const mapa = new Map<Test, CriterioTest>();
  for (const t of Object.keys(TESTS) as Test[]) mapa.set(t, { test: t, nivel: "si", motivos: [] });
  for (const id of idsSi) {
    for (const regla of REGLAS[id] ?? []) {
      for (const t of regla.tests) {
        if (BASE.includes(t)) continue;
        const c = mapa.get(t)!;
        if (PESO[regla.nivel] > PESO[c.nivel]) c.nivel = regla.nivel;
        if (!c.motivos.includes(regla.motivo)) c.motivos.push(regla.motivo);
      }
    }
  }
  // Un «precaución» que viene arrastrado de una regla más débil cuando el
  // test ya es «no» confunde: se quedan solo los motivos del nivel final.
  for (const c of mapa.values()) {
    if (c.nivel !== "no") continue;
    c.motivos = c.motivos.filter((m) =>
      idsSi.some((id) => (REGLAS[id] ?? []).some((r) => r.motivo === m && r.nivel === "no" && r.tests.includes(c.test)))
    );
  }
  return [...mapa.values()];
}

// El snapshot del PAR-Q+ vinculado en una valoración guarda los enunciados
// de los «sí». Las vinculadas antes de guardar también los ids se resuelven
// por el texto.
export function idsDesdeTextos(textos: readonly string[]): string[] {
  const todas = [...PREGUNTAS_GENERALES, ...CONDICIONES, ...CONDICIONES.flatMap((c) => c.subpreguntas)];
  return textos.map((t) => todas.find((q) => q.texto === t)?.id).filter((x): x is string => !!x);
}
