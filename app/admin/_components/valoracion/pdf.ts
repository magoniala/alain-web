// PDF de la valoración: las notas de la sesión (todo lo apuntado) y el
// informe de conclusiones (la versión para la persona, sin notas internas).
//
// No hay librería de PDF: se arma un documento HTML pensado para A4, se abre
// en una ventana nueva y se lanza imprimir, donde se elige «Guardar como
// PDF». El título del documento es el nombre de archivo que propone el
// navegador.

import { RESULTADO_ETIQUETA, type ResultadoParq } from "@/lib/parq";
import { TESTS, criterioTests, idsDesdeTextos } from "@/lib/parq-criterio";
import {
  NIVEL_ETIQUETA,
  generarInforme,
  imc,
  lecturaFcReposo,
  mejorMonopodal,
  num,
  txt,
  type Datos,
  type Nivel,
} from "@/lib/valoracion";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");

// Campos de la hoja con su etiqueta, en el mismo orden. Solo salen los que
// tienen algo.
type Campo = [clave: string, etiqueta: string, unidad?: string];
type Bloque = { titulo: string; campos: Campo[] };

const NOTAS: Bloque[] = [
  {
    titulo: "Cabecera",
    campos: [
      ["edad", "Edad", "años"],
      ["sexo", "Sexo"],
      ["modalidad", "Modalidad"],
      ["conversacionPrevia", "Conversación previa"],
      ["dispositivos", "Dispositivos pareja"],
    ],
  },
  {
    titulo: "0 · Datos previos",
    campos: [
      ["peso", "Peso", "kg"],
      ["altura", "Altura declarada", "cm"],
      ["parqRecibido", "PAR-Q+ recibido"],
    ],
  },
  {
    titulo: "1 · Bienvenida",
    campos: [
      ["chequeo", "Chequeo técnico"],
      ["notaClima", "Clima / dinámica / primeras impresiones"],
    ],
  },
  {
    titulo: "2 · Repaso PAR-Q+ y anamnesis",
    campos: [
      ["repasoParq", "Repaso PAR-Q+"],
      ["notasBanderas", "Notas sobre banderas"],
      ["grabaAnamnesis", "Audio grabado"],
      ["enfermedades", "Enfermedades diagnosticadas"],
      ["operaciones", "Operaciones importantes"],
      ["medicacion", "Medicación habitual"],
      ["revisionMedica", "Última revisión médica"],
      ["dolorActual", "Dolor / zona limitante ahora"],
      ["lesionesSecuela", "Lesiones con secuela"],
      ["despertar", "Al despertar, ¿duele o cruje algo?"],
      ["actividadActual", "Actividad actual"],
      ["facilDificil", "Qué le resulta fácil y qué le cuesta"],
      ["sueno", "Sueño"],
      ["cena", "Cena"],
      ["comeCasa", "Come en casa o fuera"],
      ["alcohol", "Alcohol"],
      ["estres", "Estrés estos meses"],
      ["diasDice", "Días/semana que dice"],
      ["momentoDia", "Momento del día preferido"],
      ["material", "Material en casa"],
      ["porQueAhora", "Por qué arrancar ahora"],
      ["f3meses", "A 3 meses"],
      ["f12meses", "A 12 meses"],
      ["fMiedos", "Miedos o preocupaciones"],
      ["sexSenales", "Señales salud sexual"],
      ["sexDecision", "Decisión"],
      ["salidaAnamnesis", "Anotado al salir del bloque"],
    ],
  },
  {
    titulo: "FC en reposo",
    campos: [
      ["fcReposo", "FC en reposo", "ppm"],
      ["fcReposoMetodo", "Cómo"],
    ],
  },
  {
    titulo: "3 · Control postural",
    campos: [
      ["sqModo", "Sentadilla · modo"],
      ["sqVariante", "Sentadilla · variante"],
      ["sqRango", "Rango"],
      ["sqTalones", "Talones"],
      ["sqRodillas", "Rodillas"],
      ["sqTronco", "Tronco"],
      ["sqBrazos", "Brazos (OH)"],
      ["sqLumbar", "Lumbar"],
      ["sqExtra", "Además"],
      ["sqNotas", "Notas sentadilla"],
      ["sqGlobal", "Sentadilla · puntuación"],
      ["dfModo", "Dorsiflexión · modo"],
      ["dfIzqDist", "Dorsiflexión IZQ"],
      ["dfIzqTalon", "Talón IZQ"],
      ["dfIzqVal", "Valoración IZQ"],
      ["dfDchDist", "Dorsiflexión DCH"],
      ["dfDchTalon", "Talón DCH"],
      ["dfDchVal", "Valoración DCH"],
      ["bd1Aguanta", "Bird-dog L1 · aguanta 10 s"],
      ["bd1Espalda", "Bird-dog L1 · espalda"],
      ["bd1Val", "Bird-dog L1 · valoración"],
      ["bd2Aguanta", "Bird-dog L2 · aguanta 10 s"],
      ["bd2Espalda", "Bird-dog L2 · espalda"],
      ["bd2Val", "Bird-dog L2 · valoración"],
      ["picaObs", "Pica · observación"],
      ["picaRom", "Pica · ROM"],
      ["picaGlobal", "Pica · puntuación"],
    ],
  },
  {
    titulo: "4 · Antropometría",
    campos: [
      ["cintura", "Perímetro de cintura", "cm"],
      ["fotos", "Fotos"],
    ],
  },
  {
    titulo: "5 · Fuerza-función y equilibrio",
    campos: [
      ["stsReps", "Sit-to-stand 30 s", "reps"],
      ["stsNotas", "Notas técnica"],
      ["moIzq1", "Monopodal IZQ · intento 1", "s"],
      ["moIzq2", "Monopodal IZQ · intento 2", "s"],
      ["moDch1", "Monopodal DCH · intento 1", "s"],
      ["moDch2", "Monopodal DCH · intento 2", "s"],
      ["plTiempo", "Plancha", "s"],
      ["plCorte", "Plancha · motivo de corte"],
      ["flNivel", "Flexiones · nivel"],
      ["flReps", "Flexiones · reps", "reps"],
      ["flCorte", "Flexiones · motivo de corte"],
      ["reOpcion", "Remo"],
      ["reAngulo", "Remo · ángulo"],
      ["reAnguloOtro", "Remo · otro ángulo"],
      ["reLongitud", "Remo · longitud correas"],
      ["reReps", "Remo · reps", "reps"],
    ],
  },
  {
    titulo: "6 · Cardio",
    campos: [
      ["stRef", "Referencia altura"],
      ["stRefOtra", "Otra referencia"],
      ["stSubidas", "2-minute step · subidas", "subidas"],
      ["stFcPico", "FC pico", "ppm"],
      ["stBorg", "Borg 0-10"],
      ["stIncidencias", "Paradas o incidencias"],
      ["cuesta", "Test cuesta"],
      ["cuestaNotas", "Test cuesta · notas"],
    ],
  },
  {
    titulo: "7 · Objetivos y cierre",
    campos: [
      ["grabaCierre", "Audio grabado"],
      ["reaccion", "Reacción a los tests"],
      ["obj3m", "Objetivos a 3 meses"],
      ["vis12m", "Visión a 12 meses"],
      ["miedosCierre", "Miedos y preocupaciones"],
      ["feedbackOnline", "Feedback operativo online"],
      ["cierre", "Cierre"],
      ["canalFicha", "Canal para la ficha"],
    ],
  },
  {
    titulo: "8 · Notas post-sesión",
    campos: [
      ["senales", "Señales / observaciones"],
      ["rapport", "Rapport y compromiso"],
      ["pendientes", "Pendiente de recibir"],
      ["pendientesOtras", "Otros pendientes"],
    ],
  },
  { titulo: "9 · Obsidian", campos: [["obsidian", "Hecho"]] },
];

