"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Pestaña Entrenatzaile · fase 7a del sistema automático (Arquitectura v3):
// clientes con su plan, semanas programadas (sesiones, ejercicios) y la cola
// de avisos del protocolo. De momento los avisos no se envían (fase 7b) y el
// cliente sigue en Trainer Studio; esto es el lado de Alain.

interface ClienteLista {
  id: string;
  nombre: string;
  estado: string;
  aviso_canal: string;
  token: string | null;
  push: { id: string }[];
  plan: { id: string; nombre: string; inicio: string; fin: string | null } | null;
  semana_actual: { id: string; numero: number; lunes: string; estado: string; fase: string | null } | null;
  semana_siguiente: { id: string; numero: number; lunes: string; estado: string } | null;
  constancia_4s: { hechas: number; programadas: number };
}
interface Cliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  idioma: string;
  estado: string;
  zonas_riesgo: string | null;
  reglas: string[];
  material: string | null;
  aviso_canal: string;
  ficha_vault: string | null;
  notas: string | null;
  token: string | null;
}
interface Plan {
  id: string;
  nombre: string;
  inicio: string;
  fin: string | null;
  frecuencia: string | null;
  activo: boolean;
  metas: { meta: string; ahora: string; hitos: string[]; minimo: string }[];
  fases: { semanas: string; fechas: string; fase: string; que_pasa: string }[];
  reglas_carga: string | null;
  nota_vault: string | null;
}
interface Tipo {
  id: string;
  clave: string;
  nombre: string;
  dia_habitual: number | null;
  duracion_min: number | null;
}
interface SemanaLista {
  id: string;
  numero: number;
  lunes: string;
  titulo: string | null;
  fase: string | null;
  rir_objetivo: string | null;
  estado: string;
  sesiones: { id: string; estado: string; fecha: string }[];
  avisos: { id: string; estado: string }[];
}
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
interface Aviso {
  id: string;
  sesion_id: string | null;
  tipo: string;
  programado_para: string;
  canal: string;
  texto: string | null;
  estado: string;
  editado: boolean;
}
interface DetalleSemana {
  semana: { id: string; numero: number; lunes: string; titulo: string | null; notas: string | null; rir_objetivo: string | null; fase: string | null; estado: string; resumen: string | null };
  sesiones: Sesion[];
  avisos: Aviso[];
  series: { ejercicio_id: string; serie: number; reps: number | null; peso: number | null; rir: number | null; lado: string | null; nota: string | null }[];
  formularios: { sesion_id: string; tipo: string; respuestas: Record<string, unknown>; alerta: string | null; fotos_url?: string[]; creado_en: string }[];
}

const DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIA_C = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
const sumar = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const corta = (iso: string) => `${Number(iso.slice(8))} ${MES[Number(iso.slice(5, 7)) - 1]}`;
const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const madrid = (iso: string) => {
  const d = new Date(iso);
  const f = d.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const h = d.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
  return { f, h };
};
const TIPO_AVISO: Record<string, string> = {
  aviso_dia_antes: "Mañana toca",
  recordatorio_dia: "Hoy toca",
  formulario_post: "Formulario post-sesión",
  si_no_registra: "Si no ha registrado",
  formulario_recuperacion: "Formulario de recuperación",
  resumen_domingo: "Resumen + aviso del lunes",
  manual: "Aviso",
};
const ESTADO_SEMANA: Record<string, string> = {
  borrador: "bg-amber-50 text-amber-900 ring-amber-200",
  programada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cerrada: "bg-gray-100 text-gray-600 ring-gray-200",
};
const ESTADO_AVISO: Record<string, string> = {
  programado: "bg-sky-50 text-sky-800",
  borrador: "bg-amber-50 text-amber-900",
  enviado: "bg-emerald-50 text-emerald-800",
  omitido: "bg-gray-100 text-gray-500",
  cancelado: "bg-gray-100 text-gray-400 line-through",
  error: "bg-red-50 text-red-800",
};
const CAMPOS = ["reps", "peso", "rir", "tempo", "tiempo", "lado", "nota", "video"];

