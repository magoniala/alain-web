// Pruebas de lib/ayto-municipio-reglas.ts (regla del Mail 1 al ayuntamiento y pistas para los centros). npm test
import test from "node:test";
import assert from "node:assert/strict";
import { reglaMail1Municipio, mismoMunicipio, enEmbudo, charlaCobradaReciente, pistaDeLocalidad, lineaPistaCentro } from "../../lib/ayto-municipio-reglas.ts";

const HOY = "2026-11-27";
const evento = (centro_id: string, fecha_evento: string, fecha_cobro: string | null, estado_evento = "ejecutado") => ({ centro_id, fecha_evento, fecha_cobro, estado_evento });

test("mismoMunicipio: tildes, mayúsculas y nombres dobles", () => {
  assert.ok(mismoMunicipio("Beasain", "beasain"));
  assert.ok(mismoMunicipio("Arrasate/Mondragón", "Mondragon"));
  assert.ok(mismoMunicipio("Donostia/San Sebastián", "Donostia"));
  assert.ok(!mismoMunicipio("Hernani", "Beasain"));
  assert.ok(!mismoMunicipio(null, "Beasain"));
});

test("enEmbudo: fuera solo 7 Ganado y 8; los aparcados cuentan", () => {
  assert.ok(enEmbudo("3.5 recordatorio 1 enviado"));
  assert.ok(enEmbudo("9 Aparcado (con fecha de reactivación)"));
  assert.ok(enEmbudo("0 Por llamar"));
  assert.ok(!enEmbudo("7 Ganado"));
  assert.ok(!enEmbudo("8 Descartado"));
});

test("charlaCobradaReciente: hecha, cobrada, no cancelada y de los últimos 12 meses", () => {
  assert.ok(charlaCobradaReciente(evento("a", "2026-11-09", "2026-10-22", "confirmado"), HOY));
  assert.ok(!charlaCobradaReciente(evento("a", "2026-11-09", null), HOY)); // sin cobrar
  assert.ok(!charlaCobradaReciente(evento("a", "2026-12-15", "2026-11-01"), HOY)); // aún no se ha dado
  assert.ok(!charlaCobradaReciente(evento("a", "2025-11-01", "2025-11-01"), HOY)); // hace más de 12 meses
  assert.ok(!charlaCobradaReciente(evento("a", "2026-11-09", "2026-10-22", "cancelado"), HOY));
});

test("Hernani: charla cobrada en Hernani BHI y Aratz Ikastola en el embudo → tarjeta con aviso", () => {
  const r = reglaMail1Municipio({
    hoy: HOY,
    centros: [{ id: "bhi", nombre: "Hernani BHI", estado: "7 Ganado" }, { id: "aratz", nombre: "Aratz Ikastola", estado: "3.5 recordatorio 1 enviado" }],
    eventos: [evento("bhi", "2026-11-09", "2026-10-22", "confirmado")],
  });
  assert.deepEqual(r, { accion: "aviso", centro: "Hernani BHI", fecha: "2026-11-09", otros: ["Aratz Ikastola"] });
});

test("Solo el centro de la charla (o el resto ganados/descartados) → no sale, hasta 12 meses después", () => {
  const r = reglaMail1Municipio({
    hoy: HOY,
    centros: [{ id: "bhi", nombre: "Hernani BHI", estado: "9 Aparcado (con fecha de reactivación)" }, { id: "x", nombre: "Otro", estado: "8 Descartado" }],
    eventos: [evento("bhi", "2026-11-09", "2026-10-22")],
  });
  assert.deepEqual(r, { accion: "saltar", centro: "Hernani BHI", fecha: "2026-11-09", hasta: "2027-11-10" });
});

test("Beasain: sin charla cobrada → Mail 1 normal; eventos de otros municipios no cuentan", () => {
  const r = reglaMail1Municipio({
    hoy: HOY,
    centros: [{ id: "b1", nombre: "Beasain BHI", estado: "9 Aparcado" }],
    eventos: [evento("fuera", "2026-11-09", "2026-10-22")],
  });
  assert.deepEqual(r, { accion: "normal" });
});

test("pistaDeLocalidad y línea del Registro", () => {
  const pistas = [{ localidad: "Beasain", pista_para_centros: "La ayuda la piden los centros" }, { localidad: "Hernani", pista_para_centros: null }];
  assert.equal(pistaDeLocalidad(pistas, "BEASAIN")?.pista_para_centros, "La ayuda la piden los centros");
  assert.equal(pistaDeLocalidad(pistas, "Hernani"), null);
  assert.equal(lineaPistaCentro("Ayuntamiento de Beasain", " hola "), "Recado de [[Ayuntamiento de Beasain]] para los centros: hola");
});
