// Encuesta anónima /arreta: tipos y cálculos comunes del panel.
// Una respuesta es de una charla si su `saioa` coincide con el slug; si no,
// si su fecha (hora de Madrid) cae entre fecha_inicio y margen_hasta.

export const PROBATU = ["bai", "oraindik-ez", "ez"] as const;
export type Probatu = (typeof PROBATU)[number];
export const PROBATU_ES: Record<Probatu, string> = { bai: "Sí, ya lo ha probado", "oraindik-ez": "Aún no, pero lo probará", ez: "No" };

export const SLUG_RE = /^[a-z0-9-]{1,60}$/;
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export type Charla = {
  slug: string;
  nombre: string;
  centro: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  margen_hasta: string;
};

export type Respuesta = {
  id: string;
  created_at: string;
  probatu: Probatu;
  ikasi: string | null;
  gustatu: string | null;
  gehitu: string | null;
  saioa: string | null;
  destacada: boolean;
  charla: string | null; // slug asignado (calculado, no se guarda)
};

export type Postit = {
  id: string;
  charla: string;
  sesion: string;
  alumnos: number;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  created_at: string;
};

/** Día (AAAA-MM-DD) en hora de Madrid. */
export function diaMadrid(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

/** Slug de la charla a la que pertenece una respuesta, o null. */
export function asignarCharla(r: { saioa: string | null; created_at: string }, charlas: Charla[]): string | null {
  if (r.saioa && charlas.some((c) => c.slug === r.saioa)) return r.saioa;
  const dia = diaMadrid(r.created_at);
  // Si dos ventanas se solapan, gana la charla que empezó más tarde.
  const dentro = charlas
    .filter((c) => c.fecha_inicio <= dia && dia <= c.margen_hasta)
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  return dentro[0]?.slug ?? null;
}

/** Nota media y % de 4-5 de un conjunto de post-its. */
export function resumenPostits(ps: Pick<Postit, "alumnos" | "n1" | "n2" | "n3" | "n4" | "n5">[]) {
  const n = [0, 0, 0, 0, 0];
  let alumnos = 0;
  for (const p of ps) {
    alumnos += p.alumnos;
    n[0] += p.n1; n[1] += p.n2; n[2] += p.n3; n[3] += p.n4; n[4] += p.n5;
  }
  const total = n.reduce((a, b) => a + b, 0);
  const suma = n.reduce((a, v, i) => a + v * (i + 1), 0);
  return {
    alumnos,
    notas: n,
    total,
    media: total ? suma / total : null,
    pctAltas: total ? ((n[3] + n[4]) / total) * 100 : null,
  };
}
