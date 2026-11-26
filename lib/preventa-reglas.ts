// Reglas de la preventa de las masterclasses de diciembre de 2026 (Entrenatzaile).
//
// Sin dependencias a propósito: lo importan la landing, el API, el webhook, el
// panel y las pruebas (scripts/preventa/test-reglas.mts). Todo lo que decide
// "qué se vende hoy", "cuánta gente cuenta" y "cuánto se devuelve" vive aquí y
// solo aquí.
//
// Decidido por Alain (nota del vault «2026-11-24 Preventa masterclass —
// Material para la landing», §2, §3 y §10, y chat del 26-11-2026):
//   B · "Por dónde empezar a entrenar a partir de los 50"  → 7 € sola, 1-4 dic
//   A · "Que la espalda no te pare" → 17 € con B de regalo, 5-9 dic
//   Quien ya compró B sube a A por 10 € (5-9 dic)
//   Umbral: 3 personas distintas por producto (A cuenta también en B)
//   Recuento el jue 10-dic; el aviso a los compradores sale solo
//   Entregas: B el lun 28-dic (también a quien compró A) · A el dom 10-ene
//   Desistimiento: 15 días desde la compra + otros 15 desde que recibe el acceso
//   Acceso: 24 meses desde la compra
//
// Diciembre y enero son horario de invierno: Madrid = UTC+1 todas estas fechas.

export type Producto = "B" | "A" | "subida";
export type Fase = "antes" | "B" | "A" | "cerrada";
export type EstadoCompra = "pendiente" | "pagado" | "devuelto" | "devuelto_parcial" | "expirado";
export type Idioma = "es" | "eu";

export const UMBRAL = 3;

export const PRECIO_CENT: Record<Producto, number> = { B: 700, A: 1700, subida: 1000 };

