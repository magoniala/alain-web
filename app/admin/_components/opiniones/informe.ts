// Informe visual (PDF) de las opiniones de un evento, para quien lo organizó.
//
// Mismo sistema que el PDF de la valoración: no hay librería de PDF; se arma
// un HTML pensado para A4, se abre en una ventana nueva y se lanza imprimir,
// donde se elige «Guardar como PDF». El título del documento es el nombre de
// archivo que propone el navegador.
//
// Reglas (19-11-2026):
// - Anónimo: ni nombres ni correos. El formulario avisa de que la opinión
//   «puede compartirse de forma anónima con quien organizó el evento».
// - «¿Qué mejorarías?» es privado: no entra nunca.
// - Sale lo que se ve en la lista del panel (por defecto, todo menos archivado).

import { NOTAS, NOTA_CORTO, NOTA_EMOJI, type Nota } from "@/lib/opinion";

export type OpinionInforme = {
  nota: Nota;
  texto_peques: string | null;
  texto_adulto: string | null;
  palabra: string | null;
  destacado: boolean;
  idioma: "es" | "eu";
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const coma = (n: number, dec = 1) => n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const limpio = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const COLOR: Record<Nota, string> = { 4: "#0F2240", 3: "#3D6A9E", 2: "#B9B2A6", 1: "#B3261E" };
const MAX_FRASES = 14;

/** Palabras agrupadas sin distinguir mayúsculas ni tildes; se muestra la forma más repetida. */
function palabras(lista: OpinionInforme[]): { palabra: string; veces: number }[] {
  const grupos = new Map<string, { formas: Map<string, number>; veces: number }>();
  for (const o of lista) {
    const p = o.palabra?.trim().replace(/[.!¡¿?]+$/g, "").replace(/^[¡¿]+/, "").trim();
    if (!p) continue;
    const clave = limpio(p);
    if (!clave) continue;
    const g = grupos.get(clave) ?? { formas: new Map(), veces: 0 };
    const forma = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    g.formas.set(forma, (g.formas.get(forma) ?? 0) + 1);
    g.veces++;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .map((g) => ({ palabra: [...g.formas.entries()].sort((a, b) => b[1] - a[1])[0][0], veces: g.veces }))
    .sort((a, b) => b.veces - a.veces || a.palabra.localeCompare(b.palabra));
}

/** Frases para el informe: primero las destacadas en el panel, luego las más largas (las que más cuentan). */
function frases(lista: OpinionInforme[]): { texto: string; quien: string; destacada: boolean }[] {
  const todas = lista.flatMap((o) => [
    o.texto_peques?.trim() ? { texto: o.texto_peques.trim(), quien: o.idioma === "eu" ? "Txikiei" : "A los peques", destacada: o.destacado } : null,
    o.texto_adulto?.trim() ? { texto: o.texto_adulto.trim(), quien: o.idioma === "eu" ? "Helduari" : "Al adulto", destacada: o.destacado } : null,
  ]).filter((x): x is { texto: string; quien: string; destacada: boolean } => !!x && x.texto.length > 2);
  const vistas = new Set<string>();
  return todas
    .filter((f) => {
      const k = limpio(f.texto);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })
    .sort((a, b) => Number(b.destacada) - Number(a.destacada) || b.texto.length - a.texto.length)
    .slice(0, MAX_FRASES);
}

export function htmlInformeOpiniones(lista: OpinionInforme[], evento: string, opciones: { reservas?: number | null } = {}): { html: string; titulo: string } {
  const n = lista.length;
  const cuenta = (k: Nota) => lista.filter((o) => o.nota === k).length;
  const media = n ? lista.reduce((s, o) => s + o.nota, 0) / n : 0;
  const encanto = n ? Math.round((cuenta(4) / n) * 100) : 0;
  const positivas = n ? Math.round(((cuenta(4) + cuenta(3)) / n) * 100) : 0;
  const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const titulo = `informe-opiniones_${limpio(evento) || "evento"}_${new Date().toISOString().slice(0, 10)}`;

  const tiles = [
    { cifra: String(n), texto: n === 1 ? "respuesta" : "respuestas", extra: opciones.reservas ? `el mail de opinión llegó a ${opciones.reservas} reservas` : "" },
    { cifra: `${coma(media)}<span class="de"> / 4</span>`, texto: "nota media", extra: `${coma((media / 4) * 10)} sobre 10` },
    { cifra: `${encanto} %`, texto: `«${NOTA_CORTO[4].toLowerCase()}» ${NOTA_EMOJI[4]}`, extra: `${positivas} % entre ${NOTA_EMOJI[4]} y ${NOTA_EMOJI[3]}` },
  ];

  const barras = NOTAS.map((k) => {
    const c = cuenta(k);
    const pct = n ? (c / n) * 100 : 0;
    return `<div class="fila"><span class="emo">${NOTA_EMOJI[k]}</span><span class="lab">${esc(NOTA_CORTO[k])}</span><span class="pista"><span class="barra" style="width:${pct.toFixed(1)}%;background:${COLOR[k]}"></span></span><span class="num">${c} <span class="suave">(${Math.round(pct)} %)</span></span></div>`;
  }).join("");

  const ps = palabras(lista);
  const maxV = Math.max(1, ...ps.map((p) => p.veces));
  const nube = ps
    .map((p) => {
      const t = 10 + Math.round(((p.veces - 1) / Math.max(1, maxV - 1)) * 12);
      return `<span class="chip" style="font-size:${maxV === 1 ? 12 : t}pt">${esc(p.palabra)}${p.veces > 1 ? `<sup>×${p.veces}</sup>` : ""}</span>`;
    })
    .join("");

  const fs = frases(lista);
  const citas = fs.map((f) => `<blockquote class="cita${f.destacada ? " dest" : ""}"><p>«${esc(f.texto)}»</p><footer>${esc(f.quien)}</footer></blockquote>`).join("");

  const cuerpo = `
  <header>
    <p class="marca">Alain Zulaika · Niala</p>
    <h1>${esc(evento)}</h1>
    <p class="sub">Qué opinó el público · informe del ${esc(hoy)}</p>
  </header>
  <section class="tiles">${tiles.map((t) => `<div class="tile"><p class="cifra">${t.cifra}</p><p class="texto">${t.texto}</p>${t.extra ? `<p class="extra">${esc(t.extra)}</p>` : ""}</div>`).join("")}</section>
  <h2>¿Qué tal fue?</h2>
  <section class="barras">${barras}</section>
  ${ps.length ? `<h2>El evento en una palabra</h2><section class="nube">${nube}</section>` : ""}
  ${fs.length ? `<h2>Lo que más gustó</h2><section class="citas">${citas}</section>` : ""}
  <p class="pie">Respuestas recogidas con el formulario de opinión tras el evento, en euskera y castellano. Informe anónimo: sin nombres ni correos. Las frases se reproducen tal cual las escribió el público${fs.length === MAX_FRASES ? " (selección)" : ""}.</p>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 15mm 15mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; color: #24211d; font-size: 10.5pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .marca { font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; color: #C47800; margin: 0 0 4px; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 26pt; font-weight: 500; margin: 0; color: #0F2240; letter-spacing: -.01em; }
  .sub { color: #776f64; margin: 4px 0 18px; font-size: 10.5pt; }
  h2 { font-size: 11.5pt; color: #0F2240; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 1.5px solid #e7dfd3; break-after: avoid; }
  .tiles { display: flex; gap: 10px; }
  .tile { flex: 1; border: 1px solid #e7dfd3; border-radius: 10px; padding: 12px 14px; background: #FBF8F3; break-inside: avoid; }
  .cifra { font-family: Georgia, serif; font-size: 26pt; color: #0F2240; margin: 0; line-height: 1.1; }
  .cifra .de { font-size: 13pt; color: #9d9488; }
  .texto { margin: 2px 0 0; font-weight: 600; color: #3b352d; }
  .extra { margin: 2px 0 0; color: #776f64; font-size: 9pt; }
  .barras .fila { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .emo { width: 20px; font-size: 13pt; }
  .lab { width: 92px; color: #5b544b; }
  .pista { flex: 1; height: 14px; background: #F1ECE4; border-radius: 7px; overflow: hidden; }
  .barra { display: block; height: 100%; border-radius: 7px; }
  .num { width: 70px; text-align: right; font-weight: 600; }
  .suave { color: #9d9488; font-weight: 400; }
  .nube { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; }
  .chip { border: 1px solid #e7dfd3; border-radius: 999px; padding: 2px 10px; color: #0F2240; background: #fff; }
  .chip sup { font-size: 7pt; color: #C47800; margin-left: 2px; }
  .citas { columns: 2; column-gap: 14px; }
  .cita { break-inside: avoid; margin: 0 0 10px; padding: 8px 12px; border-left: 3px solid #e7dfd3; background: #FBF8F3; border-radius: 0 8px 8px 0; }
  .cita.dest { border-left-color: #C47800; }
  .cita p { margin: 0; font-family: Georgia, serif; font-size: 10.5pt; }
  .cita footer { margin-top: 3px; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: #9d9488; }
  .pie { margin-top: 22px; color: #9d9488; font-size: 8pt; }
  @media screen { body { max-width: 780px; margin: 24px auto; padding: 0 20px; } }
</style></head><body>${cuerpo}</body></html>`;
  return { html, titulo };
}

/** Abre el informe e imprime (Guardar como PDF). Si el navegador bloquea la ventana, lo descarga como HTML. */
export function abrirInformeOpiniones(html: string, titulo: string): "abierto" | "descargado" {
  const w = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    const imprimir = () => {
      w.focus();
      w.print();
    };
    if (w.document.readyState === "complete") setTimeout(imprimir, 250);
    else w.addEventListener("load", () => setTimeout(imprimir, 250));
    return "abierto";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `${titulo}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "descargado";
}
