"use client";

import { useCallback, useEffect, useState } from "react";

// Aprendizajes y métricas del carril charlas.
//
// Arriba: lo que el sistema ha aprendido (reglas vigentes) y lo que propone
// aprender (pendiente de que Alain apruebe). Después, por tipo de mensaje,
// cuántos envíos lleva sin corrección: cuando un tipo supera la racha
// configurada, está listo para pasar a automático. Debajo, el embudo y el
// coste de la IA.

interface Propuesta {
  id: string;
  creado_en: string;
  regla: string;
  tipos: string[];
  evidencia: string | null;
  n_correcciones: number;
  estado: "pendiente" | "aprobada" | "descartada";
}

interface Datos {
  propuestas: Propuesta[];
  reglas: string;
  reglas_actualizadas: string | null;
  stats: { tipo: string; enviados: number; editados: number; racha_sin_editar: number; ultimo_envio: string | null }[];
  racha_para_automatico: number;
  aprendizaje_ultima: string | null;
  embudo: { por_estado: Record<string, number>; por_territorio: Record<string, Record<string, number>>; total: number };
  proximas_por_mes: Record<string, number>;
  coste_por_dia: Record<string, number>;
  tareas_30d: { creadas: number; enviadas: number; editadas: number; descartadas: number; pendientes: number; horas_medias_hasta_resolver: number | null; por_urgencia: Record<string, number> };
}

const FASES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const NOMBRE_FASE: Record<string, string> = { "0": "Por llamar", "1": "Llamando", "2": "Contacto", "3": "Mail 1", "4": "Respondió", "5": "Dossier", "6": "Conversación", "7": "Ganado", "8": "Perdido", "9": "Aparcado" };

function fecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "—";
}

