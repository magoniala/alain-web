"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Datos } from "@/lib/valoracion";
import { DatosCtx } from "./valoracion/campos";
import Hoja, { SECCIONES } from "./valoracion/Hoja";
import Informe from "./valoracion/Informe";
import Cronometro from "./valoracion/Cronometro";

// Valoración inicial online: la plantilla en PDF hecha formulario.
//
// Que no se pierda nada: cada cambio se escribe al instante en el navegador
// (localStorage) y, medio segundo después, en Supabase. Si el servidor falla
// o no hay red, se reintenta solo cada pocos segundos y la copia local se
// queda marcada como «sin subir»; al volver a abrir la valoración, esa copia
// gana a la del servidor y se sube. El servidor guarda además una copia
// completa cada 2 minutos en valoraciones_sesion_historial.

type Fila = { id: string; cliente: string | null; fecha: string | null; pareja_id: string | null; updated_at: string };
type Local = { datos: Datos; subido: boolean; t: number };
type Estado = "guardado" | "pendiente" | "guardando" | "error";

const PREFIJO = "valoracion:";

function leerLocal(id: string): Local | null {
  try {
    const raw = localStorage.getItem(PREFIJO + id);
    return raw ? (JSON.parse(raw) as Local) : null;
  } catch {
    return null;
  }
}

function escribirLocal(id: string, datos: Datos, subido: boolean) {
  try {
    localStorage.setItem(PREFIJO + id, JSON.stringify({ datos, subido, t: Date.now() }));
  } catch {
    // Sin localStorage seguimos teniendo el servidor.
  }
}

function borrarLocal(id: string) {
  try {
    localStorage.removeItem(PREFIJO + id);
  } catch {}
}

// Borra en el servidor (con su historial) y en este navegador. Pide
// confirmación antes. Devuelve si se ha borrado.
async function eliminarValoracion(id: string, nombre: string, soloLocal = false): Promise<boolean> {
  const quien = nombre.trim() || "sin nombre";
  if (!window.confirm(`¿Eliminar la valoración de ${quien}?\n\nSe borran también sus copias de seguridad. No se puede deshacer.`)) return false;
  if (!soloLocal) {
    try {
      const res = await fetch(`/api/admin/valoraciones?id=${id}`, { method: "DELETE", headers: cabeceras() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`No se ha podido eliminar: ${j.error || `error ${res.status}`}`);
        return false;
      }
    } catch {
      window.alert("No se ha podido eliminar: sin conexión. Inténtalo cuando vuelva la red.");
      return false;
    }
  }
  borrarLocal(id);
  return true;
}

// Valoraciones que solo existen en este navegador (creadas sin red, o con
// cambios que no llegaron a subir).
function localesSinSubir(): { id: string; local: Local }[] {
  const out: { id: string; local: Local }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIJO)) continue;
      const local = leerLocal(k.slice(PREFIJO.length));
      if (local && !local.subido) out.push({ id: k.slice(PREFIJO.length), local });
    }
  } catch {}
  return out;
}

function cabeceras() {
  return { "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" };
}

function hoy() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

async function subir(id: string, datos: Datos, keepalive = false) {
  const res = await fetch("/api/admin/valoraciones", {
    method: "PUT",
    headers: cabeceras(),
    body: JSON.stringify({ id, datos }),
    keepalive,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Error ${res.status}`);
  }
}

function IconoPapelera() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M9 9v5m2-5v5" />
    </svg>
  );
}

function BotonEliminar({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Eliminar"
      aria-label="Eliminar valoración"
      className={`flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 transition-opacity hover:bg-[#FDECEB] hover:text-[#B3261E] ${className}`}
    >
      <IconoPapelera />
    </button>
  );
}

export default function ValoracionTab() {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [errorLista, setErrorLista] = useState("");

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/valoraciones", { headers: cabeceras() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setFilas(j.valoraciones);
      setErrorLista("");
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : String(e));
      setFilas((f) => f ?? []);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("valoracion");
    if (id) setAbierta(id);
    cargarLista();
  }, [cargarLista]);

  // El id va en la URL: recargar la página vuelve a la misma valoración.
  function abrir(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("valoracion", id);
    else url.searchParams.delete("valoracion");
    url.searchParams.set("tab", "Valoración");
    window.history.replaceState(null, "", url);
    setAbierta(id);
    if (!id) cargarLista();
  }

  function nueva(base: Datos = {}, id: string = crypto.randomUUID()) {
    escribirLocal(id, { ...hoy(), ...base }, false);
    abrir(id);
  }

  if (abierta) {
    return (
      <Editor
        key={abierta}
        id={abierta}
        filas={filas ?? []}
        onCerrar={() => abrir(null)}
        onAbrir={abrir}
        onNueva={nueva}
        onEliminada={() => abrir(null)}
      />
    );
  }

  return <Lista filas={filas} error={errorLista} onAbrir={abrir} onNueva={() => nueva()} onCambio={cargarLista} />;
}

