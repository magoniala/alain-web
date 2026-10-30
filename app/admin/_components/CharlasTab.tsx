"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ESTADOS, faseDeEstado } from "@/lib/charlas";
import Bandeja from "./charlas/Bandeja";

// Pestaña Charlas · fase 0 del sistema automático.
//
// Hoy enseña el CRM que antes vivía solo en el vault: pipeline por estado,
// lo que toca hoy y esta semana (fecha_proxima_accion), la ficha de cada
// centro con su Registro y la edición básica. En las fases siguientes se
// le añaden la Bandeja, la cola de leads calientes, las métricas y los
// aprendizajes (ver la arquitectura en el vault).

interface CentroLista {
  id: string;
  nombre: string;
  territorio: string | null;
  localidad: string | null;
  tipo: string | null;
  euskera: string | null;
  estado: string;
  via: string | null;
  responsable: string | null;
  responsable_email: string | null;
  email_centro: string | null;
  telefono: string | null;
  intentos_llamada: number;
  mails_enviados: number;
  fecha_ultimo_contacto: string | null;
  proxima_accion: string | null;
  bloqueado_por: string | null;
  fecha_proxima_accion: string | null;
  nivel_autonomia: "A" | "B" | "C";
  actualizado_en: string;
}

interface Interaccion {
  id: string;
  fecha: string | null;
  canal: string | null;
  texto: string;
  origen: string;
}

interface Detalle {
  centro: CentroLista & { notas: string | null; responsable_cargo: string | null; ampa: string | null; ampa_contacto: string | null; ampa_email: string | null; direccion: string | null; modelo_linguistico: string | null; web: string | null };
  registro: Interaccion[];
  contactos: { id: string; nombre: string | null; cargo: string | null; email: string | null; telefono: string | null; rol: string }[];
  tareas: { id: string; tipo: string; nivel: string; estado: string; fecha_prevista: string }[];
  eventos: { id: string; nombre: string; fecha_evento: string | null; estado_evento: string | null; importe_base: number | null }[];
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function colorEstado(estado: string) {
  const f = faseDeEstado(estado);
  if (f === 7) return "bg-emerald-100 text-emerald-800";
  if (f === 8) return "bg-gray-200 text-gray-600";
  if (f === 9) return "bg-amber-50 text-amber-800";
  if (f === 6) return "bg-[#FDECD3] text-[#8A4B00]";
  if (f >= 3) return "bg-sky-50 text-sky-800";
  return "bg-gray-100 text-gray-700";
}

export default function CharlasTab() {
  const [seccion, setSeccion] = useState<"bandeja" | "crm">(() => {
    try {
      // Si se llega desde una notificación (?tarea=…), siempre a la bandeja.
      if (new URLSearchParams(window.location.search).get("tarea")) return "bandeja";
      return (sessionStorage.getItem("charlas_seccion") as "bandeja" | "crm") || "bandeja";
    } catch {
      return "bandeja";
    }
  });
  const [centros, setCentros] = useState<CentroLista[]>([]);
  const [porEstado, setPorEstado] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [vista, setVista] = useState<"hoy" | "semana" | "todos">("hoy");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroTerritorio, setFiltroTerritorio] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");

  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<string>("");

  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": pw() }), [pw]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/admin/charlas/centros", { headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setCentros(d.centros);
      setPorEstado(d.por_estado);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = useCallback(
    async (id: string) => {
      setSeleccion(id);
      setCargandoDetalle(true);
      try {
        const r = await fetch(`/api/admin/charlas/centros?id=${id}`, { headers: headers() });
        setDetalle(await r.json());
      } finally {
        setCargandoDetalle(false);
      }
    },
    [headers]
  );

  async function guardar(cambios: Record<string, unknown>) {
    if (!detalle) return;
    const r = await fetch("/api/admin/charlas/centros", { method: "PATCH", headers: headers(), body: JSON.stringify({ id: detalle.centro.id, ...cambios }) });
    if (r.ok) {
      await Promise.all([cargar(), abrir(detalle.centro.id)]);
    }
  }

  async function importar(archivo: File) {
    setImportando(true);
    setResultadoImport("");
    try {
      const texto = await archivo.text();
      const r = await fetch("/api/admin/charlas/importar", { method: "POST", headers: headers(), body: texto });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setResultadoImport(
        `${d.centros_nuevos} centros nuevos · ${d.centros_actualizados} actualizados · ${d.interacciones} líneas de registro · ${d.contactos} contactos · ${d.eventos} eventos` +
          (d.errores?.length ? ` · ⚠️ ${d.errores.length} errores: ${d.errores.slice(0, 3).join(" | ")}` : "")
      );
      await cargar();
    } catch (e) {
      setResultadoImport(`Error: ${(e as Error).message}`);
    } finally {
      setImportando(false);
    }
  }

  const hoy = hoyISO();
  const territorios = useMemo(() => Array.from(new Set(centros.map((c) => c.territorio).filter(Boolean) as string[])).sort(), [centros]);

  const activos = (c: CentroLista) => {
    const f = faseDeEstado(c.estado);
    return f !== 7 && f !== 8;
  };

  const visibles = useMemo(() => {
    let lista = centros;
    if (vista === "hoy") lista = lista.filter((c) => activos(c) && c.fecha_proxima_accion && c.fecha_proxima_accion <= hoy);
    if (vista === "semana") lista = lista.filter((c) => activos(c) && c.fecha_proxima_accion && c.fecha_proxima_accion <= sumarDias(hoy, 7));
    if (filtroEstado) lista = lista.filter((c) => c.estado === filtroEstado);
    if (filtroTerritorio) lista = lista.filter((c) => c.territorio === filtroTerritorio);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter((c) => [c.nombre, c.localidad, c.responsable, c.responsable_email, c.email_centro].some((v) => v?.toLowerCase().includes(q)));
    }
    return [...lista].sort((a, b) => (a.fecha_proxima_accion ?? "9999").localeCompare(b.fecha_proxima_accion ?? "9999") || a.nombre.localeCompare(b.nombre));
  }, [centros, vista, filtroEstado, filtroTerritorio, busqueda, hoy]);