export default function Aprendizajes() {
  const [d, setD] = useState<Datos | null>(null);
  const [reglas, setReglas] = useState("");
  const [editandoReglas, setEditandoReglas] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/charlas/aprendizaje", { headers: headers() });
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
      const r = await fetch("/api/admin/charlas/aprendizaje", { method: "POST", headers: headers(), body: JSON.stringify(body) });
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
  const dias = Object.keys(d.coste_por_dia).sort();
  const costeTotal = dias.reduce((s, k) => s + d.coste_por_dia[k], 0);
  const maxCoste = Math.max(0.01, ...dias.map((k) => d.coste_por_dia[k]));
  const meses = Object.keys(d.proximas_por_mes).sort();
  const maxMes = Math.max(1, ...meses.map((m) => d.proximas_por_mes[m]));

  return (
    <div className="space-y-6">
      {/* Propuestas */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[1rem] font-semibold">Propuestas de regla · {pendientes.length}</h2>
          <span className="text-[0.8rem] text-gray-500">Última pasada: {d.aprendizaje_ultima ? new Date(d.aprendizaje_ultima).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca"} · automática los domingos a las 20:00</span>
          <button onClick={() => accion("aprender", { accion: "aprender", dias: 14 })} disabled={!!ocupado} className="ml-auto px-3 py-1.5 text-[0.85rem] ring-1 ring-gray-300 disabled:opacity-50">
            {ocupado === "aprender" ? "Analizando…" : "Analizar correcciones ahora"}
          </button>
        </div>
        {msg && <p className="mb-3 text-[0.85rem] text-gray-800">{msg}</p>}
        {pendientes.length === 0 && <p className="text-[0.88rem] text-gray-500">Nada pendiente. Las propuestas salen de tus correcciones: cuantas más veces digas por qué cambias algo, más aprende.</p>}
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
          <h2 className="text-[1rem] font-semibold">Reglas vigentes</h2>
          <span className="text-[0.8rem] text-gray-500">actualizadas {fecha(d.reglas_actualizadas)}</span>
          <button onClick={() => setEditandoReglas(!editandoReglas)} className="ml-auto text-[0.82rem] text-[#0F2240] underline">
            {editandoReglas ? "Cancelar" : "Editar a mano"}
          </button>
        </div>
        <p className="mb-3 text-[0.8rem] text-gray-500">Esto es lo que lee la IA antes de escribir, con prioridad sobre los guiones. Lo aprobado arriba acaba aquí.</p>
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
        <h2 className="mb-1 text-[1rem] font-semibold">¿Qué puede pasar a automático?</h2>
        <p className="mb-3 text-[0.8rem] text-gray-500">
          Un tipo de mensaje está listo cuando lleva <strong>{d.racha_para_automatico}</strong> envíos seguidos sin que corrijas nada. Hasta entonces, se revisa.
        </p>
        {d.stats.length === 0 && <p className="text-[0.88rem] text-gray-500">Todavía no hay envíos.</p>}
        <div className="divide-y divide-gray-100">
          {d.stats.map((s) => {
            const pct = Math.min(100, Math.round((s.racha_sin_editar / d.racha_para_automatico) * 100));
            const listo = s.racha_sin_editar >= d.racha_para_automatico;
            return (
              <div key={s.tipo} className="flex flex-wrap items-center gap-3 py-2 text-[0.85rem]">
                <span className="w-[220px] truncate font-medium">{s.tipo.replace("respuesta:", "respuesta · ")}</span>
                <span className="text-gray-500">{s.enviados} enviados · {s.editados} editados ({s.enviados ? Math.round((s.editados / s.enviados) * 100) : 0} %)</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="h-2 w-[120px] overflow-hidden rounded bg-gray-100">
                    <span className={`block h-full ${listo ? "bg-emerald-500" : "bg-[#0F2240]"}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={`w-[90px] text-right ${listo ? "font-medium text-emerald-700" : "text-gray-600"}`}>{listo ? "Listo" : `${s.racha_sin_editar}/${d.racha_para_automatico}`}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bandeja 30 días */}
      <section className="grid gap-4 md:grid-cols-3">
        <Cifra titulo="Tareas · 30 días" valor={d.tareas_30d.creadas} detalle={`${d.tareas_30d.enviadas} enviadas · ${d.tareas_30d.descartadas} descartadas · ${d.tareas_30d.pendientes} pendientes`} />
        <Cifra titulo="Editadas antes de enviar" valor={d.tareas_30d.enviadas ? `${Math.round((d.tareas_30d.editadas / d.tareas_30d.enviadas) * 100)} %` : "—"} detalle="Cuanto más baje, menos tiempo tuyo hace falta" />
        <Cifra titulo="Horas hasta resolver" valor={d.tareas_30d.horas_medias_hasta_resolver ?? "—"} detalle={`🔴 ${d.tareas_30d.por_urgencia["3"] ?? 0} · 🟠 ${d.tareas_30d.por_urgencia["2"] ?? 0} · 🟢 ${d.tareas_30d.por_urgencia["1"] ?? 0}`} />
      </section>

      {/* Embudo */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[1rem] font-semibold">Embudo · {d.embudo.total} centros</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3 font-medium">Territorio</th>
                {FASES.map((f) => (
                  <th key={f} className="px-2 py-1 text-right font-medium" title={NOMBRE_FASE[f]}>{NOMBRE_FASE[f]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.embudo.por_territorio)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([t, fases]) => (
                  <tr key={t} className="border-t border-gray-100">
                    <td className="py-1 pr-3 font-medium">{t}</td>
                    {FASES.map((f) => (
                      <td key={f} className={`px-2 py-1 text-right ${fases[f] ? "" : "text-gray-300"}`}>{fases[f] ?? 0}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Próximas acciones por mes */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[1rem] font-semibold">Lo que viene, por mes</h2>
        <p className="mb-3 text-[0.8rem] text-gray-500">Centros con próxima acción programada (reactivaciones, seguimientos). Enero y mayo son la cosecha de septiembre.</p>
        <div className="space-y-1.5">
          {meses.map((m) => (
            <div key={m} className="flex items-center gap-3 text-[0.85rem]">
              <span className="w-[64px] text-gray-600">{m.slice(5)}/{m.slice(2, 4)}</span>
              <span className="h-3 flex-1 overflow-hidden rounded bg-gray-100">
                <span className={`block h-full ${m < new Date().toISOString().slice(0, 7) ? "bg-[#DC2626]" : "bg-[#0F2240]"}`} style={{ width: `${(d.proximas_por_mes[m] / maxMes) * 100}%` }} />
              </span>
              <span className="w-[40px] text-right font-medium">{d.proximas_por_mes[m]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Coste IA */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[1rem] font-semibold">Coste de la IA · {costeTotal.toFixed(2)} $ en 30 días</h2>
        <p className="mb-3 text-[0.8rem] text-gray-500">Objetivo: por debajo de 100 $/mes. Lo caro es la primera llamada de cada hora (carga el conocimiento); las siguientes cuestan céntimos.</p>
        <div className="flex h-[90px] items-end gap-1">
          {dias.map((k) => (
            <div key={k} className="group relative flex-1">
              <div className="w-full rounded-t bg-[#0F2240]" style={{ height: `${Math.max(2, (d.coste_por_dia[k] / maxCoste) * 80)}px` }} />
              <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[0.7rem] text-gray-600 group-hover:block">{k.slice(5)} · {d.coste_por_dia[k].toFixed(2)} $</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.78rem] text-gray-500">{titulo}</p>
      <p className="mt-1 text-[1.6rem] font-semibold tracking-tight">{valor}</p>
      <p className="text-[0.78rem] text-gray-500">{detalle}</p>
    </div>
  );
}

function PropuestaCard({ p, ocupado, onAprobar, onDescartar }: { p: Propuesta; ocupado: boolean; onAprobar: (texto: string) => void; onDescartar: () => void }) {
  const [texto, setTexto] = useState(p.regla);
  return (
    <div className="rounded-xl border border-gray-200 bg-[#fbf9f5] p-4">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="w-full border border-gray-300 bg-white px-3 py-2 text-[0.88rem]" />
      <p className="mt-1 text-[0.78rem] text-gray-500">
        {p.n_correcciones} correcciones{p.tipos?.length ? ` · tipos: ${p.tipos.join(", ")}` : ""}{p.evidencia ? ` · ${p.evidencia}` : ""}
      </p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => onAprobar(texto)} disabled={ocupado || !texto.trim()} className="bg-[#1a1a1a] px-3 py-1.5 text-[0.82rem] text-white disabled:opacity-50">Aprobar</button>
        <button onClick={onDescartar} disabled={ocupado} className="px-3 py-1.5 text-[0.82rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-50">Descartar</button>
      </div>
    </div>
  );
}
