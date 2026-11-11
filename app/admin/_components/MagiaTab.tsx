"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import VistaCorreo from "./VistaCorreo";
import EditorCrm, { cambiosDeForm, formCrmInicial, type FormCrm } from "./EditorCrm";
import UltimosMensajes, { type Ultimos } from "./UltimosMensajes";
import AplazarTarea from "./AplazarTarea";
import AprendizajesMagia from "./magia/Aprendizajes";
import CatalogoShows from "./CatalogoShows";
import CajaFaltanDatos, { type FaltaDato } from "./CajaFaltanDatos";

// Pestaña Magia · fase 6a del sistema automático: el CRM de prospectos
// (antiguos clientes, recuperar, intermediarios, referidos) con su bandeja.
// Mismo patrón que Charlas: el motor crea las tareas por fecha, la IA redacta
// y Alain aprueba. WhatsApp sale desde su móvil con un enlace preparado.

interface Ficha {
  id: string;
  nombre: string;
  segmento: string | null;
  tipo_entidad: string | null;
  territorio: string | null;
  localidad: string | null;
  prioridad: string | null;
  estado: string;
  canal: string | null;
  idioma: string | null;
  responsable: string | null;
  responsable_email: string | null;
  responsable_tel: string | null;
  email: string | null;
  telefono: string | null;
  ultimo_evento: string | null;
  fecha_ultimo_evento: string | null;
  mes_temporada: number | null;
  mails_enviados: number;
  fecha_ultimo_contacto: string | null;
  proxima_accion: string | null;
  bloqueado_por: string | null;
  fecha_proxima_accion: string | null;
  nivel_autonomia: "A" | "B" | "C";
}
interface Tarea {
  id: string;
  tipo: string;
  canal: "mail" | "whatsapp" | "llamada" | "ninguno";
  nivel: "A" | "B" | "C";
  urgencia: number;
  urgencia_motivo: string | null;
  estado: string;
  idioma: string | null;
  borrador_asunto: string | null;
  borrador_texto: string | null;
  destinatario: string | null;
  cambios_crm: Record<string, unknown>;
  nota_para_alain: string | null;
  contexto: { resumen?: string; clasificacion?: string; etiqueta_principal?: string | null; alternativa?: { etiqueta: string; asunto: string | null; cuerpo: string } | null; programada?: boolean; faltan_datos?: FaltaDato[] } | null;
  creado_en: string;
  ficha: { id: string; nombre: string; segmento: string | null; tipo_entidad: string | null; estado: string; canal: string | null; responsable: string | null; localidad: string | null; ultimo_evento: string | null; proxima_accion?: string | null; fecha_proxima_accion?: string | null } | null;
  entrante: { id: string; de: string | null; asunto: string | null; fecha: string | null; texto: string | null; clasificacion: string | null } | null;
  ultimos?: Ultimos;
}
interface Detalle {
  ficha: Ficha & { notas?: string | null; web: string | null; responsable_cargo: string | null; cuerpo_antes: string | null; origen: string | null };
  registro: { id: string; fecha: string | null; canal: string | null; texto: string; origen: string }[];
  tareas: { id: string; tipo: string; canal: string; estado: string; creado_en: string; texto_final: string | null }[];
  mensajes: { id: string; direccion: string; de: string | null; asunto: string | null; fecha: string | null; texto: string | null; resumen: string | null }[];
}

