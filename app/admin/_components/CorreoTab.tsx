"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Bandeja general de correo · F0 (medir). Cuánto correo entra, de quién, y
// qué tratamiento recibe cada remitente. Datos: /api/admin/correo.
// Diseño: vault → Sistema · Arquitectura v4 — bandeja general de correo.

const pw = () => sessionStorage.getItem("admin_pw") || "";

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", "x-admin-password": pw(), ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

type Categoria = "solicitud" | "conversacion" | "newsletter" | "tramite" | "aviso" | "ruido" | "via" | "sin_clasificar";
interface Remitente {
  de: string;
  nombre: string | null;
  dominio: string;
  n: number;
  masivos: number;
  ultimo_asunto: string | null;
  ultima_fecha: string | null;
  categoria: Categoria;
  via: string | null;
  buzones: string[];
}
interface Regla {
  patron: string;
  tratamiento: string;
  categoria: string | null;
  nota: string | null;
  creado_por: "alain" | "sugerencia";
}
interface Panel {
  sin_tabla?: boolean;
  desde: string | null;
  total: number;
  dias_laborables: number;
  por_categoria: Record<string, number>;
  remitentes: Remitente[];
  reglas: Regla[];
  sugerencias_silenciar: { dominio: string; n: number }[];
  historico: { hecho?: boolean; guardadas?: number; error?: string; en?: string } | null;
  genericos: string[];
  buzones: { id: string; direccion: string; configurado: boolean; pausado: boolean; variable: string | null; estado: { hecho?: boolean; al_dia?: boolean; guardadas?: number; error?: string | null; en?: string } | null }[];
}

const corto = (dir: string) => dir.replace(/@alainzulaika\.com$/, "@");

const TRATAMIENTOS = [
  { v: "completo", t: "Completo", d: "La IA lo lee y propone respuesta." },
  { v: "solo_fecha", t: "Solo fecha", d: "La IA solo saca plazos (tarjeta con fecha), sin borrador. Asesora, Red.es, Hacienda…" },
  { v: "solo_cabecera", t: "Solo cabecera", d: "Ves remitente y asunto; nadie lee el texto. Banco, salud, familia, plataformas." },
  { v: "silenciado", t: "Silenciado", d: "Fuera de la bandeja; solo se cuenta." },
];
const CATEGORIAS: Record<Categoria, string> = {
  solicitud: "🔴 Solicitud nueva",
  conversacion: "🟠 Conversación",
  newsletter: "💬 Respuesta a la newsletter",
  tramite: "📅 Trámite con fecha",
  aviso: "👁 Aviso",
  ruido: "🔕 Ruido",
  via: "↪ De una vía",
  sin_clasificar: "Sin clasificar (irá a la IA)",
};
const ELEGIBLES: Categoria[] = ["solicitud", "conversacion", "newsletter", "tramite", "aviso", "ruido"];
const nombreTrat = (v: string) => TRATAMIENTOS.find((x) => x.v === v)?.t ?? v;

const boton = "border border-gray-300 bg-white px-3 py-1.5 text-[0.8rem] text-gray-700 hover:border-gray-500 disabled:opacity-40";
const botonOscuro = "bg-gray-900 px-3 py-1.5 text-[0.8rem] font-medium text-white hover:bg-gray-700 disabled:opacity-40";
const campo = "w-full border border-gray-300 bg-white px-2 py-1.5 text-[0.85rem] text-gray-900";
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }) : "—");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Cifra({ valor, titulo, detalle }: { valor: string | number; titulo: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">{titulo}</p>
      <p className="mt-1 text-[1.7rem] font-semibold leading-none tabular-nums text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-[0.78rem] text-gray-500">{detalle}</p>}
    </div>
  );
}

interface Fila {
  clave: string; // email o @dominio
  titulo: string;
  sub: string | null;
  dominio: string;
  n: number;
  masivos: number;
  ultimo_asunto: string | null;
  ultima_fecha: string | null;
  categoria: Categoria;
  remitentes?: number;
  buzones: string[];
}

