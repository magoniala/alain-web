"use client";

import { useCallback, useEffect, useState } from "react";

// Bandeja de charlas · fase 1.
//
// Cada tarjeta es un correo que ha llegado de un centro, con el borrador de
// respuesta que propone el sistema y los cambios que hará en el CRM al
// enviarlo. Alain lo lee, lo corrige si hace falta (y dice por qué, para que
// el sistema aprenda) y lo envía. Nada sale sin pulsar "Enviar".
//
// Modo prueba: mientras esté activo, "Enviar" manda el correo a Alain y no
// toca el CRM. La tarea sigue en la bandeja para enviarla de verdad después.

interface Tarea {
  id: string;
  tipo: string;
  nivel: "B" | "C";
  estado: string;
  idioma: "es" | "eu";
  borrador_asunto: string | null;
  borrador_texto: string | null;
  adjuntar_dossier: boolean;
  destinatario: string | null;
  nota_para_alain: string | null;
  urgencia?: 1 | 2 | 3;
  urgencia_motivo?: string | null;
  cambios_crm: Record<string, unknown>;
  contexto: {
    programada?: boolean;
    clasificacion?: string;
    confianza?: number;
    resumen?: string;
    etiqueta_principal?: string | null;
    alternativa?: { etiqueta: string; asunto: string; cuerpo: string; adjuntar_dossier: boolean } | null;
  };
  creado_en: string;
  centro: { id: string; nombre: string; estado: string; responsable: string | null; euskera: string | null; localidad: string | null; territorio: string | null } | null;
  entrante: { id: string; de: string | null; asunto: string | null; fecha: string | null; texto: string | null } | null;
}

interface Huerfano {
  id: string;
  de: string | null;
  asunto: string | null;
  fecha: string | null;
  texto: string | null;
}

interface Datos {
  tareas: Tarea[];
  huerfanos: Huerfano[];
  errores: { id: string; asunto: string | null; error: string | null }[];
  config: { modo_prueba?: boolean; lector_activo?: boolean; modelo?: string };
  coste: { hoy_usd: number; ult_30_dias_usd: number; llamadas_30_dias: number };
  ultima_lectura: string | null;
  error_tareas: string | null;
}

const ETIQUETA: Record<string, string> = {
  calendario_abierto: "Calendario abierto",
  calendario_cerrado: "Calendario cerrado",
  pide_info: "Pide información",
  da_mes: "Da mes para escribir",
  pregunta_precio: "Pregunta precio",
  lo_decide_otro: "Lo decide otra persona",
  reenviado_a: "Reenviado a otra persona",
  pide_contacto_ayuntamiento: "Vía ayuntamiento",
  interesado_fechas: "🔥 Quiere hablar de fechas",
  no_interesa: "No le interesa",
  acuse_automatico: "Acuse automático",
  fuera_de_oficina: "Fuera de oficina",
  otro: "Otro",
  recordatorio_1: "Recordatorio 1",
  recordatorio_2: "Recordatorio 2 (último)",
  aparcar: "Aparcar",
  dossier: "Enviar dossier",
  seguimiento_dossier: "Seguimiento del dossier",
  mail_cierre: "Mail de cierre",
  reactivacion: "Reactivación",
  seguimiento_conversacion: "Seguimiento de conversación",
  llamada_alain: "📞 Llamada",
  revisar_bloqueo: "Revisar bloqueo",
};

const URGENCIA = {
  3: { etiqueta: "Ahora", borde: "border-l-[#DC2626]", chip: "bg-red-100 text-red-800", punto: "bg-[#DC2626]" },
  2: { etiqueta: "Hoy", borde: "border-l-[#E8A33D]", chip: "bg-amber-100 text-amber-900", punto: "bg-[#E8A33D]" },
  1: { etiqueta: "Cuando puedas", borde: "border-l-emerald-500", chip: "bg-emerald-50 text-emerald-800", punto: "bg-emerald-500" },
} as const;
const urg = (t: Tarea) => URGENCIA[(t.urgencia ?? 1) as 1 | 2 | 3];

