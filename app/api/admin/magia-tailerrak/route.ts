// /admin › Magia-tailerrak: el catálogo de la plataforma de magia (librillos y
// contenidos) y quién ha dejado el email. Tablas en sql/magia_edukiak.sql.
//
//  GET                         → { katalogoa, usuarios }
//  POST   { ekintza: "hasieratu" }                → copia el catálogo del código a la BD (solo si está vacía)
//  PUT    { mota: "edukia", edukia: {...} }       → crear o guardar un contenido
//  PUT    { mota: "liburutxoa", liburutxoa: {…} } → crear o guardar un librillo
//  PATCH  { mota, slug, norabidea: "gora"|"behera" } → mover en el orden
//  DELETE ?mota=edukia|liburutxoa&slug=…          → borrar
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { youtubeId } from "@/lib/magia-catalogo";
import { EGOERAK, MOTAK, SLUG_ONA, katalogoa, katalogoaKodetik, type Edukia, type Liburutxoa } from "@/lib/magia-edukiak";
import { db } from "@/lib/magia-plataforma";

export const dynamic = "force-dynamic";

const noAuth = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });
const mal = (m: string, status = 400) => NextResponse.json({ error: m }, { status });
const texto = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(req: Request) {
  if (!auth(req)) return noAuth();
  const [k, u, a] = await Promise.all([
    katalogoa(),
    db().from("magia_usuarios").select("email, librillo, canal, created_at, newsletter_alta_at").order("created_at", { ascending: false }).limit(2000),
    db().from("magia_accesos").select("email, contenido"),
  ]);
  if (u.error) return mal(u.error.message, 500);
  const accesos: Record<string, string[]> = {};
  for (const r of a.data ?? []) (accesos[r.email] ??= []).push(r.contenido);
  return NextResponse.json(
    { katalogoa: k, usuarios: (u.data ?? []).map((r) => ({ ...r, accesos: accesos[r.email] ?? [] })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Primera vez: pasar el catálogo del código a las tablas para poder editarlo.
export async function POST(req: Request) {
  if (!auth(req)) return noAuth();
  const b = (await req.json().catch(() => ({}))) as { ekintza?: string };
  if (b.ekintza !== "hasieratu") return mal("Acción desconocida.");
  const k = await katalogoa();
  if (k.errorea) return mal(`Antes hay que ejecutar sql/magia_edukiak.sql en Supabase (${k.errorea}).`);
  if (k.iturria === "db") return mal("El catálogo ya está en la base de datos.");
  const seed = katalogoaKodetik();
  const l = await db().from("magia_liburutxoak").upsert(seed.liburutxoak, { onConflict: "slug", ignoreDuplicates: true });
  if (l.error) return mal(l.error.message, 500);
  const e = await db().from("magia_edukiak").upsert(seed.edukiak, { onConflict: "slug", ignoreDuplicates: true });
  if (e.error) return mal(e.error.message, 500);
  return NextResponse.json({ ok: true });
}

function leerEdukia(x: Record<string, unknown>): Edukia | string {
  const slug = typeof x.slug === "string" ? x.slug.trim().toLowerCase() : "";
  if (!SLUG_ONA.test(slug)) return "El identificador solo puede llevar minúsculas, números y guiones (p. ej. «goma-saltaria»).";
  const mota = MOTAK.find((m) => m === x.mota);
  const egoera = EGOERAK.find((m) => m === x.egoera);
  if (!mota || !egoera) return "Tipo o estado desconocido.";
  const izenburua = texto(x.izenburua, 120);
  if (!izenburua) return "Falta el título.";
  let youtube: string | null = null;
  if (typeof x.youtube === "string" && x.youtube.trim()) {
    youtube = youtubeId(x.youtube);
    if (!youtube) return "No reconozco ese enlace de YouTube.";
  }
  const liburutxoak = Array.isArray(x.liburutxoak) ? x.liburutxoak.filter((s): s is string => typeof s === "string" && SLUG_ONA.test(s)) : [];
  const prezioa = typeof x.prezioa_cent === "number" && x.prezioa_cent >= 0 ? Math.round(x.prezioa_cent) : null;
  return {
    slug, mota, egoera, izenburua,
    etiketa: texto(x.etiketa, 80), sarrera: texto(x.sarrera), materiala: texto(x.materiala), youtube,
    liburutxoak, ordena: typeof x.ordena === "number" ? x.ordena : 0, ikusgai: x.ikusgai !== false,
    prezioa_cent: egoera === "ordainpekoa" ? prezioa : null,
  };
}

function leerLiburutxoa(x: Record<string, unknown>): Liburutxoa | string {
  const slug = typeof x.slug === "string" ? x.slug.trim().toLowerCase() : "";
  if (!SLUG_ONA.test(slug)) return "El identificador solo puede llevar minúsculas, números y guiones (p. ej. «6-7»).";
  const etiketa = texto(x.etiketa, 60);
  if (!etiketa) return "Falta el nombre del librillo.";
  const l: Liburutxoa = { slug, etiketa, ordena: typeof x.ordena === "number" ? x.ordena : 0, ikusgai: x.ikusgai !== false };
  // Solo si viene: sin la columna (sql/magia_giltza.sql sin ejecutar) no se toca.
  if ("giltza" in x) l.giltza = texto(x.giltza, 40);
  return l;
}

export async function PUT(req: Request) {
  if (!auth(req)) return noAuth();
  const b = (await req.json().catch(() => ({}))) as { mota?: string; edukia?: Record<string, unknown>; liburutxoa?: Record<string, unknown> };
  const k = await katalogoa();
  if (k.iturria !== "db") return mal("El catálogo aún no está en la base de datos: pulsa «Cargar catálogo» primero.");
  if (b.mota === "edukia" && b.edukia) {
    const e = leerEdukia(b.edukia);
    if (typeof e === "string") return mal(e);
    const r = await db().from("magia_edukiak").upsert({ ...e, updated_at: new Date().toISOString() });
    if (r.error) return mal(r.error.message, 500);
    return NextResponse.json({ ok: true, edukia: e });
  }
  if (b.mota === "liburutxoa" && b.liburutxoa) {
    const l = leerLiburutxoa(b.liburutxoa);
    if (typeof l === "string") return mal(l);
    const r = await db().from("magia_liburutxoak").upsert({ ...l, updated_at: new Date().toISOString() });
    if (r.error) return mal(r.error.message, 500);
    return NextResponse.json({ ok: true, liburutxoa: l });
  }
  return mal("Petición incompleta.");
}

// Mover arriba/abajo: intercambia `ordena` con el vecino (misma lista).
export async function PATCH(req: Request) {
  if (!auth(req)) return noAuth();
  const b = (await req.json().catch(() => ({}))) as { mota?: string; slug?: string; norabidea?: string };
  const k = await katalogoa();
  if (k.iturria !== "db") return mal("El catálogo aún no está en la base de datos.");
  const taula = b.mota === "liburutxoa" ? "magia_liburutxoak" : b.mota === "edukia" ? "magia_edukiak" : null;
  if (!taula || !b.slug) return mal("Petición incompleta.");
  const lista: { slug: string; ordena: number }[] = b.mota === "liburutxoa" ? k.liburutxoak : k.edukiak;
  const i = lista.findIndex((x) => x.slug === b.slug);
  const j = b.norabidea === "gora" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return NextResponse.json({ ok: true });
  // Si tienen el mismo `ordena`, el intercambio no movería nada: se renumeran todos.
  const nuevos = lista.map((x, idx) => ({ slug: x.slug, ordena: (idx + 1) * 10 }));
  [nuevos[i].ordena, nuevos[j].ordena] = [nuevos[j].ordena, nuevos[i].ordena];
  for (const n of nuevos) {
    const r = await db().from(taula).update({ ordena: n.ordena }).eq("slug", n.slug);
    if (r.error) return mal(r.error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!auth(req)) return noAuth();
  const u = new URL(req.url);
  const mota = u.searchParams.get("mota");
  const slug = u.searchParams.get("slug") ?? "";
  if (!SLUG_ONA.test(slug)) return mal("Identificador inválido.");
  const taula = mota === "liburutxoa" ? "magia_liburutxoak" : mota === "edukia" ? "magia_edukiak" : null;
  if (!taula) return mal("Petición incompleta.");
  const r = await db().from(taula).delete().eq("slug", slug);
  if (r.error) return mal(r.error.message, 500);
  return NextResponse.json({ ok: true });
}
