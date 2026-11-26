// Pruebas de lib/preventa-reglas.ts (fases, oferta por correo, contador, devoluciones). npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  accesoHasta,
  casoRecuento,
  contar,
  devolucionTrasRecuento,
  faseEn,
  finDesistimiento,
  ofertaPara,
  resultado,
  type CompraRegla,
} from "../../lib/preventa-reglas.ts";

const pagada = (email: string, producto: CompraRegla["producto"], extra: Partial<CompraRegla> = {}): CompraRegla => ({
  email,
  producto,
  estado: "pagado",
  importe_cent: producto === "B" ? 700 : producto === "A" ? 1700 : 1000,
  devuelto_cent: 0,
  ...extra,
});

test("faseEn: cierres a las 23:59 de Madrid", () => {
  assert.equal(faseEn(new Date("2026-11-30T23:59:00+01:00")), "antes");
  assert.equal(faseEn(new Date("2026-12-01T00:00:00+01:00")), "B");
  assert.equal(faseEn(new Date("2026-12-04T23:59:59+01:00")), "B");
  assert.equal(faseEn(new Date("2026-12-05T00:00:00+01:00")), "A");
  assert.equal(faseEn(new Date("2026-12-09T23:59:59+01:00")), "A");
  assert.equal(faseEn(new Date("2026-12-10T00:00:00+01:00")), "cerrada");
});

test("ofertaPara: B sola, A, subida y ya la tiene", () => {
  assert.deepEqual(ofertaPara("B", []), { tipo: "comprar", producto: "B", importe_cent: 700 });
  assert.deepEqual(ofertaPara("B", [pagada("x@x.es", "B")]), { tipo: "ya_la_tiene", producto: "B" });
  assert.deepEqual(ofertaPara("A", []), { tipo: "comprar", producto: "A", importe_cent: 1700 });
  assert.deepEqual(ofertaPara("A", [pagada("x@x.es", "B")]), { tipo: "comprar", producto: "subida", importe_cent: 1000 });
  assert.deepEqual(ofertaPara("A", [pagada("x@x.es", "B"), pagada("x@x.es", "subida")]), { tipo: "ya_la_tiene", producto: "A" });
  // Compró B y la devolvió entera: paga A completa.
  assert.deepEqual(ofertaPara("A", [pagada("x@x.es", "B", { estado: "devuelto", devuelto_cent: 700 })]).tipo, "comprar");
  assert.equal((ofertaPara("A", [pagada("x@x.es", "B", { estado: "devuelto", devuelto_cent: 700 })]) as { producto: string }).producto, "A");
  // Pendiente o expirada no cuenta como comprada.
  assert.deepEqual(ofertaPara("B", [pagada("x@x.es", "B", { estado: "pendiente" })]).tipo, "comprar");
  assert.deepEqual(ofertaPara("antes", []), { tipo: "cerrada", fase: "antes" });
  assert.deepEqual(ofertaPara("cerrada", []), { tipo: "cerrada", fase: "cerrada" });
});

test("contar: personas, no pagos; A suma en B; familia, prueba y devueltas fuera", () => {
  const compras = [
    pagada("ana@x.es", "B"),
    pagada("ANA@x.es", "subida"), // la misma persona sube: 1 en B y 1 en A
    pagada("bea@x.es", "A"), // 1 en A y 1 en B
    pagada("carlos@x.es", "B"),
    pagada("ama@x.es", "B"), // familia
    pagada("alain@x.es", "A", { prueba: true }),
    pagada("dani@x.es", "B", { estado: "devuelto", devuelto_cent: 700 }),
    pagada("eva@x.es", "B", { estado: "pendiente" }),
  ];
  assert.deepEqual(contar(compras, ["Ama@x.es"]), { A: 2, B: 3 });
  const r = resultado(compras, ["ama@x.es"]);
  assert.equal(r.llegaB, true);
  assert.equal(r.llegaA, false);
});

test("devolucionTrasRecuento", () => {
  const nada = { llegaB: false, llegaA: false };
  const soloB = { llegaB: true, llegaA: false };
  const todo = { llegaB: true, llegaA: true };
  assert.equal(devolucionTrasRecuento(pagada("a", "B"), nada), 700);
  assert.equal(devolucionTrasRecuento(pagada("a", "A"), nada), 1700);
  assert.equal(devolucionTrasRecuento(pagada("a", "subida"), nada), 1000);
  assert.equal(devolucionTrasRecuento(pagada("a", "B"), soloB), 0);
  assert.equal(devolucionTrasRecuento(pagada("a", "A"), soloB), 1000);
  assert.equal(devolucionTrasRecuento(pagada("a", "subida"), soloB), 1000);
  assert.equal(devolucionTrasRecuento(pagada("a", "A"), todo), 0);
  // Ya devuelta en parte o entera, o de prueba: no se devuelve otra vez.
  assert.equal(devolucionTrasRecuento(pagada("a", "A", { estado: "devuelto_parcial", devuelto_cent: 1000 }), soloB), 0);
  assert.equal(devolucionTrasRecuento(pagada("a", "B", { estado: "devuelto", devuelto_cent: 700 }), nada), 0);
  assert.equal(devolucionTrasRecuento(pagada("a", "B", { prueba: true }), nada), 0);
});

test("casoRecuento", () => {
  assert.equal(casoRecuento([pagada("a", "B")], { llegaB: false, llegaA: false }), "nada_llega");
  assert.equal(casoRecuento([pagada("a", "A")], { llegaB: true, llegaA: false }), "b_si_a_no");
  assert.equal(casoRecuento([pagada("a", "B")], { llegaB: true, llegaA: false }), "todo_llega");
  assert.equal(casoRecuento([pagada("a", "A")], { llegaB: true, llegaA: true }), "todo_llega");
  assert.equal(casoRecuento([pagada("a", "B", { estado: "devuelto", devuelto_cent: 700 })], { llegaB: true, llegaA: true }), null);
});

test("desistimiento (15 + 15) y acceso (24 meses)", () => {
  const compra = new Date("2026-12-02T10:00:00+01:00");
  assert.equal(finDesistimiento(compra, null).toISOString(), "2026-12-17T09:00:00.000Z");
  assert.equal(finDesistimiento(compra, new Date("2026-12-28T09:00:00+01:00")).toISOString(), "2027-01-12T08:00:00.000Z");
  assert.equal(accesoHasta(compra).toISOString(), "2028-12-02T09:00:00.000Z");
});
