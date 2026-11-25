// Pruebas de lib/charlas-sesion-orden.ts (qué entra en la sesión de llamadas y en qué orden). npm test
import test from "node:test";
import assert from "node:assert/strict";
import { rangoSesion, ordenarParaSesion } from "../../lib/charlas-sesion-orden.ts";

test("rangoSesion: 3.9 primero, fase 0-2 después, el resto fuera", () => {
  assert.equal(rangoSesion("3.9 reenviado - pendiente"), 0);
  assert.equal(rangoSesion("0 Sin contactar"), 1);
  assert.equal(rangoSesion("1 Llamando"), 1);
  assert.equal(rangoSesion("2 Contactado"), 1);
  assert.equal(rangoSesion("3 Mail inicial enviado"), null);
  assert.equal(rangoSesion("3.5 recordatorio 1 enviado"), null);
  assert.equal(rangoSesion("4 Ha respondido"), null);
  assert.equal(rangoSesion(null), null);
});

test("ordenarParaSesion: 3.9 antes que sin correo, estable, y lo demás no se mueve", () => {
  const l = [
    { n: "a", estado: "0 Sin contactar" },
    { n: "b", estado: "3 Mail inicial enviado" },
    { n: "c", estado: "3.9 reenviado - pendiente" },
    { n: "d", estado: "1 Llamando" },
    { n: "e", estado: "3.9 reenviado - pendiente" },
  ];
  assert.deepEqual(ordenarParaSesion(l).map((x) => x.n), ["c", "b", "e", "a", "d"]);
});
