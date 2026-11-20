"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Charlas › Ayuntamientos: la vía de prospección a los 251 ayuntamientos de
// Euskadi (protocolo en el vault: Vías/Ayuntamientos/00 Flujo ayuntamientos).
// Arriba, el interruptor y los números; después, los ajustes, la
// automatización por racha y la lista de fichas. Las tarjetas de cada
// ayuntamiento salen en la Bandeja, como las de los centros.

interface Config {
  activo: boolean;
  mail1PorDia: number;
  poblacionMinima: number;
  investigarActivo: boolean;
  investigarPorPasada: number;
  localizarPorDia: number;
  autoenvio: boolean;
  racha: number;
  tiposManuales: string[];
  autoenvioTopeDia: number;
}
interface Presupuesto {
  tope: number;
  margen: number;
  gastado: number;
  disponible: number;
  laborables_restantes: number;
  media_diaria_resto: number;
  coste_mail1_ayto: number;
  cupo_ayto_hoy: number;
}
interface Fila {
  id: string;
  nombre: string;
  estado: string;
  territorio: string | null;
  localidad: string | null;
  poblacion: number | null;
  responsable: string | null;
  responsable_cargo: string | null;
  responsable_email: string | null;
  email_centro: string | null;
  web: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  fecha_ultimo_contacto: string | null;
  otros_formatos: string | null;
  fase: number;
  correo: string | null;
  directo: boolean;
  investigacion: { resultado: string; fecha: string } | null;
}
interface Datos {
  config: Config;
  presupuesto: Presupuesto | null;
  total: number;
  por_estado: Record<string, number>;
  investigacion: { hechas: number; por_resultado: Record<string, number>; pendientes: number };
  con_correo_educacion: number;
  solo_buzon: number;
  sin_correo: number;
  lista: Fila[];
  rachas: { tipo: string; etiqueta: string; enviados: number; editados: number; racha: number; manual: boolean }[];
  modo_prueba: boolean;
}

const RESULTADO: Record<string, string> = { concejal: "Educación ✓", buzon: "Solo buzón", sin_correo: "Sin correo", sin_web: "Sin web", error: "Error" };
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "—");

