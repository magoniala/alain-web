// Lectura de las notas de plan de Entrenatzaile del vault (Clientes/…).
//
// Pensado para el formato de "Juanan — Plan del trimestre (T2)": frontmatter
// con inicio/fin/frecuencia, tabla de metas, tabla de la temporada (fases),
// tabla de las sesiones tipo, "Reglas de carga" y secciones "## Semana N"
// con sus sesiones ("**A · Fuerza (lunes)** — ~50 min") y ejercicios en lista
// numerada, más la tabla de avisos de la semana. Lo que no reconoce lo deja en
// el Markdown del plan, que es lo que lee la IA de todas formas.

export function frontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  const fm = {};
  if (!m) return { fm, cuerpo: md };
  for (const l of m[1].split("\n")) {
    const k = /^([\w_-]+):\s*(.*)$/.exec(l);
    if (k) fm[k[1]] = k[2].replace(/^["']|["']$/g, "").trim();
  }
  return { fm, cuerpo: md.slice(m[0].length) };
}

/** Secciones "## Título" → { titulo: texto } (en orden). */
export function secciones(cuerpo) {
  const out = [];
  let actual = { titulo: "", texto: [] };
  for (const l of cuerpo.split("\n")) {
    const h = /^##\s+(.+)$/.exec(l);
    if (h) {
      out.push(actual);
      actual = { titulo: h[1].trim(), texto: [] };
    } else actual.texto.push(l);
  }
  out.push(actual);
  return out.map((s) => ({ titulo: s.titulo, texto: s.texto.join("\n").trim() }));
}

const limpio = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** Primera tabla Markdown de un texto → filas (arrays de celdas), sin la fila separadora. */
export function tabla(texto) {
  const filas = [];
  let dentro = false;
  for (const l of texto.split("\n")) {
    if (/^\s*\|/.test(l)) {
      dentro = true;
      if (/^\s*\|[\s|:-]+\|\s*$/.test(l)) continue;
      filas.push(l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    } else if (dentro) break;
  }
  return filas;
}

const DIAS = { lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 7 };
const DIAS_CORTOS = { lun: 1, mar: 2, mie: 3, mié: 3, jue: 4, vie: 5, sab: 6, sáb: 6, dom: 7 };

export function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "3 × 6" | "3 × 5 por pierna" | "2 × 10 por lado + 15" → {series, reps} */
function seriesReps(tok) {
  const m = /^(\d+)\s*[×x]\s*(.+)$/i.exec(tok);
  if (!m) return null;
  return { series: Number(m[1]), reps: m[2].trim().replace(/\.$/, "") };
}

/** "1. **Peso muerto desde el suelo:** 3 × 6 · **50 kg** · descanso 2-3'. Vídeo de la última serie." */
export function ejercicio(linea, orden) {
  const m = /^\s*\d+\.\s+\*\*(.+?):?\*\*:?\s*(.*)$/.exec(linea);
  if (!m) return null;
  const nombre = limpio(m[1]).replace(/:$/, "");
  const e = { orden, nombre, series: null, reps: null, carga: null, tempo: null, descanso: null, rir: null, notas: null, video: false, superserie: null, campos: [] };
  const notas = [];
  let resto = m[2].trim().replace(/^,\s*/, "");
  if (/superserie/i.test(nombre)) e.superserie = nombre;
  const ss = /^en superserie:?\s*(.*)$/i.exec(resto);
  if (ss) {
    e.superserie = nombre;
    resto = ss[1];
  }
  if (/v[ií]deo/i.test(resto)) e.video = true;
  for (let tok of resto.split(/\s+·\s+/)) {
    tok = tok.trim();
    if (!tok) continue;
    // "descanso 2-3'. Vídeo de la última serie." → descanso + nota
    const desc = /^descanso\s+([^.]+?)(?:\.\s*(.*))?$/i.exec(limpio(tok));
    if (desc) {
      e.descanso = desc[1].trim();
      if (desc[2]) notas.push(desc[2].trim());
      continue;
    }
    const sr = seriesReps(limpio(tok));
    if (sr && e.series === null) {
      e.series = sr.series;
      e.reps = sr.reps;
      continue;
    }
    if (/\bkg\b/i.test(tok) && !e.carga) {
      e.carga = limpio(tok);
      continue;
    }
    if (/^(baja en|tempo|pausa)/i.test(limpio(tok))) {
      e.tempo = limpio(tok);
      continue;
    }
    const rir = /^RIR\s*([\d-]+)/i.exec(limpio(tok));
    if (rir) {
      e.rir = rir[1];
      continue;
    }
    const ns = /^(\d+)\s+series?\s+(.+)$/i.exec(limpio(tok));
    if (ns && e.series === null) {
      e.series = Number(ns[1]);
      e.reps = ns[2]; // "dejando 2-3 en recámara"
      continue;
    }
    if (e.series === null && !e.reps && /^\d+\s+\w+/.test(limpio(tok))) {
      e.reps = limpio(tok); // "4 subidas (2 por lado)"
      continue;
    }
    notas.push(limpio(tok));
  }
  e.notas = notas.length ? notas.join(" · ").replace(/\s*\.\s*$/, "") : null;
  const conPeso = !!e.carga || /\bpeso\b/i.test(e.notas ?? "");
  e.campos = ["reps", ...(conPeso ? ["peso"] : []), "rir", ...(e.video ? ["video"] : [])];
  if (/una pierna|por pierna|por brazo|por lado/i.test(`${e.nombre} ${e.reps ?? ""}`)) e.campos.push("lado");
  if (/apunta/i.test(e.notas ?? "")) e.campos.push("nota");
  return e;
}

/** "**A · Fuerza (lunes)** — ~50 min" */
function cabeceraSesion(l) {
  const m = /^\*\*([A-Z])\s*·\s*(.+?)\s*\((\p{L}+)\)\*\*\s*(?:—\s*~?(\d+)\s*min)?/u.exec(l.trim());
  if (!m) return null;
  return { clave: m[1], nombre: `${m[1]} · ${m[2].trim()}`, dia: DIAS[m[3].toLowerCase()] ?? null, duracion_min: m[4] ? Number(m[4]) : null };
}

/** "## Semana 1 (2-8 nov) · Reentrada" → número y título. */
function cabeceraSemana(t) {
  const m = /^Semana\s+(\d+)\s*(?:\(([^)]*)\))?\s*(?:·\s*(.+))?$/i.exec(t);
  return m ? { numero: Number(m[1]), titulo: m[3]?.trim() ?? null } : null;
}

/** "Lun 2 · 21:00" | "Mar 3 · 14:00" | "Lun 2 · al acabar" → {dia (1-7), hora|null, texto} */
function cuando(celda) {
  const c = limpio(celda).toLowerCase();
  const d = /^(\p{L}{3})\w*\s+\d+/u.exec(c);
  const dia = d ? DIAS_CORTOS[d[1]] ?? null : null;
  const h = /(\d{1,2}):(\d{2})/.exec(c);
  return { dia, hora: h ? `${h[1].padStart(2, "0")}:${h[2]}` : null, texto: c };
}

function tipoAviso(que, cuandoTxt) {
  const q = limpio(que).toLowerCase();
  if (/post-sesi/.test(q)) return "formulario_post";
  if (/recuperaci/.test(q)) return "formulario_recuperacion";
  if (/si no ha registrado/.test(q)) return "si_no_registra";
  if (/resumen/.test(q)) return "resumen_domingo";
  if (/^aviso/.test(q)) return "aviso_dia_antes";
  if (/recordatorio/.test(q)) return /al subir/.test(cuandoTxt) ? "manual" : "recordatorio_dia";
  return "manual";
}

export function semana(seccion, lunesPlan) {
  const cab = cabeceraSemana(seccion.titulo);
  if (!cab) return null;
  const lunes = sumarDias(lunesPlan, (cab.numero - 1) * 7);
  const texto = seccion.texto;
  const rir = /RIR\s*\*{0,2}\s*([\d-]+)/i.exec(texto)?.[1] ?? null;
  const calent = /^\*\*Calentamiento[^*]*\*\*:?\s*(.+)$/im.exec(texto)?.[1]?.trim() ?? null;
  const sesiones = [];
  let actual = null;
  const lineas = texto.split("\n");
  let intro = [];
  let enAvisos = false;
  const avisos = [];
  for (const l of lineas) {
    if (/^###\s+Avisos/i.test(l)) {
      enAvisos = true;
      actual = null;
      continue;
    }
    if (enAvisos) continue;
    const s = cabeceraSesion(l);
    if (s) {
      actual = { ...s, fecha: s.dia ? sumarDias(lunes, s.dia - 1) : null, calentamiento: calent, ejercicios: [] };
      sesiones.push(actual);
      continue;
    }
    if (actual) {
      const e = ejercicio(l, actual.ejercicios.length + 1);
      if (e) actual.ejercicios.push(e);
    } else if (!/^\|/.test(l) && !/^\*\*Calentamiento/i.test(l)) intro.push(l);
  }
  // Tabla de avisos.
  const iAv = texto.search(/^###\s+Avisos/im);
  if (iAv >= 0) {
    const filas = tabla(texto.slice(iAv));
    for (const [cel, que, txt] of filas.slice(1)) {
      const c = cuando(cel);
      if (!c.dia) continue;
      const tipo = tipoAviso(que, c.texto);
      const fecha = sumarDias(lunes, c.dia - 1);
      // "al acabar" (post-sesión) y "al subir la sesión": sin hora fija → la de la sesión del día.
      const hora = c.hora ?? "09:00";
      const t = limpio(txt).replace(/^"|"$/g, "").replace(/^—$/, "");
      avisos.push({ tipo, fecha, hora, texto: t || null, que: limpio(que) });
    }
  }
  return { numero: cab.numero, titulo: cab.titulo, lunes, rir_objetivo: rir, notas: intro.join("\n").trim() || null, sesiones, avisos };
}

function lunesDe(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = d.getUTCDay() || 7;
  return sumarDias(iso, 1 - dow);
}

/** Nota de plan completa → objeto listo para importar. */
export function leerPlan(md, nombreNota) {
  const { fm, cuerpo } = frontmatter(md);
  const secs = secciones(cuerpo);
  const sec = (re) => secs.find((s) => re.test(s.titulo));
  const inicio = fm.inicio ?? (fm.periodo ? fm.periodo.split(/\s*→\s*/)[0] : null);
  const finRaw = fm.fin ?? (fm.periodo ? fm.periodo.split(/\s*→\s*/)[1] : null);
  const fin = finRaw && /^\d{4}-\d{2}-\d{2}$/.test(finRaw) ? finRaw : null;
  const plan = {
    cliente: fm.cliente,
    nombre: fm.trimestre ?? fm.bloque ?? nombreNota,
    inicio,
    fin,
    frecuencia: fm.frecuencia ?? null,
    metas: [],
    fases: [],
    reglas_carga: sec(/^Reglas de carga/i)?.texto ?? null,
    markdown: md,
    nota_vault: nombreNota,
    sesiones_tipo: [],
    semanas: [],
  };
  const metas = sec(/^Las metas/i);
  if (metas) {
    const f = tabla(metas.texto);
    for (const fila of f.slice(1)) plan.metas.push({ meta: limpio(fila[0]), ahora: limpio(fila[1]), hitos: fila.slice(2, -1).map(limpio), minimo: limpio(fila.at(-1)) });
    if (f[0]) plan.metas_cabecera = f[0].map(limpio);
  }
  const temp = sec(/temporada/i);
  if (temp) for (const fila of tabla(temp.texto).slice(1)) plan.fases.push({ semanas: limpio(fila[0]), fechas: limpio(fila[1]), fase: limpio(fila[2]), que_pasa: limpio(fila[3]) });
  const tres = sec(/sesiones/i);
  if (tres) {
    const cab = tabla(tres.texto)[0] ?? [];
    cab.slice(1).forEach((c, i) => {
      const m = /\*\*([A-Z])\s*·\s*(.+?)\*\*\s*\((\p{L}+)\)/u.exec(c);
      if (m) plan.sesiones_tipo.push({ clave: m[1], nombre: `${m[1]} · ${m[2].trim()}`, dia_habitual: DIAS[m[3].toLowerCase()] ?? null, orden: i });
    });
  }
  // Sin tabla de sesiones: de la frecuencia, "(A pierna · B torso · C fullbody)".
  if (!plan.sesiones_tipo.length && plan.frecuencia) {
    const par = /\(([^)]*)\)/.exec(plan.frecuencia)?.[1] ?? "";
    par.split(/\s*[·,]\s*/).forEach((t, i) => {
      const m = /^([A-Z])\s+(.+)$/.exec(t.trim());
      if (m) plan.sesiones_tipo.push({ clave: m[1], nombre: `${m[1]} · ${m[2].charAt(0).toUpperCase()}${m[2].slice(1)}`, dia_habitual: null, orden: i });
    });
  }
  const lunesPlan = inicio ? lunesDe(inicio) : null;
  if (lunesPlan) {
    for (const s of secs) {
      const sem = semana(s, lunesPlan);
      if (sem) plan.semanas.push(sem);
    }
  }
  // Duración y foco de cada sesión tipo, de la primera semana que la tenga.
  for (const t of plan.sesiones_tipo) {
    const s = plan.semanas.flatMap((w) => w.sesiones).find((x) => x.clave === t.clave);
    if (s) t.duracion_min = s.duracion_min;
  }
  return plan;
}