function Editor({ fila, porDominio, regla, genericos, alGuardar, alCerrar }: {
  fila: Fila;
  porDominio: boolean;
  regla: Regla | null;
  genericos: Set<string>;
  alGuardar: (patron: string, tratamiento: string, categoria: string, nota: string) => Promise<void>;
  alCerrar: () => void;
}) {
  const [trat, setTrat] = useState(regla?.tratamiento ?? (fila.masivos / fila.n >= 0.8 ? "solo_cabecera" : "completo"));
  const [cat, setCat] = useState<string>(regla?.categoria ?? (fila.masivos / fila.n >= 0.8 ? "aviso" : ""));
  const [nota, setNota] = useState(regla?.nota ?? "");
  const [ocupado, setOcupado] = useState(false);
  const generico = genericos.has(fila.dominio);
  const guardar = async (patron: string) => {
    setOcupado(true);
    try {
      await alGuardar(patron, trat, cat, nota);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[0.75rem] text-gray-500">
          Tratamiento
          <select className={campo} value={trat} onChange={(e) => setTrat(e.target.value)}>
            {TRATAMIENTOS.map((t) => (
              <option key={t.v} value={t.v}>{t.t}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.75rem] text-gray-500">
          Categoría
          <select className={campo} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">— que la decida la IA —</option>
            {ELEGIBLES.map((c) => (
              <option key={c} value={c}>{CATEGORIAS[c]}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.75rem] text-gray-500">
          Nota (opcional)
          <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="p. ej. asesora" />
        </label>
      </div>
      <p className="mt-2 text-[0.75rem] text-gray-500">{TRATAMIENTOS.find((t) => t.v === trat)?.d}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {porDominio ? (
          <button className={botonOscuro} disabled={ocupado} onClick={() => guardar(fila.clave)}>Guardar para {fila.clave}</button>
        ) : (
          <>
            <button className={botonOscuro} disabled={ocupado} onClick={() => guardar(fila.clave)}>Guardar para este email</button>
            {fila.dominio && (
              <button className={boton} disabled={ocupado || generico} title={generico ? "Dominio de correo personal: la regla va al email concreto" : ""} onClick={() => guardar("@" + fila.dominio)}>
                Para todo @{fila.dominio}
              </button>
            )}
          </>
        )}
        <button className={boton} onClick={alCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

export default function CorreoTab() {
  const [datos, setDatos] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [agrupar, setAgrupar] = useState<"remitente" | "dominio">("remitente");
  const [filtro, setFiltro] = useState<"sin_regla" | "todos" | "masivos" | "personas">("sin_regla");
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [limite, setLimite] = useState(80);
  const [buzon, setBuzon] = useState("todos");
  const [leyendo, setLeyendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await api("/api/admin/correo"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const reglas = useMemo(() => {
    const m = new Map<string, Regla>();
    for (const r of datos?.reglas ?? []) m.set(r.patron, r);
    return m;
  }, [datos]);
  const genericos = useMemo(() => new Set(datos?.genericos ?? []), [datos]);

  /** Regla que se aplica de verdad (solo las de Alain) y sugerencia pendiente, si la hay. */
  const reglaDe = useCallback(
    (f: Fila) => {
      const cands = agrupar === "dominio" ? [f.clave] : [f.clave, "@" + f.dominio];
      const vigente = cands.map((c) => reglas.get(c)).find((r) => r?.creado_por === "alain") ?? null;
      const sugerida = cands.map((c) => reglas.get(c)).find((r) => r?.creado_por === "sugerencia") ?? null;
      return { vigente, sugerida };
    },
    [reglas, agrupar],
  );

  const filas: Fila[] = useMemo(() => {
    if (!datos) return [];
    const base = buzon === "todos" ? datos.remitentes : datos.remitentes.filter((r) => r.buzones.includes(buzon));
    if (agrupar === "remitente")
      return base.map((r) => ({ clave: r.de, titulo: r.nombre || r.de, sub: r.nombre ? r.de : null, dominio: r.dominio, n: r.n, masivos: r.masivos, ultimo_asunto: r.ultimo_asunto, ultima_fecha: r.ultima_fecha, categoria: r.categoria, buzones: r.buzones }));
    const m = new Map<string, Fila>();
    for (const r of base) {
      const k = "@" + (r.dominio || "?");
      const f = m.get(k);
      if (!f) m.set(k, { clave: k, titulo: k, sub: null, dominio: r.dominio, n: r.n, masivos: r.masivos, ultimo_asunto: r.ultimo_asunto, ultima_fecha: r.ultima_fecha, categoria: r.categoria, remitentes: 1, buzones: [...r.buzones] });
      else {
        f.n += r.n;
        f.masivos += r.masivos;
        f.remitentes = (f.remitentes ?? 0) + 1;
        for (const b of r.buzones) if (!f.buzones.includes(b)) f.buzones.push(b);
        if ((r.ultima_fecha ?? "") > (f.ultima_fecha ?? "")) Object.assign(f, { ultima_fecha: r.ultima_fecha, ultimo_asunto: r.ultimo_asunto, categoria: r.categoria });
      }
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [datos, agrupar, buzon]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => {
      if (t && !`${f.titulo} ${f.sub ?? ""} ${f.ultimo_asunto ?? ""}`.toLowerCase().includes(t)) return false;
      const masivo = f.masivos / f.n >= 0.5;
      if (filtro === "masivos") return masivo;
      if (filtro === "personas") return !masivo;
      if (filtro === "sin_regla") return f.categoria !== "via" && !reglaDe(f).vigente;
      return true;
    });
  }, [filas, filtro, q, reglaDe]);

  const guardar = async (patron: string, tratamiento: string, categoria: string, nota: string) => {
    try {
      const r = await api("/api/admin/correo", { method: "POST", body: JSON.stringify({ accion: "regla", patron, tratamiento, categoria, nota }) });
      setAviso(`Regla guardada para ${r.patron}${r.reclasificadas ? ` · ${r.reclasificadas} correos reclasificados` : ""}.`);
      setAbierta(null);
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    }
  };
  const quitar = async (patron: string) => {
    try {
      await api("/api/admin/correo", { method: "POST", body: JSON.stringify({ accion: "quitar", patron }) });
      setAviso(`Quitada la regla de ${patron}.`);
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    }
  };

  const pausar = async (id: string, pausado: boolean) => {
    try {
      await api("/api/admin/correo", { method: "POST", body: JSON.stringify({ accion: "pausar", id, pausado }) });
      setAviso(pausado ? "Buzón pausado: no se lee hasta que lo reactives." : "Buzón reactivado: se lee en la próxima pasada.");
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    }
  };

  const leerAhora = async () => {
    setLeyendo(true);
    try {
      const r = await api("/api/admin/correo", { method: "POST", body: JSON.stringify({ accion: "leer" }) });
      const partes: string[] = [];
      if (r.historico) partes.push(`alain@: ${r.historico.guardadas ?? 0} apuntados${r.historico.hecho ? " (histórico completo)" : r.historico.error ? ` · error: ${r.historico.error}` : " (sigue en la próxima)"}`);
      for (const [id, v] of Object.entries((r.otros ?? {}) as Record<string, { guardadas?: number; error?: string | null; al_dia?: boolean } | string>)) {
        if (typeof v === "string") continue;
        partes.push(`${id}: ${v.error ? `error: ${v.error}` : `${v.guardadas ?? 0} apuntados${v.al_dia ? "" : " (sigue en la próxima)"}`}`);
      }
      setAviso(partes.length ? `Leído. ${partes.join(" · ")}.` : "Nada nuevo que leer.");
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  };

  if (error) return <p className="text-[0.9rem] text-red-700">{error}</p>;
  if (!datos) return <p className="text-[0.9rem] text-gray-500">Cargando…</p>;
  if (datos.sin_tabla)
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-[0.9rem] text-amber-900">
        Falta ejecutar <code>sql/correo-general-f0.sql</code> en el SQL editor de Supabase. Hasta entonces el lector no apunta nada (y charlas y magia siguen igual).
      </div>
    );

  const pc = datos.por_categoria;
  const sinClasificar = pc.sin_clasificar ?? 0;
  const vias = pc.via ?? 0;
  const dl = datos.dias_laborables;
  const sugeridas = datos.reglas.filter((r) => r.creado_por === "sugerencia");

  return (
    <div className="space-y-5">
      <p className="text-[0.85rem] text-gray-500">
        Fase 0: solo se mide. Nada de esto toca el buzón ni usa IA. Marca aquí el tratamiento de cada remitente; con eso arranca la bandeja (F1).{" "}
        {datos.desde ? `Datos desde el ${fecha(datos.desde)} (${dl} días laborables).` : "Aún no hay correos apuntados."}{" "}
      </p>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[0.95rem] font-semibold text-gray-900">Buzones</h2>
          <button className={botonOscuro} disabled={leyendo} onClick={leerAhora}>{leyendo ? "Leyendo… (hasta 1 min)" : "Leer ahora"}</button>
        </div>
        <div className="divide-y divide-gray-100">
          {datos.buzones.map((b) => {
            const e = b.estado;
            const listo = b.id === "alain" ? e?.hecho : e?.al_dia;
            return (
              <div key={b.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-[0.83rem]">
                <span className="w-64 shrink-0 font-medium text-gray-900">{b.direccion}</span>
                {b.pausado ? (
                  <span className="text-gray-500">
                    Pausado: no se lee{b.id === "alain" ? " en la bandeja general (charlas y magia siguen como siempre)" : ""}.
                  </span>
                ) : !b.configurado ? (
                  <span className="text-amber-700">Falta la contraseña en Vercel: <code className="rounded bg-amber-50 px-1">{b.variable}</code></span>
                ) : e?.error ? (
                  <span className="text-red-700">Error: {e.error}</span>
                ) : !e ? (
                  <span className="text-gray-500">{b.id === "alain" ? "Leyendo lo nuevo; el último mes, pendiente (pulsa Leer ahora)." : "Pendiente de la primera lectura (pulsa Leer ahora)."}</span>
                ) : (
                  <span className="text-gray-600">
                    {listo ? "Al día" : "Leyendo el último mes"} · {e.guardadas ?? 0} apuntados{b.id === "alain" ? " del último mes" : ""}
                  </span>
                )}
                <button
                  className="ml-auto border border-gray-300 px-2 py-0.5 text-[0.75rem] text-gray-700 hover:bg-gray-50"
                  onClick={() => pausar(b.id, !b.pausado)}
                >
                  {b.pausado ? "Reactivar" : "Pausar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra titulo="Correos / día laborable" valor={(datos.total / dl).toFixed(1)} detalle={`${datos.total} en total`} />
        <Cifra titulo="Resuelto por reglas" valor={`${pct(datos.total - sinClasificar, datos.total)} %`} detalle="sin IA" />
        <Cifra titulo="Irían a la IA / día" valor={(sinClasificar / dl).toFixed(1)} detalle="los sin clasificar" />
        <Cifra titulo="De una vía" valor={vias} detalle="charlas y magia, como hoy" />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="mb-2 text-[0.95rem] font-semibold text-gray-900">Reparto</h2>
        <div className="space-y-1.5">
          {(Object.keys(CATEGORIAS) as Categoria[])
            .filter((c) => pc[c])
            .map((c) => (
              <div key={c} className="flex items-center gap-3 text-[0.82rem]">
                <span className="w-32 shrink-0 text-gray-700 sm:w-56">{CATEGORIAS[c]}</span>
                <div className="h-2 flex-1 rounded bg-gray-100">
                  <div className="h-2 rounded bg-gray-700" style={{ width: `${pct(pc[c], datos.total)}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums text-gray-500 sm:w-16">{pc[c]}</span>
              </div>
            ))}
        </div>
      </section>

      {(sugeridas.length > 0 || datos.sugerencias_silenciar.length > 0) && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-1 text-[0.95rem] font-semibold text-gray-900">Sugerencias (no se aplican hasta que las confirmes)</h2>
          <div className="divide-y divide-gray-100">
            {sugeridas.map((r) => (
              <div key={r.patron} className="flex flex-wrap items-center gap-2 py-2 text-[0.83rem] text-gray-500">
                <span className="min-w-0 flex-1">
                  <b className="text-gray-700">{r.patron}</b> → {nombreTrat(r.tratamiento)}
                  {r.categoria ? ` · ${CATEGORIAS[r.categoria as Categoria] ?? r.categoria}` : ""}
                  {r.nota ? ` · ${r.nota}` : ""}
                </span>
                <button className={boton} onClick={() => guardar(r.patron, r.tratamiento, r.categoria ?? "", r.nota ?? "")}>Confirmar</button>
                <button className={boton} onClick={() => quitar(r.patron)}>Descartar</button>
              </div>
            ))}
            {datos.sugerencias_silenciar.map((s) => (
              <div key={s.dominio} className="flex flex-wrap items-center gap-2 py-2 text-[0.83rem] text-gray-500">
                <span className="min-w-0 flex-1">
                  <b className="text-gray-700">@{s.dominio}</b> → Silenciado · Ruido ({s.n} masivos en el periodo)
                </span>
                <button className={boton} onClick={() => guardar("@" + s.dominio, "silenciado", "ruido", "")}>Silenciar</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {aviso && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[0.83rem] text-gray-700">
          {aviso} <button className="ml-2 underline" onClick={() => setAviso(null)}>ok</button>
        </p>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[0.95rem] font-semibold text-gray-900">Remitentes</h2>
          <select className={`${campo} !w-auto`} value={agrupar} onChange={(e) => setAgrupar(e.target.value as typeof agrupar)}>
            <option value="remitente">Por email</option>
            <option value="dominio">Por dominio</option>
          </select>
          <select className={`${campo} !w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="sin_regla">Sin regla</option>
            <option value="todos">Todos</option>
            <option value="personas">Personas (no masivo)</option>
            <option value="masivos">Masivos</option>
          </select>
          <select className={`${campo} !w-auto`} value={buzon} onChange={(e) => setBuzon(e.target.value)}>
            <option value="todos">Todos los buzones</option>
            {datos.buzones.filter((b) => b.configurado).map((b) => (
              <option key={b.id} value={b.id}>{b.direccion}</option>
            ))}
          </select>
          <input className={`${campo} !w-40`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="mb-2 text-[0.75rem] text-gray-400">{visibles.length} {agrupar === "dominio" ? "dominios" : "remitentes"}</p>

        <div className="divide-y divide-gray-100">
          {visibles.slice(0, limite).map((f) => {
            const { vigente, sugerida } = reglaDe(f);
            return (
              <div key={f.clave} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="truncate text-[0.88rem] font-medium text-gray-900">{f.titulo}</p>
                  {f.sub && <p className="truncate text-[0.75rem] text-gray-400">{f.sub}</p>}
                  <p className="truncate text-[0.78rem] text-gray-500">
                    {fecha(f.ultima_fecha)} · {f.ultimo_asunto || "(sin asunto)"}
                  </p>
                  {(f.buzones.length > 1 || f.buzones[0] !== "alain") && (
                    <p className="text-[0.72rem] text-gray-400">
                      en {f.buzones.map((id) => corto(datos.buzones.find((b) => b.id === id)?.direccion ?? id)).join(", ")}
                    </p>
                  )}
                </div>
                <div className="w-24 text-[0.8rem] tabular-nums text-gray-600">
                  <b className="text-gray-900">{f.n}</b> correos
                  <br />
                  <span className="text-gray-400">{pct(f.masivos, f.n)} % masivo</span>
                  {f.remitentes ? <><br /><span className="text-gray-400">{f.remitentes} remitentes</span></> : null}
                </div>
                <div className="w-56 text-[0.78rem]">
                  <p className="text-gray-700">{CATEGORIAS[f.categoria]}</p>
                  {vigente ? (
                    <p className="text-gray-900">
                      Regla{vigente.patron !== f.clave ? ` (${vigente.patron})` : ""}: {nombreTrat(vigente.tratamiento)}
                      {vigente.patron === f.clave && <button className="ml-2 text-gray-400 underline" onClick={() => quitar(vigente.patron)}>quitar</button>}
                    </p>
                  ) : sugerida ? (
                    <p className="text-gray-400">Sugerido: {nombreTrat(sugerida.tratamiento)}</p>
                  ) : f.categoria !== "via" ? (
                    <p className="text-gray-400">Sin regla</p>
                  ) : null}
                </div>
                {f.categoria !== "via" && (
                  <button className={boton} onClick={() => setAbierta(abierta === f.clave ? null : f.clave)}>
                    {vigente ? "Cambiar" : "Marcar"}
                  </button>
                )}
                {abierta === f.clave && (
                  <Editor fila={f} porDominio={agrupar === "dominio"} regla={vigente} genericos={genericos} alGuardar={guardar} alCerrar={() => setAbierta(null)} />
                )}
              </div>
            );
          })}
        </div>
        {visibles.length > limite && (
          <button className={`${boton} mt-3`} onClick={() => setLimite(limite + 100)}>Ver más ({visibles.length - limite})</button>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 text-[0.8rem] text-gray-600 sm:p-5">
        <h2 className="mb-2 text-[0.95rem] font-semibold text-gray-900">Qué significa cada tratamiento</h2>
        <ul className="space-y-1">
          {TRATAMIENTOS.map((t) => (
            <li key={t.v}><b className="text-gray-800">{t.t}:</b> {t.d}</li>
          ))}
          <li><b className="text-gray-800">Lo de una vía</b> (charlas, magia) lo sigue llevando su pestaña: aquí no se toca.</li>
        </ul>
      </section>
    </div>
  );
}
