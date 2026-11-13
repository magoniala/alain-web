"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// MIRARIAK 2026 · Control de entrada (modo puerta).
// Pensado para el móvil en la puerta del Aita Agirre: eliges día y grupo/horario,
// buscas al niño o a la familia y tocas su nombre para marcar que ha entrado.
// Varios móviles a la vez: se refresca solo cada 15 s. La marca de llegada se
// guarda en el participante (llegada.en) y no toca plazas ni el historial.
// También: lista de espera («Dar plaza y entra»), apuntar en la puerta a quien
// llega sin reserva, avisar si un niño es de otro grupo, y lista en papel.

interface Marca { en?: string; motivo?: string; desde?: string; telefono?: string; nota?: string }
interface PT { idx: number; nombre: string; edad: number; sesion: string; repite: boolean; anulada: Marca | null; espera: Marca | null; llegada: { en: string } | null }
interface PM { idx: number; nombre: string; anulada: Marca | null; espera: Marca | null; llegada: { en: string } | null }
interface Reserva { id: string; contacto: string; email: string; idioma: string; fecha: string; actividad: string; horario: string; taller: PT[]; micromagia: PM[] }
interface EnEspera { id: string; lista: Lista; idx: number; nombre: string; edad: number | null; contacto: string; email: string; idioma: string; telefono: string; nota: string; desde: string }
interface Datos {
  actualizado: string;
  taller: { grupos: { sesion: string; nombre: string; edades: string; plazas: number; n: number }[] };
  micromagia: { horarios: { horario: string; plazas: number; n: number }[] };
  reservas: Reserva[];
  espera: { taller: Record<string, EnEspera[]>; micromagia: Record<string, EnEspera[]> };
}
type Lista = "taller" | "micromagia";
type Dia = "sab" | "dom";
interface Persona { r: Reserva; lista: Lista; idx: number; nombre: string; edad: number | null; repite: boolean; franja: string; anulada: Marca | null; espera: Marca | null; llegada: { en: string } | null }

const API = "/api/admin/mirariak";
const pw = () => (typeof window !== "undefined" ? sessionStorage.getItem("admin_pw") || "" : "");
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const clave = (p: { r: { id: string }; lista: Lista; idx: number }) => `${p.r.id}:${p.lista}:${p.idx}`;
const GRUPO: Record<string, string> = { "10:00 – 10:55": "Grupo 1", "11:10 – 12:05": "Grupo 2", "12:20 – 13:15": "Grupo 3" };
const etiquetaFranja = (lista: Lista, f: string) => (lista === "taller" ? `${GRUPO[f] ?? f} · ${f.split(" ")[0]}` : f);

// Hora de Madrid en minutos desde medianoche y fecha AAAA-MM-DD.
function ahoraMadrid() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
}
const aMin = (hhmm: string) => {
  const [h, m] = hhmm.trim().split(":").map(Number);
  return h * 60 + m;
};
// La franja que toca recibir ahora: la primera que no ha terminado (con margen para ir recibiendo a la siguiente).
function franjaDeAhora(franjas: string[], margen: number) {
  const { min } = ahoraMadrid();
  return franjas.find((f) => aMin(f.split("–")[1]) - margen > min) ?? franjas[franjas.length - 1];
}