/** Input que guarda al salir (blur) si ha cambiado. */
function Campo({ valor, onGuardar, className = "", placeholder, tipo = "text", area = false, filas = 2 }: { valor: string | number | null; onGuardar: (v: string) => void; className?: string; placeholder?: string; tipo?: string; area?: boolean; filas?: number }) {
  const [v, setV] = useState(valor === null || valor === undefined ? "" : String(valor));
  useEffect(() => setV(valor === null || valor === undefined ? "" : String(valor)), [valor]);
  const salir = () => {
    if (v !== (valor === null || valor === undefined ? "" : String(valor))) onGuardar(v);
  };
  const cls = `w-full border border-transparent bg-transparent px-1.5 py-1 text-[0.86rem] text-gray-900 hover:border-gray-200 focus:border-gray-400 focus:bg-white focus:outline-none ${className}`;
  return area ? (
    <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={salir} rows={filas} placeholder={placeholder} className={cls} />
  ) : (
    <input type={tipo} value={v} onChange={(e) => setV(e.target.value)} onBlur={salir} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder={placeholder} className={cls} />
  );
}

export default function EntrenatzaileTab() {
  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": pw() }), [pw]);
  const [clientes, setClientes] = useState<ClienteLista[]>([]);
  const [faltaSql, setFaltaSql] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [ficha, setFicha] = useState<{ cliente: Cliente; plan: Plan | null; tipos: Tipo[]; semanas: SemanaLista[] } | null>(null);
  const [semSel, setSemSel] = useState<string | null>(null);
  const [det, setDet] = useState<DetalleSemana | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarClientes = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/ent", { headers: headers() });
      const d = await r.json();
      if (!r.ok) {
        setFaltaSql(!!d.falta_sql || /ent_clientes/.test(d.error ?? ""));
        setError(d.error ?? "Error");
        return;
      }
      setClientes(d.clientes);
      setError("");
      setSel((s) => s ?? d.clientes[0]?.id ?? null);
    } catch {
      setError("Sin conexión. Vuelve a intentarlo en un momento.");
    }
  }, [headers]);

  const cargarFicha = useCallback(
    async (id: string, mantenerSemana = true) => {
      const r = await fetch(`/api/admin/ent?cliente=${id}`, { headers: headers() });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? "Error");
      setFicha(d);
      const h = hoyISO();
      const actual = (d.semanas as SemanaLista[]).find((s) => s.lunes <= h && sumar(s.lunes, 6) >= h);
      setSemSel((prev) => (mantenerSemana && prev && d.semanas.some((s: SemanaLista) => s.id === prev) ? prev : actual?.id ?? d.semanas.at(-1)?.id ?? null));
    },
    [headers],
  );

  const cargarSemana = useCallback(
    async (id: string) => {
      const r = await fetch(`/api/admin/ent?semana=${id}`, { headers: headers() });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? "Error");
      setDet(d);
    },
    [headers],
  );

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);
  useEffect(() => {
    if (sel) cargarFicha(sel, false);
  }, [sel, cargarFicha]);
  useEffect(() => {
    if (semSel) cargarSemana(semSel);
    else setDet(null);
  }, [semSel, cargarSemana]);

  const post = useCallback(
    async (body: Record<string, unknown>, recargar: ("semana" | "ficha" | "clientes")[] = ["semana"]) => {
      setOcupado(true);
      try {
        const r = await fetch("/api/admin/ent", { method: "POST", headers: headers(), body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok) {
          setAviso(d.error ?? "No se pudo guardar.");
          return null;
        }
        if (recargar.includes("semana") && semSel) await cargarSemana(semSel);
        if (recargar.includes("ficha") && sel) await cargarFicha(sel);
        if (recargar.includes("clientes")) await cargarClientes();
        return d;
      } catch {
        setAviso("Sin conexión: no se ha guardado. Vuelve a intentarlo.");
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [headers, semSel, sel, cargarSemana, cargarFicha, cargarClientes],
  );

  const copiarMarkdown = async () => {
    if (!semSel) return;
    const r = await fetch(`/api/admin/ent?semana=${semSel}&formato=md`, { headers: headers() });
    const t = await r.text();
    try {
      await navigator.clipboard.writeText(t);
      setAviso("Semana copiada en Markdown.");
    } catch {
      const blob = new Blob([t], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${ficha?.cliente.nombre ?? "semana"} — Semana ${det?.semana.numero ?? ""}.md`;
      a.click();
    }
  };

  if (faltaSql)
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[0.9rem] text-amber-950">
        Falta crear las tablas: ejecuta <code>entrenatzaile-app.sql</code> en el SQL Editor de Supabase y recarga.
      </section>
    );

  return (
    <div className="space-y-5">
      {aviso && (
        <p className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} className="text-amber-700">✕</button>
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-[0.85rem] text-red-800">{error}</p>}

      <p className="rounded-xl bg-gray-50 px-4 py-2.5 text-[0.82rem] text-gray-600">
        Aquí se programa la semana y se preparan los avisos. Los avisos salen solos (notificación de la app, o correo si no la tiene instalada) cuando <code>ent_avisos_envio</code> está en <code>true</code>; hasta entonces solo se preparan. «Copiar Markdown» te da la semana para el vault o para Trainer Studio.
      </p>

      {/* Clientes */}
      <div className="flex flex-wrap gap-2">
        {clientes.map((c) => (
          <button key={c.id} onClick={() => { setSel(c.id); setSemSel(null); }} className={`rounded-2xl px-4 py-2.5 text-left ring-1 transition ${sel === c.id ? "bg-[#0F2240] text-white ring-[#0F2240]" : "bg-white text-gray-800 ring-gray-200 hover:ring-gray-300"}`}>
            <span className="block text-[0.95rem] font-semibold">{c.nombre}</span>
            <span className={`block text-[0.75rem] ${sel === c.id ? "text-white/75" : "text-gray-500"}`}>
              {c.plan ? `${c.plan.nombre}` : "Sin plan"}
              {c.semana_actual ? ` · semana ${c.semana_actual.numero}` : ""}
              {c.constancia_4s.programadas ? ` · ${c.constancia_4s.hechas}/${c.constancia_4s.programadas} en 4 sem.` : ""}
              {c.semana_siguiente ? "" : c.plan ? " · ⚠︎ falta la semana que viene" : ""}
              {c.push?.length ? " · 📱 app" : ""}
            </span>
          </button>
        ))}
        <button
          onClick={async () => {
            const n = prompt("Nombre del cliente");
            if (n?.trim()) {
              const d = await post({ accion: "cliente_crear", nombre: n.trim() }, ["clientes"]);
              if (d?.cliente) setSel(d.cliente.id);
            }
          }}
          className="rounded-2xl px-4 py-2.5 text-[0.85rem] text-gray-600 ring-1 ring-dashed ring-gray-300 hover:text-gray-900"
        >
          + Cliente
        </button>
      </div>

      {ficha && <FichaCliente ficha={ficha} post={post} />}

      {/* Semanas */}
      {ficha?.plan && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            {ficha.semanas.map((s) => {
              const actual = s.lunes <= hoyISO() && sumar(s.lunes, 6) >= hoyISO();
              return (
                <button key={s.id} onClick={() => setSemSel(s.id)} className={`rounded-full px-3 py-1 text-[0.8rem] ring-1 ${semSel === s.id ? "bg-[#0F2240] text-white ring-[#0F2240]" : ESTADO_SEMANA[s.estado] ?? "ring-gray-200"} ${actual && semSel !== s.id ? "font-semibold" : ""}`} title={`${s.estado} · ${s.sesiones.length} sesiones · ${s.avisos.filter((a) => a.estado !== "cancelado").length} avisos`}>
                  S{s.numero} · {corta(s.lunes)}
                  {actual ? " ●" : ""}
                </button>
              );
            })}
            {ficha.semanas.length > 0 && (
              <button
                disabled={ocupado}
                onClick={async () => {
                  const ult = ficha.semanas.at(-1)!;
                  const d = await post({ accion: "semana_nueva", desde: ult.id }, ["ficha"]);
                  if (d?.semana) setSemSel(d.semana.id);
                }}
                className="rounded-full px-3 py-1 text-[0.8rem] text-[#0F2240] ring-1 ring-[#0F2240]/30 hover:bg-[#0F2240]/5 disabled:opacity-40"
              >
                + Semana {(ficha.semanas.at(-1)?.numero ?? 0) + 1} (copia de la S{ficha.semanas.at(-1)?.numero})
              </button>
            )}
            <button
              disabled={ocupado}
              onClick={async () => {
                const d = await post({ accion: "semana_nueva", plan_id: ficha.plan!.id }, ["ficha"]);
                if (d?.semana) setSemSel(d.semana.id);
              }}
              className="rounded-full px-3 py-1 text-[0.8rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-40"
            >
              + Semana vacía
            </button>
          </div>
        </section>
      )}

      {det && ficha && <Semana det={det} tipos={ficha.tipos} post={post} ocupado={ocupado} copiarMarkdown={copiarMarkdown} onBorrada={() => { setSemSel(null); if (sel) cargarFicha(sel, false); }} />}
    </div>
  );
}

type Post = (body: Record<string, unknown>, recargar?: ("semana" | "ficha" | "clientes")[]) => Promise<Record<string, unknown> | null>;

function FichaCliente({ ficha, post }: { ficha: { cliente: Cliente; plan: Plan | null; tipos: Tipo[] }; post: Post }) {
  const { cliente: c, plan } = ficha;
  const [abierta, setAbierta] = useState(false);
  const guardar = (campos: Record<string, unknown>) => post({ accion: "cliente_guardar", id: c.id, campos }, ["ficha"]);
  const h = hoyISO();
  const semanaN = plan ? Math.floor((new Date(`${h}T12:00:00Z`).getTime() - new Date(`${plan.inicio}T12:00:00Z`).getTime()) / (7 * 86400000)) + 1 : null;
  const fase = plan?.fases.find((f) => {
    const [a, b] = f.semanas.split("-").map(Number);
    return semanaN !== null && semanaN >= a && semanaN <= (b || a);
  });
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-[1.15rem] font-semibold text-gray-900">{c.nombre}</h2>
          <p className="text-[0.82rem] text-gray-500">
            {plan ? `${plan.nombre} · ${corta(plan.inicio)} → ${plan.fin ? corta(plan.fin) : "?"}${plan.frecuencia ? ` · ${plan.frecuencia}` : ""}` : "Sin plan todavía"}
            {fase ? ` · semana ${semanaN}: ${fase.fase}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[0.8rem]">
          {c.token ? (
            <button
              onClick={async () => {
                const url = `${location.origin}/app/${c.token}`;
                try { await navigator.clipboard.writeText(url); alert(`Enlace copiado:\n${url}\n\nMándaselo por WhatsApp. En iPhone: Compartir → Añadir a pantalla de inicio.`); } catch { prompt("Enlace personal de la app", url); }
              }}
              className="px-3 py-1.5 text-[#0F2240] ring-1 ring-[#0F2240]/30"
            >
              Copiar enlace de la app
            </button>
          ) : (
            <button onClick={() => post({ accion: "cliente_enlace", id: c.id }, ["ficha", "clientes"])} className="px-3 py-1.5 ring-1 ring-gray-300">Crear enlace de la app</button>
          )}
          {!plan && (
            <button onClick={() => { const n = prompt("Nombre del plan (T1, B1…)"); if (n) post({ accion: "plan_crear", cliente_id: c.id, nombre: n }, ["ficha", "clientes"]); }} className="px-3 py-1.5 ring-1 ring-gray-300">
              Crear plan
            </button>
          )}
          <button onClick={() => setAbierta(!abierta)} className="px-3 py-1.5 text-gray-700 ring-1 ring-gray-300">
            {abierta ? "Cerrar ficha" : "Ficha y reglas"}
          </button>
        </div>
      </div>

      {plan && plan.metas.length > 0 && (
        <div className="overflow-x-auto px-5 py-3">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3 font-medium">Meta</th>
                <th className="py-1 pr-3 font-medium">Al empezar</th>
                {plan.metas[0].hitos.map((_, i) => (
                  <th key={i} className="py-1 pr-3 font-medium">Hito {i + 1}</th>
                ))}
                <th className="py-1 font-medium">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {plan.metas.map((m) => (
                <tr key={m.meta} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 font-medium text-gray-800">{m.meta}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{m.ahora}</td>
                  {m.hitos.map((x, i) => (
                    <td key={i} className="py-1.5 pr-3 text-gray-600">{x}</td>
                  ))}
                  <td className="py-1.5 font-semibold text-gray-900">{m.minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierta && (
        <div className="grid gap-4 border-t border-gray-100 px-5 py-4 text-[0.85rem] md:grid-cols-2">
          <label className="block">
            <span className="text-[0.75rem] text-gray-500">Zonas de riesgo (salen en el formulario de recuperación)</span>
            <Campo valor={c.zonas_riesgo} onGuardar={(v) => guardar({ zonas_riesgo: v || null })} className="border-gray-200" />
          </label>
          <label className="block">
            <span className="text-[0.75rem] text-gray-500">Avisos por</span>
            <select value={c.aviso_canal} onChange={(e) => guardar({ aviso_canal: e.target.value })} className="mt-1 block w-full border border-gray-200 px-2 py-1.5">
              <option value="push">Notificación de la app</option>
              <option value="whatsapp">WhatsApp (número de la app, fase 7b)</option>
              <option value="email">Correo</option>
              <option value="ninguno">Ninguno</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-[0.75rem] text-gray-500">Reglas del cliente (una por línea; la IA las respetará siempre al proponer sesiones)</span>
            <Campo area filas={5} valor={(c.reglas ?? []).join("\n")} onGuardar={(v) => guardar({ reglas: v.split("\n").map((x) => x.trim()).filter(Boolean) })} className="border-gray-200" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[0.75rem] text-gray-500">Material</span>
            <Campo area valor={c.material} onGuardar={(v) => guardar({ material: v || null })} className="border-gray-200" />
          </label>
          <label className="block">
            <span className="text-[0.75rem] text-gray-500">Correo</span>
            <Campo valor={c.email} onGuardar={(v) => guardar({ email: v || null })} className="border-gray-200" />
          </label>
          <label className="block">
            <span className="text-[0.75rem] text-gray-500">Teléfono</span>
            <Campo valor={c.telefono} onGuardar={(v) => guardar({ telefono: v || null })} className="border-gray-200" />
          </label>
          {plan && plan.fases.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-[0.75rem] text-gray-500">Temporada</p>
              <ul className="mt-1 space-y-1">
                {plan.fases.map((f) => (
                  <li key={f.semanas}>
                    <b>S{f.semanas}</b> ({f.fechas}) · {f.fase} — <span className="text-gray-600">{f.que_pasa}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Semana({ det, tipos, post, ocupado, copiarMarkdown, onBorrada }: { det: DetalleSemana; tipos: Tipo[]; post: Post; ocupado: boolean; copiarMarkdown: () => void; onBorrada: () => void }) {
  const s = det.semana;
  const guardarSemana = (campos: Record<string, unknown>) => post({ accion: "semana_guardar", id: s.id, campos }, ["semana", "ficha"]);
  const avisosVivos = det.avisos.filter((a) => a.estado !== "cancelado");
  const porDia = useMemo(() => {
    const m = new Map<string, Aviso[]>();
    for (const a of det.avisos) {
      const { f } = madrid(a.programado_para);
      m.set(f, [...(m.get(f) ?? []), a]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [det.avisos]);
  const [nuevaTipo, setNuevaTipo] = useState("");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[14rem] flex-1">
            <p className="text-[0.75rem] uppercase tracking-wide text-gray-500">
              Semana {s.numero} · {corta(s.lunes)} – {corta(sumar(s.lunes, 6))}
              <span className={`ml-2 rounded-full px-2 py-0.5 normal-case tracking-normal ring-1 ${ESTADO_SEMANA[s.estado]}`}>{s.estado}</span>
            </p>
            <Campo valor={s.titulo} placeholder="Título de la semana (p. ej. Reentrada)" onGuardar={(v) => guardarSemana({ titulo: v || null })} className="mt-1 text-[1.05rem] font-semibold" />
            <div className="mt-1 flex flex-wrap gap-3 text-[0.82rem] text-gray-600">
              <label className="flex items-center gap-1">Fase <Campo valor={s.fase} onGuardar={(v) => guardarSemana({ fase: v || null })} className="w-48" /></label>
              <label className="flex items-center gap-1">RIR <Campo valor={s.rir_objetivo} onGuardar={(v) => guardarSemana({ rir_objetivo: v || null })} className="w-16" /></label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[0.82rem]">
            <button disabled={ocupado} onClick={() => post({ accion: "avisos_generar", semana_id: s.id }, ["semana", "ficha"])} className="px-3 py-1.5 text-gray-800 ring-1 ring-gray-300 disabled:opacity-40">
              {avisosVivos.length ? "Rehacer avisos" : "Generar avisos"}
            </button>
            {s.estado === "borrador" ? (
              <button disabled={ocupado || !det.sesiones.length} onClick={() => post({ accion: "semana_programar", id: s.id }, ["semana", "ficha", "clientes"])} className="bg-[#0F2240] px-3 py-1.5 font-medium text-white disabled:opacity-40">
                Dar por programada
              </button>
            ) : (
              <button disabled={ocupado} onClick={() => post({ accion: "semana_reabrir", id: s.id }, ["semana", "ficha"])} className="px-3 py-1.5 text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
                Reabrir
              </button>
            )}
            <button onClick={copiarMarkdown} className="px-3 py-1.5 text-gray-700 ring-1 ring-gray-300">Copiar Markdown</button>
            <button
              disabled={ocupado}
              onClick={async () => {
                if (confirm(`¿Borrar la semana ${s.numero} con sus sesiones y avisos?`)) {
                  const d = await post({ accion: "semana_borrar", id: s.id }, []);
                  if (d) onBorrada();
                }
              }}
              className="px-3 py-1.5 text-red-700 ring-1 ring-red-200 disabled:opacity-40"
            >
              Borrar
            </button>
          </div>
        </div>
        <Campo area filas={2} valor={s.notas} placeholder="Notas de la semana para el cliente (intro, por qué esta semana es así…)" onGuardar={(v) => guardarSemana({ notas: v || null })} className="mt-2 text-gray-700" />

        {/* Mapa de la semana */}
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.75rem]">
          {Array.from({ length: 7 }, (_, i) => sumar(s.lunes, i)).map((d) => {
            const ses = det.sesiones.filter((x) => x.fecha === d);
            return (
              <div key={d} className={`rounded-lg px-1 py-2 ${ses.length ? "bg-[#0F2240]/5 font-medium text-[#0F2240]" : "bg-gray-50 text-gray-400"} ${d === hoyISO() ? "ring-1 ring-[#E8A33D]" : ""}`}>
                <div>{DIA_C[dow(d)]} {Number(d.slice(8))}</div>
                <div className="mt-0.5 truncate">{ses.map((x) => x.clave ?? x.nombre).join(" + ") || "—"}</div>
              </div>
            );
          })}
        </div>
      </section>

      {det.sesiones.map((ses) => (
        <SesionCard key={ses.id} ses={ses} det={det} post={post} />
      ))}

      <div className="flex flex-wrap items-center gap-2 text-[0.85rem]">
        <select value={nuevaTipo} onChange={(e) => setNuevaTipo(e.target.value)} className="border border-gray-300 px-2 py-1.5">
          <option value="">Sesión libre</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}{t.dia_habitual ? ` (${DIA[t.dia_habitual]})` : ""}</option>
          ))}
        </select>
        <button disabled={ocupado} onClick={() => post({ accion: "sesion_crear", semana_id: s.id, sesion_tipo_id: nuevaTipo || null }, ["semana", "ficha"])} className="px-3 py-1.5 ring-1 ring-gray-300 disabled:opacity-40">
          + Añadir sesión
        </button>
        {nuevaTipo && <span className="text-[0.78rem] text-gray-500">Copia los ejercicios de la última sesión de ese tipo.</span>}
      </div>

      {/* Avisos */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[1rem] font-semibold">Avisos y formularios</h3>
          <span className="text-[0.78rem] text-gray-500">{avisosVivos.length ? `${avisosVivos.length} en cola · aún no se envían (fase 7b)` : "Sin avisos: la semana no está programada hasta tenerlos"}</span>
        </div>
        {porDia.length === 0 ? (
          <p className="mt-2 text-[0.85rem] text-gray-500">Pulsa «Generar avisos»: salen los del protocolo (día antes 20:00, día 9:00, 21:00 si no registra, recuperación al día siguiente 14:00 y resumen del domingo 19:00).</p>
        ) : (
          <div className="mt-3 space-y-3">
            {porDia.map(([f, avs]) => (
              <div key={f}>
                <p className="text-[0.78rem] font-medium uppercase tracking-wide text-gray-500">{DIA[dow(f)]} {corta(f)}</p>
                <ul className="mt-1 space-y-1.5">
                  {avs.map((a) => (
                    <li key={a.id} className={`grid grid-cols-[3.2rem_1fr] gap-2 ${a.estado === "cancelado" ? "opacity-50" : ""}`}>
                      <span className="pt-1 text-[0.82rem] tabular-nums text-gray-600">{a.tipo === "formulario_post" ? "al acabar" : madrid(a.programado_para).h}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem]">
                          <span className="font-medium text-gray-800">{TIPO_AVISO[a.tipo] ?? a.tipo}</span>
                          <span className={`rounded-full px-1.5 py-0.5 ${ESTADO_AVISO[a.estado] ?? ""}`}>{a.estado}</span>
                          <span className="text-gray-400">{a.canal}</span>
                          {a.editado && <span className="text-gray-400">· editado</span>}
                        </div>
                        {!a.tipo.startsWith("formulario") && (
                          <Campo area filas={a.texto && a.texto.length > 90 ? 3 : 1} valor={a.texto} placeholder={a.tipo === "resumen_domingo" ? "Se escribe el domingo: «Semana N: X de 3. [algo concreto que fue bien]. Mañana lunes, la A…»" : "Texto del aviso"} onGuardar={(v) => post({ accion: "aviso_guardar", id: a.id, campos: { texto: v || null, ...(a.estado === "borrador" && v ? { estado: "programado" } : {}) } })} className="text-gray-700" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SesionCard({ ses, det, post }: { ses: Sesion; det: DetalleSemana; post: Post }) {
  const guardar = (campos: Record<string, unknown>) => post({ accion: "sesion_guardar", id: ses.id, campos });
  const guardarEj = (id: string, campos: Record<string, unknown>) => post({ accion: "ejercicio_guardar", id, campos });
  const registradas = (id: string) => det.series.filter((x) => x.ejercicio_id === id);
  const forms = det.formularios.filter((f) => f.sesion_id === ses.id);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-100 px-5 py-3">
        <div className="min-w-[12rem] flex-1">
          <Campo valor={ses.nombre} onGuardar={(v) => v && guardar({ nombre: v })} className="text-[1rem] font-semibold" />
          <Campo valor={ses.foco} placeholder="Foco del día en una frase (va en el recordatorio de las 9:00)" onGuardar={(v) => guardar({ foco: v || null })} className="text-gray-600" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.82rem] text-gray-600">
          <span className="capitalize">{DIA[dow(ses.fecha)]}</span>
          <input type="date" value={ses.fecha} onChange={(e) => e.target.value && guardar({ fecha: e.target.value })} className="border border-gray-200 px-1.5 py-1" />
          <label className="flex items-center gap-1">~<Campo tipo="number" valor={ses.duracion_min} onGuardar={(v) => guardar({ duracion_min: v ? Number(v) : null })} className="w-14" />min</label>
          <select value={ses.estado} onChange={(e) => guardar({ estado: e.target.value })} className="border border-gray-200 px-1.5 py-1">
            {["programada", "hecha", "incompleta", "saltada", "movida"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button onClick={() => confirm(`¿Quitar la sesión ${ses.nombre}?`) && post({ accion: "sesion_borrar", id: ses.id }, ["semana", "ficha"])} className="text-red-600">✕</button>
        </div>
      </div>
      <div className="px-5 py-2 text-[0.82rem] text-gray-600">
        <Campo valor={ses.calentamiento} placeholder="Calentamiento" onGuardar={(v) => guardar({ calentamiento: v || null })} />
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[56rem] text-[0.84rem]">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase tracking-wide text-gray-400">
              <th className="w-6"></th>
              <th className="px-1.5 font-medium">Ejercicio</th>
              <th className="w-14 px-1.5 font-medium">Series</th>
              <th className="w-28 px-1.5 font-medium">Reps</th>
              <th className="w-36 px-1.5 font-medium">Carga</th>
              <th className="w-36 px-1.5 font-medium">Tempo</th>
              <th className="w-16 px-1.5 font-medium">RIR</th>
              <th className="w-20 px-1.5 font-medium">Descanso</th>
              <th className="px-1.5 font-medium">Notas</th>
              <th className="w-10 px-1.5 font-medium" title="Hay que grabar">🎥</th>
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody>
            {ses.ejercicios.map((e, i) => (
              <FilaEjercicio key={e.id} e={e} i={i} total={ses.ejercicios.length} guardar={(c) => guardarEj(e.id, c)} post={post} registradas={registradas(e.id)} />
            ))}
          </tbody>
        </table>
        <button
          onClick={() => {
            const n = prompt("Nombre del ejercicio");
            if (n?.trim()) post({ accion: "ejercicio_crear", sesion_id: ses.id, nombre: n.trim() });
          }}
          className="mt-2 px-2 py-1 text-[0.82rem] text-[#0F2240] hover:underline"
        >
          + Ejercicio
        </button>
      </div>
      {(ses.rpe !== null || forms.length > 0) && (
        <div className="border-t border-gray-100 px-5 py-2 text-[0.8rem] text-gray-600">
          {ses.rpe !== null && <span>RPE {ses.rpe} · {ses.minutos ?? "?"} min · carga {ses.rpe && ses.minutos ? Math.round(ses.rpe * ses.minutos) : "?"}</span>}
          {forms.map((f, k) => (
            <details key={k} className="mt-1">
              <summary className="cursor-pointer">{f.tipo === "post" ? "Post-sesión" : "Recuperación"}{f.alerta ? ` ⚠︎ ${f.alerta}` : " ✓"}</summary>
              <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                {Object.entries(f.respuestas ?? {}).filter(([, v]) => v !== null && v !== "" && v !== undefined).map(([k2, v]) => (
                  <li key={k2}><span className="text-gray-400">{k2.replace(/_/g, " ")}:</span> {typeof v === "boolean" ? (v ? "sí" : "no") : String(v)}</li>
                ))}
              </ul>
              {f.fotos_url && f.fotos_url.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.fotos_url.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-24 rounded-lg object-cover" /></a>
                  ))}
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function FilaEjercicio({ e, i, total, guardar, post, registradas }: { e: Ejercicio; i: number; total: number; guardar: (c: Record<string, unknown>) => void; post: Post; registradas: DetalleSemana["series"] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <tr className="border-t border-gray-100 align-top">
        <td className="pt-1.5 text-center text-[0.75rem] text-gray-400">{i + 1}</td>
        <td><Campo valor={e.nombre} onGuardar={(v) => v && guardar({ nombre: v })} className="font-medium" /></td>
        <td><Campo tipo="number" valor={e.series} onGuardar={(v) => guardar({ series: v ? Number(v) : null })} /></td>
        <td><Campo valor={e.reps} onGuardar={(v) => guardar({ reps: v || null })} /></td>
        <td><Campo valor={e.carga} onGuardar={(v) => guardar({ carga: v || null })} /></td>
        <td><Campo valor={e.tempo} onGuardar={(v) => guardar({ tempo: v || null })} /></td>
        <td><Campo valor={e.rir} onGuardar={(v) => guardar({ rir: v || null })} /></td>
        <td><Campo valor={e.descanso} onGuardar={(v) => guardar({ descanso: v || null })} /></td>
        <td><Campo valor={e.notas} onGuardar={(v) => guardar({ notas: v || null })} className="text-gray-600" /></td>
        <td className="pt-1.5 text-center">
          <input type="checkbox" checked={e.video} onChange={(x) => guardar({ video: x.target.checked, campos: x.target.checked ? [...new Set([...e.campos, "video"])] : e.campos.filter((c) => c !== "video") })} />
        </td>
        <td className="whitespace-nowrap pt-1 text-[0.75rem] text-gray-400">
          <button disabled={i === 0} onClick={() => post({ accion: "ejercicio_mover", id: e.id, dir: "arriba" })} className="px-0.5 disabled:opacity-20">↑</button>
          <button disabled={i === total - 1} onClick={() => post({ accion: "ejercicio_mover", id: e.id, dir: "abajo" })} className="px-0.5 disabled:opacity-20">↓</button>
          <button onClick={() => setAbierto(!abierto)} className="px-0.5" title="Qué registra el cliente">⋯</button>
          <button onClick={() => confirm(`¿Quitar ${e.nombre}?`) && post({ accion: "ejercicio_borrar", id: e.id })} className="px-0.5 text-red-500">✕</button>
        </td>
      </tr>
      {(abierto || registradas.length > 0) && (
        <tr>
          <td></td>
          <td colSpan={10} className="pb-2 text-[0.78rem] text-gray-600">
            {abierto && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500">El cliente registra:</span>
                {CAMPOS.map((c) => {
                  const on = e.campos.includes(c);
                  return (
                    <button key={c} onClick={() => guardar({ campos: on ? e.campos.filter((x) => x !== c) : [...e.campos, c], ...(c === "video" ? { video: !on } : {}) })} className={`rounded-full px-2 py-0.5 ring-1 ${on ? "bg-[#0F2240] text-white ring-[#0F2240]" : "ring-gray-300"}`}>
                      {c}
                    </button>
                  );
                })}
                <span className="ml-2 text-gray-500">Superserie:</span>
                <Campo valor={e.superserie} onGuardar={(v) => guardar({ superserie: v || null })} className="w-40" placeholder="etiqueta común" />
              </div>
            )}
            {registradas.length > 0 && (
              <p className="mt-1">
                Registrado:{" "}
                {registradas.map((r) => `${r.lado ? `${r.lado} ` : ""}${r.reps ?? "?"}${r.peso ? `×${r.peso}kg` : ""}${r.rir !== null ? ` @${r.rir}` : ""}`).join(" · ")}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
