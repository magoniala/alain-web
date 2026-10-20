// Valoración inicial online: baremos e informe automático.
//
// Los apuntes de la sesión se guardan como un único objeto `datos` (una
// clave por campo) en la tabla valoraciones_sesion. Este módulo no toca la base de
// datos: lee ese objeto y devuelve el informe, así que la pestaña de /admin
// lo recalcula en directo cada vez que se apunta algo.
//
// Los baremos son los de la plantilla de valoración online. Donde la
// plantilla solo trae una franja de edad (sit-to-stand, 2-minute step), se
// usa la franja más cercana y el informe lo dice, para no presentar como
// baremo de su edad uno que no lo es.

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

type Franja = { etiqueta: string; nota: string | null };

function franja55o60(edad: number | null, alto: string): Franja & { mayor: boolean } {
  if (edad === null) return { etiqueta: "55-59", nota: "Sin edad apuntada: se usa el baremo de 55-59.", mayor: false };
  if (edad < 60) {
    return {
      etiqueta: "55-59",
      nota: edad < 55 ? `Baremo de 55-59, el más cercano a sus ${edad} años.` : null,
      mayor: false,
    };
  }
  return {
    etiqueta: alto,
    nota: edad > 64 && alto === "60-64" ? `Baremo de 60-64, el más cercano a sus ${edad} años.` : null,
    mayor: true,
  };
}

function sexoDe(d: Datos): "H" | "M" | null {
  const s = txt(d, "sexo");
  return s === "Hombre" ? "H" : s === "Mujer" ? "M" : null;
}

// Sit-to-stand 30 s (Rikli & Jones, plantilla).
const STS: Record<string, [number, number]> = {
  "H55-59": [12, 18],
  "M55-59": [10, 15],
  "H60-64": [11, 17],
  "M60-64": [9, 14],
};

// 2-minute step (Rikli & Jones adultos 60+, plantilla): solo 60-64.
const STEP: Record<string, [number, number]> = { H: [87, 115], M: [75, 107] };

export type Resultado = {
  nivel: Nivel | null;
  etiqueta: string; // lo que se lee junto al valor: «Medio», «Riesgo», «Elevado»…
  nota?: string | null;
};

export function baremoSitToStand(d: Datos): Resultado | null {
  const reps = num(d, "stsReps");
  const sexo = sexoDe(d);
  if (reps === null) return null;
  if (!sexo) return { nivel: null, etiqueta: "Falta el sexo para el baremo" };
  const f = franja55o60(num(d, "edad"), "60-64");
  const [a, b] = STS[`${sexo}${f.etiqueta}`];
  if (reps < a) return { nivel: "mal", etiqueta: "Bajo", nota: f.nota };
  if (reps > b) return { nivel: "bien", etiqueta: "Alto", nota: f.nota };
  return { nivel: "regular", etiqueta: "Medio", nota: f.nota };
}

export function mejorMonopodal(d: Datos, lado: "Izq" | "Dch"): number | null {
  const v = [num(d, `mo${lado}1`), num(d, `mo${lado}2`)].filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
}

export function baremoMonopodal(d: Datos, lado: "Izq" | "Dch"): Resultado | null {
  const s = mejorMonopodal(d, lado);
  if (s === null) return null;
  const f = franja55o60(num(d, "edad"), "60-69");
  const nota = f.nota;
  if (s < 5) return { nivel: "mal", etiqueta: "Riesgo de caída", nota };
  if (!f.mayor) {
    if (s < 10) return { nivel: "mal", etiqueta: "Riesgo", nota };
    if (s >= 30) return { nivel: "bien", etiqueta: "Bueno (techo)", nota };
    return { nivel: "regular", etiqueta: "Aceptable", nota };
  }
  if (s < 7) return { nivel: "mal", etiqueta: "Riesgo", nota };
  if (s > 22) return { nivel: "bien", etiqueta: "Bueno", nota };
  return { nivel: "regular", etiqueta: "Aceptable", nota };
}

export function baremoPlancha(d: Datos): Resultado | null {
  const t = num(d, "plTiempo");
  if (t === null) return null;
  if (t < 20) return { nivel: "mal", etiqueta: "Bajo" };
  if (t < 45) return { nivel: "regular", etiqueta: "Medio" };
  if (t <= 60) return { nivel: "bien", etiqueta: "Bueno" };
  return { nivel: "bien", etiqueta: "Alto" };
}

export function baremoCintura(d: Datos): Resultado | null {
  const c = num(d, "cintura");
  const sexo = sexoDe(d);
  if (c === null) return null;
  if (!sexo) return { nivel: null, etiqueta: "Falta el sexo para el baremo" };
  const [ok, alto] = sexo === "H" ? [94, 102] : [80, 88];
  if (c < ok) return { nivel: "bien", etiqueta: "OK" };
  if (c <= alto) return { nivel: "regular", etiqueta: "Elevado" };
  return { nivel: "mal", etiqueta: "Alto" };
}

export function baremoStep(d: Datos): Resultado | null {
  const n = num(d, "stSubidas");
  const sexo = sexoDe(d);
  if (n === null) return null;
  if (!sexo) return { nivel: null, etiqueta: "Falta el sexo para el baremo" };
  const edad = num(d, "edad");
  const nota =
    edad === null ? "Sin edad apuntada: baremo de 60-64." : edad < 60 || edad > 64 ? `Baremo de 60-64 (el único de la plantilla); tiene ${edad}.` : null;
  const [a, b] = STEP[sexo];
  if (n < a) return { nivel: "mal", etiqueta: "Bajo", nota };
  if (n > b) return { nivel: "bien", etiqueta: "Alto", nota };
  return { nivel: "regular", etiqueta: "Medio", nota };
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
      nivel: nivelDeBRM(txt(d, `df${l}Val`)),
    }))
    .filter((x) => x.dist || x.talon || x.nivel);
  if (dfLados.length) {
    const dIzq = num(d, "dfIzqDist");
    const dDch = num(d, "dfDchDist");
    const asim = dIzq !== null && dDch !== null ? Math.abs(dIzq - dDch) : null;
    mov.push({
      titulo: "Dorsiflexión de tobillo",
      valor: dfLados.map((x) => `${x.l === "Izq" ? "IZQ" : "DCH"} ${x.dist || "—"}`).join(" · "),
      nivel: peor(dfLados.map((x) => x.nivel)),
      lectura: dfLados
        .map((x) => `${x.l === "Izq" ? "izq" : "dch"}: ${x.nivel ? LECTURA[x.nivel].toLowerCase() : "—"}${x.talon === "despega" ? ", talón despega" : ""}`)
        .join(" · "),
      nota: asim !== null && asim > 0 ? `Diferencia entre lados: ${fmt(asim, 1)} cm.` : null,
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
  const pl = baremoPlancha(d);
  if (pl) {
    fza.push({
      titulo: "Plancha frontal",
      valor: `${fmt(num(d, "plTiempo")!, 0)} s`,
      nivel: pl.nivel,
      lectura: pl.etiqueta,
      nota: txt(d, "plCorte") ? `Corte: ${txt(d, "plCorte")}` : null,
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
  const fcP = num(d, "stFcPico");
  const fcMax = fcMaxEstimada(d);
  if (fcP !== null) {
    const pct = fcMax ? Math.round((fcP / fcMax) * 100) : null;
    const reserva = fcMax && fcR !== null ? Math.round(((fcP - fcR) / (fcMax - fcR)) * 100) : null;
    car.push({
      titulo: "FC pico tras el step",
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
