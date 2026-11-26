// Reglas de la preventa de la masterclass de diciembre de 2026 (Entrenatzaile).
//
// Sin dependencias a propósito: lo importan la landing, el API, el webhook, el
// panel y las pruebas (scripts/preventa/test-reglas.mts). Todo lo que decide
// "qué se vende hoy", "cuánta gente cuenta" y "cuánto se devuelve" vive aquí y
// solo aquí.
//
// Modelo decidido por Alain el 26-11-2026 (nota del vault «2026-11-26 Encargo —
// rediseño de la preventa (A 17 € con B de bonus)»), que sustituye al de
// B 7 € / A 17 € / subida 10 €:
//   Se vende una sola masterclass: A · "Que la espalda no te pare", 17 €, del
//   mar 1 al mié 9-dic (23:59 de Madrid).
//   Bonus: quien compra del mar 1 al vie 4-dic se lleva de regalo B · "Por dónde
//   empezar a entrenar a partir de los 50". Del sáb 5 al mié 9, mismo precio,
//   sin bonus. B no se vende suelta.
//   Umbral: 3 personas distintas que compren A (sin familia ni amigos).
//   Recuento el jue 10-dic a las 9:00; el aviso a los compradores sale solo.
//   Entregas: B el lun 28-dic (solo a quien la tiene de bonus) · A el dom 10-ene.
//   Desistimiento: 15 días desde la compra + otros 15 desde que recibe el acceso.
//   Acceso: 24 meses desde la compra.
//
// Las compras "B" y "subida" son del modelo anterior (solo existe la compra de
// prueba de Alain del 26-nov, devuelta). Se siguen entendiendo, nunca se venden.
//
// Diciembre y enero son horario de invierno: Madrid = UTC+1 todas estas fechas.

export type Producto = "B" | "A" | "subida";
export type Fase = "antes" | "bonus" | "venta" | "cerrada";
export type EstadoCompra = "pendiente" | "pagado" | "devuelto" | "devuelto_parcial" | "expirado";
export type Idioma = "es" | "eu";

export const UMBRAL = 3;
export const PRECIO_CENT = 1700;

export const FECHAS = {
  inicio: new Date("2026-12-01T00:00:00+01:00"),
  finBonus: new Date("2026-12-05T00:00:00+01:00"),
  cierre: new Date("2026-12-10T00:00:00+01:00"),
  recuento: new Date("2026-12-10T09:00:00+01:00"),
  entregaB: new Date("2026-12-28T09:00:00+01:00"),
  entregaA: new Date("2027-01-10T09:00:00+01:00"),
} as const;

export const DIAS_DESISTIMIENTO = 15;
export const MESES_ACCESO = 24;

export const NOMBRE: Record<"A" | "B", Record<Idioma, string>> = {
  B: { es: "Por dónde empezar a entrenar a partir de los 50", eu: "Zer egin 50 urtetik aurrera entrenatzen hasteko" },
  A: { es: "Que la espalda no te pare", eu: "Bizkarrak ez zaitzala gelditu" },
};

/** Lo que dice la línea de Stripe y el extracto. */
export function nombreLinea(conBonus: boolean, l: Idioma): string {
  if (!conBonus) return `Masterclass · ${NOMBRE.A[l]}`;
  return l === "eu" ? `Masterclass · ${NOMBRE.A.eu} (+ ${NOMBRE.B.eu} opari)` : `Masterclass · ${NOMBRE.A.es} (+ ${NOMBRE.B.es} de regalo)`;
}

/** Qué se vende en este instante. */
export function faseEn(d: Date): Fase {
  const t = d.getTime();
  if (t < FECHAS.inicio.getTime()) return "antes";
  if (t < FECHAS.finBonus.getTime()) return "bonus";
  if (t < FECHAS.cierre.getTime()) return "venta";
  return "cerrada";
}

export interface CompraRegla {
  email: string;
  producto: Producto;
  estado: EstadoCompra;
  importe_cent: number;
  devuelto_cent: number;
  con_bonus?: boolean | null;
  prueba?: boolean | null;
}

/** Una compra cobrada que no se ha devuelto entera. */
export function vigente(c: CompraRegla): boolean {
  return (c.estado === "pagado" || c.estado === "devuelto_parcial") && c.devuelto_cent < c.importe_cent;
}

/** ¿Tiene la de la espalda? */
export function tieneA(compras: CompraRegla[]): boolean {
  return compras.some((c) => vigente(c) && c.producto !== "B");
}

