// Prueba de regresión: el Registro no debe crecer en pasadas sucesivas del espejo.
import assert from "node:assert";
import { ficha, registroDe } from "./espejo-vault.mjs";
const c = { id: 1, nombre: "Test", tipo: "centro", notas: "" };
const registro = [
  { origen: "vault", orden: 1, raw: "- 2026-11-02 · Sistema · Ficha generada", fecha: "2026-11-02", texto: "Ficha generada", canal: "Sistema" },
  { origen: "sistema", fecha: "2026-11-03", canal: "Mail", texto: "mail 1 enviado", creado_en: "2026-11-03T10:00:00Z" },
  { origen: "panel", fecha: "2026-11-04", canal: "Recibido", texto: "Responden", creado_en: "2026-11-04T10:00:00Z" },
  { origen: "manual", fecha: "2026-11-06", canal: "Manual", texto: "Recibido · Responde la vicedirectora", raw: "- 2026-11-06 · Recibido · Responde la vicedirectora", creado_en: "2026-11-06T10:00:00Z" },
];
let cuerpo = ficha(c, registro); // primera escritura (sin Registro previo)
const cuenta = (t) => registroDe(t.split("\n---\n")[1] ?? t).length;
const n0 = cuenta(cuerpo);
for (let i = 0; i < 6; i++) {
  const m = /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(cuerpo);
  cuerpo = ficha(c, registro, m[1]); // pasada del espejo con Registro verbatim
}
assert.strictEqual(cuenta(cuerpo), n0, `el Registro ha crecido: ${n0} -> ${cuenta(cuerpo)}`);
// Y un Registro ya limpio al que le falta una línea del panel: se añade UNA vez
const sinPanel = cuerpo.replace(/^- 2026-11-04.*\n/m, "");
const m2 = /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(sinPanel);
let nuevo = ficha(c, registro, m2[1]);
assert.strictEqual(cuenta(nuevo), n0, "debía recuperar exactamente la línea que faltaba");
for (let i = 0; i < 3; i++) nuevo = ficha(c, registro, /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(nuevo)[1]);
assert.strictEqual(cuenta(nuevo), n0);
console.log("OK: Registro estable en pasadas sucesivas (" + n0 + " líneas)");
