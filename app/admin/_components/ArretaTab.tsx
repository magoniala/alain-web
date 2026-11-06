"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROBATU,
  PROBATU_ES,
  diaMadrid,
  resumenPostits,
  type Charla,
  type Postit,
  type Probatu,
  type Respuesta,
} from "@/lib/arreta";

// Encuesta anónima /arreta (alumnos de las charlas): estadísticas, testimonios
// destacados y post-its de papel apuntados a mano. Todo se filtra en el
// navegador sobre lo que devuelve /api/admin/arreta.

const pw = () => sessionStorage.getItem("admin_pw") || "";
const PISTA = "#ecebe7";
const COLOR: Record<Probatu, string> = { bai: "#1baf7a", "oraindik-ez": "#2a78d6", ez: "#9b9a95" };
const CORTO: Record<Probatu, string> = { bai: "Sí", "oraindik-ez": "Aún no", ez: "No" };
const CAMPOS = [
  ["ikasi", "Qué ha aprendido de sí"],
  ["gustatu", "Qué le ha gustado más"],
  ["gehitu", "Algo que añadir"],
] as const;

const etiqueta = "mb-1 block text-[0.72rem] font-medium uppercase tracking-wide text-gray-400";
const campo = "w-full border border-gray-300 bg-white px-2.5 py-2 text-[0.88rem] text-gray-900";
const boton = "border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500 disabled:opacity-40";
const botonOscuro = "bg-gray-900 px-3.5 py-2 text-[0.82rem] font-medium text-white hover:bg-gray-700 disabled:opacity-40";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const diaCorto = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", "x-admin-password": pw(), ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

// ── Piezas visuales (mismo estilo que Mirariak)

function Cifra({ valor, titulo, detalle }: { valor: string | number; titulo: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">{titulo}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tabular-nums text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-[0.78rem] text-gray-500">{detalle}</p>}
    </div>
  );
}