/** ¿Tiene "Por dónde empezar" (de bonus, o comprada suelta con el modelo anterior)? */
export function tieneB(compras: CompraRegla[]): boolean {
  return compras.some((c) => vigente(c) && (c.producto === "B" || !!c.con_bonus));
}

export type Oferta =
  | { tipo: "comprar"; producto: "A"; importe_cent: number; conBonus: boolean }
  | { tipo: "ya_la_tiene"; producto: "A" }
  | { tipo: "cerrada"; fase: Fase };

/** Qué puede comprar este correo en esta fase, mirando lo que ya ha comprado. */
export function ofertaPara(fase: Fase, comprasDelEmail: CompraRegla[]): Oferta {
  if (fase !== "bonus" && fase !== "venta") return { tipo: "cerrada", fase };
  if (tieneA(comprasDelEmail)) return { tipo: "ya_la_tiene", producto: "A" };
  return { tipo: "comprar", producto: "A", importe_cent: PRECIO_CENT, conBonus: fase === "bonus" };
}

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

/**
 * Personas distintas que tienen la de la espalda (y cuántas de ellas con el
 * bonus). Cuenta personas, no pagos. No cuentan las compras de prueba, las
 * devueltas enteras ni los correos que Alain ha marcado como familia o amigos.
 */
export function contar(compras: CompraRegla[], excluidos: Iterable<string> = []): { A: number; conBonus: number } {
  const fuera = new Set([...excluidos].map(normalizarEmail));
  const enA = new Set<string>();
  const conBonus = new Set<string>();
  for (const c of compras) {
    if (c.prueba || !vigente(c) || c.producto === "B") continue;
    const e = normalizarEmail(c.email);
    if (fuera.has(e)) continue;
    enA.add(e);
    if (c.con_bonus) conBonus.add(e);
  }
  return { A: enA.size, conBonus: conBonus.size };
}

export interface Resultado {
  llega: boolean;
  cuenta: { A: number; conBonus: number };
}

export function resultado(compras: CompraRegla[], excluidos: Iterable<string> = []): Resultado {
  const cuenta = contar(compras, excluidos);
  return { llega: cuenta.A >= UMBRAL, cuenta };
}

/**
 * Céntimos que quedan por devolver a esta compra según el recuento: si no se
 * llega a 3, todo a todos; si se llega, nada. Lo ya devuelto (p. ej. un
 * desistimiento) se descuenta.
 */
export function devolucionTrasRecuento(c: CompraRegla, r: Pick<Resultado, "llega">): number {
  if (c.prueba || !vigente(c) || r.llega) return 0;
  return Math.max(0, c.importe_cent - c.devuelto_cent);
}

/** Qué le pasa a una persona en el recuento (para el correo del 10-dic). */
export type CasoRecuento = "llega" | "no_llega";

export function casoRecuento(comprasDelEmail: CompraRegla[], r: Pick<Resultado, "llega">): CasoRecuento | null {
  if (!comprasDelEmail.some((c) => vigente(c) && !c.prueba)) return null;
  return r.llega ? "llega" : "no_llega";
}

const DIA_MS = 24 * 3600 * 1000;

/** Último día para desistir: 15 días desde la compra y otros 15 desde que recibe el acceso. */
export function finDesistimiento(pagadoEn: Date, accesoRecibidoEn: Date | null): Date {
  const desdeCompra = pagadoEn.getTime() + DIAS_DESISTIMIENTO * DIA_MS;
  const desdeAcceso = accesoRecibidoEn ? accesoRecibidoEn.getTime() + DIAS_DESISTIMIENTO * DIA_MS : 0;
  return new Date(Math.max(desdeCompra, desdeAcceso));
}

/** Hasta cuándo puede ver los vídeos: 24 meses desde la compra. */
export function accesoHasta(pagadoEn: Date): Date {
  const d = new Date(pagadoEn.getTime());
  d.setUTCMonth(d.getUTCMonth() + MESES_ACCESO);
  return d;
}

/** "17 €" (los precios son enteros; si no, con coma). */
export function euros(cent: number): string {
  return cent % 100 === 0 ? `${cent / 100} €` : `${(cent / 100).toFixed(2).replace(".", ",")} €`;
}

/** "ALAIN ZULAIKA" → "Alain": el nombre de pila tal como se saluda. */
export function nombrePila(nombre: string | null | undefined): string | null {
  const n = nombre?.trim().split(/\s+/)[0];
  if (!n) return null;
  return n === n.toUpperCase() || n === n.toLowerCase() ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : n;
}
