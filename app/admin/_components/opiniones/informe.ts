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

import { NOTAS, NOTA_EMOJI, type Nota } from "@/lib/opinion";

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

type Idioma = "eu" | "es";
const IDIOMAS: Idioma[] = ["eu", "es"]; // primero euskera, después castellano (cada uno en su página)

// Textos del informe. El euskera lo revisa Alain.
const T: Record<Idioma, {
  sub: (fecha: string) => string;
  familias: string;
  llego: (n: number) => string;
  media: string;
  escala: (m: string) => string;
  queTal: string;
  notas: Record<Nota, string>;
  palabra: string;
  gusto: string;
  peques: string;
  adultos: string;
  pie: (seleccion: boolean) => string;
}> = {
  eu: {
    sub: (f) => `Publikoaren iritzia · ${f}`,
    familias: "familiak erantzun dute",
    llego: (n) => `iritzi-mezua ${n} familiari iritsi zitzaien`,
    media: "batez besteko nota",
    escala: (m) => `4 aurpegiko eskalan: ${m} / 4`,
    queTal: "Zer moduz joan zen?",
    notas: { 4: "Izugarri gustatu zitzaien", 3: "Oso ondo", 2: "Normal", 1: "Ez askorik" },
    palabra: "Ekitaldia hitz bakarrean",
    gusto: "Gehien gustatu zitzaiena",
    peques: "Txikiei",
    adultos: "Helduei",
    pie: (s) => `Ekitaldiaren ondoren iritzi-formularioarekin jasotako erantzunak, euskaraz eta gaztelaniaz. Txosten anonimoa: izenik eta helbide elektronikorik gabe. Esaldiak publikoak idatzi zituen bezala daude${s ? " (hautaketa)" : ""}.`,
  },
  es: {
    sub: (f) => `Qué opinó el público · informe del ${f}`,
    familias: "familias responden",
    llego: (n) => `el mail de opinión llegó a ${n} familias`,
    media: "nota media",
    escala: (m) => `en la escala de 4 caritas: ${m} / 4`,
    queTal: "¿Qué tal fue?",
    notas: { 4: "Les encantó", 3: "Muy bien", 2: "Normal", 1: "No mucho" },
    palabra: "El evento en una palabra",
    gusto: "Lo que más gustó",
    peques: "A los peques",
    adultos: "A los adultos",
    pie: (s) => `Respuestas recogidas con el formulario de opinión tras el evento, en euskera y castellano. Informe anónimo: sin nombres ni correos. Las frases se reproducen tal cual las escribió el público${s ? " (selección)" : ""}.`,
  },
};

const MESES_EU = ["urtarrilaren", "otsailaren", "martxoaren", "apirilaren", "maiatzaren", "ekainaren", "uztailaren", "abuztuaren", "irailaren", "urriaren", "azaroaren", "abenduaren"];
const fechaDe = (d: Date, i: Idioma) =>
  i === "eu" ? `${d.getFullYear()}ko ${MESES_EU[d.getMonth()]} ${d.getDate()}a` : d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

type Frase = { texto: string; quien: "peques" | "adultos"; destacada: boolean };

