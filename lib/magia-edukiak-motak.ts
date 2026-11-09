// Tipos y constantes del catálogo de la plataforma de magia. Sin código de
// servidor: lo importan también los componentes del panel (cliente).

export const MOTAK = ["jolasa", "oparia", "sekretua"] as const;
export const EGOERAK = ["irekia", "emaila", "ordainpekoa", "sekretua"] as const;
export type Mota = (typeof MOTAK)[number];
export type Egoera = (typeof EGOERAK)[number];

export interface Liburutxoa {
  slug: string;
  etiketa: string;
  ordena: number;
  ikusgai: boolean;
  /**
   * Palabra mágica escrita a mano en el librillo: sin ella no se abre su
   * página (el QR es el mismo en todos los librillos). Vacía = abierto.
   * Solo viene si la columna existe (sql/magia_giltza.sql). Nunca al cliente público.
   */
  giltza?: string | null;
}

/** Para comparar la palabra mágica: sin mayúsculas, tildes, espacios ni signos. */
export function giltzaGarbia(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

export interface Edukia {
  slug: string;
  mota: Mota;
  egoera: Egoera;
  izenburua: string;
  etiketa: string | null;
  sarrera: string | null;
  materiala: string | null;
  youtube: string | null;
  /** Librillos en los que sale; vacío = en todos. */
  liburutxoak: string[];
  ordena: number;
  ikusgai: boolean;
  prezioa_cent: number | null;
}

export interface Katalogoa {
  liburutxoak: Liburutxoa[];
  edukiak: Edukia[];
  /** db = tablas con filas · kodea = catálogo del código (tablas vacías o sin crear). */
  iturria: "db" | "kodea";
  errorea: string | null;
}

export const SLUG_ONA = /^[a-z0-9][a-z0-9-]{0,40}$/;

export const EGOERA_IZENA: Record<Egoera, string> = {
  irekia: "Abierto (quien tiene el librillo)",
  emaila: "Se abre dejando el email",
  ordainpekoa: "De pago (candado; aún sin forma de pagar)",
  sekretua: "Secreto «???» (candado, sin pista)",
};
export const MOTA_IZENA: Record<Mota, string> = { jolasa: "Juego", oparia: "Regalo / extra", sekretua: "Bloque secreto" };
