// Catálogo vivo de la plataforma de magia: librillos y contenidos, leídos de
// Supabase (magia_liburutxoak, magia_edukiak; sql/magia_edukiak.sql) y
// editables en /admin › Magia-tailerrak. Si las tablas no existen o están
// vacías, se usa el catálogo escrito en lib/magia-catalogo.ts, así que un
// despliegue antes del SQL no rompe nada.

import { JOLASAK, LIBURUTXOAK, LIBURUTXO_ORDENA, OPARIA, SEKRETUAK } from "@/lib/magia-catalogo";
import { db } from "@/lib/magia-plataforma";
import { giltzaGarbia, type Edukia, type Katalogoa, type Liburutxoa } from "@/lib/magia-edukiak-motak";

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
  return { liburutxoak, edukiak, iturria: "kodea", errorea: null, gaztelania: false };
}

const ES = ["izenburua_es", "etiketa_es", "sarrera_es", "materiala_es", "youtube_es"] as const;
const testua = (v: unknown) => (typeof v === "string" ? v : null);

/** Una fila de magia_edukiak → Edukia (solo las columnas conocidas; las *_es si existen). */
function edukiaErrenkadatik(x: Record<string, unknown>): Edukia {
  const e: Edukia = {
    slug: x.slug as string, mota: x.mota as Edukia["mota"], egoera: x.egoera as Edukia["egoera"],
    izenburua: x.izenburua as string, etiketa: testua(x.etiketa), sarrera: testua(x.sarrera), materiala: testua(x.materiala),
    youtube: testua(x.youtube), liburutxoak: (x.liburutxoak as string[] | null) ?? [], ordena: Number(x.ordena) || 0,
    ikusgai: x.ikusgai !== false, prezioa_cent: typeof x.prezioa_cent === "number" ? x.prezioa_cent : null,
  };
  for (const k of ES) if (k in x) e[k] = testua(x[k]);
  return e;
}

const porOrden = <T extends { ordena: number; slug: string }>(a: T, b: T) => a.ordena - b.ordena || a.slug.localeCompare(b.slug);

/** El catálogo que manda ahora mismo (BD si tiene filas; si no, el del código). */
export async function katalogoa(): Promise<Katalogoa> {
  const [l, e] = await Promise.all([
    // «*» y no la lista de columnas: así, si aún no existe la columna giltza
    // (sql/magia_giltza.sql sin ejecutar), el catálogo sigue saliendo de la BD.
    db().from("magia_liburutxoak").select("*"),
    // Igual con «*»: las columnas *_es (sql/magia_gaztelania.sql) pueden no existir aún.
    db().from("magia_edukiak").select("*"),
  ]);
  const error = l.error ?? e.error;
  if (error) {
    // Tablas sin crear (42P01) o sin red: catálogo del código, pero se avisa en el panel.
    return { ...katalogoaKodetik(), errorea: error.message };
  }
  if (!l.data?.length || !e.data?.length) return katalogoaKodetik();
  return {
    liburutxoak: (l.data as (Liburutxoa & Record<string, unknown>)[])
      .map((x) => {
        const b: Liburutxoa = { slug: x.slug, etiketa: x.etiketa, ordena: x.ordena, ikusgai: x.ikusgai };
        if ("giltza" in x) b.giltza = typeof x.giltza === "string" && giltzaGarbia(x.giltza) ? x.giltza : null;
        if ("etiketa_es" in x) b.etiketa_es = typeof x.etiketa_es === "string" ? x.etiketa_es : null;
        return b;
      })
      .sort(porOrden),
    edukiak: (e.data as Record<string, unknown>[]).map(edukiaErrenkadatik).sort(porOrden),
    iturria: "db",
    errorea: null,
    gaztelania: "youtube_es" in (e.data[0] as Record<string, unknown>),
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
