"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// App del cliente de Entrenatzaile (fase 7b). Entra por su enlace personal.
// Pantallas: Semana (qué toca) → Sesión (registro serie a serie) →
// Formulario post-sesión → y, al día siguiente, Formulario de recuperación.
// Todo lo que pide por serie viene de `campos` de cada ejercicio (lo decide
// Alain en el panel). Sin contraseña, sin cuentas: el enlace es la llave.

interface Ejercicio {
  id: string;
  orden: number;
  nombre: string;
  series: number | null;
  reps: string | null;
  carga: string | null;
  tempo: string | null;
  descanso: string | null;
  rir: string | null;
  notas: string | null;
  video: boolean;
  superserie: string | null;
  campos: string[];
}
interface Sesion {
  id: string;
  clave: string | null;
  nombre: string;
  fecha: string;
  duracion_min: number | null;
  foco: string | null;
  calentamiento: string | null;
  notas: string | null;
  estado: string;
  rpe: number | null;
  minutos: number | null;
  ejercicios: Ejercicio[];
}
interface Serie {
  id: string;
  ejercicio_id: string;
  sesion_id: string;
  serie: number;
  lado: string | null;
  reps: number | null;
  peso: number | null;
  rir: number | null;
  tiempo_s: number | null;
  nota: string | null;
  completada: boolean;
}
interface Datos {
  cliente: { nombre: string; idioma: string; zonas_riesgo: string | null; aviso_canal: string };
  hoy: string;
  semanas: { id: string; numero: number; lunes: string; titulo: string | null; estado: string }[];
  actual_id: string | null;
  semana: { id: string; numero: number; lunes: string; titulo: string | null; notas: string | null; rir_objetivo: string | null; fase: string | null; resumen: string | null } | null;
  sesiones: Sesion[];
  series: Serie[];
  formularios: { sesion_id: string; tipo: string }[];
  recuperacion_pendiente: { sesion_id: string; nombre: string; fecha: string } | null;
  constancia: { hechas: number; programadas: number };
  vapid: string | null;
}

const DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIA_C = ["", "L", "M", "X", "J", "V", "S", "D"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
const sumar = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const corta = (iso: string) => `${Number(iso.slice(8))} ${MES[Number(iso.slice(5, 7)) - 1]}`;
const ETIQ: Record<string, string> = { reps: "Reps", peso: "Kg", rir: "RIR", tempo: "Tempo", tiempo: "Seg", nota: "Nota", lado: "Lado", video: "Vídeo" };

function urlBase64ToUint8Array(b64: string) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function AppCliente() {
  const { token } = useParams<{ token: string }>();
  const q = useSearchParams();
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [pantalla, setPantalla] = useState<{ tipo: "semana" } | { tipo: "sesion"; id: string } | { tipo: "post"; id: string } | { tipo: "recuperacion"; id: string } | { tipo: "historial" }>({ tipo: "semana" });
  const [aviso, setAviso] = useState("");
  const api = useCallback(
    async (body?: Record<string, unknown>, semana?: string) => {
      const r = await fetch(`/api/app/${token}${semana ? `?semana=${semana}` : ""}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error");
      return j;
    },
    [token],
  );
  const cargar = useCallback(
    async (semana?: string) => {
      try {
        const j = (await api(undefined, semana)) as Datos;
        setD(j);
        setError("");
      } catch (e) {
        setError((e as Error).message === "Enlace no válido." ? "Este enlace no es válido. Pídele a Alain el tuyo." : "Sin conexión. Vuelve a intentarlo.");
      }
    },
    [api],
  );
  useEffect(() => {
    cargar();
  }, [cargar]);
  // Abierta desde una notificación: va directa a la sesión o al formulario.
  useEffect(() => {
    if (!d) return;
    const s = q.get("sesion");
    if (s && d.sesiones.some((x) => x.id === s)) setPantalla({ tipo: "sesion", id: s });
    else if (q.get("form") === "recuperacion" && d.recuperacion_pendiente) setPantalla({ tipo: "recuperacion", id: d.recuperacion_pendiente.sesion_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.actual_id]);

  // Service worker + push.
  const [pushEstado, setPushEstado] = useState<"no" | "pedir" | "ok" | "denegado">("no");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.register("/app-sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushEstado(sub ? "ok" : Notification.permission === "denied" ? "denegado" : "pedir");
    }).catch(() => null);
  }, []);
  const activarPush = async () => {
    try {
      if (!d?.vapid) return setAviso("Las notificaciones aún no están configuradas.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(d.vapid) });
      await api({ accion: "push", suscripcion: sub.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) });
      setPushEstado("ok");
      setAviso("Avisos activados.");
    } catch {
      setPushEstado(Notification.permission === "denied" ? "denegado" : "pedir");
      setAviso("No se han podido activar los avisos.");
    }
  };

  if (error) return <Marco><p className="rounded-2xl bg-white p-5 text-[0.95rem] text-gray-700">{error}</p></Marco>;
  if (!d) return <Marco><p className="text-gray-500">Cargando…</p></Marco>;

  const sesion = pantalla.tipo === "sesion" || pantalla.tipo === "post" ? d.sesiones.find((s) => s.id === pantalla.id) ?? null : null;

  return (
    <Marco>
      {aviso && (
        <p className="mb-3 flex justify-between rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">
          <span>{aviso}</span>
          <button onClick={() => setAviso("")}>✕</button>
        </p>
      )}
      {pantalla.tipo === "semana" && (
        <Semana d={d} ir={setPantalla} pushEstado={pushEstado} activarPush={activarPush} cargar={cargar} />
      )}
      {pantalla.tipo === "historial" && <Historial d={d} cargar={cargar} volver={() => setPantalla({ tipo: "semana" })} />}
      {pantalla.tipo === "sesion" && sesion && (
        <SesionPantalla s={sesion} series={d.series.filter((x) => x.sesion_id === sesion.id)} api={api} volver={() => { cargar(); setPantalla({ tipo: "semana" }); }} terminar={() => setPantalla({ tipo: "post", id: sesion.id })} />
      )}
      {pantalla.tipo === "post" && sesion && (
        <FormPost s={sesion} api={api} hecho={async () => { await cargar(); setPantalla({ tipo: "semana" }); setAviso("Sesión guardada. ¡Buen trabajo!"); }} />
      )}
      {pantalla.tipo === "recuperacion" && (
        <FormRecuperacion sesionId={pantalla.id} zonas={d.cliente.zonas_riesgo} api={api} hecho={async () => { await cargar(); setPantalla({ tipo: "semana" }); setAviso("Gracias. Alain lo verá."); }} />
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f2ec] text-gray-900" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto max-w-md px-4 pb-10 pt-5">{children}</div>
    </main>
  );
}

function Boton({ children, onClick, tipo = "primario", disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; tipo?: "primario" | "secundario" | "texto"; disabled?: boolean; className?: string }) {
  const base = "w-full rounded-2xl px-4 py-3.5 text-[1rem] font-medium transition active:scale-[0.99] disabled:opacity-40";
  const cls = tipo === "primario" ? "bg-[#0F2240] text-white" : tipo === "secundario" ? "bg-white text-gray-900 ring-1 ring-gray-300" : "text-gray-600";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${cls} ${className}`}>
      {children}
    </button>
  );
}

function Semana({ d, ir, pushEstado, activarPush, cargar }: { d: Datos; ir: (p: { tipo: "sesion"; id: string } | { tipo: "recuperacion"; id: string } | { tipo: "historial" }) => void; pushEstado: string; activarPush: () => void; cargar: (s?: string) => void }) {
  const w = d.semana;
  const dias = w ? Array.from({ length: 7 }, (_, i) => sumar(w.lunes, i)) : [];
  const hoyS = d.sesiones.filter((s) => s.fecha === d.hoy && s.estado === "programada");
  const proxima = d.sesiones.filter((s) => s.fecha > d.hoy && s.estado === "programada")[0];
  const hechasSemana = d.sesiones.filter((s) => s.estado === "hecha" || s.estado === "incompleta").length;
  const esActual = w?.id === d.actual_id;
  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-[0.8rem] uppercase tracking-wide text-gray-500">Entrenatzaile</p>
          <h1 className="text-[1.5rem] font-semibold leading-tight">Hola, {d.cliente.nombre.split(" ")[0]}</h1>
        </div>
        <button onClick={() => ir({ tipo: "historial" })} className="text-[0.85rem] text-gray-500 underline-offset-2 hover:underline">Semanas</button>
      </header>

      {d.recuperacion_pendiente && (
        <button onClick={() => ir({ tipo: "recuperacion", id: d.recuperacion_pendiente!.sesion_id })} className="w-full rounded-2xl bg-[#E8A33D]/15 p-4 text-left ring-1 ring-[#E8A33D]/40">
          <p className="text-[0.8rem] font-medium uppercase tracking-wide text-[#8A4B00]">Un minuto</p>
          <p className="text-[0.95rem]">¿Cómo te has levantado después de la {d.recuperacion_pendiente.nombre.replace(/^([A-Z])\s*·\s*/, "$1, ")}?</p>
        </button>
      )}

      {!w ? (
        <p className="rounded-2xl bg-white p-5 text-gray-600">Todavía no hay semana programada. Alain te avisará.</p>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[0.95rem] font-semibold">Semana {w.numero}{w.titulo ? ` · ${w.titulo}` : ""}</p>
              <p className="text-[0.8rem] text-gray-500">{corta(w.lunes)} – {corta(sumar(w.lunes, 6))}</p>
            </div>
            {w.rir_objetivo && <p className="mt-0.5 text-[0.82rem] text-gray-600">Esta semana, todo a RIR {w.rir_objetivo}{w.fase ? ` · ${w.fase}` : ""}</p>}
            {w.notas && <p className="mt-2 whitespace-pre-line text-[0.9rem] text-gray-700">{w.notas.replace(/\*\*/g, "")}</p>}
            <div className="mt-3 grid grid-cols-7 gap-1">
              {dias.map((f) => {
                const ses = d.sesiones.filter((s) => s.fecha === f);
                const hecha = ses.some((s) => s.estado === "hecha" || s.estado === "incompleta");
                const saltada = ses.length > 0 && ses.every((s) => s.estado === "saltada");
                return (
                  <div key={f} className={`rounded-xl py-2 text-center text-[0.75rem] ${f === d.hoy ? "ring-2 ring-[#E8A33D]" : ""} ${hecha ? "bg-emerald-100 text-emerald-900" : ses.length && !saltada ? "bg-[#0F2240]/10 text-[#0F2240]" : "bg-gray-50 text-gray-400"}`}>
                    <div className="font-medium">{DIA_C[dow(f)]}</div>
                    <div>{Number(f.slice(8))}</div>
                    <div className="mt-0.5 text-[0.7rem]">{hecha ? "✓" : ses.map((s) => s.clave ?? "•").join("+") || ""}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[0.8rem] text-gray-500">{hechasSemana} de {d.sesiones.filter((s) => s.estado !== "saltada").length} esta semana{d.constancia.programadas ? ` · ${d.constancia.hechas} de ${d.constancia.programadas} en las últimas 4` : ""}</p>
          </section>

          {esActual && hoyS.map((s) => (
            <section key={s.id} className="rounded-2xl bg-[#0F2240] p-5 text-white">
              <p className="text-[0.8rem] uppercase tracking-wide text-white/70">Hoy toca</p>
              <h2 className="text-[1.3rem] font-semibold">{s.nombre}</h2>
              <p className="text-[0.9rem] text-white/85">{s.duracion_min ? `~${s.duracion_min} min · ` : ""}{s.ejercicios.length} ejercicios{s.ejercicios.some((e) => e.video) ? ` · graba ${s.ejercicios.filter((e) => e.video).length}` : ""}</p>
              {s.foco && <p className="mt-2 text-[0.95rem]">{s.foco}</p>}
              <button onClick={() => ir({ tipo: "sesion", id: s.id })} className="mt-4 w-full rounded-2xl bg-white py-3.5 text-[1rem] font-semibold text-[#0F2240]">Empezar</button>
            </section>
          ))}

          <section className="space-y-2">
            {d.sesiones.map((s) => (
              <button key={s.id} onClick={() => ir({ tipo: "sesion", id: s.id })} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left">
                <div>
                  <p className="font-medium">{s.nombre}</p>
                  <p className="text-[0.8rem] text-gray-500 capitalize">{DIA[dow(s.fecha)]} {corta(s.fecha)}{s.duracion_min ? ` · ~${s.duracion_min} min` : ""}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[0.75rem] ${s.estado === "hecha" ? "bg-emerald-100 text-emerald-800" : s.estado === "incompleta" ? "bg-amber-100 text-amber-900" : s.estado === "saltada" ? "bg-gray-100 text-gray-500" : s.fecha === d.hoy ? "bg-[#E8A33D]/20 text-[#8A4B00]" : "bg-gray-100 text-gray-600"}`}>
                  {s.estado === "hecha" ? "hecha" : s.estado === "incompleta" ? "a medias" : s.estado === "saltada" ? "saltada" : s.fecha === d.hoy ? "hoy" : s.fecha < d.hoy ? "pendiente" : proxima?.id === s.id ? "siguiente" : ""}
                </span>
              </button>
            ))}
          </section>
          {w.resumen && <section className="rounded-2xl bg-white p-4 text-[0.9rem] text-gray-700"><p className="text-[0.75rem] uppercase tracking-wide text-gray-500">De Alain</p>{w.resumen}</section>}
        </>
      )}

      {pushEstado === "pedir" && (
        <section className="rounded-2xl bg-white p-4">
          <p className="text-[0.9rem]">Para que te avise el día antes y el día de cada sesión, activa los avisos.</p>
          <Boton onClick={activarPush} tipo="secundario" className="mt-2">Activar avisos</Boton>
          <p className="mt-2 text-[0.75rem] text-gray-500">En iPhone, primero añade esta página a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.</p>
        </section>
      )}
      {pushEstado === "denegado" && <p className="text-[0.78rem] text-gray-500">Los avisos están bloqueados en este móvil. Se pueden activar en los ajustes del navegador.</p>}
      {!esActual && w && <Boton tipo="texto" onClick={() => cargar()}>Volver a esta semana</Boton>}
    </div>
  );
}

function Historial({ d, cargar, volver }: { d: Datos; cargar: (s?: string) => void; volver: () => void }) {
  return (
    <div className="space-y-3">
      <button onClick={volver} className="text-[0.9rem] text-gray-600">← Volver</button>
      <h2 className="text-[1.2rem] font-semibold">Semanas</h2>
      {d.semanas.map((w) => (
        <button key={w.id} onClick={() => { cargar(w.id); volver(); }} className={`flex w-full justify-between rounded-2xl bg-white px-4 py-3 text-left ${w.id === d.semana?.id ? "ring-2 ring-[#0F2240]" : ""}`}>
          <span>Semana {w.numero}{w.titulo ? ` · ${w.titulo}` : ""}</span>
          <span className="text-[0.8rem] text-gray-500">{corta(w.lunes)}</span>
        </button>
      ))}
    </div>
  );
}

// --- Sesión: registro serie a serie -------------------------------------------------
function SesionPantalla({ s, series, api, volver, terminar }: { s: Sesion; series: Serie[]; api: (b: Record<string, unknown>) => Promise<unknown>; volver: () => void; terminar: () => void }) {
  const [local, setLocal] = useState<Record<string, Partial<Serie>>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mover, setMover] = useState(false);
  const clave = (ejId: string, serie: number, lado: string | null) => `${ejId}|${serie}|${lado ?? ""}`;
  const valor = (ejId: string, serie: number, lado: string | null, campo: keyof Serie) => {
    const k = clave(ejId, serie, lado);
    if (local[k] && campo in local[k]) return local[k][campo] as string | number | null;
    const prev = series.find((x) => x.ejercicio_id === ejId && x.serie === serie && (x.lado ?? null) === lado);
    return prev ? (prev[campo] as string | number | null) : null;
  };
  const guardar = async (ejId: string, serie: number, lado: string | null, campo: string, v: string) => {
    const k = clave(ejId, serie, lado);
    const fila = { ...(local[k] ?? {}), [campo]: v === "" ? null : campo === "nota" || campo === "tempo" ? v : Number(v.replace(",", ".")) };
    setLocal((l) => ({ ...l, [k]: fila }));
    setGuardando(k);
    try {
      const prev = series.find((x) => x.ejercicio_id === ejId && x.serie === serie && (x.lado ?? null) === lado) ?? {};
      await api({ accion: "serie", ejercicio_id: ejId, serie, lado, ...prev, ...fila });
    } catch {
      /* se reintenta al siguiente cambio */
    } finally {
      setGuardando(null);
    }
  };
  const hecha = s.estado === "hecha" || s.estado === "incompleta";
  const registradas = useMemo(() => new Set(series.filter((x) => x.reps !== null || x.peso !== null || x.tiempo_s !== null).map((x) => x.ejercicio_id)), [series]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={volver} className="text-[0.9rem] text-gray-600">← Semana</button>
        {!hecha && <button onClick={() => setMover(!mover)} className="text-[0.85rem] text-gray-500">Mover o saltar</button>}
      </div>
      <header>
        <p className="text-[0.8rem] uppercase tracking-wide text-gray-500 capitalize">{DIA[dow(s.fecha)]} {corta(s.fecha)}{s.duracion_min ? ` · ~${s.duracion_min} min` : ""}</p>
        <h2 className="text-[1.4rem] font-semibold leading-tight">{s.nombre}</h2>
        {s.foco && <p className="mt-1 text-[0.95rem] text-gray-700">{s.foco}</p>}
        {s.notas && <p className="mt-1 whitespace-pre-line text-[0.9rem] text-gray-600">{s.notas}</p>}
      </header>
      {mover && <MoverSesion s={s} api={api} hecho={volver} />}
      {s.calentamiento && (
        <section className="rounded-2xl bg-white p-4">
          <p className="text-[0.75rem] uppercase tracking-wide text-gray-500">Calentamiento</p>
          <p className="text-[0.92rem]">{s.calentamiento}</p>
        </section>
      )}
      {s.ejercicios.map((e, i) => {
        const lados = e.campos.includes("lado") ? ["izq", "der"] : [null];
        const n = e.series ?? (e.reps ? 1 : 0);
        const camposSerie = e.campos.filter((c) => !["lado", "video"].includes(c));
        return (
          <section key={e.id} className={`rounded-2xl bg-white p-4 ${registradas.has(e.id) ? "ring-1 ring-emerald-200" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[0.75rem] text-gray-400">{i + 1}{e.superserie ? ` · superserie` : ""}</p>
                <h3 className="text-[1.05rem] font-semibold leading-tight">{e.nombre}</h3>
              </div>
              {e.video && <span className="shrink-0 rounded-full bg-[#E8A33D]/20 px-2 py-0.5 text-[0.75rem] text-[#8A4B00]">🎥 graba</span>}
            </div>
            <p className="mt-1 text-[0.95rem] text-gray-800">
              {e.series ? `${e.series} × ` : ""}{e.reps ?? ""}{e.carga ? ` · ${e.carga}` : ""}{e.rir ? ` · RIR ${e.rir}` : ""}{e.descanso ? ` · descanso ${e.descanso}` : ""}
            </p>
            {e.tempo && <p className="text-[0.85rem] text-gray-600">{e.tempo}</p>}
            {e.notas && <p className="mt-0.5 text-[0.85rem] text-gray-600">{e.notas}</p>}
            {n > 0 && camposSerie.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[0.9rem]">
                  <thead>
                    <tr className="text-left text-[0.7rem] uppercase tracking-wide text-gray-400">
                      <th className="w-10 pb-1">Serie</th>
                      {lados.length > 1 && <th className="w-12 pb-1">Lado</th>}
                      {camposSerie.map((c) => (
                        <th key={c} className="pb-1 pr-1">{ETIQ[c] ?? c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: n }, (_, k) => k + 1).flatMap((serie) =>
                      lados.map((lado) => (
                        <tr key={`${serie}-${lado}`} className="border-t border-gray-100">
                          <td className="py-1 text-gray-500">{lado === "der" ? "" : serie}</td>
                          {lados.length > 1 && <td className="py-1 text-[0.8rem] text-gray-500">{lado}</td>}
                          {camposSerie.map((c) => {
                            const campo = c === "tiempo" ? "tiempo_s" : c;
                            const v = valor(e.id, serie, lado, campo as keyof Serie);
                            return (
                              <td key={c} className="py-1 pr-1">
                                <Celda valor={v} texto={c === "nota" || c === "tempo"} placeholder={c === "reps" && e.reps ? e.reps.replace(/\D.*$/, "") : c === "peso" && e.carga ? (e.carga.match(/[\d,.]+/)?.[0] ?? "") : c === "rir" && e.rir ? e.rir : ""} onGuardar={(x) => guardar(e.id, serie, lado, campo, x)} guardando={guardando === clave(e.id, serie, lado)} />
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      {!hecha ? (
        <Boton onClick={terminar}>He terminado</Boton>
      ) : (
        <p className="rounded-2xl bg-emerald-50 p-4 text-center text-[0.9rem] text-emerald-900">Sesión registrada{s.rpe !== null ? ` · dureza ${s.rpe}/10` : ""}{s.minutos ? ` · ${s.minutos} min` : ""}. Puedes corregir cualquier número.</p>
      )}
    </div>
  );
}

function Celda({ valor, onGuardar, placeholder, texto, guardando }: { valor: string | number | null; onGuardar: (v: string) => void; placeholder?: string; texto?: boolean; guardando?: boolean }) {
  const [v, setV] = useState(valor === null || valor === undefined ? "" : String(valor));
  useEffect(() => setV(valor === null || valor === undefined ? "" : String(valor)), [valor]);
  return (
    <input
      inputMode={texto ? "text" : "decimal"}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (valor === null || valor === undefined ? "" : String(valor)) && onGuardar(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`w-full min-w-[3.2rem] rounded-lg border px-2 py-2 text-[1rem] ${guardando ? "border-[#E8A33D]" : v ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-50"} ${texto ? "min-w-[7rem]" : "text-center"}`}
    />
  );
}

function MoverSesion({ s, api, hecho }: { s: Sesion; api: (b: Record<string, unknown>) => Promise<unknown>; hecho: () => void }) {
  const [fecha, setFecha] = useState(s.fecha);
  const [motivo, setMotivo] = useState("");
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4">
      <p className="text-[0.9rem]">¿A qué día la mueves?</p>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-[1rem]" />
      <Boton tipo="secundario" onClick={async () => { await api({ accion: "sesion_mover", sesion_id: s.id, fecha }); hecho(); }} disabled={fecha === s.fecha}>Mover al {fecha !== s.fecha ? `${DIA[dow(fecha)]} ${corta(fecha)}` : "…"}</Boton>
      <p className="pt-2 text-[0.9rem]">O, si esta semana no va a poder ser:</p>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué (opcional)" className="w-full rounded-lg border border-gray-300 px-2 py-2 text-[1rem]" />
      <Boton tipo="texto" onClick={async () => { await api({ accion: "sesion_mover", sesion_id: s.id, saltar: true, motivo }); hecho(); }}>Saltar esta sesión</Boton>
    </section>
  );
}

// --- Formularios --------------------------------------------------------------------
function Escala({ valor, onChange, max, min = 0, etiquetas }: { valor: number | null; onChange: (v: number) => void; max: number; min?: number; etiquetas?: [string, string] }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
          <button key={n} onClick={() => onChange(n)} className={`h-10 min-w-[2.4rem] flex-1 rounded-xl text-[0.95rem] ${valor === n ? "bg-[#0F2240] text-white" : "bg-white ring-1 ring-gray-300"}`}>{n}</button>
        ))}
      </div>
      {etiquetas && <div className="mt-1 flex justify-between text-[0.72rem] text-gray-500"><span>{etiquetas[0]}</span><span>{etiquetas[1]}</span></div>}
    </div>
  );
}
function SiNo({ valor, onChange }: { valor: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[["No", false], ["Sí", true]].map(([t, v]) => (
        <button key={String(v)} onClick={() => onChange(v as boolean)} className={`flex-1 rounded-xl py-2.5 ${valor === v ? "bg-[#0F2240] text-white" : "bg-white ring-1 ring-gray-300"}`}>{t as string}</button>
      ))}
    </div>
  );
}
const Pregunta = ({ titulo, children, ayuda }: { titulo: string; children: React.ReactNode; ayuda?: string }) => (
  <section className="rounded-2xl bg-white p-4">
    <p className="mb-2 text-[0.95rem] font-medium">{titulo}</p>
    {ayuda && <p className="-mt-1 mb-2 text-[0.8rem] text-gray-500">{ayuda}</p>}
    {children}
  </section>
);

function FormPost({ s, api, hecho }: { s: Sesion; api: (b: Record<string, unknown>) => Promise<unknown>; hecho: () => void }) {
  const [r, setR] = useState<Record<string, unknown>>({ molestia: false, todo: true });
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = (k: string, v: unknown) => setR((x) => ({ ...x, [k]: v }));
  const conVideo = s.ejercicios.some((e) => e.video);
  const fileRef = useRef<HTMLInputElement>(null);
  const subirFoto = async (f: File) => {
    setSubiendo(true);
    try {
      const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
      const j = (await api({ accion: "foto_url", ext })) as { url: string; ruta: string };
      const up = await fetch(j.url, { method: "PUT", headers: { "Content-Type": f.type || "image/jpeg" }, body: f });
      if (up.ok) setFotos((x) => [...x, j.ruta]);
    } finally {
      setSubiendo(false);
    }
  };
  const listo = r.rpe !== undefined && r.minutos !== undefined && String(r.minutos) !== "";
  return (
    <div className="space-y-3">
      <h2 className="text-[1.3rem] font-semibold">¿Cómo ha ido?</h2>
      <p className="text-[0.85rem] text-gray-600">{s.nombre} · un minuto y listo.</p>
      <Pregunta titulo="¿Cómo de dura ha sido la sesión en conjunto?" ayuda="0 = nada · 10 = máximo esfuerzo">
        <Escala valor={(r.rpe as number) ?? null} onChange={(v) => set("rpe", v)} max={10} etiquetas={["nada", "máximo"]} />
      </Pregunta>
      <Pregunta titulo="¿Cuántos minutos has entrenado?">
        <input inputMode="numeric" value={(r.minutos as string) ?? ""} onChange={(e) => set("minutos", e.target.value)} placeholder={s.duracion_min ? String(s.duracion_min) : "50"} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-center text-[1.1rem]" />
      </Pregunta>
      <Pregunta titulo="¿Lo has hecho todo?">
        <SiNo valor={r.todo as boolean} onChange={(v) => set("todo", v)} />
        {r.todo === false && <input value={(r.que_falto as string) ?? ""} onChange={(e) => set("que_falto", e.target.value)} placeholder="Qué se quedó sin hacer y por qué" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2" />}
      </Pregunta>
      <Pregunta titulo="¿Has notado alguna molestia o dolor?">
        <SiNo valor={r.molestia as boolean} onChange={(v) => set("molestia", v)} />
        {r.molestia === true && (
          <div className="mt-2 space-y-2">
            <input value={(r.molestia_donde as string) ?? ""} onChange={(e) => set("molestia_donde", e.target.value)} placeholder="Dónde" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            <p className="text-[0.8rem] text-gray-500">¿Cuánto? 0 = nada · 10 = mucho</p>
            <Escala valor={(r.molestia_intensidad as number) ?? null} onChange={(v) => set("molestia_intensidad", v)} max={10} />
          </div>
        )}
      </Pregunta>
      <Pregunta titulo="¿Qué ejercicio te ha costado más, o en cuál no estás seguro de la técnica?">
        <input value={(r.costo as string) ?? ""} onChange={(e) => set("costo", e.target.value)} placeholder="Opcional" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
      </Pregunta>
      {conVideo && (
        <Pregunta titulo="¿Has subido los vídeos que tocaban?" ayuda="Por WhatsApp a Alain, como siempre.">
          <SiNo valor={(r.videos as boolean) ?? null} onChange={(v) => set("videos", v)} />
        </Pregunta>
      )}
      <Pregunta titulo="Fotos (opcional)" ayuda="Solo las ve Alain.">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
        <Boton tipo="secundario" onClick={() => fileRef.current?.click()} disabled={subiendo}>{subiendo ? "Subiendo…" : fotos.length ? `${fotos.length} subida${fotos.length > 1 ? "s" : ""} · otra` : "Hacer o elegir foto"}</Boton>
      </Pregunta>
      <Boton disabled={!listo || enviando} onClick={async () => { setEnviando(true); try { await api({ accion: "sesion_cerrar", sesion_id: s.id, respuestas: r, fotos }); hecho(); } finally { setEnviando(false); } }}>Guardar sesión</Boton>
    </div>
  );
}

function FormRecuperacion({ sesionId, zonas, api, hecho }: { sesionId: string; zonas: string | null; api: (b: Record<string, unknown>) => Promise<unknown>; hecho: () => void }) {
  const [r, setR] = useState<Record<string, unknown>>({ molestia_nueva: false, trabajo_duro: "no" });
  const [enviando, setEnviando] = useState(false);
  const set = (k: string, v: unknown) => setR((x) => ({ ...x, [k]: v }));
  const listo = r.agujetas !== undefined && r.energia !== undefined && r.sueno_calidad !== undefined;
  return (
    <div className="space-y-3">
      <h2 className="text-[1.3rem] font-semibold">¿Cómo te has levantado?</h2>
      <Pregunta titulo="Agujetas" ayuda="1 = nada · 5 = me cuesta moverme">
        <Escala valor={(r.agujetas as number) ?? null} onChange={(v) => set("agujetas", v)} min={1} max={5} />
        {(r.agujetas as number) >= 3 && <input value={(r.agujetas_donde as string) ?? ""} onChange={(e) => set("agujetas_donde", e.target.value)} placeholder="¿Dónde?" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2" />}
      </Pregunta>
      <Pregunta titulo="Energía hoy" ayuda="1 = sin pilas · 5 = a tope">
        <Escala valor={(r.energia as number) ?? null} onChange={(v) => set("energia", v)} min={1} max={5} />
      </Pregunta>
      <Pregunta titulo="Sueño de anoche">
        <p className="mb-1 text-[0.8rem] text-gray-500">Calidad: 1 = fatal · 5 = de un tirón</p>
        <Escala valor={(r.sueno_calidad as number) ?? null} onChange={(v) => set("sueno_calidad", v)} min={1} max={5} />
        <div className="mt-2 flex items-center gap-2 text-[0.9rem]">
          <span>Horas aprox.</span>
          <input inputMode="decimal" value={(r.sueno_horas as string) ?? ""} onChange={(e) => set("sueno_horas", e.target.value)} className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-center" />
        </div>
      </Pregunta>
      <Pregunta titulo="¿Alguna molestia nueva desde ayer?" ayuda={zonas ? `Sobre todo en ${zonas}.` : undefined}>
        <SiNo valor={r.molestia_nueva as boolean} onChange={(v) => set("molestia_nueva", v)} />
        {r.molestia_nueva === true && <input value={(r.molestia_donde as string) ?? ""} onChange={(e) => set("molestia_donde", e.target.value)} placeholder="Dónde" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2" />}
      </Pregunta>
      <Pregunta titulo="¿Trabajo físico duro hoy o mañana?" ayuda="Caserío, obra, mudanza…">
        <div className="flex gap-2">
          {[["No", "no"], ["Hoy", "hoy"], ["Mañana", "manana"], ["Los dos", "ambos"]].map(([t, v]) => (
            <button key={v} onClick={() => set("trabajo_duro", v)} className={`flex-1 rounded-xl py-2.5 text-[0.9rem] ${r.trabajo_duro === v ? "bg-[#0F2240] text-white" : "bg-white ring-1 ring-gray-300"}`}>{t}</button>
          ))}
        </div>
      </Pregunta>
      <Pregunta titulo="Algo que quieras contarme">
        <textarea value={(r.comentario as string) ?? ""} onChange={(e) => set("comentario", e.target.value)} rows={2} placeholder="Opcional" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
      </Pregunta>
      <Boton disabled={!listo || enviando} onClick={async () => { setEnviando(true); try { await api({ accion: "recuperacion", sesion_id: sesionId, respuestas: r }); hecho(); } finally { setEnviando(false); } }}>Enviar</Boton>
    </div>
  );
}