  const sinProxima = centros.filter((c) => activos(c) && !c.fecha_proxima_accion).length;

  function irA(s: "bandeja" | "crm") {
    setSeccion(s);
    try {
      sessionStorage.setItem("charlas_seccion", s);
    } catch {}
  }

  const selector = (
    <div className="mb-5 flex gap-1 border-b border-gray-200">
      {(["bandeja", "crm"] as const).map((s) => (
        <button
          key={s}
          onClick={() => irA(s)}
          className={`-mb-px border-b-2 px-4 py-2 text-[0.9rem] ${seccion === s ? "border-[#0F2240] font-medium text-[#0F2240]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          {s === "bandeja" ? "Bandeja" : "CRM"}
        </button>
      ))}
    </div>
  );

  if (seccion === "bandeja") {
    return (
      <div>
        {selector}
        <Bandeja centros={centros.map((c) => ({ id: c.id, nombre: c.nombre }))} onCambio={cargar} />
      </div>
    );
  }

  if (cargando && centros.length === 0) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      {selector}
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      {/* Pipeline */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[1rem] font-semibold">Pipeline · {centros.length} centros</h2>
          {sinProxima > 0 && (
            <button onClick={() => { setVista("todos"); setFiltroEstado(""); setBusqueda(""); }} className="text-[0.8rem] text-[#C47800]">
              {sinProxima} activos sin próxima acción
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.filter((e) => porEstado[e]).map((e) => (
            <button
              key={e}
              onClick={() => { setFiltroEstado(filtroEstado === e ? "" : e); setVista("todos"); }}
              className={`rounded-full px-3 py-1 text-[0.8rem] ring-1 ring-transparent ${colorEstado(e)} ${filtroEstado === e ? "ring-gray-900" : ""}`}
            >
              {e} <span className="font-semibold">{porEstado[e]}</span>
            </button>
          ))}
          {Object.keys(porEstado)
            .filter((e) => !(ESTADOS as readonly string[]).includes(e))
            .map((e) => (
              <button key={e} onClick={() => { setFiltroEstado(filtroEstado === e ? "" : e); setVista("todos"); }} className={`rounded-full px-3 py-1 text-[0.8rem] ${colorEstado(e)}`}>
                {e} <span className="font-semibold">{porEstado[e]}</span>
              </button>
            ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Lista */}
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(["hoy", "semana", "todos"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-[0.85rem] ${vista === v ? "bg-[#0F2240] text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}
              >
                {v === "hoy" ? "Hoy" : v === "semana" ? "Esta semana" : "Todos"}
              </button>
            ))}
            <select value={filtroTerritorio} onChange={(e) => setFiltroTerritorio(e.target.value)} className="ml-auto border border-gray-300 bg-white px-2 py-1.5 text-[0.85rem]">
              <option value="">Todos los territorios</option>
              {territorios.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar centro, persona, correo…"
              className="w-full border border-gray-300 bg-white px-3 py-1.5 text-[0.85rem] sm:w-auto"
            />
          </div>
          <p className="mb-2 text-[0.78rem] text-gray-500">{visibles.length} centros{filtroEstado ? ` · ${filtroEstado}` : ""}</p>

          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {visibles.length === 0 && <li className="p-5 text-[0.9rem] text-gray-500">Nada por aquí.</li>}
            {visibles.slice(0, 400).map((c) => (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-gray-50 ${seleccion === c.id ? "bg-[#fbf9f5]" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[0.92rem] font-medium">{c.nombre}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] ${colorEstado(c.estado)}`}>{c.estado}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-[0.78rem] text-gray-500">
                    <span>{c.localidad}{c.territorio ? ` · ${c.territorio}` : ""}</span>
                    {c.responsable && <span>{c.responsable}</span>}
                    {c.euskera === "sí" && <span>EU</span>}
                    {c.bloqueado_por && <span className="text-amber-700">bloqueado: {c.bloqueado_por}</span>}
                    <span className={`ml-auto ${c.fecha_proxima_accion && c.fecha_proxima_accion < hoy ? "text-[#DC2626]" : ""}`}>{fmtFecha(c.fecha_proxima_accion)}</span>
                  </div>
                  {c.proxima_accion && <p className="truncate text-[0.8rem] text-gray-600">{c.proxima_accion}</p>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Ficha */}
        <section className="min-w-0">
          {!seleccion && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-[0.9rem] text-gray-500">
              Elige un centro para ver su ficha y su Registro.
            </div>
          )}
          {seleccion && cargandoDetalle && !detalle && <p className="text-gray-500">Cargando ficha…</p>}
          {seleccion && detalle && <Ficha detalle={detalle} onGuardar={guardar} />}
        </section>
      </div>

      {/* Importación desde el vault */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-[1rem] font-semibold">Importar desde el vault</h2>
        <p className="mt-1 text-[0.85rem] text-gray-600">
          Sube el <code>vault-export.json</code> que genera <code>scripts/charlas/exportar-vault.py</code>. Actualiza los centros por nombre y reescribe el Registro
          que venía del vault; lo que haya añadido el panel o el sistema no se toca.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="application/json"
            disabled={importando}
            onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
            className="text-[0.85rem]"
          />
          {importando && <span className="text-[0.85rem] text-gray-500">Importando…</span>}
        </div>
        {resultadoImport && <p className="mt-3 text-[0.85rem] text-gray-800">{resultadoImport}</p>}
      </section>
    </div>
  );
}

function Ficha({ detalle, onGuardar }: { detalle: Detalle; onGuardar: (cambios: Record<string, unknown>) => Promise<void> }) {
  const c = detalle.centro;
  const [estado, setEstado] = useState(c.estado);
  const [proxima, setProxima] = useState(c.proxima_accion ?? "");
  const [fecha, setFecha] = useState(c.fecha_proxima_accion ?? "");
  const [nivel, setNivel] = useState(c.nivel_autonomia);
  const [nuevaLinea, setNuevaLinea] = useState("");
  const [canal, setCanal] = useState("Manual");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setEstado(c.estado);
    setProxima(c.proxima_accion ?? "");
    setFecha(c.fecha_proxima_accion ?? "");
    setNivel(c.nivel_autonomia);
    setNuevaLinea("");
  }, [c.id, c.estado, c.proxima_accion, c.fecha_proxima_accion, c.nivel_autonomia]);

  const cambiado = estado !== c.estado || proxima !== (c.proxima_accion ?? "") || fecha !== (c.fecha_proxima_accion ?? "") || nivel !== c.nivel_autonomia || nuevaLinea.trim() !== "";

  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar({
        estado,
        proxima_accion: proxima,
        fecha_proxima_accion: fecha || null,
        nivel_autonomia: nivel,
        ...(nuevaLinea.trim() ? { registro: nuevaLinea, registro_canal: canal, fecha_ultimo_contacto: hoyISO() } : {}),
      });
      setNuevaLinea("");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.1rem] font-semibold leading-tight">{c.nombre}</h2>
            <p className="mt-1 text-[0.82rem] text-gray-500">
              {c.direccion} · {c.tipo} · {c.modelo_linguistico} {c.euskera === "sí" ? "· euskera" : c.euskera === "parcial" ? "· euskera parcial" : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] ${colorEstado(c.estado)}`}>{c.estado}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.85rem] sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Responsable</dt>
            <dd>{c.responsable ?? "—"}{c.responsable_cargo ? ` (${c.responsable_cargo})` : ""}</dd>
            {c.responsable_email && <dd className="truncate text-gray-600">{c.responsable_email}</dd>}
          </div>
          <div>
            <dt className="text-gray-500">Centro</dt>
            <dd>{c.telefono ?? "—"}</dd>
            {c.email_centro && <dd className="truncate text-gray-600">{c.email_centro}</dd>}
          </div>
          <div>
            <dt className="text-gray-500">Vía · llamadas · mails</dt>
            <dd>{c.via ?? "—"} · {c.intentos_llamada} · {c.mails_enviados}</dd>
            <dd className="text-gray-600">último: {fmtFecha(c.fecha_ultimo_contacto)}</dd>
          </div>
          {c.ampa_contacto || c.ampa_email ? (
            <div>
              <dt className="text-gray-500">AMPA</dt>
              <dd>{c.ampa_contacto ?? c.ampa ?? "—"}</dd>
              {c.ampa_email && <dd className="truncate text-gray-600">{c.ampa_email}</dd>}
            </div>
          ) : null}
          {c.bloqueado_por && (
            <div>
              <dt className="text-gray-500">Bloqueado por</dt>
              <dd className="text-amber-800">{c.bloqueado_por}</dd>
            </div>
          )}
          {detalle.eventos.length > 0 && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-gray-500">Eventos</dt>
              {detalle.eventos.map((e) => (
                <dd key={e.id}>
                  {e.nombre} · {e.estado_evento} · {e.importe_base ? `${e.importe_base} € base` : ""}
                </dd>
              ))}
            </div>
          )}
        </dl>
      </div>

      {/* Edición */}
      <div className="grid gap-3 border-b border-gray-100 p-5 sm:grid-cols-2">
        <label className="text-[0.8rem] text-gray-600">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            {!(ESTADOS as readonly string[]).includes(estado) && <option value={estado}>{estado}</option>}
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600">
          Nivel de autonomía
          <select value={nivel} onChange={(e) => setNivel(e.target.value as "A" | "B" | "C")} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            <option value="A">A · el sistema envía solo</option>
            <option value="B">B · el sistema redacta, yo apruebo</option>
            <option value="C">C · solo yo</option>
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600 sm:col-span-2">
          Próxima acción
          <input value={proxima} onChange={(e) => setProxima(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" />
        </label>
        <label className="text-[0.8rem] text-gray-600">
          Fecha próxima acción
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" />
        </label>
        <label className="text-[0.8rem] text-gray-600">
          Canal de la línea nueva
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            {["Manual", "Llamada", "Mail", "Mail AMPA", "WhatsApp", "Reunión", "Recibido"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600 sm:col-span-2">
          Añadir al Registro (hoy)
          <textarea value={nuevaLinea} onChange={(e) => setNuevaLinea(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" placeholder="Qué ha pasado y cuál es el siguiente paso" />
        </label>
        <div className="sm:col-span-2">
          <button onClick={guardar} disabled={!cambiado || guardando} className="bg-[#1a1a1a] px-4 py-2 text-[0.88rem] font-medium text-white disabled:opacity-40">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Registro */}
      <div className="p-5">
        <h3 className="mb-2 text-[0.9rem] font-semibold">Registro · {detalle.registro.length}</h3>
        <ol className="space-y-2 text-[0.85rem]">
          {[...detalle.registro].reverse().map((r) => (
            <li key={r.id} className="flex gap-3">
              <span className="w-[62px] shrink-0 text-gray-500">{fmtFecha(r.fecha)}</span>
              <span className="w-[72px] shrink-0 text-gray-500">{r.canal ?? ""}</span>
              <span className={`min-w-0 whitespace-pre-wrap ${r.origen !== "vault" ? "text-[#0F2240]" : ""}`}>{r.texto}</span>
            </li>
          ))}
        </ol>
        {c.notas && (
          <>
            <h3 className="mb-2 mt-5 text-[0.9rem] font-semibold">Notas</h3>
            <p className="whitespace-pre-wrap text-[0.85rem] text-gray-700">{c.notas}</p>
          </>
        )}
      </div>
    </div>
  );
}