export const FECHAS = {
  inicioB: new Date("2026-12-01T00:00:00+01:00"),
  inicioA: new Date("2026-12-05T00:00:00+01:00"),
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

/** Lo que dice el extracto de la tarjeta y la línea de Stripe. */
export function nombreLinea(p: Producto, l: Idioma): string {
  if (p === "B") return `Masterclass · ${NOMBRE.B[l]}`;
  if (p === "A") return l === "eu" ? `Masterclass · ${NOMBRE.A.eu} (+ ${NOMBRE.B.eu} opari)` : `Masterclass · ${NOMBRE.A.es} (+ ${NOMBRE.B.es} de regalo)`;
  return l === "eu" ? `Masterclass · ${NOMBRE.A.eu} (B erosita zenuen: aldea)` : `Masterclass · ${NOMBRE.A.es} (ya tenías la de empezar: diferencia)`;
}

/** Qué se vende en este instante. */
export function faseEn(d: Date): Fase {
  const t = d.getTime();
  if (t < FECHAS.inicioB.getTime()) return "antes";
  if (t < FECHAS.inicioA.getTime()) return "B";
  if (t < FECHAS.cierre.getTime()) return "A";
  return "cerrada";
}

export interface CompraRegla {
  email: string;
  producto: Producto;
  estado: EstadoCompra;
  importe_cent: number;
  devuelto_cent: number;
  prueba?: boolean | null;
}

/** Una compra cobrada que no se ha devuelto entera. */
export function vigente(c: CompraRegla): boolean {
  return (c.estado === "pagado" || c.estado === "devuelto_parcial") && c.devuelto_cent < c.importe_cent;
}

/** ¿Tiene B (sola, o como regalo de A)? */
export function tieneB(compras: CompraRegla[]): boolean {
  return compras.some(vigente);
}

/** ¿Tiene A? Si se le devolvió parte de A o de la subida, A ya no es suya. */
export function tieneA(compras: CompraRegla[]): boolean {
  return compras.some((c) => vigente(c) && c.producto !== "B" && c.devuelto_cent === 0);
}

export type Oferta =
  | { tipo: "comprar"; producto: Producto; importe_cent: number }
  | { tipo: "ya_la_tiene"; producto: "A" | "B" }
  | { tipo: "cerrada"; fase: Fase };

/** Qué puede comprar este correo en esta fase, mirando lo que ya ha comprado. */
export function ofertaPara(fase: Fase, comprasDelEmail: CompraRegla[]): Oferta {
  if (fase === "B") {
    if (tieneB(comprasDelEmail)) return { tipo: "ya_la_tiene", producto: "B" };
    return { tipo: "comprar", producto: "B", importe_cent: PRECIO_CENT.B };
  }
  if (fase === "A") {
    if (tieneA(comprasDelEmail)) return { tipo: "ya_la_tiene", producto: "A" };
    if (tieneB(comprasDelEmail)) return { tipo: "comprar", producto: "subida", importe_cent: PRECIO_CENT.subida };
    return { tipo: "comprar", producto: "A", importe_cent: PRECIO_CENT.A };
  }
  return { tipo: "cerrada", fase };
}

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

/**
 * Personas distintas por producto. Cuenta personas, no pagos: quien compra A
 * suma en A y en B; quien sube de B a A cuenta una sola vez en cada uno. No
 * cuentan las compras de prueba, las devueltas enteras ni los correos que
 * Alain ha marcado como familia o amigos.
 */
export function contar(compras: CompraRegla[], excluidos: Iterable<string> = []): { A: number; B: number } {
  const fuera = new Set([...excluidos].map(normalizarEmail));
  const enB = new Set<string>();
  const enA = new Set<string>();
  for (const c of compras) {
    if (c.prueba || !vigente(c)) continue;
    const e = normalizarEmail(c.email);
    if (fuera.has(e)) continue;
    enB.add(e);
    if (c.producto !== "B") enA.add(e);
  }
  return { A: enA.size, B: enB.size };
}

export interface Resultado {
  llegaB: boolean;
  llegaA: boolean;
  cuenta: { A: number; B: number };
}

export function resultado(compras: CompraRegla[], excluidos: Iterable<string> = []): Resultado {
  const cuenta = contar(compras, excluidos);
  // A cuenta también en B, así que A no puede llegar sin que llegue B.
  return { llegaB: cuenta.B >= UMBRAL, llegaA: cuenta.A >= UMBRAL, cuenta };
}

/**
 * Céntimos que quedan por devolver a esta compra según el recuento.
 *   No llega B            → todo, a todos.
 *   Llega B y no llega A  → 10 € a quien compró A (se queda con B) y la subida
 *                           entera (10 €) a quien subió. "O todo si lo prefiere"
 *                           lo decide la persona contestando al correo: eso lo
 *                           hace Alain a mano desde el panel.
 *   Llegan las dos        → nada.
 * Lo ya devuelto (p. ej. un desistimiento) se descuenta.
 */
export function devolucionTrasRecuento(c: CompraRegla, r: Pick<Resultado, "llegaA" | "llegaB">): number {
  if (c.prueba || !vigente(c)) return 0;
  let objetivo = 0;
  if (!r.llegaB) objetivo = c.importe_cent;
  else if (!r.llegaA && c.producto !== "B") objetivo = Math.min(PRECIO_CENT.subida, c.importe_cent);
  return Math.max(0, objetivo - c.devuelto_cent);
}

/** Qué le pasa a una persona en el recuento (para el correo del 10-dic). */
export type CasoRecuento = "todo_llega" | "nada_llega" | "b_si_a_no";

export function casoRecuento(comprasDelEmail: CompraRegla[], r: Pick<Resultado, "llegaA" | "llegaB">): CasoRecuento | null {
  const vigentes = comprasDelEmail.filter((c) => vigente(c) && !c.prueba);
  if (vigentes.length === 0) return null;
  if (!r.llegaB) return "nada_llega";
  const comproA = vigentes.some((c) => c.producto !== "B");
  if (comproA && !r.llegaA) return "b_si_a_no";
  return "todo_llega";
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

/** "7 €" / "17 €" (los precios son enteros; si no, con coma). */
export function euros(cent: number): string {
  return cent % 100 === 0 ? `${cent / 100} €` : `${(cent / 100).toFixed(2).replace(".", ",")} €`;
}
