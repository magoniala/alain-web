"use client";

import { useCallback, useEffect, useState } from "react";
import { PropuestaCard, type Propuesta } from "../charlas/Aprendizajes";
import type { PanelAprendizajeMagia } from "@/lib/crm-aprendizaje";

// Aprendizajes del carril MAGIA (misma UX que charlas/Aprendizajes.tsx).
// 1. Propuestas de regla que salen de tus correcciones: editar, aprobar, descartar.
// 2. Reglas vigentes: lo que lee la IA de magia antes de escribir.
// 3. Por tipo de mensaje, racha de envíos sin corrección (agencias aparte).

type Datos = Omit<PanelAprendizajeMagia, "propuestas"> & { propuestas: Propuesta[] };
type Stat = Datos["stats"][number];

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ETIQUETA: Record<string, string> = {
  reactivacion: "Reactivación", recordatorio_1: "Recordatorio 1", recordatorio_2: "Recordatorio 2", recuperacion: "Recuperación", check_in: "Check-in", primer_contacto: "Primer contacto", propuesta: "Propuesta", seguimiento: "Seguimiento", cierre: "Cierre suave",
  agencia_1a: "Primer mail · 1A (formato)", agencia_1b: "Primer mail · 1B (a quién escribir)",
};
function nombreTipo(clave: string) {
  const t = clave.replace(/^agencia · /, "");
  if (t.startsWith("respuesta:")) return `Respuesta · ${t.slice(10).replace(/_/g, " ")}`;
  return ETIQUETA[t] ?? t.replace(/_/g, " ");
}
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function resumenPasada(p: Datos["ultima_pasada"]) {
  if (!p?.fecha) return { texto: "todavía no se ha hecho ninguna", error: false };
  const cuando = fechaHora(p.fecha);
  if (p.error) return { texto: `${cuando} · falló: ${p.error}`, error: true };
  if (p.saltado) return { texto: `${cuando} · no propuso nada (${p.saltado})`, error: false };
  return { texto: `${cuando} · ${p.correcciones} correcciones leídas → ${p.propuestas} propuestas`, error: false };
}