function useMovil() {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const f = () => setMovil(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return movil;
}

function fechaHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Bandeja({ centros, onCambio }: { centros: { id: string; nombre: string }[]; onCambio: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [leyendo, setLeyendo] = useState(false);
  const [progreso, setProgreso] = useState({ pasada: 0, segundos: 0, fase: "" });
  const [abierta, setAbierta] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get("tarea");
    } catch {
      return null;
    }
  });
  const movil = useMovil();
  const [aviso, setAviso] = useState("");

  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/charlas/bandeja", { headers: headers() });
      setDatos(await r.json());
    } finally {
      setCargando(false);
    }
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/charlas/bandeja", { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Error");
    return d;
  }

  // "Leer buzón ahora" hace las pasadas que haga falta seguidas (cada una
  // es una llamada al cron de como mucho 60 s) hasta que el buzón está al
  // día y no queda nada pendiente para la IA. Al acabar suena un aviso y,
  // si el navegador lo permite, sale una notificación: así se puede cambiar
  // de pestaña mientras trabaja.
  async function leerAhora() {
    setLeyendo(true);
    setAviso("");
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch {}

    const total = { leidos: 0, procesados: 0, tareas: 0, ya: 0, huerfanos: 0, errores: [] as string[] };
    const inicio = Date.now();
    const reloj = setInterval(() => setProgreso((p) => ({ ...p, segundos: Math.round((Date.now() - inicio) / 1000) })), 1000);
    let fallo: string | null = null;

    try {
      for (let pasada = 1; pasada <= 12; pasada++) {
        setProgreso((p) => ({ ...p, pasada, fase: pasada === 1 ? "Leyendo el buzón…" : p.fase }));
        const r = await fetch("/api/charlas/cron", { method: "POST", headers: headers() });
        const crudo = await r.text();
        let d;
        try {
          d = JSON.parse(crudo);
        } catch {
          // Vercel corta la función si pasa de su tiempo y responde con texto.
          // Lo leído ya está guardado: se sigue con otra pasada.
          setProgreso((p) => ({ ...p, fase: "Una pasada se ha alargado; sigo donde se quedó…" }));
          continue;
        }
        if (!r.ok) throw new Error(d.error || "Error");
        if (d.error_lectura) throw new Error(`lectura del buzón: ${d.error_lectura}`);

        const c = d.lectura?.carpetas ?? {};
        total.leidos += Object.values(c).reduce((s: number, x) => s + ((x as { asociados: number }).asociados ?? 0), 0);
        total.procesados += d.proceso?.procesados ?? 0;
        total.tareas += d.proceso?.tareas ?? 0;
        total.ya += d.proceso?.ya_respondidos ?? 0;
        total.huerfanos += d.lectura?.huerfanos_asociados ?? 0;
        total.errores.push(...(d.proceso?.errores ?? []), ...(d.motor?.errores ?? []));
        total.tareas += d.motor?.creadas ?? 0;

        const leyendoHistorico = !d.lectura?.al_dia;
        const quedan = (d.proceso?.pendientes_restantes ?? 0) + (d.motor?.pendientes_restantes ?? 0);
        setProgreso((p) => ({
          ...p,
          fase: leyendoHistorico
            ? `Leyendo el histórico del buzón… (${total.leidos} correos de centros hasta ahora)`
            : quedan > 0
              ? `Redactando respuestas con IA… (${total.procesados} hechas, quedan ${quedan})`
              : "Terminando…",
        }));
        await cargar();
        if (!leyendoHistorico && quedan === 0) break;
      }
    } catch (e) {
      fallo = (e as Error).message;
    } finally {
      clearInterval(reloj);
      setLeyendo(false);
    }

    const resumen = fallo
      ? `Error: ${fallo}`
      : `${total.leidos} correos de centros leídos · ${total.procesados} procesados con IA · ${total.tareas} tareas nuevas` +
        (total.ya ? ` · ${total.ya} ya respondidos desde Mail` : "") +
        (total.huerfanos ? ` · ${total.huerfanos} correos sin centro asociados solos` : "") +
        (total.errores.length ? ` · ⚠️ ${total.errores.join(" | ")}` : "");
    setAviso(resumen);
    await cargar();
    onCambio();
    avisarFin(fallo ? "Bandeja de charlas: ha habido un error" : `Bandeja de charlas lista · ${total.tareas} por revisar`, resumen);
  }

  async function cambiarConfig(clave: "modo_prueba" | "lector_activo", valor: boolean) {
    if (clave === "modo_prueba" && !valor && !confirm("A partir de ahora «Enviar» manda el correo al centro de verdad y actualiza el CRM. ¿Seguro?")) return;
    await accion({ accion: "config", [clave]: valor });
    await cargar();
  }

  if (cargando && !datos) return <p className="text-gray-500">Cargando bandeja…</p>;
  if (!datos) return null;

  const prueba = datos.config.modo_prueba !== false;
  const ordenadas = [...datos.tareas].sort((a, b) => (b.urgencia ?? 1) - (a.urgencia ?? 1) || a.creado_en.localeCompare(b.creado_en));
  const calientes = ordenadas.filter((t) => t.nivel === "C" || (t.urgencia ?? 1) === 3);
  const resto = ordenadas.filter((t) => !calientes.includes(t));
  const tareaAbierta = abierta ? datos.tareas.find((t) => t.id === abierta) ?? null : null;
  const cerrar = () => {
    setAbierta(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("tarea");
      window.history.replaceState(null, "", u);
    } catch {}
  };
  const alTerminar = () => {
    cerrar();
    cargar();
    onCambio();
  };

  return (
    <div className="space-y-5">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-[0.85rem]">
        <button onClick={leerAhora} disabled={leyendo} className="flex items-center gap-2 bg-[#0F2240] px-4 py-2 font-medium text-white disabled:opacity-70">
          {leyendo && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {leyendo ? "Trabajando…" : "Leer buzón ahora"}
        </button>
        <span className="text-gray-500">Última lectura: {fechaHora(datos.ultima_lectura) || "nunca"}</span>
        <span className="text-gray-500">IA: {datos.coste.hoy_usd.toFixed(2)} $ hoy · {datos.coste.ult_30_dias_usd.toFixed(2)} $ en 30 días</span>
        <label className={`ml-auto flex items-center gap-2 px-3 py-1.5 ${prueba ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          <input type="checkbox" checked={prueba} onChange={(e) => cambiarConfig("modo_prueba", e.target.checked)} />
          {prueba ? "Modo prueba: los envíos te llegan a ti" : "Envío real a los centros"}
        </label>
      </div>
      {leyendo && (
        <div className="overflow-hidden rounded-2xl border border-[#0F2240]/15 bg-white">
          <div className="h-1 w-full overflow-hidden bg-gray-100">
            <div className="charlas-barra h-full w-1/3 bg-[#0F2240]" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[0.85rem]">
            <span className="font-medium text-gray-900">{progreso.fase || "Empezando…"}</span>
            <span className="text-gray-500">Pasada {progreso.pasada} · {progreso.segundos} s</span>
            <span className="ml-auto text-[0.78rem] text-gray-400">Puedes cambiar de pestaña: te aviso con un sonido al terminar.</span>
          </div>
          <style>{`@keyframes charlas-barra{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}.charlas-barra{animation:charlas-barra 1.4s ease-in-out infinite}`}</style>
        </div>
      )}
      {aviso && <p className="text-[0.85rem] text-gray-800">{aviso}</p>}
      {datos.error_tareas && <p className="text-[0.85rem] text-[#DC2626]">Error cargando tareas: {datos.error_tareas}</p>}

      {datos.tareas.length === 0 && datos.huerfanos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-[0.9rem] text-gray-500">Bandeja vacía. Nada que revisar.</div>
      )}

      {/* Pantalla completa de una tarea (móvil siempre; escritorio al llegar por notificación) */}
      {tareaAbierta && (movil || abierta) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f6f2ec] lg:bg-black/40 lg:p-6">
          <div className="min-h-full lg:mx-auto lg:max-w-[1100px]">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-[#f6f2ec]/95 px-4 py-3 backdrop-blur lg:rounded-t-2xl">
              <button onClick={cerrar} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 ring-1 ring-gray-200">
                ←
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-semibold">{tareaAbierta.centro?.nombre}</p>
                <p className="truncate text-[0.75rem] text-gray-500">{urg(tareaAbierta).etiqueta} · {tareaAbierta.urgencia_motivo ?? ""}</p>
              </div>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${urg(tareaAbierta).punto}`} />
            </div>
            <div className="p-3 lg:p-0">
              <TarjetaTarea key={`${tareaAbierta.id}:${tareaAbierta.borrador_texto ?? ""}`} t={tareaAbierta} prueba={prueba} accion={accion} alTerminar={alTerminar} movil />
            </div>
          </div>
        </div>
      )}

      {movil ? (
        <ListaMovil calientes={calientes} resto={resto} abrir={(id) => setAbierta(id)} />
      ) : (
        <>
          {calientes.length > 0 && (
            <section>
              <h2 className="mb-2 text-[0.95rem] font-semibold">Para ti · {calientes.length}</h2>
              <p className="mb-3 text-[0.8rem] text-gray-500">Leads calientes y casos delicados. El borrador es una propuesta; aquí decides tú.</p>
              <div className="space-y-4">
                {calientes.map((t) => (
                  <TarjetaTarea key={`${t.id}:${t.borrador_texto ?? ""}`} t={t} prueba={prueba} accion={accion} alTerminar={alTerminar} />
                ))}
              </div>
            </section>
          )}

          {resto.length > 0 && (
            <section>
              <h2 className="mb-3 text-[0.95rem] font-semibold">Respuestas por revisar · {resto.length}</h2>
              <div className="space-y-4">
                {resto.map((t) => (
                  <TarjetaTarea key={`${t.id}:${t.borrador_texto ?? ""}`} t={t} prueba={prueba} accion={accion} alTerminar={alTerminar} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Notificaciones headers={headers} />

      {datos.huerfanos.length > 0 && (
        <section>
          <h2 className="mb-2 text-[0.95rem] font-semibold">Correos sin centro · {datos.huerfanos.length}</h2>
          <p className="mb-3 text-[0.8rem] text-gray-500">Parecen de la campaña pero no sé de qué centro son. Asígnalo y lo proceso; la dirección queda aprendida.</p>
          <div className="space-y-3">
            {datos.huerfanos.map((h) => (
              <Huerfano key={h.id} h={h} centros={centros} accion={accion} alTerminar={() => { cargar(); onCambio(); }} />
            ))}
          </div>
        </section>
      )}

      {datos.errores.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[0.82rem] text-red-900">
          <p className="font-medium">Correos que han fallado 3 veces</p>
          {datos.errores.map((e) => (
            <p key={e.id}>{e.asunto}: {e.error}</p>
          ))}
        </section>
      )}
    </div>
  );
}

function TarjetaTarea({ t, prueba, accion, alTerminar, movil = false }: { t: Tarea; prueba: boolean; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void; movil?: boolean }) {
  const [asunto, setAsunto] = useState(t.borrador_asunto ?? "");
  const [texto, setTexto] = useState(t.borrador_texto ?? "");
  const [para, setPara] = useState(t.destinatario ?? "");
  const [dossier, setDossier] = useState(t.adjuntar_dossier);
  const [idiomaDossier, setIdiomaDossier] = useState<"es" | "eu">(t.idioma);
  const [motivo, setMotivo] = useState("");
  const [instruccion, setInstruccion] = useState("");
  const [verOriginal, setVerOriginal] = useState(!movil);
  const [opcion, setOpcion] = useState<"a" | "b">("a");
  const alt = t.contexto?.alternativa ?? null;

  function elegir(o: "a" | "b") {
    setOpcion(o);
    if (o === "a") {
      setAsunto(t.borrador_asunto ?? "");
      setTexto(t.borrador_texto ?? "");
      setDossier(t.adjuntar_dossier);
    } else if (alt) {
      setAsunto(alt.asunto || t.borrador_asunto || "");
      setTexto(alt.cuerpo);
      setDossier(alt.adjuntar_dossier);
    }
  }
  const [ocupado, setOcupado] = useState("");
  const [mensaje, setMensaje] = useState("");

  const base = opcion === "b" && alt ? { asunto: alt.asunto || t.borrador_asunto || "", texto: alt.cuerpo } : { asunto: t.borrador_asunto ?? "", texto: t.borrador_texto ?? "" };
  const editado = texto.trim() !== base.texto.trim() || asunto.trim() !== base.asunto.trim();
  const conRespuesta = !!t.borrador_texto;
  const programada = !!t.contexto?.programada;
  const cambios = Object.entries(t.cambios_crm ?? {}).filter(([k]) => k !== "contacto_nuevo");
  const persona = t.cambios_crm?.contacto_nuevo as { nombre?: string; email?: string } | undefined;

  async function hacer(nombre: string, body: Record<string, unknown>) {
    setOcupado(nombre);
    setMensaje("");
    try {
      const r = (await accion(body)) as { prueba?: boolean; enviado_a?: string; smtp?: string };
      if (r?.prueba) setMensaje(`Prueba enviada a ${r.enviado_a}. Revisa tu correo (también Spam); la tarea sigue aquí. Servidor: ${r.smtp || "sin respuesta"}`);
      else alTerminar();
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }

  return (
    <article className={`rounded-2xl border border-l-4 bg-white ${urg(t).borde} ${t.nivel === "C" ? "border-[#E8A33D]" : "border-gray-200"} ${urg(t).borde}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${urg(t).chip}`} title={t.urgencia_motivo ?? ""}>{urg(t).etiqueta}</span>
        <span className="text-[0.95rem] font-semibold">{t.centro?.nombre ?? "¿Centro?"}</span>
        <span className="text-[0.78rem] text-gray-500">{t.centro?.localidad} · {t.centro?.estado}</span>
        <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-[0.75rem]">
          {ETIQUETA[t.contexto?.clasificacion ?? ""] ?? t.contexto?.clasificacion}
          {typeof t.contexto?.confianza === "number" && t.contexto.confianza < 0.8 ? ` · dudoso (${Math.round(t.contexto.confianza * 100)}%)` : ""}
        </span>
      </header>

      <div className={`grid gap-0 ${movil ? "" : "lg:grid-cols-2"}`}>
        {/* Lo que ha llegado */}
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          {programada ? (
            <>
              <p className="mb-2 text-[0.78rem] font-medium uppercase text-gray-400">Toca por fecha</p>
              <p className="text-[0.95rem] font-medium">{ETIQUETA[t.tipo] ?? t.tipo}</p>
              <p className="mt-1 text-[0.82rem] text-gray-600">No ha llegado ningún correo: lo marca el Flujo según el estado de la ficha y su fecha de próxima acción.</p>
            </>
          ) : (
            <>
              <button onClick={() => setVerOriginal(!verOriginal)} className="mb-2 text-[0.78rem] font-medium uppercase text-gray-400">
                Ha llegado {verOriginal ? "▾" : "▸"}
              </button>
              <p className="text-[0.82rem] text-gray-600">
                {t.entrante?.de} · {fechaHora(t.entrante?.fecha ?? null)}
              </p>
              <p className="mb-2 text-[0.85rem] font-medium">{t.entrante?.asunto}</p>
              {verOriginal && <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap font-sans text-[0.85rem] text-gray-800">{(t.entrante?.texto ?? "").trim()}</pre>}
            </>
          )}
          {t.contexto?.resumen && <p className="mt-3 text-[0.8rem] text-gray-500">Resumen: {t.contexto.resumen}</p>}
        </div>

        {/* Lo que se propone */}
        <div className="p-5">
          {t.nota_para_alain && <p className="mb-3 bg-amber-50 px-3 py-2 text-[0.82rem] text-amber-900">⚑ {t.nota_para_alain}</p>}

          {conRespuesta && alt && (
            <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-[0.8rem]">
              {(["a", "b"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => elegir(o)}
                  className={`flex-1 rounded-md px-3 py-1.5 ${opcion === o ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-600"}`}
                >
                  {o === "a" ? `A · ${t.contexto?.etiqueta_principal ?? "Propuesta"}` : `B · ${alt.etiqueta}`}
                </button>
              ))}
            </div>
          )}
          {conRespuesta ? (
            <>
              <label className="block text-[0.75rem] text-gray-500">
                Para
                <input value={para} onChange={(e) => setPara(e.target.value)} className="mt-0.5 w-full border border-gray-300 px-2 py-1 text-[0.85rem] text-gray-900" />
              </label>
              <label className="mt-2 block text-[0.75rem] text-gray-500">
                Asunto
                <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="mt-0.5 w-full border border-gray-300 px-2 py-1 text-[0.85rem] text-gray-900" />
              </label>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(18, Math.max(8, texto.split("\n").length + 2))} className={`mt-2 w-full border border-gray-300 px-3 py-2 font-sans leading-relaxed text-gray-900 ${movil ? "text-[1rem]" : "text-[0.88rem]"}`} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.82rem]">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={dossier} onChange={(e) => setDossier(e.target.checked)} /> Adjuntar dossier
                </label>
                {dossier && (
                  <select value={idiomaDossier} onChange={(e) => setIdiomaDossier(e.target.value as "es" | "eu")} className="border border-gray-300 px-1.5 py-0.5">
                    <option value="eu">euskera</option>
                    <option value="es">castellano</option>
                  </select>
                )}
              </div>
              {editado && (
                <label className="mt-3 block text-[0.75rem] text-gray-500">
                  ¿Por qué lo cambias? (una frase; así aprende)
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="p. ej. demasiado largo; no pidas el nº de grupos si ya lo han dicho" className="mt-0.5 w-full border border-gray-300 px-2 py-1 text-[0.85rem] text-gray-900" />
                </label>
              )}
            </>
          ) : (
            <p className="text-[0.85rem] text-gray-700">
              {t.tipo === "llamada_alain" ? "Esto es una llamada tuya. Cuando la hagas, apunta el resultado abajo y pulsa Aplicar." : "No hace falta responder. Solo se propone actualizar la ficha."}
            </p>
          )}

          {(cambios.length > 0 || persona?.email) && (
            <div className="mt-3 bg-gray-50 px-3 py-2 text-[0.8rem] text-gray-700">
              <p className="mb-1 font-medium text-gray-500">{prueba ? "En el CRM (no se aplica en modo prueba)" : "Al enviar, en el CRM"}:</p>
              {cambios.map(([k, v]) => (
                <p key={k}>
                  {k.replace(/_/g, " ")}: <strong>{String(v)}</strong>
                </p>
              ))}
              {persona?.email && <p>contacto nuevo: <strong>{persona.nombre ?? ""} {persona.email}</strong></p>}
            </div>
          )}

          <div className={`mt-4 flex flex-wrap gap-2 ${movil ? "sticky bottom-0 -mx-5 -mb-5 border-t border-gray-100 bg-white px-5 py-3 [&>button]:min-h-[44px] [&>button]:flex-1" : ""}`}>
            {conRespuesta ? (
              <button
                onClick={() => hacer("enviar", { accion: "enviar", id: t.id, asunto, texto, destinatario: para, adjuntar_dossier: dossier, dossier_idioma: idiomaDossier, motivo, opcion: alt ? opcion : null })}
                disabled={!!ocupado || (editado && !motivo.trim())}
                title={editado && !motivo.trim() ? "Escribe por qué lo cambias" : ""}
                className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40"
              >
                {ocupado === "enviar" ? "Enviando…" : prueba ? "Enviar (prueba, a ti)" : "Enviar"}
              </button>
            ) : (
              <button onClick={() => hacer("aplicar", { accion: "aplicar", id: t.id })} disabled={!!ocupado || prueba} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">
                {prueba ? "Aplicar (desactiva el modo prueba)" : "Aplicar cambios"}
              </button>
            )}
            <button
              onClick={() => {
                const m = prompt("¿Por qué lo descartas? (opcional; ayuda a que aprenda)") ?? "";
                hacer("descartar", { accion: "descartar", id: t.id, motivo: m });
              }}
              disabled={!!ocupado}
              className="px-4 py-2 text-[0.85rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-40"
            >
              Descartar
            </button>
          </div>

          {conRespuesta && !programada && (
            <div className="mt-3 flex gap-2">
              <input value={instruccion} onChange={(e) => setInstruccion(e.target.value)} placeholder="Rehazlo así: …" className="min-w-0 flex-1 border border-gray-300 px-2 py-1 text-[0.82rem]" />
              <button onClick={() => hacer("regenerar", { accion: "regenerar", id: t.id, instruccion })} disabled={!!ocupado || !instruccion.trim()} className="px-3 py-1 text-[0.82rem] ring-1 ring-gray-300 disabled:opacity-40">
                {ocupado === "regenerar" ? "Rehaciendo…" : "Rehacer"}
              </button>
            </div>
          )}
          {mensaje && <p className="mt-3 text-[0.82rem] text-gray-800">{mensaje}</p>}
        </div>
      </div>
    </article>
  );
}

function Huerfano({ h, centros, accion, alTerminar }: { h: Huerfano; centros: { id: string; nombre: string }[]; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void }) {
  const [filtro, setFiltro] = useState("");
  const [centro, setCentro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const opciones = filtro.trim() ? centros.filter((c) => c.nombre.toLowerCase().includes(filtro.trim().toLowerCase())).slice(0, 30) : [];

  async function hacer(body: Record<string, unknown>) {
    setOcupado(true);
    try {
      await accion(body);
      alTerminar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-[0.85rem]">
      <p className="text-gray-600">{h.de} · {fechaHora(h.fecha)}</p>
      <p className="font-medium">{h.asunto}</p>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-gray-700">{(h.texto ?? "").slice(0, 400)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar centro…" className="border border-gray-300 px-2 py-1" />
        <select value={centro} onChange={(e) => setCentro(e.target.value)} className="max-w-[260px] border border-gray-300 px-2 py-1">
          <option value="">{opciones.length ? "Elige…" : "Escribe para buscar"}</option>
          {opciones.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button onClick={() => hacer({ accion: "asignar", mensaje_id: h.id, centro_id: centro })} disabled={!centro || ocupado} className="bg-[#1a1a1a] px-3 py-1 text-white disabled:opacity-40">
          {ocupado ? "Procesando…" : "Asignar y procesar"}
        </button>
        <button onClick={() => hacer({ accion: "ignorar", mensaje_id: h.id })} disabled={ocupado} className="px-3 py-1 text-gray-600 ring-1 ring-gray-300">
          No es de charlas
        </button>
      </div>
    </div>
  );
}

// Sonido corto (dos notas) y notificación del sistema al terminar. Sin
// archivos de audio: se genera con Web Audio. Si el navegador no deja,
// no pasa nada.
function avisarFin(titulo: string, cuerpo: string) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {}
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(titulo, { body: cuerpo.slice(0, 180) });
    }
  } catch {}
  try {
    const original = document.title;
    if (document.visibilityState !== "visible") {
      document.title = `✓ ${titulo}`;
      const volver = () => {
        document.title = original;
        document.removeEventListener("visibilitychange", volver);
      };
      document.addEventListener("visibilitychange", volver);
    }
  } catch {}
}

function ListaMovil({ calientes, resto, abrir }: { calientes: Tarea[]; resto: Tarea[]; abrir: (id: string) => void }) {
  const Fila = ({ t }: { t: Tarea }) => (
    <button onClick={() => abrir(t.id)} className={`flex w-full items-start gap-3 border-l-4 bg-white px-4 py-3 text-left ${urg(t).borde}`}>
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${urg(t).punto}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.95rem] font-semibold">{t.centro?.nombre ?? "¿Centro?"}</span>
          <span className="shrink-0 text-[0.72rem] text-gray-500">{urg(t).etiqueta}</span>
        </span>
        <span className="block truncate text-[0.8rem] text-gray-600">{ETIQUETA[t.contexto?.clasificacion ?? t.tipo] ?? t.tipo}{t.urgencia_motivo ? ` · ${t.urgencia_motivo}` : ""}</span>
        {t.contexto?.resumen && <span className="mt-0.5 line-clamp-2 block text-[0.8rem] text-gray-500">{t.contexto.resumen}</span>}
      </span>
      <span className="mt-1 text-gray-400">›</span>
    </button>
  );
  return (
    <div className="space-y-4">
      {calientes.length > 0 && (
        <section>
          <h2 className="mb-2 text-[0.85rem] font-semibold uppercase tracking-wide text-gray-500">Para ti · {calientes.length}</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {calientes.map((t) => <Fila key={t.id} t={t} />)}
          </div>
        </section>
      )}
      {resto.length > 0 && (
        <section>
          <h2 className="mb-2 text-[0.85rem] font-semibold uppercase tracking-wide text-gray-500">Por revisar · {resto.length}</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {resto.map((t) => <Fila key={t.id} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}

// Notificaciones push en este dispositivo (la app instalada en el móvil, o el
// navegador del Mac). En iPhone solo funcionan desde la app añadida a la
// pantalla de inicio; desde Safari a secas no aparece el botón.
function Notificaciones({ headers }: { headers: () => Record<string, string> }) {
  const [estado, setEstado] = useState<"cargando" | "no_soportado" | "sin_claves" | "activas" | "inactivas" | "denegadas">("cargando");
  const [dispositivos, setDispositivos] = useState(0);
  const [clave, setClave] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  const esIphone = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  const instalada = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/charlas/push", { headers: headers() });
        const d = await r.json();
        setDispositivos(d.dispositivos ?? 0);
        setClave(d.clave_publica);
        if (!d.clave_publica) return setEstado("sin_claves");
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEstado("no_soportado");
        if (Notification.permission === "denied") return setEstado("denegadas");
        const reg = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub ? "activas" : "inactivas");
      } catch {
        setEstado("no_soportado");
      }
    })();
  }, [headers]);

  async function activar() {
    if (!clave) return;
    setOcupado(true);
    setMsg("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("denegadas");
        return;
      }
      const reg = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
      const r = await fetch("/api/admin/charlas/push", { method: "POST", headers: headers(), body: JSON.stringify({ suscripcion: sub.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) }) });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      setEstado("activas");
      setDispositivos((n) => n + 1);
      setMsg("Activadas en este dispositivo.");
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/admin");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/charlas/push", { method: "DELETE", headers: headers(), body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEstado("inactivas");
      setDispositivos((n) => Math.max(0, n - 1));
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setOcupado(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/charlas/push", { method: "PUT", headers: headers() });
      const d = await r.json();
      setMsg(d.error ? `Error: ${d.error}` : `Prueba enviada a ${d.enviados} dispositivo(s).`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 text-[0.85rem]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Notificaciones al móvil</span>
        <span className="text-gray-500">{dispositivos} dispositivo{dispositivos === 1 ? "" : "s"} suscrito{dispositivos === 1 ? "" : "s"}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {estado === "inactivas" && (
            <button onClick={activar} disabled={ocupado} className="bg-[#0F2240] px-3 py-1.5 font-medium text-white disabled:opacity-50">
              Activar en este dispositivo
            </button>
          )}
          {estado === "activas" && (
            <>
              <button onClick={probar} disabled={ocupado} className="px-3 py-1.5 ring-1 ring-gray-300 disabled:opacity-50">Enviar prueba</button>
              <button onClick={desactivar} disabled={ocupado} className="px-3 py-1.5 text-gray-600 ring-1 ring-gray-300 disabled:opacity-50">Desactivar aquí</button>
            </>
          )}
        </span>
      </div>
      {estado === "sin_claves" && <p className="mt-2 text-amber-800">Faltan las claves VAPID en Vercel (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).</p>}
      {estado === "denegadas" && <p className="mt-2 text-amber-800">Este navegador tiene las notificaciones bloqueadas para el panel. Se cambia en los ajustes del navegador o del sistema.</p>}
      {estado === "no_soportado" && esIphone && !instalada && (
        <p className="mt-2 text-gray-600">
          En iPhone las notificaciones solo funcionan con el panel instalado como app: en Safari, botón <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>. Luego ábrelo desde ese icono y vuelve aquí.
        </p>
      )}
      {estado === "no_soportado" && !esIphone && <p className="mt-2 text-gray-600">Este navegador no admite notificaciones push.</p>}
      {msg && <p className="mt-2 text-gray-800">{msg}</p>}
    </section>
  );
}
