"use client";

import { useCallback, useEffect, useState } from "react";

// MIRARIAK 2026 de un vistazo: reservas del taller por grupo (ruedas por
// edades con el total dentro), quién repite del año pasado, micromagia por
// horario, ritmo de reservas y avisos (posibles duplicados). Los datos salen
// de /api/admin/mirariak (tabla mirariak2026_reservas).

// Paleta categórica en orden fijo (validada: daltonismo y visión normal OK en
// pares contiguos). El color sigue a la franja de edad en todas las ruedas.
const COLOR: Record<string, string> = {
  "6": "#2a78d6",
  "7": "#eb6834",
  "8": "#1baf7a",
  "9": "#eda100",
  "10": "#e87ba4",
  "11-12": "#008300",
  "13-17": "#6250d6",
  Adultos: "#e34948",
};
const ETIQUETA = (f: string) => (/^\d+$/.test(f) ? `${f} años` : f === "Adultos" ? "Adultos (18+)" : `${f} años`);
const AZUL = "#2a78d6";
const PISTA = "#ecebe7";

interface PT { nombre: string; edad: number; repite: boolean; contacto: string; email: string; fecha: string }
interface Grupo { sesion: string; nombre: string; edades: string; plazas: number; n: number; repiten: number; franjas: Record<string, number>; participantes: PT[] }
interface Horario { horario: string; plazas: number; n: number; participantes: { nombre: string; contacto: string; email: string; fecha: string }[] }
interface Datos {
  actualizado: string;
  resumen: { formularios: number; familias: number; personas_taller: number; plazas_taller: number; repiten_taller: number; personas_micromagia: number; plazas_micromagia: number; en_las_dos: number; con_newsletter: number; idioma: Record<string, number>; ultima: string | null };
  franjas: string[];
  taller: { total: Record<string, number>; grupos: Grupo[] };
  micromagia: { horarios: Horario[] };
  semanas: { semana: string; taller: number; micromagia: number }[];
  duplicados: { contacto: string; email: string; actividad: string; nombres: string[]; veces: number; fechas: string[] }[];
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fecha = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ── Rueda (donut) con el total dentro. Al pasar por un color, el centro dice qué es.
function Rueda({ valores, orden, tam = 168, titulo }: { valores: Record<string, number>; orden: string[]; tam?: number; titulo: string }) {
  const [activo, setActivo] = useState<string | null>(null);
  const total = orden.reduce((a, k) => a + (valores[k] ?? 0), 0);
  const r = 60;
  const grosor = 20;
  const C = 2 * Math.PI * r;
  const hueco = total > 1 ? 2.5 : 0; // 2px de superficie entre colores
  let acumulado = 0;
  const trozos = orden
    .filter((k) => (valores[k] ?? 0) > 0)
    .map((k) => {
      const v = valores[k];
      const largo = (v / total) * C;
      const t = { k, v, inicio: acumulado, largo };
      acumulado += largo;
      return t;
    });
  const sel = activo ? trozos.find((t) => t.k === activo) : null;
  return (
    <svg viewBox="0 0 160 160" width={tam} height={tam} role="img" aria-label={`${titulo}: ${total} personas`} className="shrink-0">
      <circle cx={80} cy={80} r={r} fill="none" stroke={PISTA} strokeWidth={grosor} />
      {trozos.map((t) => (
        <circle
          key={t.k}
          cx={80}
          cy={80}
          r={r}
          fill="none"
          stroke={COLOR[t.k] ?? "#999"}
          strokeWidth={activo === t.k ? grosor + 4 : grosor}
          strokeDasharray={`${Math.max(t.largo - hueco, 0.5)} ${C}`}
          strokeDashoffset={-t.inicio}
          transform="rotate(-90 80 80)"
          style={{ cursor: "default", transition: "stroke-width 120ms" }}
          onMouseEnter={() => setActivo(t.k)}
          onMouseLeave={() => setActivo(null)}
          onClick={() => setActivo(activo === t.k ? null : t.k)}
        >
          <title>{`${ETIQUETA(t.k)}: ${t.v} (${pct(t.v, total)} %)`}</title>
        </circle>
      ))}
      {sel ? (
        <>
          <text x={80} y={76} textAnchor="middle" fontSize={26} fontWeight={600} fill="#1a1a1a">{sel.v}</text>
          <text x={80} y={96} textAnchor="middle" fontSize={11} fill="#52514e">{ETIQUETA(sel.k)} · {pct(sel.v, total)} %</text>
        </>
      ) : (
        <>
          <text x={80} y={82} textAnchor="middle" fontSize={34} fontWeight={600} fill="#1a1a1a">{total}</text>
          <text x={80} y={100} textAnchor="middle" fontSize={11} fill="#52514e">{total === 1 ? "persona" : "personas"}</text>
        </>
      )}
    </svg>
  );
}

function Leyenda({ valores, orden }: { valores: Record<string, number>; orden: string[] }) {
  const total = orden.reduce((a, k) => a + (valores[k] ?? 0), 0);
  const filas = orden.filter((k) => (valores[k] ?? 0) > 0);
  if (!filas.length) return <p className="text-[0.82rem] text-gray-400">Sin reservas todavía.</p>;
  return (
    <ul className="space-y-1 text-[0.85rem]">
      {filas.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: COLOR[k] }} />
          <span className="text-gray-800">{ETIQUETA(k)}</span>
          <span className="ml-auto tabular-nums text-gray-900">{valores[k]}</span>
          <span className="w-11 text-right tabular-nums text-gray-500">{pct(valores[k], total)} %</span>
        </li>
      ))}
    </ul>
  );
}

