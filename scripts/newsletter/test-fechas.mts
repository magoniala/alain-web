// Pruebas de lib/newsletter-fechas.ts (siguiente día libre al confirmar un mail
// devuelto a «Por confirmar»). npm test
import test from "node:test";
import assert from "node:assert/strict";
import { fechaMadrid, horaMadrid, madridAInstante, siguienteDiaLibre } from "../../lib/newsletter-fechas.ts";

test("madridAInstante: invierno (UTC+1) y verano (UTC+2)", () => {
  assert.equal(madridAInstante("2026-11-20", "19:15").toISOString(), "2026-11-20T18:15:00.000Z");
  assert.equal(madridAInstante("2026-07-20", "19:15").toISOString(), "2026-07-20T17:15:00.000Z");
  // Día del cambio de hora (29-mar-2026, 02:00 → 03:00): a las 19:15 ya es verano.
  assert.equal(madridAInstante("2026-03-29", "19:15").toISOString(), "2026-03-29T17:15:00.000Z");
  assert.equal(madridAInstante("2026-10-25", "19:15").toISOString(), "2026-10-25T18:15:00.000Z");
});

test("fechaMadrid/horaMadrid ida y vuelta", () => {
  const d = madridAInstante("2026-12-24", "07:05");
  assert.equal(fechaMadrid(d), "2026-12-24");
  assert.equal(horaMadrid(d), "07:05");
  assert.equal(horaMadrid(madridAInstante("2026-12-24", "00:30")), "00:30");
});

test("siguienteDiaLibre: misma hora, primer día futuro sin envío", () => {
  const ahora = new Date("2026-11-20T12:00:00Z"); // vie 20-nov 13:00 Madrid
  const original = madridAInstante("2026-11-10", "19:15").toISOString();
  // Hoy 19:15 aún no ha pasado y está libre → hoy.
  assert.equal(siguienteDiaLibre(original, [], ahora).toISOString(), "2026-11-20T18:15:00.000Z");
  // Hoy ocupado (otro mail sale hoy) y mañana ocupado → pasado mañana.
  const ocupados = [madridAInstante("2026-11-20", "19:15").toISOString(), madridAInstante("2026-11-21", "19:15").toISOString()];
  assert.equal(siguienteDiaLibre(original, ocupados, ahora).toISOString(), "2026-11-22T18:15:00.000Z");
});

test("siguienteDiaLibre: si la hora de hoy ya pasó, salta a mañana", () => {
  const ahora = new Date("2026-11-20T19:00:00Z"); // 20:00 Madrid
  const original = madridAInstante("2026-11-10", "19:15").toISOString();
  assert.equal(siguienteDiaLibre(original, [], ahora).toISOString(), "2026-11-21T18:15:00.000Z");
});
