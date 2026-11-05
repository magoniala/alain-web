"use client";

import { useCallback, useEffect, useState } from "react";
import { PropuestaCard, type Propuesta } from "../charlas/Aprendizajes";

// Aprendizajes del carril MAGIA. Misma UX que charlas/Aprendizajes.tsx:
// propuestas de regla (editar, aprobar, descartar), reglas vigentes que lee la
// IA (lib/crm-ia.ts) y, por tipo de mensaje, la racha de envíos sin
// corrección para decidir cuándo un tipo puede pasar a nivel A. Las agencias
// van en su propio bloque.

interface Stat {
  tipo: string;
  segmento: "agencia" | "general";
  enviados: number;
  editados: number;
  racha_sin_editar: number;
  ultimo_envio: string | null;
}
interface Datos {
  propuestas: Propuesta[];
  error_propuestas: string | null;
  reglas: string;
  reglas_actualizadas: string | null;
  stats: Stat[];
  racha_para_automatico: number;
  aprendizaje_ultima: string | null;
  correcciones_7d: { total: number; sin_motivo: number };
}

const ETIQUETA: Record<string, string> = {
  reactivacion: "Reactivación", recordatorio_1: "Recordatorio 1", recordatorio_2: "Recordatorio 2", recuperacion: "Recuperación", check_in: "Check-in", primer_contacto: "Primer contacto", propuesta: "Propuesta", seguimiento: "Seguimiento", cierre: "Cierre suave",
  agencia_1a: "Primer mail (formato) · 1A", agencia_1b: "Primer mail (a quién escribir) · 1B",
};
function nombreTipo(clave: string) {
  const t = clave.replace(/^agencia · /, "");
  if (t.startsWith("respuesta:")) return `Respuesta · ${t.slice(10).replace(/_/g, " ")}`;
  return ETIQUETA[t] ?? t.replace(/_/g, " ");
}
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "—");