const ESTADOS = ["0 Por contactar", "1 Intentando", "2 Contacto conseguido", "3 Primer mensaje enviado", "4 Ha respondido", "5 Propuesta enviada", "6 En conversación", "7 Ganado", "8 Perdido", "9 Aparcado"];
const ETIQUETA: Record<string, string> = {
  reactivacion: "Reactivación", recordatorio_1: "Recordatorio 1", recordatorio_2: "Recordatorio 2 (último)", recuperacion: "Mensaje de recuperación", check_in: "Check-in", primer_contacto: "Primer contacto", agencia_1a: "Agencia · primer mail (formato)", agencia_1b: "Agencia · primer mail (a quién escribir)", localizar_contacto: "🔎 Localizar email de la agencia", propuesta: "Propuesta", seguimiento: "Seguimiento", cierre: "Cierre suave", aparcar: "Aparcar", revisar_bloqueo: "Revisar bloqueo", revisar_ganado: "Cliente ganado · acción programada", revisar_correo: "✉️ Correo suyo sin respuesta", llamada_alain: "📞 Llamada / conseguir contacto", respuesta: "Respuesta", actualizar_crm: "Actualizar ficha",
  interesado: "🔥 Quiere repetir", pide_propuesta: "Pide propuesta", da_fecha: "🔥 Da fecha", este_ano_no: "Este año no", no_interesa: "No le interesa", recomienda: "Pasa un contacto", pregunta: "Pregunta algo", acuse: "Acuse", fuera_de_oficina: "Fuera de oficina", otro: "Otro",
};
const URG = { 3: ["Ahora", "border-l-[#DC2626]", "bg-red-100 text-red-800"], 2: ["Hoy", "border-l-[#E8A33D]", "bg-amber-100 text-amber-900"], 1: ["Cuando puedas", "border-l-emerald-500", "bg-emerald-50 text-emerald-800"] } as const;
const fase = (e: string) => Number(/^(\d)/.exec(e)?.[1] ?? -1);
const colorEstado = (e: string) => (fase(e) === 7 ? "bg-emerald-100 text-emerald-800" : fase(e) === 8 ? "bg-gray-200 text-gray-600" : fase(e) === 9 ? "bg-amber-50 text-amber-800" : fase(e) === 6 ? "bg-[#FDECD3] text-[#8A4B00]" : fase(e) >= 3 ? "bg-sky-50 text-sky-800" : "bg-gray-100 text-gray-700");
const fmtFecha = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function MagiaTab() {
  const [seccion, setSeccion] = useState<"bandeja" | "crm" | "catalogo" | "aprendizajes">("bandeja");
  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": pw() }), [pw]);

  // Bandeja
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [errores, setErrores] = useState<{ id: string; asunto: string | null; de: string | null; error: string | null }[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [coste, setCoste] = useState<{ hoy_usd: number; ult_30_dias_usd: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargarBandeja = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/crm/bandeja?carril=magia", { headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      if (d.error_tareas) setAviso(`La bandeja de magia aún no está lista: ${d.error_tareas}. ¿Se ha ejecutado crm-magia.sql en Supabase?`);
      setTareas(d.tareas ?? []);
      setErrores(d.errores ?? []);
      setConfig(d.config ?? {});
      setCoste(d.coste ?? null);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [headers]);

  // CRM
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [porEstado, setPorEstado] = useState<Record<string, number>>({});
  const [porSegmento, setPorSegmento] = useState<Record<string, number>>({});
  const [filtroSeg, setFiltroSeg] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [vista, setVista] = useState<"hoy" | "semana" | "todos">("hoy");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  const cargarFichas = useCallback(async () => {
    const r = await fetch("/api/admin/crm/fichas?carril=magia", { headers: headers() });
    const d = await r.json();
    if (r.ok) {
      setFichas(d.fichas ?? []);
      setPorEstado(d.por_estado ?? {});
      setPorSegmento(d.por_segmento ?? {});
    }
  }, [headers]);
  const abrir = useCallback(
    async (id: string) => {
      setSeleccion(id);
      const r = await fetch(`/api/admin/crm/fichas?id=${id}`, { headers: headers() });
      if (r.ok) setDetalle(await r.json());
    },
    [headers]
  );
  async function guardar(cambios: Record<string, unknown>) {
    if (!detalle) return;
    const r = await fetch("/api/admin/crm/fichas", { method: "PATCH", headers: headers(), body: JSON.stringify({ id: detalle.ficha.id, ...cambios }) });
    if (r.ok) await Promise.all([cargarFichas(), abrir(detalle.ficha.id)]);
  }

  useEffect(() => {
    cargarBandeja();
    cargarFichas();
  }, [cargarBandeja, cargarFichas]);

  async function accion(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/crm/bandeja", { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || "Error"), { duplicado: !!d.duplicado });
    return d;
  }

  const hoy = hoyISO();
  const visibles = useMemo(() => {
    let l = fichas;
    const activa = (f: Ficha) => fase(f.estado) !== 8;
    if (vista === "hoy") l = l.filter((f) => activa(f) && f.fecha_proxima_accion && f.fecha_proxima_accion <= hoy);
    if (vista === "semana") l = l.filter((f) => activa(f) && f.fecha_proxima_accion && f.fecha_proxima_accion <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    if (filtroSeg) l = l.filter((f) => (f.segmento ?? "—") === filtroSeg);
    if (filtroEstado) l = l.filter((f) => f.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      l = l.filter((f) => [f.nombre, f.localidad, f.responsable, f.responsable_email, f.email, f.ultimo_evento].some((v) => v?.toLowerCase().includes(q)));
    }
    return [...l].sort((a, b) => (a.fecha_proxima_accion ?? "9999").localeCompare(b.fecha_proxima_accion ?? "9999") || a.nombre.localeCompare(b.nombre));
  }, [fichas, vista, filtroSeg, filtroEstado, busqueda, hoy]);

  const calientes = tareas.filter((t) => t.nivel === "C" || t.urgencia === 3);
  const resto = tareas.filter((t) => !calientes.includes(t));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200">
        {(["bandeja", "crm", "catalogo", "aprendizajes"] as const).map((s) => (
          <button key={s} onClick={() => setSeccion(s)} className={`-mb-px border-b-2 px-4 py-2 text-[0.9rem] ${seccion === s ? "border-[#0F2240] font-medium text-[#0F2240]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {s === "bandeja" ? `Bandeja${tareas.length ? ` · ${tareas.length}` : ""}` : s === "crm" ? "CRM de magia" : s === "catalogo" ? "Catálogo de shows" : "Aprendizajes"}
          </button>
        ))}
        <span className="ml-auto text-[0.78rem] text-gray-500">
          {coste ? `IA hoy ${coste.hoy_usd.toFixed(2)} $ · 30 días ${coste.ult_30_dias_usd.toFixed(2)} $` : ""}
          {config.magia_activo === false && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">motor en pausa</span>}
        </span>
      </div>
      {aviso && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">{aviso}</p>}

      {seccion === "aprendizajes" && <AprendizajesMagia />}
      {seccion === "catalogo" && <CatalogoShows />}

      {seccion === "bandeja" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-gray-600">
            <button onClick={cargarBandeja} className="rounded-full border border-gray-300 px-3 py-1">Actualizar</button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.magia_activo !== false} onChange={async (e) => { await accion({ accion: "config", magia_activo: e.target.checked }); cargarBandeja(); }} />
              El motor crea tareas (reactivaciones, recordatorios, check-ins) cuando llega su fecha
            </label>
            <span className="text-gray-400">Nada sale solo: cada tarea pasa por aquí.</span>
          </div>
          {cargando && <p className="text-[0.85rem] text-gray-500">Cargando…</p>}
          {!cargando && tareas.length === 0 && <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[0.9rem] text-gray-500">Bandeja de magia vacía. El motor mira cada ficha cuando llega su fecha de próxima acción.</p>}
          {calientes.length > 0 && (
            <section>
              <h2 className="mb-2 text-[0.95rem] font-semibold">Te toca a ti · {calientes.length}</h2>
              <div className="space-y-4">{calientes.map((t) => <TarjetaMagia key={t.id + (t.borrador_texto ?? "")} t={t} accion={accion} alTerminar={() => { cargarBandeja(); cargarFichas(); }} />)}</div>
            </section>
          )}
          {resto.length > 0 && (
            <section>
              <h2 className="mb-2 text-[0.95rem] font-semibold">Mensajes para enviar · {resto.length}</h2>
              <div className="space-y-4">{resto.map((t) => <TarjetaMagia key={t.id + (t.borrador_texto ?? "")} t={t} accion={accion} alTerminar={() => { cargarBandeja(); cargarFichas(); }} />)}</div>
            </section>
          )}
          {errores.length > 0 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[0.82rem] text-red-900">
              <p className="font-medium">Correos de magia que la IA no ha podido procesar</p>
              {errores.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 border-t border-red-200 py-1.5">
                  <span><b>{e.asunto}</b>{e.de ? ` · ${e.de}` : ""} <span className="block truncate text-[0.75rem] text-red-800/70">{e.error}</span></span>
                  <button onClick={async () => { await accion({ accion: "reintentar_mensaje", mensaje_id: e.id }).catch(() => null); cargarBandeja(); }} className="shrink-0 rounded-full border border-red-300 bg-white px-3 py-1 text-[0.78rem]">Reintentar</button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {seccion === "crm" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-[1rem] font-semibold">Pipeline · {fichas.length} fichas</h2>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.filter((e) => porEstado[e]).map((e) => (
                <button key={e} onClick={() => { setFiltroEstado(filtroEstado === e ? "" : e); setVista("todos"); }} className={`rounded-full px-3 py-1 text-[0.8rem] ring-1 ring-transparent ${colorEstado(e)} ${filtroEstado === e ? "ring-gray-900" : ""}`}>
                  {e} <span className="font-semibold">{porEstado[e]}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(porSegmento).sort().map(([s, n]) => (
                <button key={s} onClick={() => setFiltroSeg(filtroSeg === s ? "" : s)} className={`rounded-full px-3 py-1 text-[0.78rem] ring-1 ${filtroSeg === s ? "bg-[#0F2240] text-white ring-[#0F2240]" : "bg-white text-gray-700 ring-gray-300"}`}>
                  {s} · {n}
                </button>
              ))}
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(["hoy", "semana", "todos"] as const).map((v) => (
                  <button key={v} onClick={() => setVista(v)} className={`rounded-full px-3 py-1 text-[0.8rem] ring-1 ${vista === v ? "bg-[#0F2240] text-white ring-[#0F2240]" : "bg-white text-gray-700 ring-gray-300"}`}>{v === "hoy" ? "Hoy" : v === "semana" ? "Esta semana" : "Todos"}</button>
                ))}
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="w-full border border-gray-300 bg-white px-3 py-1.5 text-[0.85rem] sm:ml-auto sm:w-auto" />
              </div>
              <p className="mb-2 text-[0.78rem] text-gray-500">{visibles.length} fichas</p>
              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                {visibles.length === 0 && <li className="p-5 text-[0.9rem] text-gray-500">Nada por aquí.</li>}
                {visibles.slice(0, 300).map((f) => (
                  <li key={f.id}>
                    <button onClick={() => abrir(f.id)} className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-gray-50 ${seleccion === f.id ? "bg-gray-50" : ""}`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[0.92rem]">{f.nombre}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.72rem] ${colorEstado(f.estado)}`}>{f.estado}</span>
                      </span>
                      <span className="text-[0.78rem] text-gray-500">{[f.segmento, f.tipo_entidad, f.localidad, f.canal].filter(Boolean).join(" · ")}{f.fecha_proxima_accion ? ` · ${fmtFecha(f.fecha_proxima_accion)}: ${f.proxima_accion ?? ""}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>{seleccion && detalle && <FichaMagia detalle={detalle} onGuardar={guardar} />}</section>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaMagia({ t, accion, alTerminar }: { t: Tarea; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void }) {
  const alt = t.contexto?.alternativa ?? null;
  const [opcion, setOpcion] = useState<"a" | "b">("a");
  const [asunto, setAsunto] = useState(t.borrador_asunto ?? "");
  const [texto, setTexto] = useState(t.borrador_texto ?? "");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [err, setErr] = useState("");
  const [crm, setCrm] = useState<FormCrm>(() => formCrmInicial(t.cambios_crm));
  const [para, setPara] = useState(t.destinatario ?? "");
  useEffect(() => {
    setTexto((opcion === "b" ? alt?.cuerpo : t.borrador_texto) ?? "");
    setAsunto((opcion === "b" ? alt?.asunto : t.borrador_asunto) ?? "");
  }, [opcion, alt, t.borrador_texto, t.borrador_asunto]);
  const base = ((opcion === "b" ? alt?.cuerpo : t.borrador_texto) ?? "").trim();
  const editado = texto.trim() !== base;
  const u = URG[(t.urgencia ?? 1) as 1 | 2 | 3];
  const cambios = Object.entries(t.cambios_crm ?? {}).filter(([k, v]) => v && k !== "contacto_nuevo");
  const conMensaje = t.canal === "mail" || t.canal === "whatsapp";
  const wa = t.canal === "whatsapp" && t.destinatario ? `https://wa.me/${t.destinatario}?text=${encodeURIComponent(texto)}` : null;

  async function hacer(nombre: string, body: Record<string, unknown>) {
    setOcupado(nombre);
    setErr("");
    try {
      await accion(body);
      alTerminar();
    } catch (e) {
      const er = e as Error & { duplicado?: boolean };
      // Ya salió un correo a esta ficha hace poco: solo se manda otro si Alain lo confirma.
      if (er.duplicado && body.accion === "enviar" && confirm(`${er.message}\n\n¿Quieres enviar este otro igualmente?`)) {
        await hacer(nombre, { ...body, confirmar_duplicado: true });
        return;
      }
      setErr(er.message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <article className={`rounded-2xl border border-gray-200 border-l-4 bg-white p-5 ${u[1]}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[1rem] font-semibold">{t.ficha?.nombre ?? "—"}</h3>
          <p className="text-[0.8rem] text-gray-500">{[t.ficha?.segmento, t.ficha?.tipo_entidad, t.ficha?.localidad, t.ficha?.ultimo_evento].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span className={`rounded-full px-2 py-0.5 ${u[2]}`} title={t.urgencia_motivo ?? ""}>{u[0]}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{ETIQUETA[t.contexto?.clasificacion ?? t.tipo] ?? t.tipo}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{t.canal === "whatsapp" ? "WhatsApp" : t.canal === "mail" ? "Correo" : "Sin mensaje"}</span>
          {t.ficha && <span className={`rounded-full px-2 py-0.5 ${colorEstado(t.ficha.estado)}`}>{t.ficha.estado}</span>}
        </div>
      </header>
      {t.contexto?.resumen && <p className="mt-2 text-[0.88rem] text-gray-800">{t.contexto.resumen}</p>}
      {t.entrante?.texto && (
        <details className="mt-2 text-[0.82rem] text-gray-700">
          <summary className="cursor-pointer text-gray-500">Mensaje recibido · {t.entrante.de} · {fmtFecha(t.entrante.fecha)}</summary>
          <pre className="mt-1 whitespace-pre-wrap font-sans">{t.entrante.texto}</pre>
        </details>
      )}
      <UltimosMensajes ultimos={t.ultimos} omitirEntrante={!!t.entrante?.texto} />
      {t.nota_para_alain && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[0.82rem] text-amber-900">{t.nota_para_alain}</p>}
      <CajaFaltanDatos faltan={t.contexto?.faltan_datos} ocupado={ocupado === "completar"} onGuardar={(clave, txt) => hacer("completar", { accion: "completar", id: t.id, clave, texto: txt })} />

      {conMensaje && (
        <div className="mt-3 space-y-2">
          {alt && (
            <div className="flex gap-2 text-[0.78rem]">
              {(["a", "b"] as const).map((o) => (
                <button key={o} onClick={() => setOpcion(o)} className={`rounded-full px-3 py-1 ring-1 ${opcion === o ? "bg-[#0F2240] text-white ring-[#0F2240]" : "bg-white ring-gray-300"}`}>{o === "a" ? `A · ${t.contexto?.etiqueta_principal ?? "Recomendada"}` : `B · ${alt.etiqueta}`}</button>
              ))}
            </div>
          )}
          {t.canal === "mail" ? (
            <label className="block text-[0.75rem] text-gray-500">
              Para
              <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="pega aquí el email" className="mt-0.5 w-full border border-gray-300 px-2 py-1 text-[0.85rem] text-gray-900" />
            </label>
          ) : (
            <p className="text-[0.78rem] text-gray-500">Para: {t.destinatario ?? "—"}</p>
          )}
          {t.canal === "mail" && <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="w-full border border-gray-300 px-2 py-1.5 text-[0.88rem]" placeholder="Asunto" />}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(14, Math.max(4, texto.split("\n").length + 1))} className="w-full border border-gray-300 px-2 py-1.5 text-[0.9rem] leading-relaxed" />
          {t.canal === "mail" && <VistaCorreo texto={texto} />}
          {editado && (
            <label className="block text-[0.75rem] text-gray-500">
              ¿Por qué lo cambias? (una frase; así aprende)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-0.5 w-full border border-gray-300 px-2 py-1 text-[0.85rem]" />
            </label>
          )}
        </div>
      )}
      <EditorCrm f={crm} setF={setCrm} estados={ESTADOS} estadoActual={t.ficha?.estado} responsableActual={t.ficha?.responsable} abierto={cambios.length > 0} etiquetaFicha="prospecto" />
      <div className="mt-4 flex flex-wrap gap-2">
        {t.canal === "mail" && (
          <button onClick={() => hacer("enviar", { accion: "enviar", id: t.id, asunto, texto, destinatario: para, motivo, opcion: alt ? opcion : null, cambios: cambiosDeForm(crm) })} disabled={!!ocupado || !para.includes("@") || (editado && !motivo.trim())} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">
            {ocupado === "enviar" ? "Enviando…" : "Enviar correo"}
          </button>
        )}
        {t.canal === "whatsapp" && (
          <>
            <a href={wa ?? "#"} target="_blank" rel="noreferrer" className={`bg-[#25D366] px-4 py-2 text-[0.85rem] font-medium text-white ${wa ? "" : "pointer-events-none opacity-40"}`}>Abrir en WhatsApp</a>
            <button onClick={() => hacer("wa", { accion: "whatsapp_enviado", id: t.id, texto, motivo, opcion: alt ? opcion : null, cambios: cambiosDeForm(crm) })} disabled={!!ocupado || (editado && !motivo.trim())} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">
              {ocupado === "wa" ? "Guardando…" : "Ya lo he enviado"}
            </button>
          </>
        )}
        {!conMensaje && (
          <>
            <button onClick={() => hacer("aplicar", { accion: "aplicar", id: t.id, cambios: cambiosDeForm(crm) })} disabled={!!ocupado} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">{ocupado === "aplicar" ? "Aplicando…" : "Aplicar cambios"}</button>
            <button onClick={() => { const i = prompt("¿Qué quieres decirle? (opcional)") ?? ""; hacer("rehacer", { accion: "redactar", id: t.id, instruccion: i }); }} disabled={!!ocupado} className="px-4 py-2 text-[0.85rem] font-medium text-[#0F2240] ring-1 ring-[#0F2240]/40 disabled:opacity-40">
              {ocupado === "rehacer" ? "Redactando…" : "✍️ Redactar mensaje"}
            </button>
          </>
        )}
        {conMensaje && (
          <button onClick={() => hacer("aplicar", { accion: "aplicar", id: t.id, cambios: cambiosDeForm(crm) })} disabled={!!ocupado} title="Apunta lo de «Qué se apunta en el CRM» y cierra la tarjeta sin enviar nada" className="px-4 py-2 text-[0.85rem] font-medium text-[#0F2240] ring-1 ring-[#0F2240]/40 disabled:opacity-40">
            {ocupado === "aplicar" ? "Actualizando…" : "Solo actualizar la ficha (no envía)"}
          </button>
        )}
        {conMensaje && (
          <button onClick={() => { const i = prompt("¿Qué cambio quieres en el borrador?") ?? ""; if (i.trim()) hacer("rehacer", { accion: "rehacer", id: t.id, instruccion: i }); }} disabled={!!ocupado} className="px-4 py-2 text-[0.85rem] text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
            {ocupado === "rehacer" ? "Redactando…" : "Rehacer"}
          </button>
        )}
        <button onClick={() => { const m = prompt("¿Por qué lo descartas? (opcional)") ?? ""; hacer("descartar", { accion: "descartar", id: t.id, motivo: m }); }} disabled={!!ocupado} className="px-4 py-2 text-[0.85rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-40">Descartar</button>
      </div>
      <AplazarTarea ocupado={!!ocupado} onAplazar={(fecha) => hacer("aplazar", { accion: "aplazar", id: t.id, fecha })} />
      {err && <p className="mt-2 text-[0.82rem] text-[#DC2626]">{err}</p>}
    </article>
  );
}

function FichaMagia({ detalle, onGuardar }: { detalle: Detalle; onGuardar: (c: Record<string, unknown>) => Promise<void> }) {
  const f = detalle.ficha;
  const [estado, setEstado] = useState(f.estado);
  const [proxima, setProxima] = useState(f.proxima_accion ?? "");
  const [fecha, setFecha] = useState(f.fecha_proxima_accion ?? "");
  const [nivel, setNivel] = useState<"A" | "B" | "C">(f.nivel_autonomia);
  const [linea, setLinea] = useState("");
  const [canal, setCanal] = useState("Manual");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setEstado(f.estado);
    setProxima(f.proxima_accion ?? "");
    setFecha(f.fecha_proxima_accion ?? "");
    setNivel(f.nivel_autonomia);
    setLinea("");
  }, [f]);
  const cambiado = estado !== f.estado || proxima !== (f.proxima_accion ?? "") || fecha !== (f.fecha_proxima_accion ?? "") || nivel !== f.nivel_autonomia || linea.trim() !== "";
  const bloque = /<!-- mensaje-listo -->\n([\s\S]*?)<!-- \/mensaje-listo -->/.exec(f.cuerpo_antes ?? "")?.[1];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.1rem] font-semibold leading-tight">{f.nombre}</h2>
            <p className="mt-1 text-[0.82rem] text-gray-500">{[f.segmento, f.tipo_entidad, f.localidad, f.canal, f.idioma, f.prioridad ? `prioridad ${f.prioridad}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] ${colorEstado(f.estado)}`}>{f.estado}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.85rem] sm:grid-cols-3">
          <div><dt className="text-gray-500">Responsable</dt><dd>{f.responsable ?? "—"}{f.responsable_cargo ? ` (${f.responsable_cargo})` : ""}</dd>{f.responsable_email && <dd className="truncate text-gray-600">{f.responsable_email}</dd>}{f.responsable_tel && <dd className="text-gray-600">{f.responsable_tel}</dd>}</div>
          <div><dt className="text-gray-500">Entidad</dt><dd>{f.telefono ?? "—"}</dd>{f.email && <dd className="truncate text-gray-600">{f.email}</dd>}{f.web && <dd className="truncate text-gray-600">{f.web}</dd>}</div>
          <div><dt className="text-gray-500">Último evento</dt><dd>{f.ultimo_evento ?? "—"}</dd><dd className="text-gray-600">{fmtFecha(f.fecha_ultimo_evento)}{f.mes_temporada ? ` · temporada mes ${f.mes_temporada}` : ""}</dd></div>
          <div><dt className="text-gray-500">Contacto · mails</dt><dd>último {fmtFecha(f.fecha_ultimo_contacto)} · {f.mails_enviados} mails</dd></div>
          {f.bloqueado_por && <div><dt className="text-gray-500">Bloqueado por</dt><dd className="text-amber-800">{f.bloqueado_por}</dd></div>}
        </dl>
        {bloque && (
          <details className="mt-3 text-[0.82rem]">
            <summary className="cursor-pointer text-gray-500">Mensaje / guion que dejaste listo en la ficha</summary>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-gray-700">{bloque}</pre>
          </details>
        )}
      </div>
      <div className="grid gap-3 border-b border-gray-100 p-5 sm:grid-cols-2">
        <label className="text-[0.8rem] text-gray-600">Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            {!ESTADOS.includes(estado) && <option value={estado}>{estado}</option>}
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600">Nivel de autonomía
          <select value={nivel} onChange={(e) => setNivel(e.target.value as "A" | "B" | "C")} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            <option value="A">A · el sistema envía solo (cuando se active)</option>
            <option value="B">B · el sistema redacta, yo apruebo</option>
            <option value="C">C · solo yo</option>
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600 sm:col-span-2">Próxima acción
          <input value={proxima} onChange={(e) => setProxima(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" />
        </label>
        <label className="text-[0.8rem] text-gray-600">Fecha próxima acción
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" />
        </label>
        <label className="text-[0.8rem] text-gray-600">Canal de la línea nueva
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900">
            {["Manual", "Llamada", "Mail", "WhatsApp", "Reunión", "Recibido"].map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="text-[0.8rem] text-gray-600 sm:col-span-2">Añadir al Registro (hoy)
          <textarea value={linea} onChange={(e) => setLinea(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-[0.88rem] text-gray-900" />
        </label>
        <div className="sm:col-span-2">
          <button onClick={async () => { setGuardando(true); try { await onGuardar({ estado, proxima_accion: proxima, fecha_proxima_accion: fecha || null, nivel_autonomia: nivel, ...(linea.trim() ? { registro: linea, registro_canal: canal, fecha_ultimo_contacto: hoyISO() } : {}) }); } finally { setGuardando(false); } }} disabled={!cambiado || guardando} className="bg-[#1a1a1a] px-4 py-2 text-[0.88rem] font-medium text-white disabled:opacity-40">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
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
        {detalle.mensajes.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-[0.9rem] font-semibold">Correos · {detalle.mensajes.length}</h3>
            <ul className="space-y-2 text-[0.82rem]">
              {detalle.mensajes.map((m) => (
                <li key={m.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-gray-500">{m.direccion === "saliente" ? "→" : "←"} {m.de} · {fmtFecha(m.fecha)} · {m.asunto}</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{(m.texto ?? "").slice(0, 600)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