export default function MirariakEntrada({ onVolver }: { onVolver: () => void }) {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [dia, setDia] = useState<Dia>(() => (ahoraMadrid().fecha === "2026-11-15" ? "dom" : "sab"));
  const [franjaSel, setFranja] = useState("");
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<"faltan" | "todos" | "dentro">("faltan");
  const [local, setLocal] = useState<Record<string, boolean>>({}); // marcas optimistas hasta la próxima carga
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean; deshacer?: () => void } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [abrir, setAbrir] = useState<"" | "espera" | "puerta">("");
  const enVuelo = useRef(0);
  const generacion = useRef(0); // sube con cada guardado: una carga empezada antes no pisa lo recién marcado
  const buscador = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const gen = generacion.current;
    try {
      const r = await fetch(API, { headers: { "x-admin-password": pw() }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Error");
      if (enVuelo.current > 0 || gen !== generacion.current) return; // no pisar marcas que aún se están guardando
      setD(j);
      setLocal({});
      setError("");
    } catch {
      setError("Sin conexión: lo que marques no se guardará hasta que vuelva.");
    }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const lista: Lista = dia === "sab" ? "taller" : "micromagia";
  const franjas = useMemo(() => (d ? (lista === "taller" ? d.taller.grupos.map((g) => g.sesion) : d.micromagia.horarios.map((h) => h.horario)) : []), [d, lista]);
  // Si no has elegido (o cambias de día), la que toca recibir ahora.
  const franja = franjas.includes(franjaSel) ? franjaSel : franjas.length ? franjaDeAhora(franjas, lista === "taller" ? 10 : 5) : "";

  // Todas las personas del día (las de las dos listas de cada reserva), con su franja.
  const personas: Persona[] = useMemo(() => {
    if (!d) return [];
    const out: Persona[] = [];
    for (const r of d.reservas) {
      if (lista === "taller") for (const p of r.taller) out.push({ r, lista, idx: p.idx, nombre: p.nombre, edad: p.edad, repite: p.repite, franja: p.sesion, anulada: p.anulada, espera: p.espera, llegada: p.llegada });
      else for (const p of r.micromagia) out.push({ r, lista, idx: p.idx, nombre: p.nombre, edad: null, repite: false, franja: r.horario, anulada: p.anulada, espera: p.espera, llegada: p.llegada });
    }
    return out;
  }, [d, lista]);
  const dentro = (p: Persona) => (clave(p) in local ? local[clave(p)] : !!p.llegada);
  const conPlaza = (p: Persona) => !p.anulada && !p.espera;

  const deLaFranja = personas.filter((p) => p.franja === franja && conPlaza(p));
  const llegados = deLaFranja.filter(dentro).length;
  const plazas = lista === "taller" ? d?.taller.grupos.find((g) => g.sesion === franja)?.plazas ?? 0 : d?.micromagia.horarios.find((h) => h.horario === franja)?.plazas ?? 0;
  const libres = plazas - deLaFranja.length;
  const enEspera = (d?.espera[lista][franja] ?? []);

  // ── Llamada al API con la misma lógica de aforo que el resto del panel.
  const post = async (cuerpo: Record<string, unknown>) => {
    const llamar = (extra: Record<string, unknown> = {}) => fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-password": pw() }, body: JSON.stringify({ ...cuerpo, ...extra }) });
    let r = await llamar();
    let j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.completo) {
      if (!window.confirm(`${j.error}\n\n¿Que entre igualmente, por encima del aforo?`)) return { ok: false, error: "No se ha hecho nada: está completo." };
      r = await llamar({ forzar: true });
      j = await r.json().catch(() => ({}));
    }
    return r.ok ? { ok: true } : { ok: false, error: j.error ?? "Error" };
  };

  const marcar = async (ps: Persona[], valor: boolean) => {
    if (!ps.length) return;
    const porFila = new Map<string, Persona[]>();
    for (const p of ps) porFila.set(`${p.r.id}:${p.lista}`, [...(porFila.get(`${p.r.id}:${p.lista}`) ?? []), p]);
    setLocal((l) => ({ ...l, ...Object.fromEntries(ps.map((p) => [clave(p), valor])) }));
    const quien = ps.map((p) => p.nombre).join(", ");
    setAviso({ texto: valor ? `Dentro: ${quien}` : `Quitado: ${quien}`, deshacer: () => marcar(ps, !valor) });
    enVuelo.current++;
    try {
      for (const grupo of porFila.values()) {
        const res = await post({ accion: "llegada", id: grupo[0].r.id, lista: grupo[0].lista, idxs: grupo.map((p) => p.idx), nombres: grupo.map((p) => p.nombre), valor });
        if (!res.ok) {
          setLocal((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !grupo.some((p) => clave(p) === k))));
          setAviso({ texto: `${grupo.map((p) => p.nombre).join(", ")}: ${res.error}`, error: true });
        }
      }
    } catch {
      setAviso({ texto: "Sin conexión: no se ha guardado. Vuelve a tocar cuando haya señal.", error: true });
      setLocal((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !ps.some((p) => clave(p) === k))));
    } finally {
      enVuelo.current--;
      generacion.current++;
      if (enVuelo.current === 0) cargar();
    }
  };

  // Acciones de dos pasos (dar plaza / reactivar / mover) y luego marcar la entrada.
  const yEntra = async (primero: Record<string, unknown>, p: { id: string; lista: Lista; idx: number; nombre: string }, hecho: string) => {
    setOcupado(true);
    enVuelo.current++;
    try {
      const a = await post(primero);
      if (!a.ok) return setAviso({ texto: `${p.nombre}: ${a.error}`, error: true });
      const b = await post({ accion: "llegada", id: p.id, lista: p.lista, idxs: [p.idx], nombres: [p.nombre], valor: true });
      setAviso(b.ok ? { texto: hecho } : { texto: `${p.nombre}: ${b.error}`, error: true });
    } catch {
      setAviso({ texto: "Sin conexión.", error: true });
    } finally {
      enVuelo.current--;
      generacion.current++;
      setOcupado(false);
      await cargar();
    }
  };

  // ── Qué se ve: con búsqueda, todo el día (para pillar al que es de otro grupo o tiene la reserva anulada).
  const termino = normal(q);
  const coincide = (p: Persona) => !termino || normal(p.nombre).includes(termino) || normal(p.r.contacto).includes(termino) || normal(p.r.email).includes(termino);
  const visibles = termino
    ? personas.filter(coincide)
    : deLaFranja.filter((p) => (ver === "faltan" ? !dentro(p) : ver === "dentro" ? dentro(p) : true));

  // Agrupadas por familia (formulario + franja): los hermanos entran juntos.
  const familias = (() => {
    const m = new Map<string, Persona[]>();
    for (const p of visibles) m.set(`${p.r.id}|${p.franja}`, [...(m.get(`${p.r.id}|${p.franja}`) ?? []), p]);
    const arr = [...m.values()].map((ps) => ps.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    const orden = (ps: Persona[]) => (ps[0].franja === franja ? 0 : 1);
    return arr.sort((a, b) => orden(a) - orden(b) || a[0].nombre.localeCompare(b[0].nombre, "es"));
  })();

  // ── Lista en papel (por si falla la cobertura): todas las franjas del día, por orden alfabético.
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const bloques = franjas
      .map((f) => {
        const ps = personas.filter((p) => p.franja === f && conPlaza(p)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const filas = ps.map((p) => `<tr><td class="c">${p.llegada ? "✓" : "☐"}</td><td><b>${esc(p.nombre)}</b>${p.edad ? ` <span>${p.edad}</span>` : ""}${p.repite ? " <i>repite</i>" : ""}</td><td>${esc(p.r.contacto)}</td></tr>`).join("");
        return `<h2>${lista === "taller" ? "Sábado 14" : "Domingo 15"} · ${esc(etiquetaFranja(lista, f))} (${f}) · ${ps.length}/${lista === "taller" ? d?.taller.grupos.find((g) => g.sesion === f)?.plazas ?? "" : d?.micromagia.horarios.find((h) => h.horario === f)?.plazas ?? ""}</h2><table>${filas}</table>`;
      })
      .join("");
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Mirariak 2026 · Entrada</title><style>body{font:13px system-ui,sans-serif;margin:24px}h2{font-size:15px;margin:18px 0 6px;page-break-after:avoid}table{border-collapse:collapse;width:100%;page-break-inside:auto}tr{page-break-inside:avoid}td{border-bottom:1px solid #ddd;padding:5px 6px}td.c{width:22px;font-size:16px}span{color:#666}i{color:#1C3A5E;font-size:11px}section{page-break-after:always}</style><h1 style="font-size:17px">MIRARIAK 2026 · Lista de entrada · impresa ${new Date().toLocaleString("es-ES")}</h1>${bloques}<script>print()</script>`);
    w.document.close();
  };

  if (!d) return <p className="text-sm text-gray-400">{error || "Cargando la entrada…"}</p>;

  const resumenFranja = (f: string) => {
    const ps = personas.filter((p) => p.franja === f && conPlaza(p));
    return `${ps.filter(dentro).length}/${ps.length}`;
  };

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Mirariak 2026 · puerta</p>
          <h2 className="text-[1.3rem] font-semibold text-gray-900">Control de entrada</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={imprimir} className="px-3 py-1.5 text-[0.8rem] text-gray-700 ring-1 ring-gray-300">Lista en papel</button>
          <button onClick={onVolver} className="px-3 py-1.5 text-[0.8rem] text-gray-700 ring-1 ring-gray-300">Volver a reservas</button>
        </div>
      </header>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">{error}</p>}

      {/* Día */}
      <div className="grid grid-cols-2 gap-2">
        {(["sab", "dom"] as Dia[]).map((x) => (
          <button key={x} onClick={() => { setDia(x); setFranja(""); setQ(""); }} className={`rounded-xl py-2.5 text-[0.9rem] font-medium ring-1 ${dia === x ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-300"}`}>
            {x === "sab" ? "Sábado 14 · Taller" : "Domingo 15 · Micromagia"}
          </button>
        ))}
      </div>

      {/* Grupo / horario */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {franjas.map((f) => (
          <button key={f} onClick={() => { setFranja(f); setQ(""); setAbrir(""); }} className={`shrink-0 rounded-xl px-3 py-2 text-left ring-1 ${franja === f ? "bg-[#1C3A5E] text-white ring-[#1C3A5E]" : "bg-white text-gray-800 ring-gray-300"}`}>
            <span className="block text-[0.85rem] font-semibold">{lista === "taller" ? GRUPO[f] : f.split(" ")[0]}</span>
            <span className={`block text-[0.72rem] ${franja === f ? "text-white/75" : "text-gray-500"}`}>{lista === "taller" ? f.split(" ")[0] : f} · {resumenFranja(f)}</span>
          </button>
        ))}
      </div>

      {/* Marcador de la franja */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.78rem] text-gray-500">{lista === "taller" ? `${GRUPO[franja]} · ${d.taller.grupos.find((g) => g.sesion === franja)?.edades ?? ""} · ${franja}` : `Micromagia · ${franja}`}</p>
            <p className="text-[2rem] font-semibold leading-none tabular-nums text-gray-900">{llegados}<span className="text-[1.1rem] font-normal text-gray-400"> / {deLaFranja.length} dentro</span></p>
          </div>
          <div className="text-right text-[0.8rem] text-gray-600">
            <p>Faltan <b className="tabular-nums text-gray-900">{deLaFranja.length - llegados}</b></p>
            <p>{libres > 0 ? <>Plazas libres <b className="tabular-nums text-gray-900">{libres}</b></> : <span className="text-amber-700">Completo</span>}</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ecebe7]">
          <div className="h-full rounded-full bg-[#1baf7a] transition-all" style={{ width: `${deLaFranja.length ? (llegados / deLaFranja.length) * 100 : 0}%` }} />
        </div>
      </section>

      {/* Buscador */}
      <div className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-2">
          <input
            ref={buscador}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre del niño/a o de la familia…"
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-[1rem]"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q && <button onClick={() => { setQ(""); buscador.current?.focus(); }} className="rounded-xl px-3 text-[0.85rem] text-gray-600 ring-1 ring-gray-300">Borrar</button>}
        </div>
        {!q && (
          <div className="mt-2 flex gap-1.5 text-[0.8rem]">
            {([["faltan", `Faltan (${deLaFranja.length - llegados})`], ["dentro", `Dentro (${llegados})`], ["todos", `Todos (${deLaFranja.length})`]] as const).map(([k, t]) => (
              <button key={k} onClick={() => setVer(k)} className={`rounded-full px-3 py-1 ring-1 ${ver === k ? "bg-gray-900 text-white ring-gray-900" : "text-gray-700 ring-gray-300"}`}>{t}</button>
            ))}
          </div>
        )}
        {q && <p className="mt-1 text-[0.75rem] text-gray-500">Buscando en todo el {dia === "sab" ? "sábado" : "domingo"}, no solo en esta franja.</p>}
      </div>

      {aviso && (
        <div className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[0.85rem] ${aviso.error ? "bg-red-50 text-red-700" : "bg-[#1baf7a]/10 text-[#0b5e40]"}`}>
          <span className="flex-1">{aviso.texto}</span>
          {aviso.deshacer && <button onClick={() => { const f = aviso.deshacer!; setAviso(null); f(); }} className="font-medium underline">Deshacer</button>}
          <button onClick={() => setAviso(null)} aria-label="Cerrar" className="text-gray-400">✕</button>
        </div>
      )}

      {/* Familias */}
      <ul className="space-y-2">
        {familias.map((ps) => {
          const r = ps[0].r;
          const otraFranja = ps[0].franja !== franja;
          const conP = ps.filter(conPlaza);
          const pendientes = conP.filter((p) => !dentro(p));
          return (
            <li key={`${r.id}|${ps[0].franja}`} className={`rounded-2xl border bg-white p-3 ${otraFranja ? "border-amber-300" : "border-gray-200"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-gray-500">
                <span className="text-gray-700">{r.contacto}</span>
                {otraFranja && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Es de {etiquetaFranja(lista, ps[0].franja)}</span>}
                {!otraFranja && pendientes.length > 1 && (
                  <button onClick={() => marcar(pendientes, true)} className="ml-auto rounded-full bg-gray-900 px-3 py-1 text-[0.78rem] text-white">Entran los {pendientes.length}</button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {ps.map((p) => {
                  const ok = dentro(p);
                  const base = { id: r.id, lista: p.lista, idx: p.idx, nombre: p.nombre };
                  if (p.anulada)
                    return (
                      <div key={clave(p)} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-[0.95rem]">
                        <span className="text-gray-500 line-through">{p.nombre}</span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[0.72rem] text-red-700">anulada · {p.anulada.motivo}</span>
                        <button disabled={ocupado} onClick={() => yEntra({ accion: "reactivar", ...base }, base, `${p.nombre}: reactivada y dentro.`)} className="ml-auto rounded-lg px-3 py-1.5 text-[0.8rem] ring-1 ring-gray-300 disabled:opacity-40">Reactivar y entra</button>
                      </div>
                    );
                  if (p.espera)
                    return (
                      <div key={clave(p)} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[0.95rem]">
                        <span className="text-gray-900">{p.nombre}</span>
                        {p.edad && <span className="text-gray-500">{p.edad} años</span>}
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.72rem] text-amber-900">lista de espera</span>
                        <button disabled={ocupado} onClick={() => yEntra({ accion: "dar_plaza", ...base }, base, `${p.nombre}: plaza dada y dentro.`)} className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-[0.8rem] text-white disabled:opacity-40">Dar plaza y entra</button>
                      </div>
                    );
                  if (otraFranja)
                    return (
                      <div key={clave(p)} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/60 px-3 py-2.5 text-[0.95rem]">
                        <span className="text-gray-900">{p.nombre}</span>
                        {p.edad && <span className="text-gray-500">{p.edad} años</span>}
                        {ok && <span className="text-[0.75rem] text-[#0b5e40]">✓ ya entró {p.llegada ? hora(p.llegada.en) : ""}</span>}
                        <span className="ml-auto flex gap-1.5">
                          <button disabled={ocupado} onClick={() => { setFranja(p.franja); setQ(""); }} className="rounded-lg px-3 py-1.5 text-[0.8rem] ring-1 ring-gray-300">Ir a su grupo</button>
                          {!ok && <button disabled={ocupado} onClick={() => yEntra({ accion: "mover", ...base, destino: franja }, base, `${p.nombre}: movido a ${etiquetaFranja(lista, franja)} y dentro.`)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-[0.8rem] text-white disabled:opacity-40">Entra aquí</button>}
                        </span>
                      </div>
                    );
                  return (
                    <button
                      key={clave(p)}
                      onClick={() => marcar([p], !ok)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[1rem] ring-1 transition-colors ${ok ? "bg-[#1baf7a]/10 ring-[#1baf7a]/40" : "bg-white ring-gray-300 active:bg-gray-100"}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[1rem] ${ok ? "bg-[#1baf7a] text-white" : "ring-2 ring-gray-300"}`}>{ok ? "✓" : ""}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`font-medium ${ok ? "text-[#0b5e40]" : "text-gray-900"}`}>{p.nombre}</span>
                        {p.edad && <span className="ml-2 text-[0.85rem] text-gray-500">{p.edad} años</span>}
                        {p.repite && <span className="ml-2 rounded-full bg-[#1C3A5E]/10 px-1.5 text-[0.7rem] text-[#1C3A5E]">repite</span>}
                      </span>
                      <span className="text-[0.75rem] text-gray-500">{ok ? (p.llegada ? hora(p.llegada.en) : "ahora") : "Entra"}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {!familias.length && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[0.9rem] text-gray-500">
          {q ? "Nadie con ese nombre este día. Si viene sin reserva, apúntalo abajo." : ver === "faltan" ? (deLaFranja.length ? "¡Han llegado todos! 🎉" : "No hay nadie apuntado en esta franja.") : "Nadie todavía."}
        </p>
      )}

      {/* Lista de espera y llegadas sin reserva */}
      <section className="space-y-2">
        <div className="flex gap-2">
          <button onClick={() => setAbrir(abrir === "espera" ? "" : "espera")} className={`flex-1 rounded-xl py-2.5 text-[0.85rem] ring-1 ${abrir === "espera" ? "bg-amber-100 ring-amber-300" : "bg-white ring-gray-300"}`}>Lista de espera ({enEspera.length})</button>
          <button onClick={() => setAbrir(abrir === "puerta" ? "" : "puerta")} className={`flex-1 rounded-xl py-2.5 text-[0.85rem] ring-1 ${abrir === "puerta" ? "bg-gray-900 text-white ring-gray-900" : "bg-white ring-gray-300"}`}>Llega sin reserva</button>
        </div>
        {abrir === "espera" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
            {libres > 0 ? <p className="mb-2 text-[0.8rem] text-amber-900">Quedan {libres} plazas libres en esta franja: por orden de llegada a la lista.</p> : <p className="mb-2 text-[0.8rem] text-amber-900">Está completo: si dejan de venir algunos, al empezar puedes dar sus plazas.</p>}
            {enEspera.length ? (
              <ol className="space-y-1.5">
                {enEspera.map((e, i) => (
                  <li key={`${e.id}:${e.idx}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-[0.9rem]">
                    <span className="tabular-nums text-gray-400">{i + 1}.</span>
                    <b className="text-gray-900">{e.nombre}</b>
                    {e.edad && <span className="text-gray-500">{e.edad} años</span>}
                    <span className="text-[0.78rem] text-gray-500">· {e.contacto}{e.telefono ? ` · ${e.telefono}` : ""}</span>
                    <button disabled={ocupado} onClick={() => yEntra({ accion: "dar_plaza", id: e.id, lista: e.lista, idx: e.idx, nombre: e.nombre }, { id: e.id, lista: e.lista, idx: e.idx, nombre: e.nombre }, `${e.nombre}: plaza dada y dentro.`)} className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-[0.8rem] text-white disabled:opacity-40">Dar plaza y entra</button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[0.85rem] text-gray-500">Nadie en lista de espera para esta franja.</p>
            )}
          </div>
        )}
        {abrir === "puerta" && <EnLaPuerta lista={lista} franja={franja} libres={libres} ocupado={ocupado} onHecho={async (cuerpo, hecho) => {
          setOcupado(true);
          try {
            const res = await post(cuerpo);
            setAviso(res.ok ? { texto: hecho } : { texto: res.error ?? "Error", error: true });
            if (res.ok) { setAbrir(""); await cargar(); }
            return res.ok;
          } catch {
            setAviso({ texto: "Sin conexión.", error: true });
            return false;
          } finally {
            setOcupado(false);
          }
        }} />}
      </section>

      <p className="pb-6 text-center text-[0.72rem] text-gray-400">Se actualiza solo cada 15 s (vale para varios móviles a la vez) · {hora(d.actualizado)}</p>
    </div>
  );
}

function EnLaPuerta({ lista, franja, libres, ocupado, onHecho }: { lista: Lista; franja: string; libres: number; ocupado: boolean; onHecho: (cuerpo: Record<string, unknown>, hecho: string) => Promise<boolean> }) {
  const [f, setF] = useState({ nombre: "", edad: "", contacto: "", telefono: "" });
  const nombres = lista === "micromagia" ? f.nombre.split(/,| y | eta /).map((s) => s.trim()).filter(Boolean) : [f.nombre.trim()].filter(Boolean);
  const listo = nombres.length > 0 && (lista === "micromagia" || Number(f.edad) > 0);
  const campo = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[0.95rem]";
  return (
    <form
      className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!listo) return;
        const ok = await onHecho(
          { accion: "puerta_alta", lista, destino: franja, nombres, nombre: nombres[0], edad: Number(f.edad) || undefined, contacto: f.contacto, telefono: f.telefono },
          `${nombres.join(", ")}: apuntado${nombres.length > 1 ? "s" : ""} en la puerta y dentro.`
        );
        if (ok) setF({ nombre: "", edad: "", contacto: "", telefono: "" });
      }}
    >
      <p className="text-[0.8rem] text-gray-600">Se apunta en {lista === "taller" ? GRUPO[franja] : `micromagia ${franja}`}, ocupa plaza y queda marcado como dentro. {libres > 0 ? `Quedan ${libres} libres.` : "Está completo: te pedirá confirmar."}</p>
      <div className="flex gap-2">
        <input className={campo} placeholder={lista === "micromagia" ? "Nombre(s): Ane, Jon…" : "Nombre del niño/a"} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        {lista === "taller" && <input className={`${campo} !w-20`} placeholder="Edad" inputMode="numeric" value={f.edad} onChange={(e) => setF({ ...f, edad: e.target.value.replace(/\D/g, "") })} />}
      </div>
      <div className="flex gap-2">
        <input className={campo} placeholder="Familia (opcional)" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
        <input className={campo} placeholder="Teléfono (opcional)" inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
      </div>
      <button disabled={!listo || ocupado} className="w-full rounded-xl bg-gray-900 py-3 text-[0.95rem] font-medium text-white disabled:opacity-40">Apuntar y entra</button>
    </form>
  );
}