export default function AprendizajesMagia() {
  const [d, setD] = useState<Datos | null>(null);
  const [reglas, setReglas] = useState("");
  const [editandoReglas, setEditandoReglas] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/crm/aprendizaje", { headers: headers() });
    const j = await r.json();
    if (!r.ok) {
      setMsg(`Error al cargar: ${j.error ?? r.status}`);
      return;
    }
    setD(j as Datos);
    setReglas((j as Datos).reglas ?? "");
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(nombre: string, body: Record<string, unknown>) {
    setOcupado(nombre);
    setMsg("");
    try {
      const r = await fetch("/api/admin/crm/aprendizaje", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      if (nombre === "guardar") setEditandoReglas(false);
      await cargar();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }

  if (!d) return <p className="text-gray-500">{msg || "Cargando…"}</p>;

  const pendientes = d.propuestas.filter((p) => p.estado === "pendiente");
  const resueltas = d.propuestas.filter((p) => p.estado !== "pendiente").slice(0, 10);
  const pasada = resumenPasada(d.ultima_pasada);

  return (
    <div className="space-y-6">
      {d.avisos.length > 0 && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">{d.avisos.join(" · ")}</p>}

      {/* 1. Propuestas */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="text-[1rem] font-semibold">Propuestas de regla · {pendientes.length}</h2>
          <button onClick={() => accion("aprender", { accion: "aprender", dias: 14 })} disabled={!!ocupado} className="ml-auto px-3 py-1.5 text-[0.85rem] ring-1 ring-gray-300 disabled:opacity-50">
            {ocupado === "aprender" ? "Analizando…" : "Analizar ahora (últimos 14 días)"}
          </button>
        </div>
        <p className="mb-3 text-[0.8rem] text-gray-500">
          Se analiza solo cada {DIAS[d.programada.dia] ?? "domingo"} a las {d.programada.hora}. Última pasada: <span className={pasada.error ? "text-red-700" : ""}>{pasada.texto}</span>.
          <br />
          Esta semana: {d.correcciones_7d.total} correcciones{d.correcciones_7d.sin_motivo ? `, ${d.correcciones_7d.sin_motivo} sin motivo (con motivo aprende más y antes)` : ""}.
        </p>
        {msg && <p className="mb-3 text-[0.85rem] text-red-700">{msg}</p>}
        {pendientes.length === 0 && <p className="text-[0.88rem] text-gray-500">Nada pendiente. Las propuestas salen de lo que corriges, eliges como opción B o descartas en la bandeja de magia.</p>}
        <div className="space-y-3">
          {pendientes.map((p) => (
            <PropuestaCard key={p.id} p={p} ocupado={!!ocupado} onAprobar={(texto) => accion("aprobar", { accion: "aprobar", id: p.id, texto })} onDescartar={() => accion("descartar", { accion: "descartar", id: p.id })} />
          ))}
        </div>
        {pendientes.length > 0 && <p className="mt-2 text-[0.78rem] text-gray-500">Puedes retocar el texto antes de aprobar. Lo que descartes no se vuelve a proponer.</p>}
        {resueltas.length > 0 && (
          <details className="mt-4 text-[0.82rem] text-gray-600">
            <summary className="cursor-pointer">Últimas resueltas ({resueltas.length})</summary>
            <ul className="mt-2 space-y-1">
              {resueltas.map((p) => (
                <li key={p.id}>
                  <span className={p.estado === "aprobada" ? "text-emerald-700" : "text-gray-400"}>{p.estado === "aprobada" ? "✓" : "✗"}</span> {p.regla}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* 2. Reglas vigentes */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[1rem] font-semibold">Reglas vigentes</h2>
          <span className="text-[0.8rem] text-gray-500">{d.reglas_actualizadas ? `actualizadas ${fechaHora(d.reglas_actualizadas)}` : ""}</span>
          <button onClick={() => { setReglas(d.reglas); setEditandoReglas(!editandoReglas); }} className="ml-auto text-[0.82rem] text-[#0F2240] underline">
            {editandoReglas ? "Cancelar" : "Editar a mano"}
          </button>
        </div>
        <p className="mb-3 text-[0.8rem] text-gray-500">Lo que lee la IA de magia antes de escribir, con prioridad sobre los guiones. Lo que apruebas arriba se añade aquí, numerado y fechado.</p>
        {editandoReglas ? (
          <>
            <textarea value={reglas} onChange={(e) => setReglas(e.target.value)} rows={14} className="w-full border border-gray-300 px-3 py-2 font-mono text-[0.82rem]" />
            <button onClick={() => accion("guardar", { accion: "guardar_reglas", texto: reglas })} disabled={!!ocupado || !reglas.trim()} className="mt-2 bg-[#1a1a1a] px-4 py-2 text-[0.85rem] text-white disabled:opacity-50">
              Guardar reglas
            </button>
          </>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[0.85rem] leading-relaxed text-gray-800">{d.reglas || "(ninguna todavía)"}</pre>
        )}
      </section>

      {/* 3. Rachas */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[1rem] font-semibold">¿En qué tipos ya acierta?</h2>
        <p className="mb-3 text-[0.8rem] text-gray-500">
          Un tipo está <strong>listo para nivel A</strong> cuando lleva {d.racha_para_automatico} envíos seguidos sin corrección (editar o elegir la opción B rompe la racha; descartar no cuenta como envío). En magia todavía no sale nada solo: «Listo» es la señal para decidir automatizarlo.
        </p>
        <Rachas titulo="Antiguos clientes, recuperar, intermediarios y referidos" filas={d.stats.filter((s) => s.segmento === "general")} meta={d.racha_para_automatico} vacio="Todavía no hay envíos." />
        <Rachas titulo="Agencias de eventos" nota="1A, 1B y el recordatorio son texto fijo del guion: si los corriges, lo que toca es cambiar el guion." filas={d.stats.filter((s) => s.segmento === "agencia")} meta={d.racha_para_automatico} />
      </section>
    </div>
  );
}

function Rachas({ titulo, nota, filas, meta, vacio }: { titulo: string; nota?: string; filas: Stat[]; meta: number; vacio?: string }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-[0.8rem] font-medium uppercase tracking-wide text-gray-500">{titulo}</h3>
      {nota && <p className="text-[0.78rem] text-gray-500">{nota}</p>}
      {filas.length === 0 && vacio && <p className="mt-1 text-[0.88rem] text-gray-500">{vacio}</p>}
      <div className="divide-y divide-gray-100">
        {filas.map((s) => {
          const listo = s.racha_sin_editar >= meta;
          return (
            <div key={s.tipo} className="flex flex-wrap items-center gap-3 py-2 text-[0.85rem]">
              <span className="w-[240px] truncate font-medium">{nombreTipo(s.tipo)}</span>
              <span className="text-gray-500">{s.enviados ? `${s.enviados} enviados · ${Math.round((s.editados / s.enviados) * 100)} % corregidos` : "sin envíos"}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="h-2 w-[120px] overflow-hidden rounded bg-gray-100">
                  <span className={`block h-full ${listo ? "bg-emerald-500" : "bg-[#0F2240]"}`} style={{ width: `${Math.min(100, Math.round((s.racha_sin_editar / meta) * 100))}%` }} />
                </span>
                <span className={`w-[90px] text-right ${listo ? "font-medium text-emerald-700" : "text-gray-600"}`}>{listo ? "Listo" : `${s.racha_sin_editar}/${meta}`}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