export default function AprendizajesMagia() {
  const [d, setD] = useState<Datos | null>(null);
  const [reglas, setReglas] = useState("");
  const [editandoReglas, setEditandoReglas] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/crm/aprendizaje", { headers: headers() });
    const j = (await r.json()) as Datos;
    setD(j);
    setReglas(j.reglas ?? "");
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
      if (body.accion === "aprender") setMsg(j.saltado ? `No se ha propuesto nada: ${j.saltado}.` : `${j.correcciones} correcciones leídas · ${j.propuestas} propuestas nuevas.`);
      await cargar();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }

  if (!d) return <p className="text-gray-500">Cargando…</p>;

  const pendientes = d.propuestas.filter((p) => p.estado === "pendiente");
  const resueltas = d.propuestas.filter((p) => p.estado !== "pendiente").slice(0, 10);
  const generales = d.stats.filter((s) => s.segmento === "general");
  const agencias = d.stats.filter((s) => s.segmento === "agencia");

  return (
    <div className="space-y-6">
      {d.error_propuestas && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">Falta la tabla de propuestas: ejecuta <code>sql/crm-aprendizaje.sql</code> en Supabase. ({d.error_propuestas})</p>}

      {/* Propuestas */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[1rem] font-semibold">Propuestas de regla · {pendientes.length}</h2>
          <span className="text-[0.8rem] text-gray-500">
            Última pasada: {d.aprendizaje_ultima ? new Date(d.aprendizaje_ultima).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca"} · automática los domingos a las 20:00 · {d.correcciones_7d.total} correcciones esta semana{d.correcciones_7d.sin_motivo ? ` (${d.correcciones_7d.sin_motivo} sin motivo)` : ""}
          </span>
          <button onClick={() => accion("aprender", { accion: "aprender", dias: 14 })} disabled={!!ocupado} className="ml-auto px-3 py-1.5 text-[0.85rem] ring-1 ring-gray-300 disabled:opacity-50">
            {ocupado === "aprender" ? "Analizando…" : "Analizar correcciones ahora"}
          </button>
        </div>
        {msg && <p className="mb-3 text-[0.85rem] text-gray-800">{msg}</p>}
        {pendientes.length === 0 && <p className="text-[0.88rem] text-gray-500">Nada pendiente. Las propuestas salen de tus correcciones en la bandeja de magia: cuantas más veces digas por qué cambias o descartas algo, más aprende.</p>}
        <div className="space-y-3">
          {pendientes.map((p) => (
            <PropuestaCard key={p.id} p={p} ocupado={!!ocupado} onAprobar={(texto) => accion("aprobar", { accion: "aprobar", id: p.id, texto })} onDescartar={() => accion("descartar", { accion: "descartar", id: p.id })} />
          ))}
        </div>
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

      {/* Reglas vigentes */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[1rem] font-semibold">Reglas vigentes · magia</h2>
          <span className="text-[0.8rem] text-gray-500">actualizadas {fecha(d.reglas_actualizadas)}</span>
          <button onClick={() => setEditandoReglas(!editandoReglas)} className="ml-auto text-[0.82rem] text-[#0F2240] underline">
            {editandoReglas ? "Cancelar" : "Editar a mano"}
          </button>
        </div>
        <p className="mb-3 text-[0.8rem] text-gray-500">Esto es lo que lee la IA de magia antes de escribir, con prioridad sobre los guiones. Lo aprobado arriba acaba aquí.</p>
        {editandoReglas ? (
          <>
            <textarea value={reglas} onChange={(e) => setReglas(e.target.value)} rows={14} className="w-full border border-gray-300 px-3 py-2 font-mono text-[0.82rem]" />
            <button onClick={() => { accion("guardar", { accion: "guardar_reglas", texto: reglas }); setEditandoReglas(false); }} disabled={!!ocupado} className="mt-2 bg-[#1a1a1a] px-4 py-2 text-[0.85rem] text-white disabled:opacity-50">
              Guardar reglas
            </button>
          </>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[0.85rem] leading-relaxed text-gray-800">{d.reglas || "(ninguna todavía)"}</pre>
        )}
      </section>

      {/* Racha por tipo */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[1rem] font-semibold">¿Qué puede pasar a nivel A?</h2>
        <p className="mb-3 text-[0.8rem] text-gray-500">
          Un tipo de mensaje está listo cuando lleva <strong>{d.racha_para_automatico}</strong> envíos seguidos sin que corrijas nada (editar o elegir la opción B cuenta como corrección). Hasta entonces, se revisa.
        </p>
        <Rachas titulo="Antiguos clientes, recuperar, intermediarios, referidos" filas={generales} meta={d.racha_para_automatico} vacio="Todavía no hay envíos." />
        <Rachas titulo="Agencias de eventos" filas={agencias} meta={d.racha_para_automatico} vacio="" />
      </section>
    </div>
  );
}

function Rachas({ titulo, filas, meta, vacio }: { titulo: string; filas: Stat[]; meta: number; vacio: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-1 text-[0.82rem] font-medium uppercase tracking-wide text-gray-500">{titulo}</h3>
      {filas.length === 0 && vacio && <p className="text-[0.88rem] text-gray-500">{vacio}</p>}
      <div className="divide-y divide-gray-100">
        {filas.map((s) => {
          const pct = Math.min(100, Math.round((s.racha_sin_editar / meta) * 100));
          const listo = s.racha_sin_editar >= meta;
          return (
            <div key={s.tipo} className="flex flex-wrap items-center gap-3 py-2 text-[0.85rem]">
              <span className="w-[240px] truncate font-medium">{nombreTipo(s.tipo)}</span>
              <span className="text-gray-500">{s.enviados} enviados · {s.editados} corregidos ({s.enviados ? Math.round((s.editados / s.enviados) * 100) : 0} %)</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="h-2 w-[120px] overflow-hidden rounded bg-gray-100">
                  <span className={`block h-full ${listo ? "bg-emerald-500" : "bg-[#0F2240]"}`} style={{ width: `${pct}%` }} />
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
