// Catálogo vivo de la plataforma de magia: librillos y contenidos, leídos de
// Supabase (magia_liburutxoak, magia_edukiak; sql/magia_edukiak.sql) y
// editables en /admin › Magia-tailerrak. Si las tablas no existen o están
// vacías, se usa el catálogo escrito en lib/magia-catalogo.ts, así que un
// despliegue antes del SQL no rompe nada.

import { JOLASAK, LIBURUTXOAK, LIBURUTXO_ORDENA, OPARIA, SEKRETUAK } from "@/lib/magia-catalogo";
import { db } from "@/lib/magia-plataforma";
import type { Edukia, Katalogoa, Liburutxoa } from "@/lib/magia-edukiak-motak";

export * from "@/lib/magia-edukiak-motak";

/** El catálogo escrito en el código, con la forma de las tablas. */
export function katalogoaKodetik(): Katalogoa {
  const liburutxoak: Liburutxoa[] = LIBURUTXO_ORDENA.map((s, i) => ({ slug: s, etiketa: LIBURUTXOAK[s].etiketa, ordena: i + 1, ikusgai: true }));
  const jolasOrdena = Object.keys(JOLASAK);
  const edukiak: Edukia[] = [
    { slug: OPARIA.slug, mota: "oparia", egoera: "emaila", izenburua: OPARIA.izenburua, etiketa: "Opari extra bat", sarrera: OPARIA.azpititulua, materiala: null, youtube: OPARIA.bideoa, liburutxoak: [], ordena: 0, ikusgai: true, prezioa_cent: null },
    ...jolasOrdena.map((slug, i) => {
      const j = JOLASAK[slug];
      return {
        slug, mota: "jolasa" as const, egoera: "irekia" as const, izenburua: j.izenburua, etiketa: j.etiketa, sarrera: j.sarrera, materiala: j.materiala, youtube: j.bideoa,
        liburutxoak: LIBURUTXO_ORDENA.filter((l) => LIBURUTXOAK[l].jolasak.includes(slug)), ordena: (i + 1) * 10, ikusgai: true, prezioa_cent: null,
      };
    }),
    ...SEKRETUAK.map((n) => ({ slug: `sekretua-${n}`, mota: "sekretua" as const, egoera: "sekretua" as const, izenburua: `Sekretua ${n}`, etiketa: null, sarrera: null, materiala: null, youtube: null, liburutxoak: [], ordena: 900 + n * 10, ikusgai: true, prezioa_cent: null })),
  ];
  return { liburutxoak, edukiak, iturria: "kodea", errorea: null };
}

const porOrden = <T extends { ordena: number; slug: string }>(a: T, b: T) => a.ordena - b.ordena || a.slug.localeCompare(b.slug);

/** El catálogo que manda ahora mismo (BD si tiene filas; si no, el del código). */
export async function katalogoa(): Promise<Katalogoa> {
  const [l, e] = await Promise.all([
    db().from("magia_liburutxoak").select("slug, etiketa, ordena, ikusgai"),
    db().from("magia_edukiak").select("slug, mota, egoera, izenburua, etiketa, sarrera, materiala, youtube, liburutxoak, ordena, ikusgai, prezioa_cent"),
  ]);
  const error = l.error ?? e.error;
  if (error) {
    // Tablas sin crear (42P01) o sin red: catálogo del código, pero se avisa en el panel.
    return { ...katalogoaKodetik(), errorea: error.message };
  }
  if (!l.data?.length || !e.data?.length) return katalogoaKodetik();
  return {
    liburutxoak: (l.data as Liburutxoa[]).sort(porOrden),
    edukiak: (e.data as Edukia[]).map((x) => ({ ...x, liburutxoak: x.liburutxoak ?? [] })).sort(porOrden),
    iturria: "db",
    errorea: null,
  };
}

/** Lo que ve el público: solo lo visible. */
export function ikusgaiak(k: Katalogoa): Katalogoa {
  return { ...k, liburutxoak: k.liburutxoak.filter((x) => x.ikusgai), edukiak: k.edukiak.filter((x) => x.ikusgai) };
}

/** Los contenidos que salen en un librillo (los suyos + los de «todos»), en orden. */
export function liburutxokoEdukiak(k: Katalogoa, liburutxoa: string): Edukia[] {
  return k.edukiak.filter((e) => e.liburutxoak.length === 0 || e.liburutxoak.includes(liburutxoa));
}

export function liburutxoaDago(k: Katalogoa, slug: unknown): slug is string {
  return typeof slug === "string" && k.liburutxoak.some((l) => l.slug === slug);
}