function Lista({
  filas,
  error,
  onAbrir,
  onNueva,
  onCambio,
}: {
  filas: Fila[] | null;
  error: string;
  onAbrir: (id: string) => void;
  onNueva: () => void;
  onCambio: () => void;
}) {
  const [locales, setLocales] = useState<{ id: string; local: Local }[]>([]);
  useEffect(() => setLocales(localesSinSubir()), [filas]);
  const enServidor = new Set((filas ?? []).map((f) => f.id));
  const soloLocales = locales.filter((l) => !enServidor.has(l.id));
  const conCambiosSinSubir = new Set(locales.map((l) => l.id));

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400">Valoraciones iniciales</p>
        <button onClick={onNueva} className="bg-[#1a1a1a] px-4 py-2 text-sm text-white">
          + Nueva valoración
        </button>
      </div>

      {error && (
        <p className="mb-4 border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
          No se ha podido cargar la lista del servidor ({error}). Si la tabla aún no existe, hay que ejecutar valoraciones_sesion.sql.
        </p>
      )}

      {soloLocales.length > 0 && (
        <div className="mb-5 border border-[#F2DBA6] bg-[#FFFAF0] p-3">
          <p className="mb-2 text-[0.8rem] text-[#9A6400]">Solo en este navegador, pendientes de subir:</p>
          {soloLocales.map(({ id, local }) => (
            <div key={id} className="flex items-center justify-between gap-3 py-1">
              <button onClick={() => onAbrir(id)} className="text-left text-[0.9rem] underline">
                {(local.datos.cliente as string) || "Sin nombre"} · {(local.datos.fecha as string) || "—"}
              </button>
              <BotonEliminar
                onClick={async () => {
                  if (await eliminarValoracion(id, (local.datos.cliente as string) || "", true)) setLocales(localesSinSubir());
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!filas ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : filas.length === 0 && !soloLocales.length ? (
        <p className="text-sm text-gray-400">Aún no hay ninguna.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 bg-white">
          {filas.map((f) => (
            <div key={f.id} className="group flex items-center hover:bg-gray-50">
            <button
              onClick={() => onAbrir(f.id)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="font-medium">{f.cliente || "Sin nombre"}</span>
                {f.pareja_id && <span className="ml-2 text-[0.75rem] text-gray-400">pareja</span>}
                {conCambiosSinSubir.has(f.id) && <span className="ml-2 text-[0.75rem] text-[#9A6400]">cambios sin subir</span>}
              </span>
              <span className="text-[0.82rem] text-gray-400">
                {f.fecha || "—"} · editada {new Date(f.updated_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </button>
            <BotonEliminar
              className="mr-2 opacity-40 group-hover:opacity-100"
              onClick={async () => {
                if (await eliminarValoracion(f.id, f.cliente || "")) onCambio();
              }}
            />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({
  id,
  filas,
  onCerrar,
  onAbrir,
  onNueva,
  onEliminada,
}: {
  id: string;
  filas: Fila[];
  onCerrar: () => void;
  onAbrir: (id: string) => void;
  onNueva: (base: Datos, id: string) => void;
  onEliminada: () => void;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<Estado>("guardado");
  const [ultimo, setUltimo] = useState<Date | null>(null);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState<"hoja" | "informe">("hoja");
  const [activa, setActiva] = useState<string>("cabecera");

  const datosRef = useRef<Datos>({});
  const sucio = useRef(false);
  const enVuelo = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tras eliminarla no se vuelve a subir nada: ni el guardado pendiente ni
  // el de «al cerrar», que la resucitarían.
  const borrada = useRef(false);

  const guardar = useCallback(async () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    if (borrada.current) return;
    if (enVuelo.current) return; // al terminar el que está en vuelo, se vuelve a mirar
    if (!sucio.current) return;
    enVuelo.current = true;
    sucio.current = false;
    const enviado = datosRef.current;
    setEstado("guardando");
    try {
      await subir(id, enviado);
      // Solo se marca como subida si no ha cambiado nada mientras tanto.
      if (datosRef.current === enviado) escribirLocal(id, enviado, true);
      setUltimo(new Date());
      setErrorGuardado("");
      setEstado(sucio.current ? "pendiente" : "guardado");
    } catch (e) {
      sucio.current = true;
      setErrorGuardado(e instanceof Error ? e.message : String(e));
      setEstado("error");
      temporizador.current = setTimeout(() => guardar(), 4000);
    } finally {
      enVuelo.current = false;
      if (sucio.current && !temporizador.current) temporizador.current = setTimeout(() => guardar(), 300);
    }
  }, [id]);

  const setMany = useCallback(
    (cambios: Datos) => {
      const nuevo = { ...datosRef.current, ...cambios };
      datosRef.current = nuevo;
      setDatos(nuevo);
      escribirLocal(id, nuevo, false);
      sucio.current = true;
      setEstado((e) => (e === "error" ? e : "pendiente"));
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => guardar(), 600);
    },
    [id, guardar]
  );

  // Carga: la copia local sin subir gana; si no, la del servidor.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const local = leerLocal(id);
      let servidor: Datos | null = null;
      let fallo = "";
      try {
        const res = await fetch(`/api/admin/valoraciones?id=${id}`, { headers: cabeceras() });
        if (res.ok) servidor = (await res.json()).datos;
        else if (res.status !== 404) fallo = `servidor: error ${res.status}`;
      } catch {
        fallo = "sin conexión";
      }
      if (cancelado) return;
      let inicial: Datos;
      if (local && !local.subido) {
        inicial = local.datos;
        sucio.current = true;
        if (servidor) setAviso("Había cambios en este navegador que no llegaron a subir: se han recuperado y se suben ahora.");
      } else if (servidor) {
        inicial = servidor;
        escribirLocal(id, servidor, true);
      } else if (local) {
        inicial = local.datos;
        if (fallo) setAviso(`No se ha podido leer del servidor (${fallo}). Abierta la copia de este navegador.`);
      } else {
        inicial = {};
        if (fallo) setAviso(`No se ha podido leer del servidor (${fallo}).`);
      }
      datosRef.current = inicial;
      setDatos(inicial);
      if (sucio.current) guardar();
    })();
    return () => {
      cancelado = true;
    };
  }, [id, guardar]);

  // Al cambiar de pestaña o cerrar: subir lo que quede. Y si aún hay algo
  // sin subir al cerrar, que el navegador pregunte.
  useEffect(() => {
    const alOcultar = () => {
      if (borrada.current) return;
      if (document.visibilityState === "hidden" && sucio.current) {
        subir(id, datosRef.current, true)
          .then(() => {
            sucio.current = false;
            escribirLocal(id, datosRef.current, true);
          })
          .catch(() => {});
      }
    };
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (!borrada.current && (sucio.current || enVuelo.current)) {
        subir(id, datosRef.current, true).catch(() => {});
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("beforeunload", antesDeSalir);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("beforeunload", antesDeSalir);
      if (sucio.current && !borrada.current) subir(id, datosRef.current, true).catch(() => {});
    };
  }, [id]);

  // Sección visible, para resaltarla en el índice.
  useEffect(() => {
    if (vista !== "hoja" || !datos) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva((visible.target as HTMLElement).dataset.seccion || "");
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    document.querySelectorAll("[data-seccion]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [vista, datos !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ d: datos ?? {}, setMany }), [datos, setMany]);

  const parejaId = typeof datos?.parejaId === "string" ? datos.parejaId : null;
  const parejaNombre = parejaId ? filas.find((f) => f.id === parejaId)?.cliente ?? null : null;

  async function irAPareja() {
    if (!datos) return;
    await guardar();
    if (parejaId) return onAbrir(parejaId);
    // Ficha nueva con la cabecera compartida, y enlazadas en los dos sentidos.
    const comun: Datos = {};
    for (const k of ["fecha", "hora", "modalidad", "conversacionPrevia", "dispositivos"]) if (datos[k]) comun[k] = datos[k];
    const nuevoId = crypto.randomUUID();
    const actualizado = { ...datosRef.current, parejaId: nuevoId };
    datosRef.current = actualizado;
    escribirLocal(id, actualizado, false);
    try {
      await subir(id, actualizado);
      escribirLocal(id, actualizado, true);
    } catch {
      // Queda como «sin subir» en este navegador y se sube al volver a abrirla.
    }
    onNueva({ ...comun, parejaId: id }, nuevoId);
  }

  function irA(sec: string) {
    if (sec === "informe" && vista === "hoja") {
      document.getElementById("informe")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setVista("hoja");
    setTimeout(() => document.getElementById(sec)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  if (!datos) return <p className="text-sm text-gray-400">Abriendo…</p>;

  const etiquetaEstado =
    estado === "guardado"
      ? ultimo
        ? `Guardado ${ultimo.toLocaleTimeString("es-ES")}`
        : "Guardado"
      : estado === "guardando"
        ? "Guardando…"
        : estado === "pendiente"
          ? "Cambios sin guardar…"
          : "Sin conexión con el servidor · guardado en este navegador · reintentando";
  const colorEstado =
    estado === "error" ? "text-[#B3261E]" : estado === "guardado" ? "text-[#1E7B3A]" : "text-[#9A6400]";

  return (
    <DatosCtx.Provider value={ctx}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:self-start lg:overflow-y-auto">
          <button onClick={onCerrar} className="mb-3 text-[0.8rem] text-gray-500 hover:text-[#1a1a1a]">
            ← Todas las valoraciones
          </button>
          <p className={`mb-3 text-[0.78rem] leading-snug ${colorEstado}`} title={errorGuardado}>
            ● {etiquetaEstado}
          </p>

          <div className="mb-3 flex border border-gray-300">
            {(["hoja", "informe"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`flex-1 py-1.5 text-[0.8rem] ${vista === v ? "bg-[#1a1a1a] text-white" : "bg-white text-gray-600"}`}
              >
                {v === "hoja" ? "Hoja" : "Informe"}
              </button>
            ))}
          </div>

          <nav className="mb-4 hidden border border-gray-200 bg-white lg:block">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                onClick={() => irA(s.id)}
                className={`flex w-full items-baseline justify-between border-l-2 px-3 py-1.5 text-left text-[0.8rem] ${
                  vista === "hoja" && activa === s.id
                    ? "border-[#1a1a1a] bg-gray-50 font-medium text-[#1a1a1a]"
                    : "border-transparent text-gray-500 hover:text-[#1a1a1a]"
                } ${s.id === "fc" ? "text-[#B3261E]" : ""}`}
              >
                {s.titulo}
                {"tiempo" in s && s.tiempo && <span className="text-[0.7rem] text-gray-400">{s.tiempo}</span>}
              </button>
            ))}
          </nav>

          <Cronometro />

          <button
            onClick={async () => {
              const pausa = borrada.current;
              borrada.current = true;
              if (temporizador.current) clearTimeout(temporizador.current);
              const ok = await eliminarValoracion(id, typeof datos.cliente === "string" ? datos.cliente : "");
              if (ok) return onEliminada();
              borrada.current = pausa;
              if (sucio.current) guardar();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 border border-transparent py-2 text-[0.8rem] text-gray-400 hover:border-[#F4C7C3] hover:bg-[#FDECEB] hover:text-[#B3261E]"
          >
            <IconoPapelera /> Eliminar valoración
          </button>
        </aside>

        <div className="min-w-0">
          {aviso && (
            <p className="mb-4 border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
              {aviso}{" "}
              <button onClick={() => setAviso("")} className="ml-2 underline">
                Vale
              </button>
            </p>
          )}

          {vista === "hoja" ? (
            <>
              <Hoja parejaNombre={parejaNombre} onPareja={irAPareja} />
              <section id="informe" data-seccion="informe" className="mt-5 scroll-mt-20 rounded-2xl border border-gray-200 bg-[#fbf9f5] p-5 md:p-7 lg:scroll-mt-6">
                <Informe />
              </section>
            </>
          ) : (
            <div className="border border-gray-200 bg-[#fafafa] p-6 md:p-10">
              <Informe grande />
            </div>
          )}
        </div>
      </div>
    </DatosCtx.Provider>
  );
}
