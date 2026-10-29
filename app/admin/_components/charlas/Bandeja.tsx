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
  cambios_crm: Record<string, unknown>;
  contexto: { clasificacion?: string; confianza?: number; resumen?: string };
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
};

function fechaHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Bandeja({ centros, onCambio }: { centros: { id: string; nombre: string }[]; onCambio: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [leyendo, setLeyendo] = useState(false);
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

  async function leerAhora() {
    setLeyendo(true);
    setAviso("");
    try {
      const r = await fetch("/api/charlas/cron", { method: "POST", headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      const c = d.lectura?.carpetas ?? {};
      const asociados = Object.values(c).reduce((s: number, x) => s + ((x as { asociados: number }).asociados ?? 0), 0);
      setAviso(
        (d.error_lectura ? `⚠️ Lectura: ${d.error_lectura} · ` : "") +
          (d.proceso?.esperando_lectura && !d.error_lectura ? "Todavía leyendo el histórico del buzón; pulsa otra vez en un momento. · " : "") +
          `${asociados} correos de centros leídos · ${d.proceso?.procesados ?? 0} procesados con IA · ${d.proceso?.tareas ?? 0} tareas nuevas` +
          (d.proceso?.ya_respondidos ? ` · ${d.proceso.ya_respondidos} ya respondidos desde Mail` : "") +
          (d.proceso?.errores?.length ? ` · ⚠️ ${d.proceso.errores.join(" | ")}` : "")
      );
      await cargar();
      onCambio();
    } catch (e) {
      setAviso(`Error: ${(e as Error).message}`);
    } finally {
      setLeyendo(false);
    }
  }

  async function cambiarConfig(clave: "modo_prueba" | "lector_activo", valor: boolean) {
    if (clave === "modo_prueba" && !valor && !confirm("A partir de ahora «Enviar» manda el correo al centro de verdad y actualiza el CRM. ¿Seguro?")) return;
    await accion({ accion: "config", [clave]: valor });
    await cargar();
  }

  if (cargando && !datos) return <p className="text-gray-500">Cargando bandeja…</p>;
  if (!datos) return null;

  const prueba = datos.config.modo_prueba !== false;
  const calientes = datos.tareas.filter((t) => t.nivel === "C");
  const resto = datos.tareas.filter((t) => t.nivel !== "C");

  return (
    <div className="space-y-5">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-[0.85rem]">
        <button onClick={leerAhora} disabled={leyendo} className="bg-[#0F2240] px-4 py-2 font-medium text-white disabled:opacity-50">
          {leyendo ? "Leyendo buzón… (hasta 1 min)" : "Leer buzón ahora"}
        </button>
        <span className="text-gray-500">Última lectura: {fechaHora(datos.ultima_lectura) || "nunca"}</span>
        <span className="text-gray-500">IA: {datos.coste.hoy_usd.toFixed(2)} $ hoy · {datos.coste.ult_30_dias_usd.toFixed(2)} $ en 30 días</span>
        <label className={`ml-auto flex items-center gap-2 px-3 py-1.5 ${prueba ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          <input type="checkbox" checked={prueba} onChange={(e) => cambiarConfig("modo_prueba", e.target.checked)} />
          {prueba ? "Modo prueba: los envíos te llegan a ti" : "Envío real a los centros"}
        </label>
      </div>
      {aviso && <p className="text-[0.85rem] text-gray-800">{aviso}</p>}
      {datos.error_tareas && <p className="text-[0.85rem] text-[#DC2626]">Error cargando tareas: {datos.error_tareas}</p>}

      {datos.tareas.length === 0 && datos.huerfanos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-[0.9rem] text-gray-500">Bandeja vacía. Nada que revisar.</div>
      )}

      {calientes.length > 0 && (
        <section>
          <h2 className="mb-2 text-[0.95rem] font-semibold">Para ti · {calientes.length}</h2>
          <p className="mb-3 text-[0.8rem] text-gray-500">Leads calientes y casos delicados. El borrador es una propuesta; aquí decides tú.</p>
          <div className="space-y-4">
            {calientes.map((t) => (
              <TarjetaTarea key={`${t.id}:${t.borrador_texto ?? ""}`} t={t} prueba={prueba} accion={accion} alTerminar={() => { cargar(); onCambio(); }} />
            ))}
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <section>
          <h2 className="mb-3 text-[0.95rem] font-semibold">Respuestas por revisar · {resto.length}</h2>
          <div className="space-y-4">
            {resto.map((t) => (
              <TarjetaTarea key={`${t.id}:${t.borrador_texto ?? ""}`} t={t} prueba={prueba} accion={accion} alTerminar={() => { cargar(); onCambio(); }} />
            ))}
          </div>
        </section>
      )}

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

function TarjetaTarea({ t, prueba, accion, alTerminar }: { t: Tarea; prueba: boolean; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void }) {
  const [asunto, setAsunto] = useState(t.borrador_asunto ?? "");
  const [texto, setTexto] = useState(t.borrador_texto ?? "");
  const [para, setPara] = useState(t.destinatario ?? "");
  const [dossier, setDossier] = useState(t.adjuntar_dossier);
  const [idiomaDossier, setIdiomaDossier] = useState<"es" | "eu">(t.idioma);
  const [motivo, setMotivo] = useState("");
  const [instruccion, setInstruccion] = useState("");
  const [verOriginal, setVerOriginal] = useState(true);
  const [ocupado, setOcupado] = useState("");
  const [mensaje, setMensaje] = useState("");

  const editado = texto.trim() !== (t.borrador_texto ?? "").trim() || asunto.trim() !== (t.borrador_asunto ?? "").trim();
  const conRespuesta = t.tipo === "respuesta";
  const cambios = Object.entries(t.cambios_crm ?? {}).filter(([k]) => k !== "contacto_nuevo");
  const persona = t.cambios_crm?.contacto_nuevo as { nombre?: string; email?: string } | undefined;

  async function hacer(nombre: string, body: Record<string, unknown>) {
    setOcupado(nombre);
    setMensaje("");
    try {
      const r = (await accion(body)) as { prueba?: boolean; enviado_a?: string };
      if (r?.prueba) setMensaje(`Prueba enviada a ${r.enviado_a}. Revisa tu correo; la tarea sigue aquí.`);
      else alTerminar();
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }

  return (
    <article className={`rounded-2xl border bg-white ${t.nivel === "C" ? "border-[#E8A33D]" : "border-gray-200"}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
        <span className="text-[0.95rem] font-semibold">{t.centro?.nombre ?? "¿Centro?"}</span>
        <span className="text-[0.78rem] text-gray-500">{t.centro?.localidad} · {t.centro?.estado}</span>
        <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-[0.75rem]">
          {ETIQUETA[t.contexto?.clasificacion ?? ""] ?? t.contexto?.clasificacion}
          {typeof t.contexto?.confianza === "number" && t.contexto.confianza < 0.8 ? ` · dudoso (${Math.round(t.contexto.confianza * 100)}%)` : ""}
        </span>
      </header>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Lo que ha llegado */}
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <button onClick={() => setVerOriginal(!verOriginal)} className="mb-2 text-[0.78rem] font-medium uppercase text-gray-400">
            Ha llegado {verOriginal ? "▾" : "▸"}
          </button>
          <p className="text-[0.82rem] text-gray-600">
            {t.entrante?.de} · {fechaHora(t.entrante?.fecha ?? null)}
          </p>
          <p className="mb-2 text-[0.85rem] font-medium">{t.entrante?.asunto}</p>
          {verOriginal && <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap font-sans text-[0.85rem] text-gray-800">{(t.entrante?.texto ?? "").trim()}</pre>}
          {t.contexto?.resumen && <p className="mt-3 text-[0.8rem] text-gray-500">Resumen: {t.contexto.resumen}</p>}
        </div>

        {/* Lo que se propone */}
        <div className="p-5">
          {t.nota_para_alain && <p className="mb-3 bg-amber-50 px-3 py-2 text-[0.82rem] text-amber-900">⚑ {t.nota_para_alain}</p>}

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
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(18, Math.max(8, texto.split("\n").length + 2))} className="mt-2 w-full border border-gray-300 px-3 py-2 font-sans text-[0.88rem] leading-relaxed text-gray-900" />
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
            <p className="text-[0.85rem] text-gray-700">No hace falta responder. Solo se propone actualizar la ficha.</p>
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

          <div className="mt-4 flex flex-wrap gap-2">
            {conRespuesta ? (
              <button
                onClick={() => hacer("enviar", { accion: "enviar", id: t.id, asunto, texto, destinatario: para, adjuntar_dossier: dossier, dossier_idioma: idiomaDossier, motivo })}
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

          {conRespuesta && (
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