/** Frases para el informe: primero las destacadas en el panel, luego las más largas (las que más cuentan). */
function frases(lista: OpinionInforme[]): Frase[] {
  const todas = lista.flatMap((o): (Frase | null)[] => [
    o.texto_peques?.trim() ? { texto: o.texto_peques.trim(), quien: "peques", destacada: o.destacado } : null,
    o.texto_adulto?.trim() ? { texto: o.texto_adulto.trim(), quien: "adultos", destacada: o.destacado } : null,
  ]).filter((x): x is Frase => !!x && x.texto.length > 2);
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

/** Informe en dos versiones completas en el mismo PDF: una página (o más) en euskera y otra en castellano. */
export function htmlInformeOpiniones(lista: OpinionInforme[], evento: string, opciones: { reservas?: number | null } = {}): { html: string; titulo: string } {
  const n = lista.length;
  const cuenta = (k: Nota) => lista.filter((o) => o.nota === k).length;
  const media = n ? lista.reduce((s, o) => s + o.nota, 0) / n : 0;
  const ahora = new Date();
  const titulo = `informe-opiniones_${limpio(evento) || "evento"}_${ahora.toISOString().slice(0, 10)}`;
  const ps = palabras(lista);
  const maxV = Math.max(1, ...ps.map((p) => p.veces));
  const fs = frases(lista);

  const version = (i: Idioma) => {
    const tx = T[i];
    const tiles = [
      { cifra: String(n), texto: tx.familias, extra: opciones.reservas ? tx.llego(opciones.reservas) : "" },
      { cifra: `${coma((media / 4) * 10)}<span class="de"> / 10</span>`, texto: tx.media, extra: tx.escala(coma(media)) },
    ];
    const barras = NOTAS.map((k) => {
      const c = cuenta(k);
      const pct = n ? (c / n) * 100 : 0;
      return `<div class="fila"><span class="emo">${NOTA_EMOJI[k]}</span><span class="lab">${esc(tx.notas[k])}</span><span class="pista"><span class="barra" style="width:${pct.toFixed(1)}%;background:${COLOR[k]}"></span></span><span class="num">${c} <span class="suave">(${Math.round(pct)} %)</span></span></div>`;
    }).join("");
    const nube = ps
      .map((p) => {
        const tam = 10 + Math.round(((p.veces - 1) / Math.max(1, maxV - 1)) * 12);
        return `<span class="chip" style="font-size:${maxV === 1 ? 12 : tam}pt">${esc(p.palabra)}${p.veces > 1 ? `<sup>×${p.veces}</sup>` : ""}</span>`;
      })
      .join("");
    const citas = fs.map((f) => `<blockquote class="cita${f.destacada ? " dest" : ""}"><p>«${esc(f.texto)}»</p><footer>${esc(f.quien === "peques" ? tx.peques : tx.adultos)}</footer></blockquote>`).join("");
    return `<article class="version" lang="${i}">
  <header>
    <p class="marca">Alain Zulaika · Niala</p>
    <h1>${esc(evento)}</h1>
    <p class="sub">${esc(tx.sub(fechaDe(ahora, i)))}</p>
  </header>
  <section class="tiles">${tiles.map((x) => `<div class="tile"><p class="cifra">${x.cifra}</p><p class="texto">${esc(x.texto)}</p>${x.extra ? `<p class="extra">${esc(x.extra)}</p>` : ""}</div>`).join("")}</section>
  <h2>${esc(tx.queTal)}</h2>
  <section class="barras">${barras}</section>
  ${ps.length ? `<h2>${esc(tx.palabra)}</h2><section class="nube">${nube}</section>` : ""}
  ${fs.length ? `<h2>${esc(tx.gusto)}</h2><section class="citas">${citas}</section>` : ""}
  <p class="pie">${esc(tx.pie(fs.length === MAX_FRASES))}</p>
</article>`;
  };
  const cuerpo = IDIOMAS.map(version).join("");

  const html = `<!doctype html>
<html lang="eu"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 15mm 15mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; color: #24211d; font-size: 10.5pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .version + .version { break-before: page; }
  .marca { font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; color: #C47800; margin: 0 0 4px; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 26pt; font-weight: 500; margin: 0; color: #0F2240; letter-spacing: -.01em; }
  .sub { color: #776f64; margin: 4px 0 18px; font-size: 10.5pt; }
  h2 { font-size: 11.5pt; color: #0F2240; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 1.5px solid #e7dfd3; break-after: avoid; }
  .tiles { display: flex; gap: 10px; }
  .tile { flex: 1; border: 1px solid #e7dfd3; border-radius: 10px; padding: 12px 14px; background: #FBF8F3; break-inside: avoid; }
  .cifra { font-family: Georgia, serif; font-size: 28pt; color: #0F2240; margin: 0; line-height: 1.1; }
  .cifra .de { font-size: 14pt; color: #9d9488; }
  .texto { margin: 2px 0 0; font-weight: 600; color: #3b352d; }
  .extra { margin: 2px 0 0; color: #776f64; font-size: 9pt; }
  .barras .fila { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .emo { width: 20px; font-size: 13pt; }
  .lab { width: 165px; color: #5b544b; }
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
  @media screen { body { max-width: 780px; margin: 24px auto; padding: 0 20px; } .version + .version { margin-top: 48px; padding-top: 32px; border-top: 2px dashed #e7dfd3; } }
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
