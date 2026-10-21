// Valoración inicial online: baremos e informe automático.
//
// Los apuntes de la sesión se guardan como un único objeto `datos` (una
// clave por campo) en la tabla valoraciones_sesion. Este módulo no toca la base de
// datos: lee ese objeto y devuelve el informe, así que la pestaña de /admin
// lo recalcula en directo cada vez que se apunta algo.
//
// Los baremos son los de la cheat sheet de valoración online (v1.1,
// 2026-10-21), que cubre de 40 a 69 años. Fuera de ese rango se usa la
// franja más cercana y el informe lo dice, para no presentar como baremo de
// su edad uno que no lo es. Los que la cheat sheet marca como orientativos
// (sit-to-stand 40-54, 1-min sentadillas, plancha) lo dicen también.

export type Datos = Record<string, unknown>;
export type Nivel = "bien" | "regular" | "mal";

export const NIVEL_ETIQUETA: Record<Nivel, string> = { bien: "BIEN", regular: "REGULAR", mal: "MAL" };

// ---------- lectura de campos ----------

export function txt(d: Datos, k: string): string {
  const v = d[k];
  return typeof v === "string" ? v.trim() : "";
}

export function num(d: Datos, k: string): number | null {
  const v = d[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function lista(d: Datos, k: string): string[] {
  const v = d[k];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function nivelDeBRM(v: string): Nivel | null {
  if (v === "B" || v === "BIEN") return "bien";
  if (v === "R" || v === "REGULAR") return "regular";
  if (v === "M" || v === "MAL") return "mal";
  return null;
}

function peor(niveles: (Nivel | null)[]): Nivel | null {
  const n = niveles.filter((x): x is Nivel => !!x);
  if (!n.length) return null;
  if (n.includes("mal")) return "mal";
  if (n.includes("regular")) return "regular";
  return "bien";
}

const fmt = (n: number, dec = 0) => n.toLocaleString("es-ES", { maximumFractionDigits: dec });

// ---------- sugerencias de puntuación (los «Puntuación: …» de la plantilla) ----------

// Sentadilla: 0-1 compensaciones = BIEN · 2-3 = REGULAR · 4+ o no llega a
// media sentadilla o dolor = MAL.
export function compensacionesSentadilla(d: Datos): string[] {
  const c: string[] = [];
  if (txt(d, "sqRango") === "no llega") c.push("no llega a paralela");
  if (txt(d, "sqTalones") === "despegan") c.push("talones despegan");
  const rod = txt(d, "sqRodillas");
  if (rod === "valgo" || rod === "varo") c.push(`rodillas en ${rod}`);
  if (txt(d, "sqTronco") === "inclinación adelante") c.push("tronco inclinado adelante");
  if (txt(d, "sqVariante") === "Overhead squat" && txt(d, "sqBrazos") === "caen") c.push("brazos caen");
  if (txt(d, "sqLumbar") === "butt wink") c.push("butt wink");
  return c;
}

export function sugerenciaSentadilla(d: Datos): { nivel: Nivel; motivo: string } | null {
  const tocado = ["sqRango", "sqTalones", "sqRodillas", "sqTronco", "sqLumbar"].some((k) => txt(d, k));
  const extra = lista(d, "sqExtra");
  if (!tocado && !extra.length) return null;
  const c = compensacionesSentadilla(d);
  if (extra.includes("Dolor")) return { nivel: "mal", motivo: "dolor" };
  if (extra.includes("No llega a media sentadilla")) return { nivel: "mal", motivo: "no llega a media sentadilla" };
  const motivo = `${c.length} ${c.length === 1 ? "compensación" : "compensaciones"}`;
  if (c.length >= 4) return { nivel: "mal", motivo };
  if (c.length >= 2) return { nivel: "regular", motivo };
  return { nivel: "bien", motivo };
}

// Bird-dog por lado: aguanta estable = B · aguanta con bamboleo o rotación =
// R · no aguanta = M.
export function sugerenciaBirdDog(d: Datos, lado: 1 | 2): Nivel | null {
  const aguanta = txt(d, `bd${lado}Aguanta`);
  if (aguanta === "No") return "mal";
  if (aguanta !== "Sí") return null;
  const esp = lista(d, `bd${lado}Espalda`);
  if (esp.includes("bamboleo") || esp.includes("rota cadera")) return "regular";
  if (esp.includes("estable")) return "bien";
  return null;
}

// Pica: 3 contactos hasta bisagra completa = BIEN · pierde contacto al final
// = REGULAR · en bloque desde el inicio o pierde contactos rápido = MAL.
export function sugerenciaPica(d: Datos): Nivel | null {
  const obs = lista(d, "picaObs");
  const rom = txt(d, "picaRom");
  if (!obs.length && !rom) return null;
  if (obs.includes("Flexiona en bloque (sin separar cadera de columna)")) return "mal";
  const pierde = obs.some((o) => o.startsWith("Se despega"));
  if (!pierde && obs.includes("Mantiene tres contactos limpio") && rom.startsWith("Bisagra completa")) return "bien";
  if (pierde && rom.startsWith("Bisagra ligera")) return "mal";
  return "regular";
}

// ---------- baremos ----------

function sexoDe(d: Datos): "H" | "M" | null {
  const s = txt(d, "sexo");
  return s === "Hombre" ? "H" : s === "Mujer" ? "M" : null;
}

export type Resultado = {
  nivel: Nivel | null;
  etiqueta: string; // lo que se lee junto al valor: «Medio», «Riesgo», «Elevado»…
  nota?: string | null;
};

type Franja<T> = { min: number; max: number; v: T; orientativo?: boolean };

// La franja de su edad, o la más cercana con una nota que lo diga.
function porEdad<T>(edad: number | null, tabla: Franja<T>[]): { v: T; nota: string | null } {
  const rango = (f: Franja<T>) => `${f.min}-${f.max}`;
  const orient = (f: Franja<T>) => (f.orientativo ? " Baremo orientativo, no validado." : "");
  if (edad === null) {
    const f = tabla[Math.floor(tabla.length / 2)];
    return { v: f.v, nota: `Sin edad apuntada: baremo de ${rango(f)}.${orient(f)}` };
  }
  const exacta = tabla.find((f) => edad >= f.min && edad <= f.max);
  if (exacta) return { v: exacta.v, nota: orient(exacta).trim() || null };
  const f = edad < tabla[0].min ? tabla[0] : tabla[tabla.length - 1];
  return { v: f.v, nota: `Baremo de ${rango(f)}, el más cercano a sus ${edad} años.${orient(f)}` };
}

const faltaSexo: Resultado = { nivel: null, etiqueta: "Falta el sexo para el baremo" };

// bajo < a ≤ medio ≤ b < alto
function tresNiveles(x: number, [a, b]: [number, number], nota: string | null): Resultado {
  if (x < a) return { nivel: "mal", etiqueta: "Bajo", nota };
  if (x > b) return { nivel: "bien", etiqueta: "Alto", nota };
  return { nivel: "regular", etiqueta: "Medio", nota };
}

type HM = { H: [number, number]; M: [number, number] };

// Sit-to-stand 30 s. 55-69 Rikli & Jones; 40-54 extrapolación orientativa.
const STS: Franja<HM>[] = [
  { min: 40, max: 49, v: { H: [18, 30], M: [15, 27] }, orientativo: true },
  { min: 50, max: 54, v: { H: [14, 24], M: [12, 21] }, orientativo: true },
  { min: 55, max: 59, v: { H: [12, 18], M: [10, 15] } },
  { min: 60, max: 64, v: { H: [11, 17], M: [9, 14] } },
  { min: 65, max: 69, v: { H: [10, 15], M: [8, 13] } },
];

export function baremoSitToStand(d: Datos): Resultado | null {
  const reps = num(d, "stsReps");
  const sexo = sexoDe(d);
  if (reps === null) return null;
  if (!sexo) return faltaSexo;
  const { v, nota } = porEdad(num(d, "edad"), STS);
  return tresNiveles(reps, v[sexo], nota);
}

// ¿Supera el baremo con holgura? Entonces el 30 s se queda corto y la
// cheat sheet propone el 5-TSTS (pensado para 40-54 en forma).
export function stsTecho(d: Datos): boolean {
  const reps = num(d, "stsReps");
  const sexo = sexoDe(d);
  if (reps === null || !sexo) return false;
  const [, alto] = porEdad(num(d, "edad"), STS).v[sexo];
  return reps > alto;
}

// 5-TSTS: segundos para 5 repeticiones. Menos es mejor.
export function baremoSts5(d: Datos): Resultado | null {
  const t = num(d, "sts5Tiempo");
  if (t === null) return null;
  const edad = num(d, "edad");
  const [bueno, normal] = edad !== null && edad >= 60 ? [11, 15] : [10, 13];
  if (t < bueno) return { nivel: "bien", etiqueta: "Bueno" };
  if (t <= normal) return { nivel: "regular", etiqueta: "Normal" };
  return { nivel: "mal", etiqueta: "Pobre" };
}

export function mejorMonopodal(d: Datos, lado: "Izq" | "Dch", ojosCerrados = false): number | null {
  const p = ojosCerrados ? "moOc" : "mo";
  const v = [num(d, `${p}${lado}1`), num(d, `${p}${lado}2`)].filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
}

// Monopodal ojos abiertos, hasta 30 s. «Bueno» es el techo de 30 s salvo en
// 60-69, donde es >22 s.
const MONO: Franja<{ riesgo: number; bueno: (s: number) => boolean; techo: boolean }>[] = [
  { min: 40, max: 49, v: { riesgo: 15, bueno: (s) => s >= 30, techo: true } },
  { min: 50, max: 59, v: { riesgo: 10, bueno: (s) => s >= 30, techo: true } },
  { min: 60, max: 69, v: { riesgo: 7, bueno: (s) => s > 22, techo: false } },
];

export function baremoMonopodal(d: Datos, lado: "Izq" | "Dch"): Resultado | null {
  const s = mejorMonopodal(d, lado);
  if (s === null) return null;
  const { v, nota } = porEdad(num(d, "edad"), MONO);
  if (s < 5) return { nivel: "mal", etiqueta: "Riesgo de caída", nota };
  if (s < v.riesgo) return { nivel: "mal", etiqueta: "Riesgo", nota };
  if (v.bueno(s)) return { nivel: "bien", etiqueta: v.techo ? "Bueno (techo)" : "Bueno", nota };
  return { nivel: "regular", etiqueta: "Aceptable", nota };
}

// Llega al techo de 30 s: toca la variante con ojos cerrados.
export function monopodalTecho(d: Datos): boolean {
  return (["Izq", "Dch"] as const).some((l) => (mejorMonopodal(d, l) ?? 0) >= 30);
}

export function baremoMonopodalOc(d: Datos, lado: "Izq" | "Dch"): Resultado | null {
  const s = mejorMonopodal(d, lado, true);
  if (s === null) return null;
  const edad = num(d, "edad");
  const [a, b] = edad !== null && edad >= 50 ? [3, 10] : [5, 20];
  if (s < a) return { nivel: "regular", etiqueta: "Regular" };
  if (s > b) return { nivel: "bien", etiqueta: "Muy bueno" };
  return { nivel: "bien", etiqueta: "Bueno" };
}

const PLANCHA: Franja<[number, number, number]>[] = [
  { min: 40, max: 49, v: [30, 60, 120] },
  { min: 50, max: 59, v: [25, 50, 90] },
  { min: 60, max: 69, v: [20, 45, 60] },
];

export function baremoPlancha(d: Datos): Resultado | null {
  const t = num(d, "plTiempo");
  if (t === null) return null;
  const { v: [a, b, c], nota } = porEdad(num(d, "edad"), PLANCHA);
  if (t < a) return { nivel: "mal", etiqueta: "Bajo", nota };
  if (t < b) return { nivel: "regular", etiqueta: "Medio", nota };
  if (t <= c) return { nivel: "bien", etiqueta: "Bueno", nota };
  return { nivel: "bien", etiqueta: "Alto", nota };
}

// Dorsiflexión (rodilla-pared): >10 cm BIEN · 5-10 REGULAR · <5 o talón
// despega MAL. Mismo baremo a cualquier edad.
export function sugerenciaDorsiflexion(d: Datos, lado: "Izq" | "Dch"): Nivel | null {
  if (txt(d, `df${lado}Talon`) === "despega") return "mal";
  const cm = num(d, `df${lado}Dist`);
  if (cm === null) return null;
  if (cm > 10) return "bien";
  if (cm >= 5) return "regular";
  return "mal";
}

export function asimetriaDorsiflexion(d: Datos): number | null {
  const i = num(d, "dfIzqDist");
  const r = num(d, "dfDchDist");
  return i !== null && r !== null ? Math.abs(i - r) : null;
}

export function baremoCintura(d: Datos): Resultado | null {
  const c = num(d, "cintura");
  const sexo = sexoDe(d);
  if (c === null) return null;
  if (!sexo) return faltaSexo;
  const [ok, alto] = sexo === "H" ? [94, 102] : [80, 88];
  if (c < ok) return { nivel: "bien", etiqueta: "OK" };
  if (c <= alto) return { nivel: "regular", etiqueta: "Elevado" };
  return { nivel: "mal", etiqueta: "Alto" };
}

// Ratio cintura/cadera: óptimo H <0,90 · M <0,85.
export function ratioCinturaCadera(d: Datos): (Resultado & { valor: number }) | null {
  const c = num(d, "cintura");
  const k = num(d, "cadera");
  const sexo = sexoDe(d);
  if (c === null || !k) return null;
  const valor = c / k;
  if (!sexo) return { ...faltaSexo, valor };
  const limite = sexo === "H" ? 0.9 : 0.85;
  return valor < limite
    ? { nivel: "bien", etiqueta: "Óptimo", valor }
    : { nivel: "regular", etiqueta: `Por encima de ${limite.toFixed(2).replace(".", ",")}`, valor };
}

// 2-minute step (Rikli & Jones): validado solo para 60+.
const STEP: Franja<HM>[] = [
  { min: 60, max: 64, v: { H: [87, 115], M: [75, 107] } },
  { min: 65, max: 69, v: { H: [86, 116], M: [73, 107] } },
];

export function baremoStep(d: Datos): Resultado | null {
  const n = num(d, "stSubidas");
  const sexo = sexoDe(d);
  if (n === null) return null;
  if (!sexo) return faltaSexo;
  const edad = num(d, "edad");
  const { v, nota } = porEdad(edad, STEP);
  const corto = edad !== null && edad < 60 ? " En menores de 60 se queda corto: mejor el de 1 minuto de sentadillas." : "";
  return tresNiveles(n, v[sexo], ((nota ?? "") + corto).trim() || null);
}

// 1-minute squat test: variante cardio para 40-59. Orientativo.
const SQ1: Franja<HM>[] = [
  { min: 40, max: 49, v: { H: [22, 32], M: [18, 28] }, orientativo: true },
  { min: 50, max: 59, v: { H: [18, 28], M: [15, 24] }, orientativo: true },
];

export function baremoSentadilla1min(d: Datos): Resultado | null {
  const n = num(d, "sq1Reps");
  const sexo = sexoDe(d);
  if (n === null) return null;
  if (!sexo) return faltaSexo;
  const { v, nota } = porEdad(num(d, "edad"), SQ1);
  return tresNiveles(n, v[sexo], nota);
}

// Qué test de cardio toca por edad: 2-min step para 55+, 1-min sentadillas
// para 40-54 (en 55-59 la cheat sheet pone step; su baremo es de 60+).
export function cardioRecomendado(d: Datos): "step" | "sentadillas" | null {
  const edad = num(d, "edad");
  if (edad === null) return null;
  return edad < 55 ? "sentadillas" : "step";
}

export function imc(d: Datos): { valor: number; etiqueta: string } | null {
  const peso = num(d, "peso");
  const altura = num(d, "altura");
  if (!peso || !altura) return null;
  const m = altura > 3 ? altura / 100 : altura;
  const v = peso / (m * m);
  const etiqueta = v < 18.5 ? "Bajo peso" : v < 25 ? "Normal" : v < 30 ? "Sobrepeso" : "Obesidad";
  return { valor: v, etiqueta };
}

// FC máxima estimada (Tanaka: 208 − 0,7 × edad). Orientativa.
export function fcMaxEstimada(d: Datos): number | null {
  const edad = num(d, "edad");
  return edad === null ? null : Math.round(208 - 0.7 * edad);
}

export function lecturaFcReposo(fc: number): Resultado {
  if (fc > 100) return { nivel: "mal", etiqueta: "Alta (>100)", nota: "Por encima de 100 en reposo: no hacer esfuerzo hoy sin consultarlo con su médico." };
  if (fc > 80) return { nivel: "regular", etiqueta: "Algo elevada" };
  if (fc < 50) return { nivel: null, etiqueta: "Baja", nota: "Normal si entrena resistencia; si no, y hay mareos, que lo mire su médico." };
  return { nivel: "bien", etiqueta: "Normal" };
}

// Lo que la cheat sheet pide no olvidar sacar de la sesión. Se marca solo
// en cuanto el campo correspondiente tiene algo.
export function noOlvidar(d: Datos): { etiqueta: string; hecho: boolean; seccion: string }[] {
  return [
    { etiqueta: "Medicaciones (nombre exacto)", hecho: !!txt(d, "medicacion"), seccion: "s2" },
    { etiqueta: "Frases visión 12 meses", hecho: !!(txt(d, "vis12m") || txt(d, "f12meses")), seccion: "s7" },
    { etiqueta: "Miedos y preocupaciones", hecho: !!(txt(d, "fMiedos") || txt(d, "miedosCierre")), seccion: "s2" },
    { etiqueta: "Feedback operativo online", hecho: !!txt(d, "feedbackOnline"), seccion: "s7" },
  ];
}

// ---------- informe ----------

export type ItemInforme = {
  titulo: string;
  valor: string;
  nivel: Nivel | null;
  lectura: string;
  nota?: string | null;
};

export type BloqueInforme = { titulo: string; items: ItemInforme[] };

export type Informe = {
  alertas: string[];
  bloques: BloqueInforme[];
  fuertes: string[];
  trabajar: string[];
  objetivos: { etiqueta: string; texto: string }[];
};

const LECTURA: Record<Nivel, string> = {
  bien: "Bien",
  regular: "Regular",
  mal: "A trabajar",
};

export function generarInforme(d: Datos): Informe {
  const alertas: string[] = [];
  const bloques: BloqueInforme[] = [];

  if (txt(d, "parqRecibido") === "NO recibido") {
    alertas.push("PAR-Q+ NO recibido: la sesión es solo anamnesis. Sin cribado no se hacen tests de esfuerzo.");
  }
  if (txt(d, "parqRecibido") === "Sí, con bandera(s)" && txt(d, "repasoParq") !== "Aclarada bandera(s)") {
    alertas.push("PAR-Q+ con bandera(s) sin aclarar en el repaso.");
  }

  // Composición
  const comp: ItemInforme[] = [];
  const peso = num(d, "peso");
  if (peso !== null) comp.push({ titulo: "Peso", valor: `${fmt(peso, 1)} kg`, nivel: null, lectura: "" });
  const i = imc(d);
  if (i) comp.push({ titulo: "IMC", valor: fmt(i.valor, 1), nivel: null, lectura: i.etiqueta });
  const cin = baremoCintura(d);
  if (cin) {
    comp.push({
      titulo: "Perímetro de cintura",
      valor: `${fmt(num(d, "cintura")!, 1)} cm`,
      nivel: cin.nivel,
      lectura: cin.etiqueta,
      nota: cin.nivel === "mal" ? "Riesgo cardiometabólico alto según perímetro." : null,
    });
  }
  const icc = ratioCinturaCadera(d);
  if (icc) {
    comp.push({
      titulo: "Ratio cintura/cadera",
      valor: icc.valor.toFixed(2).replace(".", ","),
      nivel: icc.nivel,
      lectura: icc.etiqueta,
    });
  }
  if (comp.length) bloques.push({ titulo: "Composición", items: comp });

  // Movilidad y control
  const mov: ItemInforme[] = [];
  const sqSug = sugerenciaSentadilla(d);
  const sqNivel = nivelDeBRM(txt(d, "sqGlobal")) ?? sqSug?.nivel ?? null;
  if (sqNivel) {
    const comps = compensacionesSentadilla(d);
    const extra = lista(d, "sqExtra");
    mov.push({
      titulo: `Sentadilla${txt(d, "sqVariante") ? ` (${txt(d, "sqVariante").toLowerCase()})` : ""}`,
      valor: NIVEL_ETIQUETA[sqNivel],
      nivel: sqNivel,
      lectura: [...comps, ...extra.map((e) => e.toLowerCase())].join(" · ") || "Sin compensaciones",
      nota: extra.includes("Dolor") ? "Dolor durante la sentadilla." : null,
    });
  }
  const dfLados = (["Izq", "Dch"] as const)
    .map((l) => ({
      l,
      dist: txt(d, `df${l}Dist`),
      talon: txt(d, `df${l}Talon`),
      nivel: nivelDeBRM(txt(d, `df${l}Val`)) ?? sugerenciaDorsiflexion(d, l),
    }))
    .filter((x) => x.dist || x.talon || x.nivel);
  if (dfLados.length) {
    const asim = asimetriaDorsiflexion(d);
    mov.push({
      titulo: "Dorsiflexión de tobillo",
      valor: dfLados.map((x) => `${x.l === "Izq" ? "IZQ" : "DCH"} ${x.dist || "—"}`).join(" · "),
      nivel: peor(dfLados.map((x) => x.nivel)),
      lectura: dfLados
        .map((x) => `${x.l === "Izq" ? "izq" : "dch"}: ${x.nivel ? LECTURA[x.nivel].toLowerCase() : "—"}${x.talon === "despega" ? ", talón despega" : ""}`)
        .join(" · "),
      nota:
        asim !== null && asim > 2
          ? `Diferencia entre lados de ${fmt(asim, 1)} cm: relevante, trabajo específico.`
          : asim !== null && asim > 0
            ? `Diferencia entre lados: ${fmt(asim, 1)} cm.`
            : null,
    });
  }
  const bd = ([1, 2] as const).map((l) => nivelDeBRM(txt(d, `bd${l}Val`)) ?? sugerenciaBirdDog(d, l));
  if (bd.some(Boolean)) {
    mov.push({
      titulo: "Bird-dog (10 s por lado)",
      valor: bd.map((n, k) => `L${k + 1} ${n ? NIVEL_ETIQUETA[n] : "—"}`).join(" · "),
      nivel: peor(bd),
      lectura: [1, 2]
        .map((l) => lista(d, `bd${l}Espalda`).join(", "))
        .filter(Boolean)
        .join(" / "),
    });
  }
  const pica = nivelDeBRM(txt(d, "picaGlobal")) ?? sugerenciaPica(d);
  if (pica) {
    mov.push({
      titulo: "Disociación lumbopélvica (pica)",
      valor: NIVEL_ETIQUETA[pica],
      nivel: pica,
      lectura: [txt(d, "picaRom"), ...lista(d, "picaObs").filter((o) => o !== "Mantiene tres contactos limpio")]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (mov.length) bloques.push({ titulo: "Movilidad y control", items: mov });

  // Fuerza y equilibrio
  const fza: ItemInforme[] = [];
  const sts = baremoSitToStand(d);
  if (sts) {
    fza.push({ titulo: "Sit-to-stand 30 s", valor: `${num(d, "stsReps")} reps`, nivel: sts.nivel, lectura: sts.etiqueta, nota: sts.nota });
  }
  const sts5 = baremoSts5(d);
  if (sts5) {
    fza.push({ titulo: "5 levantadas de silla (5-TSTS)", valor: `${fmt(num(d, "sts5Tiempo")!, 1)} s`, nivel: sts5.nivel, lectura: sts5.etiqueta });
  }
  for (const lado of ["Izq", "Dch"] as const) {
    const r = baremoMonopodal(d, lado);
    if (r) {
      fza.push({
        titulo: `Apoyo monopodal ${lado === "Izq" ? "izquierdo" : "derecho"}`,
        valor: `${fmt(mejorMonopodal(d, lado)!, 1)} s`,
        nivel: r.nivel,
        lectura: r.etiqueta,
        nota: r.nota,
      });
      if (r.etiqueta === "Riesgo de caída") alertas.push(`Apoyo monopodal ${lado === "Izq" ? "izquierdo" : "derecho"} por debajo de 5 s: riesgo de caída.`);
    }
  }
  for (const lado of ["Izq", "Dch"] as const) {
    const r = baremoMonopodalOc(d, lado);
    if (r) {
      fza.push({
        titulo: `Monopodal ojos cerrados ${lado === "Izq" ? "izquierdo" : "derecho"}`,
        valor: `${fmt(mejorMonopodal(d, lado, true)!, 1)} s`,
        nivel: r.nivel,
        lectura: r.etiqueta,
      });
    }
  }
  const pl = baremoPlancha(d);
  if (pl) {
    fza.push({
      titulo: "Plancha frontal",
      valor: `${fmt(num(d, "plTiempo")!, 0)} s`,
      nivel: pl.nivel,
      lectura: pl.etiqueta,
      nota: [pl.nota, txt(d, "plCorte") && `Corte: ${txt(d, "plCorte")}`].filter(Boolean).join(" ") || null,
    });
  }
  if (txt(d, "flNivel") || txt(d, "flReps")) {
    fza.push({
      titulo: "Flexiones adaptadas",
      valor: [txt(d, "flNivel"), txt(d, "flReps") && `${txt(d, "flReps")} reps`].filter(Boolean).join(" · "),
      nivel: null,
      lectura: "",
      nota: txt(d, "flCorte") ? `Corte: ${txt(d, "flCorte")}` : null,
    });
  }
  if (txt(d, "reOpcion") === "TRX" && (txt(d, "reReps") || txt(d, "reAngulo"))) {
    const ang = txt(d, "reAngulo") === "Otro" ? txt(d, "reAnguloOtro") : txt(d, "reAngulo");
    fza.push({
      titulo: "Remo TRX",
      valor: [ang, txt(d, "reReps") && `${txt(d, "reReps")} reps`].filter(Boolean).join(" · "),
      nivel: null,
      lectura: "",
    });
  }
  if (fza.length) bloques.push({ titulo: "Fuerza y equilibrio", items: fza });

  // Cardio
  const car: ItemInforme[] = [];
  const fcR = num(d, "fcReposo");
  if (fcR !== null) {
    const l = lecturaFcReposo(fcR);
    car.push({ titulo: "FC en reposo", valor: `${fmt(fcR)} ppm`, nivel: l.nivel, lectura: l.etiqueta, nota: l.nota });
    if (fcR > 100) alertas.push(`FC en reposo de ${fmt(fcR)} ppm: no hacer tests de esfuerzo sin valoración médica.`);
  }
  const st = baremoStep(d);
  if (st) {
    car.push({ titulo: "2-minute step", valor: `${num(d, "stSubidas")} subidas`, nivel: st.nivel, lectura: st.etiqueta, nota: st.nota });
  }
  const sq1 = baremoSentadilla1min(d);
  if (sq1) {
    car.push({ titulo: "Sentadillas en 1 minuto", valor: `${num(d, "sq1Reps")} reps`, nivel: sq1.nivel, lectura: sq1.etiqueta, nota: sq1.nota });
  }
  const fcP = num(d, "stFcPico");
  const fcMax = fcMaxEstimada(d);
  if (fcP !== null) {
    const pct = fcMax ? Math.round((fcP / fcMax) * 100) : null;
    const reserva = fcMax && fcR !== null ? Math.round(((fcP - fcR) / (fcMax - fcR)) * 100) : null;
    car.push({
      titulo: "FC pico tras el test cardio",
      valor: `${fmt(fcP)} ppm`,
      nivel: null,
      lectura: pct !== null ? `${pct}% de su FC máx. estimada (${fcMax})` : "",
      nota: reserva !== null ? `${reserva}% de su FC de reserva.` : null,
    });
  }
  const borg = num(d, "stBorg");
  if (borg !== null) {
    car.push({
      titulo: "Esfuerzo percibido (Borg 0-10)",
      valor: fmt(borg),
      nivel: null,
      lectura: borg >= 8 ? "Muy duro" : borg >= 5 ? "Duro" : borg >= 3 ? "Moderado" : "Suave",
    });
  }
  if (car.length) bloques.push({ titulo: "Cardio", items: car });

  if (txt(d, "dolorActual")) alertas.push(`Dolor / zona limitante: ${txt(d, "dolorActual")}`);

  const todos = bloques.flatMap((b) => b.items);
  const fuertes = todos.filter((x) => x.nivel === "bien").map((x) => x.titulo);
  const trabajar = [
    ...todos.filter((x) => x.nivel === "mal").map((x) => x.titulo),
    ...todos.filter((x) => x.nivel === "regular").map((x) => x.titulo),
  ];

  const objetivos = [
    { etiqueta: "Por qué ahora", texto: txt(d, "porQueAhora") },
    { etiqueta: "A 3 meses", texto: txt(d, "obj3m") || txt(d, "f3meses") },
    { etiqueta: "A 12 meses", texto: txt(d, "vis12m") || txt(d, "f12meses") },
    { etiqueta: "Miedos", texto: [txt(d, "fMiedos"), txt(d, "miedosCierre")].filter(Boolean).join(" / ") },
  ].filter((o) => o.texto);

  return { alertas, bloques, fuertes, trabajar, objetivos };
}