// ── Barra contra un límite (plazas, repetidores).
function Medidor({ valor, max, etiqueta, detalle, color = AZUL, plazas = false }: { valor: number; max: number; etiqueta: string; detalle?: string; color?: string; plazas?: boolean }) {
  const p = Math.min(100, max ? (valor / max) * 100 : 0);
  const lleno = plazas && valor >= max;
  return (
    <div title={`${etiqueta}: ${valor} de ${max}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.8rem]">
        <span className="text-gray-600">{etiqueta}</span>
        <span className="tabular-nums text-gray-900">
          <b>{valor}</b> / {max}
          {detalle ? <span className="text-gray-500"> · {detalle}</span> : null}
          {lleno ? <span className="ml-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-[0.68rem] text-white">completo</span> : null}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: PISTA }}>
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function Cifra({ valor, etiqueta, detalle }: { valor: string | number; etiqueta: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">{etiqueta}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tabular-nums text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-[0.78rem] text-gray-500">{detalle}</p>}
    </div>
  );
}

// ── Ritmo: personas nuevas por semana (taller y micromagia, lado a lado).
function Ritmo({ semanas }: { semanas: Datos["semanas"] }) {
  const [activa, setActiva] = useState<number | null>(null);
  if (!semanas.length) return null;
  const max = Math.max(...semanas.map((s) => Math.max(s.taller, s.micromagia)), 1);
  const alto = 150;
  const ancho = 900;
  const paso = ancho / semanas.length;
  const barra = Math.min(26, paso / 3);
  const s = activa !== null ? semanas[activa] : null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[0.8rem] text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR["6"] }} />Taller</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR["7"] }} />Micromagia</span>
        <span className="ml-auto hidden text-gray-500 sm:inline">{s ? `Semana del ${new Date(s.semana).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}: ${s.taller} al taller · ${s.micromagia} a micromagia` : "Pasa por una semana para ver el detalle"}</span>
      </div>
      <ul className="space-y-2 sm:hidden">
        {semanas.map((w) => (
          <li key={w.semana} className="grid grid-cols-[4.2rem_1fr] items-center gap-x-2 text-[0.75rem] text-gray-600">
            <span className="row-span-2">{new Date(w.semana).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 rounded-full" style={{ width: `${(w.taller / max) * 80}%`, minWidth: w.taller ? 4 : 0, background: COLOR["6"] }} /><span className="tabular-nums">{w.taller}</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 rounded-full" style={{ width: `${(w.micromagia / max) * 80}%`, minWidth: w.micromagia ? 4 : 0, background: COLOR["7"] }} /><span className="tabular-nums">{w.micromagia}</span></span>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <svg viewBox={`0 0 ${ancho} ${alto + 22}`} width="100%" style={{ minWidth: 520 }} role="img" aria-label="Personas apuntadas por semana">
          <line x1={0} x2={ancho} y1={alto} y2={alto} stroke="#d6d5d0" strokeWidth={1} />
          {semanas.map((w, i) => {
            const x = i * paso + paso / 2;
            const hT = (w.taller / max) * (alto - 18);
            const hM = (w.micromagia / max) * (alto - 18);
            return (
              <g key={w.semana} onMouseEnter={() => setActiva(i)} onMouseLeave={() => setActiva(null)} onClick={() => setActiva(activa === i ? null : i)}>
                <rect x={i * paso} y={0} width={paso} height={alto + 22} fill={activa === i ? "#f3f2ee" : "transparent"} />
                {w.taller > 0 && <rect x={x - barra - 1} y={alto - hT} width={barra} height={hT} rx={3} fill={COLOR["6"]} />}
                {w.micromagia > 0 && <rect x={x + 1} y={alto - hM} width={barra} height={hM} rx={3} fill={COLOR["7"]} />}
                {w.taller > 0 && <text x={x - barra / 2 - 1} y={alto - hT - 4} textAnchor="middle" fontSize={10} fill="#52514e">{w.taller}</text>}
                {w.micromagia > 0 && <text x={x + barra / 2 + 1} y={alto - hM - 4} textAnchor="middle" fontSize={10} fill="#52514e">{w.micromagia}</text>}
                <text x={x} y={alto + 15} textAnchor="middle" fontSize={10} fill="#52514e">{new Date(w.semana).toLocaleDateString("es-ES", { day: "numeric", month: "numeric" })}</text>
                <title>{`Semana del ${w.semana}: ${w.taller} taller · ${w.micromagia} micromagia`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function MirariakTab() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/mirariak", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Error");
      else {
        setD(j);
        setError("");
      }
    } catch {
      setError("Sin conexión.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 120000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!d) return <p className="text-sm text-gray-400">{error || "Cargando Mirariak…"}</p>;
  const R = d.resumen;
  const dias = Math.ceil((new Date("2026-11-14T10:00:00+01:00").getTime() - Date.now()) / 86400000);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Aita Agirre Kulturgunea · Elgoibar</p>
          <h2 className="text-[1.4rem] font-semibold text-gray-900">Reservas de un vistazo</h2>
          <p className="text-[0.82rem] text-gray-500">
            Taller el sábado 14 · micromagia el domingo 15{dias > 0 ? ` · faltan ${dias} días` : ""}
            {R.ultima ? ` · última reserva ${fecha(R.ultima)}` : ""}
          </p>
        </div>
        <button onClick={cargar} disabled={cargando} className="px-3 py-1.5 text-[0.82rem] text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra valor={R.personas_taller} etiqueta="Taller (sábado)" detalle={`de ${R.plazas_taller} plazas · ${pct(R.personas_taller, R.plazas_taller)} %`} />
        <Cifra valor={R.personas_micromagia} etiqueta="Micromagia (domingo)" detalle={`de ${R.plazas_micromagia} plazas · ${pct(R.personas_micromagia, R.plazas_micromagia)} %`} />
        <Cifra valor={`${pct(R.repiten_taller, R.personas_taller)} %`} etiqueta="Repiten del año pasado" detalle={`${R.repiten_taller} de ${R.personas_taller} en el taller`} />
        <Cifra valor={R.familias} etiqueta="Familias" detalle={`${R.formularios} formularios · ${R.en_las_dos} van a las dos`} />
      </section>

      {d.duplicados.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[0.85rem] text-amber-950">
          <p className="font-semibold">Posible reserva repetida ({d.duplicados.length})</p>
          <p className="mb-2 text-[0.8rem]">Mismo correo, misma actividad y mismos nombres: cuenta doble en las plazas. Si es un error, bórrala en Supabase o dímelo y la quito.</p>
          <ul className="space-y-1">
            {d.duplicados.map((x) => (
              <li key={x.email + x.actividad}>
                <b>{x.nombres.join(", ")}</b> · {x.contacto} ({x.email}) · {x.actividad} · {x.veces} veces: {x.fechas.map(fecha).join(" y ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Taller · edades de todos los apuntados</p>
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
          <Rueda valores={d.taller.total} orden={d.franjas} tam={200} titulo="Todo el taller" />
          <div className="w-full max-w-sm">
            <Leyenda valores={d.taller.total} orden={d.franjas} />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Taller · cada grupo</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {d.taller.grupos.map((g) => (
            <article key={g.sesion} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div>
                <p className="text-[1rem] font-semibold text-gray-900">{g.nombre} · {g.edades}</p>
                <p className="text-[0.8rem] text-gray-500">Sábado 14 · {g.sesion}</p>
              </div>
              <div className="flex items-center gap-4">
                <Rueda valores={g.franjas} orden={d.franjas} tam={132} titulo={g.nombre} />
                <div className="min-w-0 flex-1">
                  <Leyenda valores={g.franjas} orden={d.franjas} />
                </div>
              </div>
              <Medidor plazas valor={g.n} max={g.plazas} etiqueta="Plazas" detalle={`${Math.max(g.plazas - g.n, 0)} libres`} />
              <Medidor valor={g.repiten} max={g.n || 1} etiqueta="Estuvieron el año pasado" detalle={g.n ? `${pct(g.repiten, g.n)} % · ${g.n - g.repiten} nuevos` : "—"} color="#1C3A5E" />
              <details className="text-[0.82rem] text-gray-700">
                <summary className="cursor-pointer text-gray-500">Ver quién va ({g.participantes.length})</summary>
                <ul className="mt-2 space-y-1">
                  {g.participantes
                    .slice()
                    .sort((a, b) => a.edad - b.edad || a.nombre.localeCompare(b.nombre))
                    .map((p, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span className="text-gray-900">{p.nombre}</span>
                        <span className="tabular-nums text-gray-500">{p.edad} años</span>
                        {p.repite && <span className="rounded-full bg-[#1C3A5E]/10 px-1.5 text-[0.72rem] text-[#1C3A5E]">repite</span>}
                        <span className="text-gray-400">· {p.contacto}</span>
                      </li>
                    ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Micromagia · domingo 15, por horario</p>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          {d.micromagia.horarios.map((h) => (
            <div key={h.horario}>
              <Medidor plazas valor={h.n} max={h.plazas} etiqueta={h.horario} detalle={`${Math.max(h.plazas - h.n, 0)} libres`} color={COLOR["7"]} />
              {h.participantes.length > 0 && (
                <details className="mt-1 text-[0.8rem] text-gray-700">
                  <summary className="cursor-pointer text-gray-400">Ver quién va ({h.participantes.length})</summary>
                  <p className="mt-1">{h.participantes.map((p) => p.nombre).join(" · ")}</p>
                </details>
              )}
            </div>
          ))}
          <p className="text-[0.75rem] text-gray-400">En micromagia el formulario no pide edad ni si vinieron el año pasado: solo el nombre.</p>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Ritmo · personas apuntadas cada semana</p>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <Ritmo semanas={d.semanas} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Idioma del formulario</p>
          <Medidor valor={R.idioma.eu ?? 0} max={R.formularios || 1} etiqueta="En euskera" detalle={`${pct(R.idioma.eu ?? 0, R.formularios)} % · ${R.idioma.es ?? 0} en castellano`} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Newsletter</p>
          <Medidor valor={R.con_newsletter} max={R.formularios || 1} etiqueta="Se apuntaron a la newsletter" detalle={`${pct(R.con_newsletter, R.formularios)} % de los formularios`} />
        </div>
      </section>

      <p className="text-[0.72rem] text-gray-400">Se actualiza solo cada 2 minutos · {fecha(d.actualizado)}</p>
    </div>
  );
}