function valor(d: Datos, k: string, unidad?: string): string {
  const v = d[k];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(" · ");
  if (typeof v !== "string" || !v.trim()) return "";
  return unidad ? `${v.trim()} ${unidad}` : v.trim();
}

const COLOR: Record<Nivel, [string, string]> = {
  bien: ["#E7F4EA", "#1E7B3A"],
  regular: ["#FFF4DD", "#9A6400"],
  mal: ["#FDECEB", "#B3261E"],
};

const etiquetaNivel = (n: Nivel | null, texto?: string) =>
  n
    ? `<span class="nivel" style="background:${COLOR[n][0]};color:${COLOR[n][1]}">${esc(texto ?? NIVEL_ETIQUETA[n])}</span>`
    : texto
      ? `<span class="suave">${esc(texto)}</span>`
      : "";

function documento(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; color: #24211d; font-size: 10.5pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .marca { font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: #C47800; margin: 0 0 4px; }
  h1 { font-size: 20pt; margin: 0; letter-spacing: -.01em; color: #0F2240; }
  .sub { color: #776f64; margin: 2px 0 18px; font-size: 10pt; }
  h2 { font-size: 11.5pt; color: #0F2240; margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #e7dfd3; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 6px; vertical-align: top; border-bottom: 1px solid #f0ebe3; }
  td.k { width: 36%; color: #5b544b; }
  tr { break-inside: avoid; }
  .nivel { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 8.5pt; font-weight: 600; }
  .suave { color: #776f64; }
  .nota { color: #776f64; font-style: italic; font-size: 9pt; }
  .alerta { border-left: 3px solid #B3261E; background: #FDECEB; color: #8c1d18; padding: 6px 10px; margin: 0 0 6px; border-radius: 4px; }
  .caja { border: 1px solid #e7dfd3; border-radius: 8px; padding: 10px 12px; break-inside: avoid; }
  .dos { display: flex; gap: 10px; margin-bottom: 4px; }
  .dos > div { flex: 1; }
  .cita { margin: 4px 0; }
  .cita b { display: inline-block; min-width: 82px; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: #9d9488; font-weight: 600; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  .pie { margin-top: 26px; color: #9d9488; font-size: 8pt; }
  @media screen { body { max-width: 780px; margin: 24px auto; padding: 0 20px; } }
</style></head><body>${cuerpo}</body></html>`;
}

function cabecera(d: Datos, tipo: string): string {
  const cliente = txt(d, "cliente") || "Sin nombre";
  const fecha = [txt(d, "fecha"), txt(d, "hora")].filter(Boolean).join(" · ");
  return `<p class="marca">Entrenatzaile · Alain Zulaika</p><h1>${esc(cliente)}</h1><p class="sub">${esc(tipo)}${fecha ? ` · ${esc(fecha)}` : ""}</p>`;
}

function nombreArchivo(d: Datos, tipo: string): string {
  const limpio = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return ["valoracion", limpio(txt(d, "cliente")) || "sin-nombre", txt(d, "fecha"), tipo].filter(Boolean).join("_");
}

export function htmlNotas(d: Datos): string {
  let cuerpo = cabecera(d, "Notas de la valoración inicial");

  // PAR-Q+ vinculado y lo que implica para los tests.
  const parq = d.parq as { resultado: ResultadoParq; sis: string[]; sisIds?: string[]; enviado_en: string } | undefined;
  if (parq) {
    const criterio = criterioTests(parq.sisIds ?? idsDesdeTextos(parq.sis));
    const lista = (nivel: string) => criterio.filter((c) => c.nivel === nivel).map((c) => TESTS[c.test]);
    cuerpo += `<h2>PAR-Q+</h2><div class="caja">
      <p style="margin:0 0 4px"><b>${esc(RESULTADO_ETIQUETA[parq.resultado] ?? parq.resultado)}</b> · recibido ${esc(new Date(parq.enviado_en).toLocaleDateString("es-ES"))}</p>
      ${parq.sis.length ? `<ul>${parq.sis.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : `<p class="suave" style="margin:0">Todo «no».</p>`}
      ${lista("no").length ? `<p style="margin:8px 0 0"><b style="color:#B3261E">No hacer:</b> ${esc(lista("no").join(" · "))}</p>` : ""}
      ${lista("precaucion").length ? `<p style="margin:2px 0 0"><b style="color:#9A6400">Con precaución:</b> ${esc(lista("precaucion").join(" · "))}</p>` : ""}
    </div>`;
  }

  const alertas = generarInforme(d).alertas;
  if (alertas.length) cuerpo += alertas.map((x) => `<p class="alerta">${esc(x)}</p>`).join("");

  // Valores calculados que no están como campo.
  const extra: Record<string, [string, string][]> = {
    "0 · Datos previos": imc(d) ? [["IMC", `${imc(d)!.valor.toFixed(1).replace(".", ",")} · ${imc(d)!.etiqueta}`]] : [],
    "FC en reposo": num(d, "fcReposo") !== null ? [["Lectura", lecturaFcReposo(num(d, "fcReposo")!).etiqueta]] : [],
    "5 · Fuerza-función y equilibrio": (["Izq", "Dch"] as const)
      .filter((l) => mejorMonopodal(d, l) !== null)
      .map((l) => [`Monopodal ${l === "Izq" ? "IZQ" : "DCH"} · mejor`, `${mejorMonopodal(d, l)} s`] as [string, string]),
  };

  for (const b of NOTAS) {
    const filas = [
      ...b.campos.map(([k, et, u]) => [et, valor(d, k, u)] as [string, string]),
      ...(extra[b.titulo] ?? []),
    ].filter(([, v]) => v);
    if (!filas.length) continue;
    cuerpo += `<h2>${esc(b.titulo)}</h2><table>${filas
      .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join("")}</table>`;
  }

  if (txt(d, "informeNotas")) cuerpo += `<h2>Mi lectura</h2><p>${esc(txt(d, "informeNotas"))}</p>`;
  cuerpo += `<p class="pie">Documento interno. Contiene datos de salud.</p>`;
  return documento(nombreArchivo(d, "notas"), cuerpo);
}

export function htmlInforme(d: Datos): string {
  const inf = generarInforme(d);
  let cuerpo = cabecera(d, "Valoración inicial · conclusiones");

  // Sin las alertas: son avisos para mí (banderas sin aclarar, dolor…), no
  // para el documento que se lleva la persona.

  if (inf.fuertes.length || inf.trabajar.length) {
    const lista = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="suave">—</p>`);
    cuerpo += `<div class="dos">
      <div class="caja" style="background:#F3FAF5;border-color:#BFE3C8"><b style="color:#1E7B3A">Puntos fuertes</b>${lista(inf.fuertes)}</div>
      <div class="caja" style="background:#FFFAF0;border-color:#F2DBA6"><b style="color:#9A6400">A trabajar</b>${lista(inf.trabajar)}</div>
    </div>`;
  }

  for (const b of inf.bloques) {
    cuerpo += `<h2>${esc(b.titulo)}</h2><table>${b.items
      .map(
        (it) => `<tr>
          <td class="k"><b style="color:#24211d">${esc(it.titulo)}</b>${it.nota ? `<br><span class="nota">${esc(it.nota)}</span>` : ""}</td>
          <td>${esc(it.valor)}${it.lectura ? `<br><span class="suave">${esc(it.lectura)}</span>` : ""}</td>
          <td style="width:90px;text-align:right">${etiquetaNivel(it.nivel)}</td>
        </tr>`
      )
      .join("")}</table>`;
  }

  if (inf.objetivos.length) {
    cuerpo += `<h2>Lo que me has contado</h2><div class="caja">${inf.objetivos
      .map((o) => `<p class="cita"><b>${esc(o.etiqueta)}</b> «${esc(o.texto)}»</p>`)
      .join("")}</div>`;
  }

  if (txt(d, "informeNotas")) cuerpo += `<h2>Mi lectura</h2><p>${esc(txt(d, "informeNotas"))}</p>`;

  cuerpo += `<p class="pie">Valoración realizada por Alain Zulaika · Entrenatzaile. Los baremos son orientativos y no sustituyen una valoración médica.</p>`;
  return documento(nombreArchivo(d, "informe"), cuerpo);
}

// Abre el documento y lanza imprimir. Hay que llamarlo desde un clic, o el
// navegador bloquea la ventana.
export function abrirPdf(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  const imprimir = () => {
    w.focus();
    w.print();
  };
  if (w.document.readyState === "complete") setTimeout(imprimir, 150);
  else w.addEventListener("load", () => setTimeout(imprimir, 150));
  return true;
}
