// Prueba de los conversores de texto a HTML de los mails (20-11-2026).
// Se ejecuta con:  npm test   (node --test, sin dependencias)
//
// Caso que motivó el arreglo: un enlace con "_" en la URL (utm_source,
// utm_content) se rompía porque el conversor leía los "_" como cursiva.
import test from "node:test";
import assert from "node:assert/strict";
import { processText } from "../../lib/newsletter-texto.ts";
import { formatoEnLinea, textoAHtml } from "../../lib/email-markdown.ts";

const URL_UTM =
  "https://entrenatzaile.alainzulaika.com/hoja-de-ruta/capacidades?utm_source=diario&utm_content=hr5";
const ENLACE = `[Reservar mi Hoja de Ruta](${URL_UTM})`;

test("newsletter: el href conserva los _ y no hay cursivas dentro del enlace", () => {
  const html = processText(`Mira esto: ${ENLACE}`);
  assert.ok(html.includes(`<a href="${URL_UTM}" style=`), html);
  assert.ok(html.includes(">Reservar mi Hoja de Ruta</a>"), html);
  assert.ok(!html.includes("<em"), html);
});

test("newsletter: la cursiva real sigue funcionando (en otro párrafo y en el mismo)", () => {
  assert.equal(processText("Esto es _así_ de simple"), 'Esto es <em style="font-style:italic;">así</em> de simple');
  // Cursiva que envuelve un enlace con _ en la URL.
  const html = processText(`_mira ${ENLACE} ya_`);
  assert.ok(html.startsWith('<em style="font-style:italic;">mira <a href="' + URL_UTM + '"'), html);
  assert.ok(html.endsWith(" ya</em>"), html);
});

test("newsletter: varios enlaces con _ en la misma línea", () => {
  const a = "https://x.com/?utm_source=a&utm_medium=b";
  const b = "https://y.com/?utm_source=c&utm_medium=d";
  const html = processText(`[uno](${a}) y [dos](${b})`);
  assert.ok(html.includes(`href="${a}"`) && html.includes(`href="${b}"`), html);
  assert.ok(!html.includes("<em"), html);
});

test("newsletter: negrita y cursiva dentro del texto del enlace", () => {
  const html = processText(`[**ya** _mismo_](${URL_UTM})`);
  assert.ok(html.includes('<strong style="font-weight:bold;">ya</strong> <em style="font-style:italic;">mismo</em></a>'), html);
});

test("newsletter: con %5F sale exactamente igual que antes (los mails ya programados)", () => {
  const url = "https://x.com/?utm%5Fsource=diario&utm%5Fcontent=hr5";
  const html = processText(`[Reservar](${url})`);
  assert.equal(html, `<a href="${url}" style="color:#D4860A;text-decoration:underline;font-weight:bold;">Reservar</a>`);
});

test("email-markdown: mismo arreglo en los correos automáticos", () => {
  const html = formatoEnLinea(`${ENLACE} y _esto_`);
  assert.ok(html.includes(`href="${URL_UTM.replace("&", "&amp;")}"`), html);
  assert.ok(html.includes('<em style="font-style:italic;">esto</em>'), html);
  assert.equal(html.match(/<em/g)?.length, 1, html);
  const parrafos = textoAHtml(`${ENLACE}\n\nUna _cursiva_ real`);
  assert.ok(parrafos.includes("utm_source=diario"), parrafos);
  assert.ok(parrafos.includes("<em"), parrafos);
});

test("email-markdown: marcador {{hoja_ruta}} como destino y botón", () => {
  assert.ok(formatoEnLinea("[Tu ficha]({{hoja_ruta}})").includes('href="{{hoja_ruta}}"'));
  assert.ok(textoAHtml("[[Descargar](https://a.com/?utm_source=x&utm_content=y)]").includes("utm_source=x"));
});
