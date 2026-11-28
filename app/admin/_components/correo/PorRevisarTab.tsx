"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmar } from "../confirmar";

// Correo › Por revisar (adelanto de F1, 28-11-2026). Lo que llega al correo,
// como tarjeta con acciones, para gestionarlo sin abrir Mail. Datos y acciones:
// /api/admin/correo/panel · lib/correo-panel.ts · lib/correo-acciones.ts.
// Los pendientes de correo viven solo aquí (decisión de Alain, 28-11).

const pw = () => sessionStorage.getItem("admin_pw") || "";
async function api(init?: RequestInit, query = "") {
  const r = await fetch(`/api/admin/correo/panel${query}`, { ...init, headers: { "Content-Type": "application/json", "x-admin-password": pw(), ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
const post = (b: Record<string, unknown>) => api({ method: "POST", body: JSON.stringify(b) });

interface Ficha { id: string; nombre: string; tipo: string | null; estado: string; ampa_email: string | null; etiquetas: string[] | null; motivo_rechazo: string | null }
interface PendienteSug { titulo: string; fecha: string | null; frase: string | null }
interface Tarjeta {
  id: string; buzon: string; message_id: string; de: string | null; de_nombre: string | null; asunto: string | null; fecha: string | null;
  tipo: string | null; categoria: string; via: string | null; etiquetas: string[]; pide_respuesta: boolean | null; idioma: string | null; resumen: string | null;
  texto: string | null; sin_abrir: boolean; pendiente_sugerido: PendienteSug | null; accion_ficha: "rechazo" | "ampa" | "pide_documento" | null; accion_dato: string | null;
  pregunta_origen: string | null; newsletter_asunto: string | null; testimonio_guardado: boolean; respuesta_guardada: boolean; ficha: Ficha | null; via_ref: string | null;
}
interface Pendiente { id: string; titulo: string; fecha_limite: string | null; message_id: string | null; via: string | null; estado: string; hecho_en: string | null; creado_por: string }
interface Datos { listo: boolean; error?: string; dias?: number; tarjetas?: Tarjeta[]; pendientes?: Pendiente[]; hechos?: Pendiente[] }

const TIPO: Record<string, { icono: string; nombre: string }> = {
  solicitud: { icono: "🔴", nombre: "Solicitud nueva" },
  conversacion: { icono: "🟠", nombre: "Conversación" },
  newsletter: { icono: "💬", nombre: "Respuesta a la newsletter" },
  testimonio: { icono: "🗣", nombre: "Testimonio" },
  tramite: { icono: "📅", nombre: "Trámite" },
  aviso: { icono: "👁", nombre: "Aviso" },
  ruido: { icono: "🔕", nombre: "Ruido" },
};
const ORDEN = ["solicitud", "conversacion", "testimonio", "newsletter", "tramite"];

const boton = "rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[0.8rem] text-gray-800 hover:bg-gray-50 disabled:opacity-50";
const botonOscuro = "rounded-lg bg-gray-900 px-2.5 py-1 text-[0.8rem] font-medium text-white hover:bg-gray-700 disabled:opacity-50";
const campo = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[0.85rem] text-gray-900";

const hoyISO = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const fechaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const diasHasta = (f: string) => Math.round((new Date(f + "T12:00:00").getTime() - new Date(hoyISO() + "T12:00:00").getTime()) / 86400000);

function colorFecha(f: string | null) {
  if (!f) return { punto: "⚪", clase: "text-gray-500", texto: "sin fecha" };
  const d = diasHasta(f);
  const txt = d < 0 ? `vencido hace ${-d} d` : d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} d`;
  const fmt = new Date(f + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  if (d <= 0) return { punto: "🔴", clase: "text-red-700", texto: `${fmt} · ${txt}` };
  if (d <= 3) return { punto: "🟠", clase: "text-orange-700", texto: `${fmt} · ${txt}` };
  return { punto: "🟢", clase: "text-green-700", texto: `${fmt} · ${txt}` };
}

// ---------------------------------------------------------------------------
// Pendientes
// ---------------------------------------------------------------------------
function FormPendiente({ inicial, correoId, alGuardar, alCerrar }: { inicial?: { titulo?: string; fecha?: string | null; via?: string | null }; correoId?: string; alGuardar: () => void; alCerrar: () => void }) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? "");
  const [via, setVia] = useState(inicial?.via && ["charlas", "magia", "entrenatzaile"].includes(inicial.via) ? inicial.via : "general");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await post({ accion: "crear_pendiente", titulo, fecha_limite: fecha || null, via, id: correoId });
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <input className={campo} placeholder="Qué hay que hacer" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[0.8rem] text-gray-600">Fecha límite (opcional)</label>
        <input type="date" className="rounded-lg border border-gray-300 px-2 py-1 text-[0.85rem]" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <label className="ml-2 text-[0.8rem] text-gray-600">Vía</label>
        <select className="rounded-lg border border-gray-300 px-2 py-1 text-[0.85rem]" value={via} onChange={(e) => setVia(e.target.value)}>
          <option value="general">General</option>
          <option value="charlas">Charlas</option>
          <option value="magia">Magia</option>
          <option value="entrenatzaile">Entrenatzaile</option>
        </select>
        <span className="ml-auto flex gap-2">
          <button className={botonOscuro} disabled={ocupado || !titulo.trim()} onClick={guardar}>Crear pendiente</button>
          <button className={boton} onClick={alCerrar}>Cancelar</button>
        </span>
      </div>
      {error && <p className="text-[0.8rem] text-red-700">{error}</p>}
    </div>
  );
}

function SeccionPendientes({ pendientes, hechos, recargar, avisar }: { pendientes: Pendiente[]; hechos: Pendiente[]; recargar: () => void; avisar: (m: string) => void }) {
  const [nuevo, setNuevo] = useState(false);
  const [verHechos, setVerHechos] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [eTitulo, setETitulo] = useState("");
  const [eFecha, setEFecha] = useState("");
  const accion = async (b: Record<string, unknown>) => {
    try {
      await post(b);
      recargar();
    } catch (e) {
      avisar((e as Error).message);
    }
  };
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[0.95rem] font-semibold text-gray-900">📌 Pendientes de correo · {pendientes.length}</h2>
        <button className={boton} onClick={() => setNuevo((v) => !v)}>+ Pendiente</button>
      </div>
      {nuevo && <FormPendiente alGuardar={() => { setNuevo(false); recargar(); }} alCerrar={() => setNuevo(false)} />}
      {!pendientes.length && !nuevo && <p className="text-[0.85rem] text-gray-500">Nada pendiente. Se crean desde las tarjetas o a mano. Aviso al móvil la víspera y el mismo día.</p>}
      <ul className="divide-y divide-gray-100">
        {pendientes.map((p) => {
          const c = colorFecha(p.fecha_limite);
          return (
            <li key={p.id} className="py-2">
              {editando === p.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input className={campo + " flex-1"} value={eTitulo} onChange={(e) => setETitulo(e.target.value)} />
                  <input type="date" className="rounded-lg border border-gray-300 px-2 py-1 text-[0.85rem]" value={eFecha} onChange={(e) => setEFecha(e.target.value)} />
                  <button className={botonOscuro} onClick={async () => { await accion({ accion: "editar_pendiente", pendiente_id: p.id, titulo: eTitulo, fecha_limite: eFecha || null }); setEditando(null); }}>Guardar</button>
                  <button className={boton} onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>{c.punto}</span>
                  <span className="min-w-0 flex-1 text-[0.9rem] text-gray-900">{p.titulo}</span>
                  <span className={`text-[0.78rem] ${c.clase}`}>{c.texto}</span>
                  {p.via && p.via !== "general" && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] text-gray-600">{p.via}</span>}
                  {p.message_id && !p.message_id.startsWith("sin-id-") && (
                    <a className="text-[0.78rem] text-blue-700 underline" href={`message://%3C${encodeURIComponent(p.message_id)}%3E`} title="Abrir el correo en Mail">✉ correo</a>
                  )}
                  <button className={boton} onClick={() => { setEditando(p.id); setETitulo(p.titulo); setEFecha(p.fecha_limite ?? ""); }}>Editar</button>
                  <button className={botonOscuro} onClick={() => accion({ accion: "pendiente_hecho", pendiente_id: p.id })}>Hecho</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hechos.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button className="text-[0.8rem] text-gray-600 underline" onClick={() => setVerHechos((v) => !v)}>{verHechos ? "Ocultar" : "Ver"} hechos (30 días) · {hechos.length}</button>
          {verHechos && (
            <ul className="mt-1 space-y-1">
              {hechos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-3 text-[0.82rem] text-gray-500">
                  <span className="flex-1 line-through">{p.titulo}</span>
                  <span>{p.hecho_en ? new Date(p.hecho_en).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}</span>
                  <button className={boton} onClick={() => accion({ accion: "pendiente_deshacer", pendiente_id: p.id })}>↩ Deshacer</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------
type Panel = null | "testimonio" | "respuesta" | "pendiente" | "siempre" | "rechazo" | "ampa" | "documento" | "ficha";

function Tarjeta({ t, recargar, avisar }: { t: Tarjeta; recargar: () => void; avisar: (m: string) => void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [verTexto, setVerTexto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const tipo = t.tipo ?? "sin_clasificar";
  const info = TIPO[tipo] ?? { icono: "❔", nombre: "Sin clasificar" };

  const hacer = async (b: Record<string, unknown>, ok?: string) => {
    setOcupado(true);
    try {
      const r = await post({ id: t.id, ...b });
      if (ok) avisar(ok);
      if (r.conflicto) return r;
      recargar();
      return r;
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  // Formularios
  const [tq, setTq] = useState({
    texto: t.texto ?? "", quien: t.de_nombre ?? "", centro: t.ficha?.nombre ?? "", via: t.via === "magia" ? "magia" : t.via === "charlas" || t.ficha ? "charlas" : "", idioma: t.idioma === "eu" ? "eu" : t.idioma === "es" ? "es" : "",
    permiso: "", donde: [] as string[],
  });
  const [rs, setRs] = useState({ pregunta: t.pregunta_origen ?? "", respuesta: t.texto ?? "" });
  const [sa, setSa] = useState({ alcance: "email", tratamiento: "completo", categoria: tipo === "aviso" || tipo === "ruido" ? tipo : "" });
  const [motivo, setMotivo] = useState(t.accion_ficha === "rechazo" ? t.accion_dato ?? "" : "");
  const [ampa, setAmpa] = useState(t.accion_ficha === "ampa" ? t.accion_dato ?? "" : "");
  const [doc, setDoc] = useState(t.accion_ficha === "pide_documento" ? t.accion_dato ?? "" : "");
  const [q, setQ] = useState("");
  const [fichas, setFichas] = useState<{ id: string; nombre: string; estado: string }[]>([]);

  const hrefResponder = `mailto:${t.de ?? ""}?subject=${encodeURIComponent("Re: " + (t.asunto ?? "").replace(/^((re|rv)\s*:\s*)+/i, ""))}`;
  const hrefMail = !t.message_id.startsWith("sin-id-") ? `message://%3C${encodeURIComponent(t.message_id)}%3E` : null;
  const ficha = t.ficha;
  const esCharlas = t.via === "charlas" || (!t.via && !!ficha);
  const yaRechazada = !!ficha && ficha.estado.startsWith("8");

  const guardarTestimonio = async () => {
    if (!tq.permiso) return avisar("Elige el permiso: es obligatorio.");
    if (!tq.via) return avisar("Elige la vía.");
    const r = await hacer({ accion: "guardar_testimonio", ...tq, centro_id: ficha?.id }, "Testimonio guardado. Se vuelca al vault en la próxima pasada horaria.");
    if (r) setPanel(null);
  };

  return (
    <div id={`correo-${t.id}`} className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[1.05rem]">{info.icono}</span>
        <span className="text-[0.78rem] font-semibold uppercase tracking-wide text-gray-500">{info.nombre}</span>
        {t.via && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[0.7rem] text-blue-800">↪ {t.via}{ficha ? ` · ${ficha.nombre}` : ""}</span>}
        {t.etiquetas.includes("privado") && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-amber-900">privado: no usar en copy sin permiso</span>}
        {t.etiquetas.includes("autorrespuesta_ayto") && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] text-gray-700">autorrespuesta · no cuenta como respuesta</span>}
        {t.etiquetas.includes("pide_documento") && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[0.7rem] text-purple-900">pide documento</span>}
        {t.testimonio_guardado && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[0.7rem] text-green-900">✔ testimonio guardado</span>}
        {t.respuesta_guardada && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[0.7rem] text-green-900">✔ respuesta guardada</span>}
        <span className="ml-auto text-[0.75rem] text-gray-400">{fechaCorta(t.fecha)}</span>
      </div>
      <p className="mt-1 text-[0.9rem] text-gray-900">
        <span className="font-medium">{t.de_nombre || t.de}</span> <span className="text-gray-500">&lt;{t.de}&gt;</span>
      </p>
      <p className="text-[0.85rem] text-gray-700">{t.asunto}</p>
      {t.resumen && <p className="mt-1 text-[0.85rem] text-gray-600">{t.resumen}</p>}
      {t.sin_abrir && <p className="mt-1 text-[0.8rem] text-gray-500">Correo de este remitente, sin abrir (tratamiento «solo cabecera»).</p>}

      {tipo === "newsletter" && (
        <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[0.85rem] text-amber-950">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-amber-800">Contesta al mail{t.newsletter_asunto ? `: ${t.newsletter_asunto}` : ""}</p>
          <p className="mt-0.5">{t.pregunta_origen ? `«${t.pregunta_origen}»` : "No he podido sacar la pregunta del mail (revisa la campaña)."}</p>
        </div>
      )}

      {t.texto && (
        <div className="mt-2">
          <button className="text-[0.8rem] text-gray-600 underline" onClick={() => setVerTexto((v) => !v)}>{verTexto ? "Ocultar texto" : "Ver texto del correo"}</button>
          {verTexto && <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-[0.83rem] text-gray-800">{t.texto}</pre>}
        </div>
      )}

      {t.pendiente_sugerido && panel !== "pendiente" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-2.5 text-[0.83rem] text-blue-950">
          <span>📅 Pendiente sugerido: <b>{t.pendiente_sugerido.titulo}</b>{t.pendiente_sugerido.fecha ? ` · antes del ${t.pendiente_sugerido.fecha}` : ""}</span>
          <button className={boton + " ml-auto"} onClick={() => setPanel("pendiente")}>Crear pendiente…</button>
        </div>
      )}

      {/* Acciones sobre la ficha, sugeridas por el correo */}
      {t.accion_ficha && esCharlas && ficha && panel === null && (
        <div className="mt-2 rounded-xl bg-purple-50 p-2.5 text-[0.83rem] text-purple-950">
          {t.accion_ficha === "rechazo" && (yaRechazada ? <>Rechazo ya registrado en la ficha ({ficha.estado}{ficha.motivo_rechazo ? `: ${ficha.motivo_rechazo}` : ""}). No hace falta nada más.</> : <>Parece un rechazo{t.accion_dato ? `: «${t.accion_dato}»` : ""}. <button className={boton + " ml-2"} onClick={() => setPanel("rechazo")}>Marcar rechazo…</button></>)}
          {t.accion_ficha === "ampa" && (ficha.ampa_email?.toLowerCase() === (t.accion_dato ?? "").toLowerCase() ? <>El contacto del AMPA ({ficha.ampa_email}) ya está en la ficha.</> : <>Pasan el correo del AMPA: <b>{t.accion_dato}</b>. <button className={boton + " ml-2"} onClick={() => setPanel("ampa")}>Guardar contacto del AMPA…</button></>)}
          {t.accion_ficha === "pide_documento" && ((ficha.etiquetas ?? []).includes("pide documento") ? <>La ficha ya lleva la etiqueta «pide documento».</> : <>Piden un documento{t.accion_dato ? `: «${t.accion_dato}»` : ""}. <button className={boton + " ml-2"} onClick={() => setPanel("documento")}>Etiquetar «pide documento»…</button></>)}
        </div>
      )}

      {/* Botonera */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {t.de && (t.pide_respuesta !== false) && tipo !== "aviso" && tipo !== "ruido" && <a className={boton} href={hrefResponder}>✉ Responder en Mail</a>}
        {hrefMail && <a className={boton} href={hrefMail}>Abrir en Mail</a>}
        {tipo === "testimonio" || t.texto ? <button className={boton} onClick={() => setPanel(panel === "testimonio" ? null : "testimonio")}>🗣 Guardar testimonio</button> : null}
        {tipo === "newsletter" && <button className={boton} onClick={() => setPanel(panel === "respuesta" ? null : "respuesta")}>Guardar respuesta</button>}
        <button className={boton} onClick={() => setPanel(panel === "pendiente" ? null : "pendiente")}>+ Pendiente</button>
        {esCharlas && !ficha && <button className={boton} onClick={() => setPanel(panel === "ficha" ? null : "ficha")}>Elegir ficha…</button>}
        {esCharlas && ficha && !t.accion_ficha && (
          <>
            {!yaRechazada && <button className={boton} onClick={() => setPanel("rechazo")}>Marcar rechazo</button>}
            <button className={boton} onClick={() => setPanel("ampa")}>Contacto AMPA</button>
            <button className={boton} onClick={() => setPanel("documento")}>Pide documento</button>
          </>
        )}
        {!t.via && t.de && <button className={boton} onClick={() => setPanel(panel === "siempre" ? null : "siempre")}>Siempre así con este remitente</button>}
        {t.via && t.de && <button className={boton} onClick={() => setPanel(panel === "siempre" ? null : "siempre")}>Siempre así…</button>}
        <span className="ml-auto flex gap-2">
          <button className={boton} disabled={ocupado} onClick={() => hacer({ accion: "visto" })}>Visto</button>
          <button className={botonOscuro} disabled={ocupado} onClick={() => hacer({ accion: "hecho" })}>Hecho</button>
        </span>
      </div>

      {panel === "pendiente" && (
        <FormPendiente
          correoId={t.id}
          inicial={{ titulo: t.pendiente_sugerido?.titulo ?? "", fecha: t.pendiente_sugerido?.fecha ?? "", via: t.via }}
          alGuardar={() => { setPanel(null); avisar("Pendiente creado."); recargar(); }}
          alCerrar={() => setPanel(null)}
        />
      )}

      {panel === "ficha" && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex gap-2">
            <input className={campo} placeholder="Nombre del centro o ayuntamiento" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className={boton} onClick={async () => { const r = await post({ accion: "ficha_buscar", q }).catch(() => ({ fichas: [] })); setFichas(r.fichas ?? []); }}>Buscar</button>
          </div>
          {fichas.map((f) => (
            <button key={f.id} className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-[0.83rem] hover:bg-gray-100" onClick={async () => { await hacer({ accion: "vincular_ficha", centro_id: f.id }, `Ficha: ${f.nombre}`); setPanel(null); }}>
              {f.nombre} <span className="text-gray-500">· {f.estado}</span>
            </button>
          ))}
        </div>
      )}

      {panel === "testimonio" && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <textarea className={campo} rows={8} value={tq.texto} onChange={(e) => setTq({ ...tq, texto: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={campo} placeholder="Quién (puede ir vacío)" value={tq.quien} onChange={(e) => setTq({ ...tq, quien: e.target.value })} />
            <input className={campo} placeholder="Centro o cliente" value={tq.centro} onChange={(e) => setTq({ ...tq, centro: e.target.value })} />
            <select className={campo} value={tq.via} onChange={(e) => setTq({ ...tq, via: e.target.value })}>
              <option value="">Vía…</option>
              <option value="charlas">Charlas</option>
              <option value="entrenatzaile">Entrenatzaile</option>
              <option value="magia">Magia</option>
            </select>
            <select className={campo} value={tq.idioma} onChange={(e) => setTq({ ...tq, idioma: e.target.value })}>
              <option value="">Idioma…</option>
              <option value="es">Castellano</option>
              <option value="eu">Euskera</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-[0.78rem] font-semibold text-gray-700">Permiso (obligatorio)</p>
            <div className="flex flex-wrap gap-3 text-[0.85rem]">
              {[["solo_anonimo", "Solo anónimo"], ["con_nombre", "Con nombre"], ["no_consta", "No consta"]].map(([v, n]) => (
                <label key={v} className="flex items-center gap-1.5"><input type="radio" name={`perm-${t.id}`} checked={tq.permiso === v} onChange={() => setTq({ ...tq, permiso: v })} />{n}</label>
              ))}
            </div>
            {tq.permiso && tq.permiso !== "con_nombre" && <p className="mt-1 text-[0.78rem] text-red-700">Quedará marcado «SOLO ANÓNIMO» y no se ofrecerá nunca para copy con nombre.</p>}
          </div>
          <div>
            <p className="mb-1 text-[0.78rem] font-semibold text-gray-700">Dónde usarlo</p>
            <div className="flex flex-wrap gap-3 text-[0.85rem]">
              {[["objecion", "Objeción"], ["dossier", "Dossier"], ["cierre", "Cierre"], ["web", "Web"]].map(([v, n]) => (
                <label key={v} className="flex items-center gap-1.5"><input type="checkbox" checked={tq.donde.includes(v)} onChange={(e) => setTq({ ...tq, donde: e.target.checked ? [...tq.donde, v] : tq.donde.filter((x) => x !== v) })} />{n}</label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className={botonOscuro} disabled={ocupado} onClick={guardarTestimonio}>Guardar testimonio</button>
            <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {panel === "respuesta" && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="text-[0.78rem] font-semibold text-gray-700">Pregunta del mail</label>
          <textarea className={campo} rows={2} value={rs.pregunta} onChange={(e) => setRs({ ...rs, pregunta: e.target.value })} />
          <label className="text-[0.78rem] font-semibold text-gray-700">Respuesta literal</label>
          <textarea className={campo} rows={5} value={rs.respuesta} onChange={(e) => setRs({ ...rs, respuesta: e.target.value })} />
          <p className="text-[0.78rem] text-amber-800">Va a la nota de respuestas de suscriptores con la etiqueta «privado: no usar en copy sin permiso».</p>
          <div className="flex gap-2">
            <button className={botonOscuro} disabled={ocupado} onClick={async () => { const r = await hacer({ accion: "guardar_respuesta", ...rs, newsletter_asunto: t.newsletter_asunto }, "Respuesta guardada. Se vuelca al vault en la próxima pasada horaria."); if (r) setPanel(null); }}>Guardar respuesta</button>
            <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {panel === "siempre" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[0.83rem]">
          <span>{t.de}</span>
          <select className="rounded-lg border border-gray-300 px-2 py-1" value={sa.alcance} onChange={(e) => setSa({ ...sa, alcance: e.target.value })}>
            <option value="email">solo este email</option>
            <option value="dominio">todo el dominio</option>
          </select>
          <select className="rounded-lg border border-gray-300 px-2 py-1" value={sa.tratamiento} onChange={(e) => setSa({ ...sa, tratamiento: e.target.value })}>
            <option value="completo">Completo</option>
            <option value="solo_fecha">Solo fecha (cuerpo 30 d)</option>
            <option value="solo_cabecera">Solo cabecera</option>
            <option value="silenciado">Silenciado</option>
          </select>
          <select className="rounded-lg border border-gray-300 px-2 py-1" value={sa.categoria} onChange={(e) => setSa({ ...sa, categoria: e.target.value })}>
            <option value="">Sin categoría fija</option>
            {["solicitud", "conversacion", "newsletter", "tramite", "aviso", "ruido"].map((c) => <option key={c} value={c}>{TIPO[c].nombre}</option>)}
          </select>
          <button className={botonOscuro} disabled={ocupado} onClick={async () => { const r = await hacer({ accion: "siempre_asi", ...sa }, "Regla guardada."); if (r) setPanel(null); }}>Guardar regla</button>
          <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
        </div>
      )}

      {panel === "rechazo" && ficha && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[0.83rem]">Marcar <b>{ficha.nombre}</b> como «8 Perdido» y cerrar sus pendientes en la bandeja de charlas.</p>
          <input className={campo} placeholder="Motivo en una frase" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex gap-2">
            <button className={botonOscuro} disabled={ocupado || !motivo.trim()} onClick={async () => { if (!(await confirmar(`¿Marcar ${ficha.nombre} como Perdido por: «${motivo}»?`, { aceptar: "Marcar rechazo" }))) return; const r = await hacer({ accion: "rechazo", centro_id: ficha.id, motivo }, "Rechazo marcado en la ficha."); if (r) setPanel(null); }}>Marcar rechazo</button>
            <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {panel === "ampa" && ficha && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[0.83rem]">Guardar en la ficha de <b>{ficha.nombre}</b> el contacto del AMPA{ficha.ampa_email ? ` (ahora: ${ficha.ampa_email})` : ""}.</p>
          <input className={campo} placeholder="email del AMPA" value={ampa} onChange={(e) => setAmpa(e.target.value)} />
          <div className="flex gap-2">
            <button
              className={botonOscuro}
              disabled={ocupado || !ampa.trim()}
              onClick={async () => {
                if (!(await confirmar(`¿Guardar ${ampa} como contacto del AMPA de ${ficha.nombre}?`, { aceptar: "Guardar" }))) return;
                const r = await hacer({ accion: "ampa", centro_id: ficha.id, email: ampa });
                if (r?.conflicto) {
                  if (await confirmar(`La ficha ya tiene ${r.conflicto}. ¿Sustituirlo por ${ampa}?`, { aceptar: "Sustituir", peligro: true })) await hacer({ accion: "ampa", centro_id: ficha.id, email: ampa, sobrescribir: true }, "Contacto del AMPA guardado.");
                } else if (r) {
                  avisar(r.ya_estaba ? "Ese contacto ya estaba." : "Contacto del AMPA guardado en la ficha.");
                  setPanel(null);
                }
              }}
            >
              Guardar contacto del AMPA
            </button>
            <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {panel === "documento" && ficha && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[0.83rem]">Etiquetar <b>{ficha.nombre}</b> con «pide documento».</p>
          <input className={campo} placeholder="Qué piden (opcional)" value={doc} onChange={(e) => setDoc(e.target.value)} />
          <div className="flex gap-2">
            <button className={botonOscuro} disabled={ocupado} onClick={async () => { if (!(await confirmar(`¿Etiquetar ${ficha.nombre} con «pide documento»?`, { aceptar: "Etiquetar" }))) return; const r = await hacer({ accion: "pide_documento", centro_id: ficha.id, nota: doc }, "Etiqueta «pide documento» puesta."); if (r) setPanel(null); }}>Etiquetar</button>
            <button className={boton} onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña
// ---------------------------------------------------------------------------
export default function PorRevisarTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [verVias, setVerVias] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const actualizar = async () => {
    setActualizando(true);
    try {
      const r = await post({ accion: "procesar" });
      setAviso(r.resumen ? `Revisado: ${r.resumen.procesadas} correos procesados${r.resumen.con_ia ? `, ${r.resumen.con_ia} con IA` : ""}${r.resumen.cerradas_por_enviados ? `, ${r.resumen.cerradas_por_enviados} cerrados por tu respuesta en Mail` : ""}.` : "Nada que procesar (¿falta ejecutar sql/correo-adelanto.sql?).");
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setActualizando(false);
    }
  };

  const grupos = useMemo(() => {
    const ts = datos?.tarjetas ?? [];
    const promovida = (t: Tarjeta) => !!t.accion_ficha || ["testimonio", "newsletter", "tramite", "solicitud"].includes(t.tipo ?? "");
    const principal = ts.filter((t) => t.tipo !== "aviso" && t.tipo !== "ruido" && t.categoria !== "ruido" && (t.categoria !== "via" || promovida(t)));
    const vias = ts.filter((t) => t.categoria === "via" && !promovida(t) && t.tipo !== "aviso" && t.tipo !== "ruido");
    const avisos = ts.filter((t) => t.tipo === "aviso" || t.tipo === "ruido" || t.categoria === "aviso" || t.categoria === "ruido");
    principal.sort((a, b) => {
      const ia = ORDEN.indexOf(a.tipo ?? ""), ib = ORDEN.indexOf(b.tipo ?? "");
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(b.fecha).localeCompare(String(a.fecha));
    });
    return { principal, vias, avisos: avisos.filter((a) => !principal.includes(a)) };
  }, [datos]);

  if (error) return <p className="text-[0.9rem] text-red-700">{error}</p>;
  if (!datos) return <p className="text-[0.9rem] text-gray-500">Cargando…</p>;
  if (!datos.listo)
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-[0.9rem] text-amber-900">
        Falta ejecutar <code>sql/correo-adelanto.sql</code> en el SQL editor de Supabase{datos.error ? ` (${datos.error})` : ""}. Hasta entonces esta pestaña no tiene datos; charlas y magia siguen igual.
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[0.85rem] text-gray-500">
          Lo que llega al correo de los últimos {datos.dias} días, con acciones. Leer nunca marca nada en Mail: <b>Visto</b> y <b>Hecho</b> sí lo marcan como leído. Se cierran solas cuando ves tu respuesta en Enviados.
        </p>
        <button className={boton} disabled={actualizando} onClick={actualizar}>{actualizando ? "Revisando… (hasta 1 min)" : "Actualizar ahora"}</button>
      </div>
      {aviso && <p className="rounded-xl bg-gray-100 px-3 py-2 text-[0.83rem] text-gray-800">{aviso}</p>}

      <SeccionPendientes pendientes={datos.pendientes ?? []} hechos={datos.hechos ?? []} recargar={cargar} avisar={setAviso} />

      <section className="space-y-3">
        <h2 className="text-[0.95rem] font-semibold text-gray-900">Te toca a ti · {grupos.principal.length}</h2>
        {!grupos.principal.length && <p className="text-[0.85rem] text-gray-500">Nada que gestionar ahora mismo.</p>}
        {grupos.principal.map((t) => <Tarjeta key={t.id} t={t} recargar={cargar} avisar={setAviso} />)}
      </section>

      {grupos.avisos.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="mr-auto text-[0.95rem] font-semibold text-gray-900">👁 Avisos · {grupos.avisos.length}</h2>
            <button className={boton} onClick={async () => { if (!(await confirmar(`¿Marcar los ${grupos.avisos.length} avisos como vistos? También quedan leídos en Mail.`, { aceptar: "Visto todos" }))) return; try { const r = await post({ accion: "visto_todos", ids: grupos.avisos.map((a) => a.id) }); setAviso(`${r.cerradas} avisos vistos.`); cargar(); } catch (e) { setAviso((e as Error).message); } }}>Visto todos</button>
          </div>
          <ul className="divide-y divide-gray-100">
            {grupos.avisos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-[0.83rem]">
                <span className="w-44 shrink-0 truncate font-medium text-gray-900" title={a.de ?? ""}>{a.de_nombre || a.de}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{a.asunto}{a.sin_abrir ? " · sin abrir" : ""}{a.etiquetas.includes("autorrespuesta_ayto") ? " · autorrespuesta: no cuenta como respuesta del centro" : ""}</span>
                <span className="text-gray-400">{fechaCorta(a.fecha)}</span>
                <button className={boton} onClick={async () => { await post({ accion: "visto", id: a.id }).catch((e) => setAviso(e.message)); cargar(); }}>Visto</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grupos.vias.length > 0 && (
        <section className="space-y-3">
          <button className="text-[0.9rem] font-semibold text-gray-900" onClick={() => setVerVias((v) => !v)}>↪ De una vía (ya las lleva su pestaña) · {grupos.vias.length} {verVias ? "▾" : "▸"}</button>
          {verVias && grupos.vias.map((t) => <Tarjeta key={t.id} t={t} recargar={cargar} avisar={setAviso} />)}
        </section>
      )}
    </div>
  );
}