function Tarjeta({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[0.95rem] font-semibold text-gray-900">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Barra({ texto, valor, max, color, detalle }: { texto: string; valor: number; max: number; color: string; detalle?: string }) {
  return (
    <div title={`${texto}: ${valor}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.82rem]">
        <span className="text-gray-700">{texto}</span>
        <span className="tabular-nums text-gray-900">
          <b>{valor}</b>
          {detalle ? <span className="text-gray-500"> · {detalle}</span> : null}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: PISTA }}>
        <div className="h-full rounded-full" style={{ width: `${max ? (valor / max) * 100 : 0}%`, minWidth: valor ? 4 : 0, background: color, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function Reparto({ filas }: { filas: Respuesta[] }) {
  const total = filas.length;
  if (!total) return <p className="text-[0.85rem] text-gray-400">Sin respuestas en esta selección.</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: PISTA }}>
        {PROBATU.map((k) => {
          const n = filas.filter((f) => f.probatu === k).length;
          return n ? <div key={k} style={{ width: `${(n / total) * 100}%`, background: COLOR[k] }} title={`${PROBATU_ES[k]}: ${n}`} /> : null;
        })}
      </div>
      {PROBATU.map((k) => {
        const n = filas.filter((f) => f.probatu === k).length;
        return <Barra key={k} texto={PROBATU_ES[k]} valor={n} max={total} color={COLOR[k]} detalle={`${pct(n, total)} %`} />;
      })}
    </div>
  );
}

function PorDia({ filas }: { filas: Respuesta[] }) {
  const dias = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(diaMadrid(f.created_at), (m.get(diaMadrid(f.created_at)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filas]);
  if (!dias.length) return <p className="text-[0.85rem] text-gray-400">Sin respuestas en esta selección.</p>;
  const max = Math.max(...dias.map((d) => d[1]));
  return (
    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
      {dias.map(([d, n]) => (
        <Barra key={d} texto={diaCorto(d)} valor={n} max={max} color="#2a78d6" />
      ))}
    </div>
  );
}

// ── Post-its

function TablaPostits({ postits, charlas, mostrarCharla, onBorrar }: { postits: Postit[]; charlas: Charla[]; mostrarCharla: boolean; onBorrar: (id: string) => void }) {
  if (!postits.length) return <p className="text-[0.85rem] text-gray-400">Todavía no hay post-its apuntados.</p>;
  const nombre = (s: string) => charlas.find((c) => c.slug === s)?.nombre ?? s;
  const grupos = mostrarCharla ? [...new Set(postits.map((p) => p.charla))] : [postits[0].charla];
  const fmt = (r: ReturnType<typeof resumenPostits>) => ({
    media: r.media == null ? "—" : r.media.toFixed(2).replace(".", ","),
    altas: r.pctAltas == null ? "—" : `${Math.round(r.pctAltas)} %`,
  });
  const fila = (clave: string, titulo: React.ReactNode, ps: Postit[], negrita: boolean, borrar?: string) => {
    const r = resumenPostits(ps);
    const f = fmt(r);
    return (
      <tr key={clave} className={negrita ? "border-t border-gray-300 font-semibold" : "border-t border-gray-100"}>
        <td className="py-1.5 pr-3 text-left">{titulo}</td>
        <td className="px-2 text-right tabular-nums">{r.alumnos}</td>
        {r.notas.map((n, i) => (
          <td key={i} className="px-2 text-right tabular-nums">{n}</td>
        ))}
        <td className="px-2 text-right tabular-nums">{f.media}</td>
        <td className="px-2 text-right tabular-nums">{f.altas}</td>
        <td className="pl-2 text-right">
          {borrar && (
            <button className="text-[0.75rem] text-gray-400 hover:text-red-600" onClick={() => onBorrar(borrar)} title="Borrar esta sesión">
              borrar
            </button>
          )}
        </td>
      </tr>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[0.84rem] text-gray-800">
        <thead>
          <tr className="text-[0.72rem] uppercase text-gray-400">
            <th className="pb-1 text-left font-medium">Sesión</th>
            <th className="px-2 text-right font-medium">Alumnos</th>
            {[1, 2, 3, 4, 5].map((n) => (
              <th key={n} className="px-2 text-right font-medium">{n}</th>
            ))}
            <th className="px-2 text-right font-medium">Media</th>
            <th className="px-2 text-right font-medium">% 4-5</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const ps = postits.filter((p) => p.charla === g);
            return [
              ...(mostrarCharla ? [<tr key={g + "-t"}><td colSpan={10} className="pt-3 text-[0.78rem] font-semibold text-gray-500">{nombre(g)}</td></tr>] : []),
              ...ps.map((p) => fila(p.id, p.sesion, [p], false, p.id)),
              ...(ps.length > 1 || mostrarCharla ? [fila(g + "-s", `Total ${nombre(g)}`, ps, true)] : []),
            ];
          })}
          {mostrarCharla && grupos.length > 1 && fila("total", "Total todas las charlas", postits, true)}
        </tbody>
      </table>
    </div>
  );
}

function NuevoPostit({ charlas, charla, onHecho }: { charlas: Charla[]; charla: string; onHecho: () => Promise<void> }) {
  const vacio = { charla, sesion: "", alumnos: "", n1: "", n2: "", n3: "", n4: "", n5: "" };
  const [f, setF] = useState(vacio);
  const [estado, setEstado] = useState("");
  useEffect(() => setF((x) => ({ ...x, charla })), [charla]);
  const suma = ["n1", "n2", "n3", "n4", "n5"].reduce((a, k) => a + (Number(f[k as keyof typeof f]) || 0), 0);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("Guardando…");
    try {
      await api("/api/admin/arreta/postits", { method: "POST", body: JSON.stringify(f) });
      setF({ ...vacio, charla: f.charla });
      setEstado("Guardado.");
      await onHecho();
    } catch (err) {
      setEstado((err as Error).message);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-4 border-t border-gray-100 pt-4">
      <p className="mb-2 text-[0.82rem] font-medium text-gray-700">Apuntar post-its de una sesión</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2">
          <span className={etiqueta}>Charla</span>
          <select className={campo} value={f.charla} onChange={(e) => setF({ ...f, charla: e.target.value })} required>
            <option value="">Elige…</option>
            {charlas.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Sesión</span>
          <input className={campo} value={f.sesion} onChange={(e) => setF({ ...f, sesion: e.target.value })} placeholder="Lun 9 · 3.º A" maxLength={80} required />
        </label>
        <label>
          <span className={etiqueta}>Alumnos</span>
          <input className={campo} type="number" min={0} inputMode="numeric" value={f.alumnos} onChange={(e) => setF({ ...f, alumnos: e.target.value })} />
        </label>
        {(["n1", "n2", "n3", "n4", "n5"] as const).map((k, i) => (
          <label key={k}>
            <span className={etiqueta}>Nota {i + 1}</span>
            <input className={campo} type="number" min={0} inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
        <div className="col-span-2 flex items-end gap-3 sm:col-span-3">
          <button className={botonOscuro} disabled={!f.charla || !f.sesion.trim()}>Guardar sesión</button>
          <span className="text-[0.8rem] text-gray-500">
            {suma} post-its{estado ? ` · ${estado}` : ""}
          </span>
        </div>
      </div>
    </form>
  );
}

function NuevaCharla({ onHecho }: { onHecho: (slug: string) => Promise<void> }) {
  const vacio = { nombre: "", centro: "", slug: "", fecha_inicio: "", fecha_fin: "", margen_hasta: "" };
  const [f, setF] = useState(vacio);
  const [estado, setEstado] = useState("");
  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("Guardando…");
    try {
      await api("/api/admin/arreta/charlas", { method: "POST", body: JSON.stringify(f) });
      setEstado(`Creada. QR: alainzulaika.com/arreta?c=${f.slug}`);
      const slug = f.slug;
      setF(vacio);
      await onHecho(slug);
    } catch (err) {
      setEstado((err as Error).message);
    }
  }

  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-[0.95rem] font-semibold text-gray-900">Nueva charla</summary>
      <form onSubmit={guardar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>
          <span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={set("nombre")} placeholder="Hernani BHI" maxLength={120} required />
        </label>
        <label>
          <span className={etiqueta}>Centro</span>
          <input className={campo} value={f.centro} onChange={set("centro")} maxLength={120} />
        </label>
        <label>
          <span className={etiqueta}>Slug (va en el QR)</span>
          <input
            className={campo}
            value={f.slug}
            onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
            placeholder="lasarte-2027-01"
            pattern="[a-z0-9-]{1,60}"
            maxLength={60}
            required
          />
        </label>
        <label>
          <span className={etiqueta}>Primer día</span>
          <input className={campo} type="date" value={f.fecha_inicio} onChange={set("fecha_inicio")} required />
        </label>
        <label>
          <span className={etiqueta}>Último día</span>
          <input className={campo} type="date" value={f.fecha_fin} onChange={set("fecha_fin")} required />
        </label>
        <label>
          <span className={etiqueta}>Respuestas hasta</span>
          <input className={campo} type="date" value={f.margen_hasta} onChange={set("margen_hasta")} required />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button className={botonOscuro}>Crear charla</button>
          <span className="text-[0.8rem] text-gray-500">{estado || (f.slug ? `QR: alainzulaika.com/arreta?c=${f.slug}` : "")}</span>
        </div>
      </form>
    </details>
  );
}

// ── Pestaña

export default function ArretaTab() {
  const [datos, setDatos] = useState<{ respuestas: Respuesta[]; charlas: Charla[]; postits: Postit[] } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const [charla, setCharla] = useState(""); // "" = todo el histórico
  const [modo, setModo] = useState<"todas" | "destacadas">("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<"nuevas" | "antiguas">("nuevas");
  const [busca, setBusca] = useState("");

  const cargar = useCallback(async () => {
    try {
      setDatos(await api("/api/admin/arreta"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const avisar = (m: string) => {
    setAviso(m);
    setTimeout(() => setAviso(""), 2500);
  };

  const charlaSel = datos?.charlas.find((c) => c.slug === charla) ?? null;

  // Filtro común (charla + fechas). La búsqueda y el modo solo afectan a la lista.
  const filtradas = useMemo(() => {
    if (!datos) return [];
    return datos.respuestas.filter((r) => {
      if (charla && r.charla !== charla) return false;
      const d = diaMadrid(r.created_at);
      if (desde && d < desde) return false;
      if (hasta && d > hasta) return false;
      return true;
    });
  }, [datos, charla, desde, hasta]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = filtradas.filter(
      (r) => (modo === "todas" || r.destacada) && (!q || [r.ikasi, r.gustatu, r.gehitu].some((t) => t?.toLowerCase().includes(q)))
    );
    return l.sort((a, b) => (orden === "nuevas" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));
  }, [filtradas, busca, modo, orden]);

  const postits = useMemo(() => (datos ? datos.postits.filter((p) => !charla || p.charla === charla) : []), [datos, charla]);
  const rp = resumenPostits(postits);

  async function destacar(r: Respuesta) {
    const nuevo = !r.destacada;
    setDatos((d) => d && { ...d, respuestas: d.respuestas.map((x) => (x.id === r.id ? { ...x, destacada: nuevo } : x)) });
    try {
      await api(`/api/admin/arreta?id=${r.id}`, { method: "PATCH", body: JSON.stringify({ destacada: nuevo }) });
    } catch (e) {
      avisar((e as Error).message);
      await cargar();
    }
  }

  async function borrarPostit(id: string) {
    if (!confirm("¿Borrar esta sesión de post-its?")) return;
    try {
      await api(`/api/admin/arreta/postits?id=${id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  async function copiarDestacadas() {
    const titulo = charlaSel ? `${charlaSel.nombre} — testimonios de alumnos` : "Arreta — testimonios de alumnos";
    const bloques = lista.map((r) =>
      CAMPOS.map(([k]) => r[k])
        .filter(Boolean)
        .map((t) => `«${t}»`)
        .join("\n")
    );
    const texto = [titulo, "", ...bloques.flatMap((b) => [b, ""])].join("\n").trim() + "\n";
    try {
      await navigator.clipboard.writeText(texto);
      avisar(`Copiadas ${lista.length}`);
    } catch {
      window.prompt("Cópialo desde aquí:", texto);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!datos) return <p className="text-sm text-gray-400">Cargando…</p>;

  const nombreCharla = (s: string | null) => (s ? datos.charlas.find((c) => c.slug === s)?.nombre ?? s : "Sin charla");
  const bai = filtradas.filter((r) => r.probatu === "bai").length;
  const destacadas = filtradas.filter((r) => r.destacada).length;
  const hayFiltros = desde || hasta || busca;

  return (
    <div className="space-y-4">
      {/* Selección */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="col-span-2">
            <span className={etiqueta}>Vista</span>
            <select className={campo} value={charla} onChange={(e) => setCharla(e.target.value)}>
              <option value="">Todo el histórico</option>
              {datos.charlas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre} · {diaCorto(c.fecha_inicio)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Desde</span>
            <input className={campo} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            <span className={etiqueta}>Hasta</span>
            <input className={campo} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className={etiqueta}>Orden</span>
            <select className={campo} value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
              <option value="nuevas">Más nuevas primero</option>
              <option value="antiguas">Más antiguas primero</option>
            </select>
          </label>
        </div>
        {charlaSel && (
          <p className="mt-3 text-[0.8rem] text-gray-500">
            {charlaSel.centro ? `${charlaSel.centro} · ` : ""}charlas del {diaCorto(charlaSel.fecha_inicio)} al {diaCorto(charlaSel.fecha_fin)}, respuestas hasta el {diaCorto(charlaSel.margen_hasta)} · QR: alainzulaika.com/arreta?c={charlaSel.slug}
          </p>
        )}
        {(desde || hasta) && (
          <button className="mt-2 text-[0.78rem] text-gray-500 underline" onClick={() => { setDesde(""); setHasta(""); }}>
            Quitar fechas
          </button>
        )}
      </div>

      {/* Cifras */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra titulo="Respuestas" valor={filtradas.length} detalle={charlaSel && rp.alumnos ? `${pct(filtradas.length, rp.alumnos)} % de ${rp.alumnos} alumnos` : undefined} />
        <Cifra titulo="Ya lo han probado" valor={`${pct(bai, filtradas.length)} %`} detalle={`${bai} de ${filtradas.length}`} />
        <Cifra titulo="Post-its · media" valor={rp.media == null ? "—" : rp.media.toFixed(2).replace(".", ",")} detalle={rp.total ? `${rp.total} post-its de 1 a 5` : "sin apuntar"} />
        <Cifra titulo="Post-its 4-5" valor={rp.pctAltas == null ? "—" : `${Math.round(rp.pctAltas)} %`} detalle={rp.total ? `${rp.notas[3] + rp.notas[4]} de ${rp.total}` : undefined} />
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="¿Lo has probado ya?">
          <Reparto filas={filtradas} />
        </Tarjeta>
        <Tarjeta titulo="Respuestas por día">
          <PorDia filas={filtradas} />
        </Tarjeta>
      </div>

      {/* Lista */}
      <Tarjeta
        titulo={modo === "todas" ? `Respuestas (${lista.length})` : `Destacadas (${lista.length})`}
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex">
              <button className={modo === "todas" ? botonOscuro : boton} onClick={() => setModo("todas")}>Todas</button>
              <button className={modo === "destacadas" ? botonOscuro : boton} onClick={() => setModo("destacadas")}>
                ★ Destacadas ({destacadas})
              </button>
            </div>
            {modo === "destacadas" && (
              <button className={boton} onClick={copiarDestacadas} disabled={!lista.length}>Copiar</button>
            )}
          </div>
        }
      >
        <input className={campo + " mb-3"} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar en las respuestas escritas…" />
        {aviso && <p className="mb-2 text-[0.8rem] text-gray-500">{aviso}</p>}
        {!lista.length && (
          <p className="text-[0.85rem] text-gray-400">
            {modo === "destacadas" ? "No hay destacadas en esta selección." : hayFiltros ? "Nada coincide con los filtros." : "Todavía no hay respuestas."}
          </p>
        )}
        <div className="space-y-2">
          {lista.map((r) => {
            const textos = CAMPOS.filter(([k]) => r[k]);
            return (
              <div key={r.id} className={`border p-3 sm:p-4 ${r.destacada ? "border-amber-300 bg-amber-50/40" : "border-gray-200"}`}>
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <p className="text-[0.74rem] text-gray-500">
                    {fechaLarga(r.created_at)}
                    {!charla && <> · {nombreCharla(r.charla)}</>}
                    {" · "}
                    <span className="font-medium" style={{ color: COLOR[r.probatu] }}>{CORTO[r.probatu]}</span>
                  </p>
                  <button
                    onClick={() => destacar(r)}
                    className={`shrink-0 text-[1.15rem] leading-none ${r.destacada ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}
                    title={r.destacada ? "Quitar de destacadas" : "Marcar como destacada"}
                    aria-pressed={r.destacada}
                  >
                    ★
                  </button>
                </div>
                {textos.length ? (
                  textos.map(([k, t]) => (
                    <p key={k} className="mt-1 whitespace-pre-wrap break-words text-[0.88rem] text-gray-800">
                      <span className="text-gray-400">{t}: </span>
                      {r[k]}
                    </p>
                  ))
                ) : (
                  <p className="text-[0.82rem] italic text-gray-400">Sin texto, solo la pregunta 1.</p>
                )}
              </div>
            );
          })}
        </div>
      </Tarjeta>

      {/* Post-its */}
      <Tarjeta titulo={charlaSel ? `Post-its · ${charlaSel.nombre}` : "Post-its · todas las charlas"}>
        <TablaPostits postits={postits} charlas={datos.charlas} mostrarCharla={!charla} onBorrar={borrarPostit} />
        <NuevoPostit charlas={datos.charlas} charla={charla} onHecho={cargar} />
      </Tarjeta>

      <NuevaCharla
        onHecho={async (slug) => {
          await cargar();
          setCharla(slug);
        }}
      />
    </div>
  );
}