export default function Ayuntamientos({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [d, setD] = useState<Datos | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "educacion" | "buzon" | "sin" | "marcha">("todos");
  const [territorio, setTerritorio] = useState("");
  const [busca, setBusca] = useState("");
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/charlas/ayuntamientos", { headers: headers() });
    const j = await r.json();
    if (!r.ok) {
      setMsg(`Error: ${j.error ?? r.status}. ¿Está aplicado sql/ayuntamientos.sql?`);
      return;
    }
    setD(j as Datos);
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(nombre: string, body: Record<string, unknown>, aviso?: (j: Record<string, unknown>) => string) {
    setOcupado(nombre);
    setMsg("");
    try {
      const r = await fetch("/api/admin/charlas/ayuntamientos", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      if (aviso) setMsg(aviso(j));
      await cargar();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }
  const ajuste = (clave: string, valor: unknown) => accion(clave, { accion: "config", clave, valor });

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.lista.filter((f) => {
      if (territorio && f.territorio !== territorio) return false;
      if (filtro === "educacion" && !f.directo) return false;
      if (filtro === "buzon" && !(f.correo && !f.directo)) return false;
      if (filtro === "sin" && f.correo) return false;
      if (filtro === "marcha" && f.fase < 3) return false;
      if (q && ![f.nombre, f.responsable, f.correo, f.localidad].some((x) => (x ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [d, filtro, territorio, busca]);

  if (!d) return <p className="text-gray-500">{msg || "Cargando…"}</p>;
  const c = d.config;
  const enMarcha = d.lista.filter((f) => f.fase >= 3 && f.fase <= 6).length;

  return (
    <div className="space-y-6">
      {msg && <p className="rounded bg-[#fbf9f5] px-3 py-2 text-[0.85rem] text-gray-700">{msg}</p>}

      {/* Estado de la vía */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[1rem] font-semibold">🏛️ Vía ayuntamientos · {d.total} fichas</h2>
            <p className="mt-1 text-[0.82rem] text-gray-600">
              Investiga sola la web de cada ayuntamiento y, con la vía encendida, prepara cada día los Mail 1 que caben en el presupuesto de IA (máximo {c.mail1PorDia}), de más a menos población, en la Bandeja. Protocolo: vault › Vías › Ayuntamientos.
            </p>
            {d.presupuesto && (
              <p className="mt-1 text-[0.8rem] text-gray-700">
                IA este mes: {d.presupuesto.gastado.toFixed(2)} US$ de {(d.presupuesto.tope - d.presupuesto.margen).toFixed(0)} (tope {d.presupuesto.tope}, nunca se pasa) · quedan {d.presupuesto.laborables_restantes} días laborables · hoy caben <strong>{d.presupuesto.cupo_ayto_hoy}</strong> Mail 1
              </p>
            )}
            {d.modo_prueba && <p className="mt-1 text-[0.8rem] text-[#C47800]">Modo prueba activo: los envíos van a tu correo y no sale nada automático.</p>}
          </div>
          <button
            onClick={() => ajuste("ayto_activo", !c.activo)}
            disabled={!!ocupado}
            className={`px-4 py-2 text-[0.88rem] font-medium ${c.activo ? "bg-emerald-600 text-white" : "bg-[#1a1a1a] text-white"} disabled:opacity-40`}
          >
            {c.activo ? "Encendida · apagar" : "Apagada · encender Mail 1 diario"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Cifra n={d.con_correo_educacion} t="con correo de Educación" />
          <Cifra n={d.solo_buzon} t="solo buzón general" />
          <Cifra n={d.sin_correo} t="sin correo todavía" />
          <Cifra n={enMarcha} t="en marcha (Mail 1 → conversación)" />
        </div>
        <p className="mt-3 text-[0.8rem] text-gray-500">
          Investigación web: {d.investigacion.hechas} hechas · {d.investigacion.pendientes} por hacer
          {Object.entries(d.investigacion.por_resultado).map(([k, v]) => ` · ${RESULTADO[k] ?? k}: ${v}`)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(d.por_estado)
            .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
            .map(([e, n]) => (
              <span key={e} className="rounded-full bg-gray-100 px-3 py-1 text-[0.78rem] text-gray-700">
                {e} <strong>{n}</strong>
              </span>
            ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() =>
              accion("importar", { accion: "importar" }, (j) => {
                const leidos = Object.entries((j.leidos as Record<string, number>) ?? {}).map(([k, v]) => `${k} ${v}`).join(", ");
                const errores = (j.errores as string[]) ?? [];
                return `Padrón leído (${leidos || "nada"}) · ${j.creados} fichas nuevas · ${j.ya_estaban} ya estaban${errores.length ? ` · avisos: ${errores.join(" | ")}` : ""}`;
              })
            }
            disabled={!!ocupado}
            className="bg-white px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300 disabled:opacity-40"
          >
            {ocupado === "importar" ? "Cargando…" : d.total < 200 ? "Cargar los 251 ayuntamientos (INE)" : "Volver a leer el padrón"}
          </button>
          <button
            onClick={() => accion("cola", { accion: "cola" }, (j) => (j.activo ? `${j.creadas} Mail 1 preparados ahora (${j.hoy_ya} ya hoy, caben ${j.cupo_hoy ?? "?"}) · ${j.localizar} tarjetas de localizar · ${j.candidatos} con correo en la cola` : "La vía está apagada: enciéndela para preparar Mail 1."))}
            disabled={!!ocupado}
            className="bg-white px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300 disabled:opacity-40"
          >
            {ocupado === "cola" ? "Preparando…" : "Preparar ya los Mail 1 de hoy"}
          </button>
        </div>
      </section>

      {/* Ajustes */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-[0.95rem] font-semibold">Ajustes</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Numero key={`mail1PorDia-${c.mail1PorDia}`} etiqueta="Máximo de Mail 1 al día (el presupuesto lo recorta)" valor={c.mail1PorDia} onGuardar={(v) => ajuste("ayto_mail1_maximo_dia", v)} />
          <Numero key={`poblacionMinima-${c.poblacionMinima}`} etiqueta="Población mínima (0 = todos)" valor={c.poblacionMinima} onGuardar={(v) => ajuste("ayto_poblacion_minima", v)} />
          <Numero key={`localizarPorDia-${c.localizarPorDia}`} etiqueta="Tarjetas «localizar correo» al día" valor={c.localizarPorDia} onGuardar={(v) => ajuste("ayto_localizar_por_dia", v)} />
          <Numero key={`investigarPorPasada-${c.investigarPorPasada}`} etiqueta="Investigados por pasada del cron" valor={c.investigarPorPasada} onGuardar={(v) => ajuste("ayto_investigar_por_pasada", v)} />
          <Numero key={`racha-${c.racha}`} etiqueta="Envíos seguidos sin corregir para automático" valor={c.racha} onGuardar={(v) => ajuste("ayto_racha_automatico", v)} />
          <Numero key={`autoenvioTopeDia-${c.autoenvioTopeDia}`} etiqueta="Máximo de automáticos al día" valor={c.autoenvioTopeDia} onGuardar={(v) => ajuste("ayto_autoenvio_tope_dia", v)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[0.85rem]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={c.investigarActivo} onChange={(e) => ajuste("ayto_investigar_activo", e.target.checked)} /> Investigación web activa
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={c.autoenvio} onChange={(e) => ajuste("ayto_autoenvio", e.target.checked)} /> Envío automático cuando un tipo llega a la racha
          </label>
        </div>
      </section>

      {/* Automatización */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-[0.95rem] font-semibold">Automatización por tipo de mail</h3>
        <p className="mb-3 mt-1 text-[0.8rem] text-gray-600">
          Cuando un tipo lleva {c.racha} envíos seguidos sin que toques el texto, sale solo (L-V de 9 a 18, nunca en modo prueba, ni lo que la IA marca para ti, ni tarjetas con dos versiones, ni conversaciones abiertas). Si editas uno, la racha vuelve a cero.
        </p>
        <div className="divide-y divide-gray-100">
          {d.rachas.map((r) => {
            const listo = r.racha >= c.racha;
            const estado = r.manual ? "Manual" : listo && c.autoenvio ? "Automático" : `${r.racha}/${c.racha}`;
            return (
              <div key={r.tipo} className="flex flex-wrap items-center gap-3 py-2 text-[0.83rem]">
                <span className="w-full min-w-0 flex-1 sm:w-auto">{r.etiqueta}</span>
                <span className="text-gray-500">{r.enviados} enviados · {r.editados} corregidos</span>
                <span className="relative h-2 w-28 overflow-hidden rounded bg-gray-100">
                  <span className={`absolute inset-y-0 left-0 ${listo ? "bg-emerald-500" : "bg-[#0F2240]"}`} style={{ width: `${Math.min(100, Math.round((r.racha / Math.max(1, c.racha)) * 100))}%` }} />
                </span>
                <span className={`w-[92px] text-right ${estado === "Automático" ? "font-medium text-emerald-700" : "text-gray-600"}`}>{estado}</span>
                <button onClick={() => accion(`manual-${r.tipo}`, { accion: "manual", tipo: r.tipo, manual: !r.manual })} disabled={!!ocupado} className="text-[0.78rem] text-[#C47800] disabled:opacity-40">
                  {r.manual ? "Permitir automático" : "Dejar en manual"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["todos", "Todos"],
              ["educacion", "Con Educación"],
              ["buzon", "Solo buzón"],
              ["sin", "Sin correo"],
              ["marcha", "En marcha"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} onClick={() => setFiltro(k)} className={`px-3 py-1.5 text-[0.82rem] ${filtro === k ? "bg-[#0F2240] text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>
              {t}
            </button>
          ))}
          <select value={territorio} onChange={(e) => setTerritorio(e.target.value)} className="ml-auto border border-gray-300 bg-white px-2 py-1.5 text-[0.82rem]">
            <option value="">Los tres territorios</option>
            <option>Gipuzkoa</option>
            <option>Bizkaia</option>
            <option>Araba</option>
          </select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pueblo, persona, correo…" className="w-full border border-gray-300 bg-white px-3 py-1.5 text-[0.82rem] sm:w-auto" />
        </div>
        <p className="mb-2 text-[0.78rem] text-gray-500">{lista.length} ayuntamientos</p>
        <ul className="divide-y divide-gray-100">
          {lista.slice(0, 300).map((f) => (
            <li key={f.id} className="flex flex-col gap-1 py-2.5 text-[0.83rem] sm:flex-row sm:items-start sm:gap-3">
              <div className="min-w-0 flex-1">
                <button onClick={() => onAbrir(f.id)} className="text-left font-medium text-[#0F2240] hover:underline">
                  {f.nombre}
                </button>
                <span className="ml-2 text-gray-500">
                  {f.territorio ?? "—"}
                  {f.poblacion ? ` · ${f.poblacion.toLocaleString("es-ES")} hab.` : ""}
                </span>
                <div className="text-gray-600">
                  {f.directo ? `📧 ${[f.responsable, f.responsable_cargo].filter(Boolean).join(" · ") || "Educación"} · ${f.correo}` : f.correo ? `📭 Buzón: ${f.correo}${f.responsable ? ` · ${f.responsable}` : ""}` : "Sin correo"}
                </div>
                {f.proxima_accion && f.fase >= 3 && (
                  <div className="text-gray-500">
                    → {f.proxima_accion} {f.fecha_proxima_accion ? `(${fmt(f.fecha_proxima_accion)})` : ""}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[0.78rem]">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{f.estado}</span>
                <span className="text-gray-500">{f.investigacion ? `${RESULTADO[f.investigacion.resultado] ?? f.investigacion.resultado} · ${fmt(f.investigacion.fecha)}` : "Sin investigar"}</span>
                <button onClick={() => accion(`inv-${f.id}`, { accion: "investigar", id: f.id }, (j) => `${f.nombre}: ${RESULTADO[String(j.resultado)] ?? j.resultado}`)} disabled={!!ocupado} className="text-[#C47800] disabled:opacity-40">
                  {ocupado === `inv-${f.id}` ? "Mirando…" : "Investigar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Cifra({ n, t }: { n: number; t: string }) {
  return (
    <div className="rounded-xl bg-[#fbf9f5] px-3 py-2">
      <div className="text-[1.3rem] font-semibold text-[#0F2240]">{n}</div>
      <div className="text-[0.78rem] text-gray-600">{t}</div>
    </div>
  );
}

function Numero({ etiqueta, valor, onGuardar }: { etiqueta: string; valor: number; onGuardar: (v: number) => void }) {
  const [v, setV] = useState(String(valor));
  return (
    <label className="flex flex-col gap-1 text-[0.8rem] text-gray-600">
      {etiqueta}
      <input
        type="number"
        min={0}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => Number(v) !== valor && Number.isFinite(Number(v)) && onGuardar(Number(v))}
        className="w-28 border border-gray-300 bg-white px-2 py-1 text-[0.85rem] text-gray-900"
      />
    </label>
  );
}
