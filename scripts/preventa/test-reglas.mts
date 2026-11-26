// Pruebas de lib/preventa-reglas.ts (modelo del 26-11-2026: A 17 € con B de bonus del 1 al 4-dic). npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  accesoHasta,
  casoRecuento,
  contar,
  devolucionTrasRecuento,
  faseEn,
  finDesistimiento,
  nombrePila,
  ofertaPara,
  resultado,
  tieneA,
  tieneB,
  type CompraRegla,
} from "../../lib/preventa-reglas.ts";

const pagada = (email: string, extra: Partial<CompraRegla> = {}): CompraRegla => ({
  email,
  producto: "A",
  estado: "pagado",
  importe_cent: 1700,
  devuelto_cent: 0,
  con_bonus: true,
  ...extra,
});

test("faseEn: bonus hasta el vie 4 a las 23:59, venta hasta el mié 9 a las 23:59 (Madrid)", () => {
  assert.equal(faseEn(new Date("2026-11-30T23:59:59+01:00")), "antes");
  assert.equal(faseEn(new Date("2026-12-01T00:00:00+01:00")), "bonus");
  assert.equal(faseEn(new Date("2026-12-04T23:59:59+01:00")), "bonus");
  assert.equal(faseEn(new Date("2026-12-05T00:00:00+01:00")), "venta");
  assert.equal(faseEn(new Date("2026-12-09T23:59:59+01:00")), "venta");
  assert.equal(faseEn(new Date("2026-12-10T00:00:00+01:00")), "cerrada");
});

test("ofertaPara: siempre A a 17 €, con bonus solo en la fase de bonus", () => {
  assert.deepEqual(ofertaPara("bonus", []), { tipo: "comprar", producto: "A", importe_cent: 1700, conBonus: true });
  assert.deepEqual(ofertaPara("venta", []), { tipo: "comprar", producto: "A", importe_cent: 1700, conBonus: false });
  assert.deepEqual(ofertaPara("bonus", [pagada("x@x.es")]), { tipo: "ya_la_tiene", producto: "A" });
  assert.deepEqual(ofertaPara("venta", [pagada("x@x.es", { con_bonus: false })]), { tipo: "ya_la_tiene", producto: "A" });
  // Devuelta entera, pendiente o expirada: puede comprar otra vez.
  assert.equal(ofertaPara("venta", [pagada("x@x.es", { estado: "devuelto", devuelto_cent: 1700 })]).tipo, "comprar");
  assert.equal(ofertaPara("bonus", [pagada("x@x.es", { estado: "pendiente" })]).tipo, "comprar");
  // Una compra suelta de B del modelo anterior no impide comprar A.
  assert.equal(ofertaPara("bonus", [pagada("x@x.es", { producto: "B", importe_cent: 700, con_bonus: false })]).tipo, "comprar");
  assert.deepEqual(ofertaPara("antes", []), { tipo: "cerrada", fase: "antes" });
  assert.deepEqual(ofertaPara("cerrada", []), { tipo: "cerrada", fase: "cerrada" });
});

test("tieneA / tieneB", () => {
  assert.equal(tieneA([pagada("a")]), true);
  assert.equal(tieneB([pagada("a")]), true);
  assert.equal(tieneB([pagada("a", { con_bonus: false })]), false);
  assert.equal(tieneA([pagada("a", { estado: "devuelto", devuelto_cent: 1700 })]), false);
  assert.equal(tieneB([pagada("a", { estado: "devuelto", devuelto_cent: 1700 })]), false);
});

test("contar: personas que tienen A; prueba, familia, devueltas y pendientes fuera", () => {
  const compras = [
    pagada("ana@x.es"),
    pagada("ANA@x.es"), // compró dos veces: es una persona
    pagada("bea@x.es", { con_bonus: false }),
    pagada("ama@x.es"), // familia
    pagada("alain@x.es", { prueba: true }),
    pagada("dani@x.es", { estado: "devuelto", devuelto_cent: 1700 }),
    pagada("eva@x.es", { estado: "pendiente" }),
    pagada("fran@x.es", { producto: "B", importe_cent: 700, con_bonus: false }), // modelo anterior: no cuenta en A
  ];
  assert.deepEqual(contar(compras, ["Ama@x.es"]), { A: 2, conBonus: 1 });
  assert.equal(resultado(compras, ["ama@x.es"]).llega, false);
  assert.equal(resultado([...compras, pagada("gorka@x.es", { con_bonus: false })], ["ama@x.es"]).llega, true);
});

test("devolucionTrasRecuento: todo si no se llega, nada si se llega", () => {
  assert.equal(devolucionTrasRecuento(pagada("a"), { llega: false }), 1700);
  assert.equal(devolucionTrasRecuento(pagada("a"), { llega: true }), 0);
  assert.equal(devolucionTrasRecuento(pagada("a", { estado: "devuelto_parcial", devuelto_cent: 500 }), { llega: false }), 1200);
  assert.equal(devolucionTrasRecuento(pagada("a", { estado: "devuelto", devuelto_cent: 1700 }), { llega: false }), 0);
  assert.equal(devolucionTrasRecuento(pagada("a", { prueba: true }), { llega: false }), 0);
});

test("casoRecuento", () => {
  assert.equal(casoRecuento([pagada("a")], { llega: false }), "no_llega");
  assert.equal(casoRecuento([pagada("a")], { llega: true }), "llega");
  assert.equal(casoRecuento([pagada("a", { estado: "devuelto", devuelto_cent: 1700 })], { llega: true }), null);
  assert.equal(casoRecuento([pagada("a", { prueba: true })], { llega: true }), null);
});

test("desistimiento (15 + 15) y acceso (24 meses)", () => {
  const compra = new Date("2026-12-02T10:00:00+01:00");
  assert.equal(finDesistimiento(compra, null).toISOString(), "2026-12-17T09:00:00.000Z");
  assert.equal(finDesistimiento(compra, new Date("2026-12-28T09:00:00+01:00")).toISOString(), "2027-01-12T08:00:00.000Z");
  assert.equal(accesoHasta(compra).toISOString(), "2028-12-02T09:00:00.000Z");
});

test("nombrePila: el nombre de la tarjeta en mayúsculas se saluda bien", () => {
  assert.equal(nombrePila("ALAIN ZULAIKA FUENTE"), "Alain");
  assert.equal(nombrePila("maite"), "Maite");
  assert.equal(nombrePila("McKenzie"), "McKenzie");
  assert.equal(nombrePila("  "), null);
  assert.equal(nombrePila(null), null);
});
