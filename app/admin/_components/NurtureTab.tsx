"use client";

import { useState, useEffect, useCallback } from "react";
import { cuerpoDelMail, marcadoresDeMuestra, sustituirMarcadores } from "@/lib/email-markdown";
import {
  CONDICIONES_DE_MUESTRA,
  MARCADORES,
  SECUENCIAS,
  SECUENCIA_ETIQUETA,
  VALORES_DE_MUESTRA,
  type Secuencia,
} from "@/lib/secuencias";

// En el envío real los marcadores los resuelve el servidor con los datos de
// cada contacto; aquí, con los de muestra.
const EJEMPLO_BASE = marcadoresDeMuestra();

// Nombre y fechas de muestra, más los marcadores propios de la secuencia que
// se esté editando. Antes solo iban los primeros, así que previsualizar un
// correo de Comodín enseñaba un "{{tutorial}}" suelto en mitad de la frase.
function ejemploDe(secuencia: Secuencia): Record<string, string> {
  return { ...EJEMPLO_BASE, ...(VALORES_DE_MUESTRA[secuencia] ?? {}) };
}

interface NurtureContacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string;
  recibe_secuencia: boolean;
  posicion_secuencia: number;
  secuencia_completada: boolean;
  fecha_ultimo_mail_secuencia: string | null;
  unsubscribed: boolean;
  siguiente_asunto: string | null;
}

interface SecuenciaMail {
  posicion: number;
  asunto: string | null;
  cuerpo_html: string | null;
  formato?: string | null;
  preheader?: string | null;
  remitente: string | null;
  activo: boolean;
}

const SUB_TABS = ["Contactos", "Mails"] as const;
type SubTab = (typeof SUB_TABS)[number];

const REMITENTE_FALLBACK = "newsletter@alainzulaika.com";

// Mails que no siguen la progresión normal: se disparan por su propia regla.
const ESPECIALES: Record<number, { titulo: string; cuando: string }> = {
  [-1]: {
    titulo: "Recordatorio de valoración",
    cuando: "El mismo día que el mail 7, a las 19:14 (hora de Madrid).",
  },
  [-2]: {
    titulo: "Mail de cortesía (ya estaba en la lista)",
    cuando: "Al instante, cuando un lead de Meta Ads ya estaba suscrito y no entra en la secuencia.",
  },
};

function describePosicion(posicion: number) {
  if (ESPECIALES[posicion]) return ESPECIALES[posicion];
  if (posicion === 0) {
    return { titulo: "Mail 0 — bienvenida", cuando: "Al instante, en cuanto el lead entra desde el anuncio." };
  }
  return { titulo: `Mail ${posicion}`, cuando: "A las 14:30 (hora de Madrid), un día después del anterior." };
}

export default function NurtureTab() {
  const [subTab, setSubTab] = useState<SubTab>("Contactos");

  const [contactos, setContactos] = useState<NurtureContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [mails, setMails] = useState<SecuenciaMail[]>([]);
  const [esperando, setEsperando] = useState<Record<string, number>>({});
  const [remitentes, setRemitentes] = useState<string[]>([REMITENTE_FALLBACK]);
  const [loadingMails, setLoadingMails] = useState(true);
  const [borradores, setBorradores] = useState<Record<number, SecuenciaMail>>({});
  const [abierto, setAbierto] = useState<number | null>(null);
  const [secuencia, setSecuencia] = useState<Secuencia>("nurture");
  const [idiomaEdicion, setIdiomaEdicion] = useState<"es" | "eu">("es");
  const [bilingue, setBilingue] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ posicion: number; ok?: string; error?: string } | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<number | null>(null);
  const [testEmails, setTestEmails] = useState("");
  const [enviandoTest, setEnviandoTest] = useState<number | null>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-password": sessionStorage.getItem("admin_pw") || "",
  }), []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de secuencia o de idioma hay que recargar: son mails distintos.
  useEffect(() => {
    loadMails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secuencia, idiomaEdicion]);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/admin/nurture/contactos", { headers: authHeaders() }).then(r => r.json());
    if (Array.isArray(data)) setContactos(data);
    setLoading(false);
  }

  async function loadMails() {
    setLoadingMails(true);
    const data = await fetch(`/api/admin/nurture/mails?secuencia=${secuencia}&idioma=${idiomaEdicion}`, { headers: authHeaders() }).then(r => r.json());
    if (Array.isArray(data?.mails)) {
      setMails(data.mails);
      setBorradores(Object.fromEntries(data.mails.map((m: SecuenciaMail) => [m.posicion, { ...m }])));
      setEsperando(data.esperando ?? {});
      if (Array.isArray(data.remitentes) && data.remitentes.length) setRemitentes(data.remitentes);
      setBilingue(Boolean(data.bilingue));
    }
    setLoadingMails(false);
  }

  async function toggleRecibe(id: string, recibe_secuencia: boolean) {
    setUpdatingId(id);
    setContactos(prev => prev.map(c => c.id === id ? { ...c, recibe_secuencia } : c));
    await fetch("/api/admin/nurture/contactos", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, recibe_secuencia }),
    });
    setUpdatingId(null);
  }

  function setCampo(posicion: number, patch: Partial<SecuenciaMail>) {
    setBorradores(prev => ({ ...prev, [posicion]: { ...prev[posicion], ...patch } }));
  }

  function estaSucio(posicion: number) {
    const original = mails.find(m => m.posicion === posicion);
    const draft = borradores[posicion];
    if (!draft) return false;
    if (!original) return true;
    return (
      (original.asunto ?? "") !== (draft.asunto ?? "") ||
      (original.cuerpo_html ?? "") !== (draft.cuerpo_html ?? "") ||
      (original.formato ?? "html") !== (draft.formato ?? "html") ||
      (original.preheader ?? "") !== (draft.preheader ?? "") ||
      (original.remitente ?? REMITENTE_FALLBACK) !== (draft.remitente ?? REMITENTE_FALLBACK) ||
      original.activo !== draft.activo
    );
  }

  async function guardar(posicion: number) {
    const draft = borradores[posicion];
    if (!draft) return;
    setGuardando(posicion);
    setAviso(null);
    const res = await fetch("/api/admin/nurture/mails", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        secuencia,
        idioma: idiomaEdicion,
        posicion,
        asunto: draft.asunto ?? "",
        cuerpo_html: draft.cuerpo_html ?? "",
        formato: draft.formato ?? "html",
        preheader: draft.preheader ?? "",
        remitente: draft.remitente ?? REMITENTE_FALLBACK,
        activo: draft.activo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(null);
    if (!res.ok) {
      setAviso({ posicion, error: data.error || "Error al guardar." });
      return;
    }
    setMails(prev => {
      const sin = prev.filter(m => m.posicion !== posicion);
      return [...sin, { ...draft, posicion }].sort((a, b) => a.posicion - b.posicion);
    });
    setAviso({ posicion, ok: "Guardado." });
  }

  function olvidarBorrador(posicion: number) {
    setBorradores(prev => Object.fromEntries(
      Object.entries(prev).filter(([k]) => Number(k) !== posicion)
    ));
  }

  function descartar(posicion: number) {
    const original = mails.find(m => m.posicion === posicion);
    if (original) setBorradores(prev => ({ ...prev, [posicion]: { ...original } }));
    else olvidarBorrador(posicion);
    setAviso(null);
  }

  async function borrar(posicion: number) {
    setGuardando(posicion);
    const res = await fetch("/api/admin/nurture/mails", {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ secuencia, idioma: idiomaEdicion, posicion }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(null);
    setBorrarTarget(null);
    if (!res.ok) {
      setAviso({ posicion, error: data.error || "Error al borrar." });
      return;
    }
    setMails(prev => prev.filter(m => m.posicion !== posicion));
    olvidarBorrador(posicion);
    if (abierto === posicion) setAbierto(null);
  }

  async function enviarPrueba(posicion: number) {
    const draft = borradores[posicion];
    const lista = testEmails.split(",").map(e => e.trim()).filter(Boolean);
    if (!draft || lista.length === 0) return;
    setEnviandoTest(posicion);
    setAviso(null);
    const res = await fetch("/api/admin/nurture/mails", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        secuencia,
        idioma: idiomaEdicion,
        test_emails: lista,
        asunto: draft.asunto ?? "",
        cuerpo_html: draft.cuerpo_html ?? "",
        formato: draft.formato ?? "html",
        preheader: draft.preheader ?? "",
        remitente: draft.remitente ?? REMITENTE_FALLBACK,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEnviandoTest(null);
    setAviso(res.ok
      ? { posicion, ok: `Prueba enviada a ${lista.length} dirección(es).` }
      : { posicion, error: data.error || "Error al enviar la prueba." });
  }

  function nuevoMail() {
    const normales = Object.keys(borradores).map(Number).filter(p => p >= 0);
    const siguiente = normales.length ? Math.max(...normales) + 1 : 0;
    setBorradores(prev => ({
      ...prev,
      [siguiente]: { posicion: siguiente, asunto: "", cuerpo_html: "", remitente: remitentes[0], activo: false, formato: "texto", preheader: "" },
    }));
    setAbierto(siguiente);
  }

  function crearEspecial(posicion: number) {
    setBorradores(prev => ({
      ...prev,
      [posicion]: { posicion, asunto: "", cuerpo_html: "", remitente: remitentes[0], activo: false, formato: "texto", preheader: "" },
    }));
    setAbierto(posicion);
  }

  // --- Ayudas de edición sobre el textarea de HTML ---

  function editarSeleccion(posicion: number, transformar: (seleccion: string) => string, fallback: string) {
    const el = document.getElementById(`nurture-body-${posicion}`) as HTMLTextAreaElement | null;
    const valor = borradores[posicion]?.cuerpo_html ?? "";
    if (!el) {
      setCampo(posicion, { cuerpo_html: valor + fallback });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const seleccion = valor.slice(start, end);
    const insertado = seleccion ? transformar(seleccion) : fallback;
    setCampo(posicion, { cuerpo_html: valor.slice(0, start) + insertado + valor.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + insertado.length);
    });
  }

  const P_ABRE = '<p style="margin:0 0 1.6rem 0;">';

  // Convierte texto pegado en crudo a los mismos párrafos que usa la secuencia:
  // línea en blanco = párrafo nuevo, salto simple = <br>.
  function textoAParrafos(texto: string) {
    return texto
      .split(/\n\s*\n/)
      .map(bloque => bloque.trim())
      .filter(Boolean)
      .map(bloque => `${P_ABRE}${bloque.split(/\n/).map(l => l.trim()).join("<br>")}</p>`)
      .join("\n");
  }

  // Sin selección convierte todo el cuerpo (sustituyéndolo), no inserta al lado.
  function convertirAParrafos(posicion: number) {
    const el = document.getElementById(`nurture-body-${posicion}`) as HTMLTextAreaElement | null;
    const valor = borradores[posicion]?.cuerpo_html ?? "";
    if (el && el.selectionStart !== el.selectionEnd) {
      editarSeleccion(posicion, textoAParrafos, "");
      return;
    }
    setCampo(posicion, { cuerpo_html: textoAParrafos(valor) });
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // Buckets mutuamente excluyentes: excluido manda sobre completada.
  const excluidos = contactos.filter(c => !c.recibe_secuencia);
  const completados = contactos.filter(c => c.recibe_secuencia && c.secuencia_completada);
  const activos = contactos.filter(c => c.recibe_secuencia && !c.secuencia_completada);

  const btnClass = "px-3 py-1.5 text-xs border transition-colors";
  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";
  const toolbarBtnClass = "px-2 py-1 text-[0.72rem] border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-600 hover:text-gray-900 select-none";

  const posiciones = Object.keys(borradores).map(Number);
  const normales = posiciones.filter(p => p >= 0).sort((a, b) => a - b);
  const especiales = posiciones.filter(p => p < 0).sort((a, b) => b - a);
  const faltanEspeciales = [-1, -2].filter(p => !posiciones.includes(p));

  function Row({ c }: { c: NurtureContacto }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-700 truncate">{c.email}</p>
          <p className="text-[0.7rem] text-gray-400">
            Posición {c.posicion_secuencia}
            {c.siguiente_asunto && <> · Siguiente: {c.siguiente_asunto}</>}
            {" · "}Último envío: {fmtDate(c.fecha_ultimo_mail_secuencia)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.secuencia_completada && (
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 bg-green-50 text-green-600">completada</span>
          )}
          {!c.recibe_secuencia && (
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 bg-gray-100 text-gray-500">excluido</span>
          )}
          {c.recibe_secuencia ? (
            <button
              onClick={() => toggleRecibe(c.id, false)}
              disabled={updatingId === c.id}
              className={`${btnClass} border-gray-300 hover:border-gray-500 disabled:opacity-40`}
            >
              Marcar como reservado
            </button>
          ) : (
            <button
              onClick={() => toggleRecibe(c.id, true)}
              disabled={updatingId === c.id}
              className={`${btnClass} border-green-400 text-green-700 hover:bg-green-50 disabled:opacity-40`}
            >
              Reactivar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Función de render, no componente: si fuera un componente declarado aquí
  // dentro, React lo trataría como un tipo nuevo en cada render y remontaría
  // el editor — el textarea perdería el foco a cada tecla.
  function mailCard(posicion: number) {
    const draft = borradores[posicion];
    if (!draft) return null;
    const existe = mails.some(m => m.posicion === posicion);
    const info = describePosicion(posicion);
    const enEspera = posicion >= 0 ? esperando[String(posicion)] ?? 0 : 0;
    const sucio = estaSucio(posicion);
    const isOpen = abierto === posicion;
    const avisoMail = aviso?.posicion === posicion ? aviso : null;

    return (
      <div key={posicion} className="border border-gray-200">
        <button
          onClick={() => setAbierto(isOpen ? null : posicion)}
          className="w-full flex items-start justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm text-gray-800">
              <span className="text-gray-400 mr-2">{info.titulo}</span>
              {draft.asunto?.trim() || <span className="italic text-gray-400">Sin asunto</span>}
            </p>
            <p className="text-[0.7rem] text-gray-400 mt-0.5">
              {info.cuando}
              {enEspera > 0 && <> · {enEspera} esperando este mail</>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sucio && <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-700">sin guardar</span>}
            <span className={`text-[0.65rem] uppercase tracking-wider px-2 py-0.5 ${draft.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
              {draft.activo ? "activo" : "inactivo"}
            </span>
            <span className="text-gray-400 text-[0.75rem]">{isOpen ? "▲" : "▼"}</span>
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
            {avisoMail?.ok && <div className="p-3 bg-green-50 border border-green-200 text-sm text-green-700">✓ {avisoMail.ok}</div>}
            {avisoMail?.error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{avisoMail.error}</div>}

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[240px]">
                <p className="text-[0.72rem] text-gray-500 mb-1">Asunto</p>
                <input
                  type="text"
                  value={draft.asunto ?? ""}
                  onChange={e => setCampo(posicion, { asunto: e.target.value })}
                  placeholder="Asunto del mail"
                  className={inputClass}
                />
              </div>
              <div>
                <p className="text-[0.72rem] text-gray-500 mb-1">Remitente</p>
                <select
                  value={draft.remitente ?? remitentes[0]}
                  onChange={e => setCampo(posicion, { remitente: e.target.value })}
                  className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  {remitentes.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input
                  type="checkbox"
                  checked={draft.activo}
                  onChange={e => setCampo(posicion, { activo: e.target.checked })}
                />
                Activo
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[0.72rem] text-gray-500">Cuerpo</p>
                {/* Los mails antiguos se guardaron como HTML. Se pueden dejar
                    así o pasarlos a texto cuando toque reescribirlos. */}
                <div className="flex border border-gray-300 text-[0.7rem]">
                  {(["texto", "html"] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCampo(posicion, { formato: f })}
                      className={`px-2.5 py-1 ${(draft.formato ?? "html") === f ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-gray-800"}`}
                    >
                      {f === "texto" ? "Texto" : "HTML"}
                    </button>
                  ))}
                </div>
              </div>

              {(draft.formato ?? "html") === "texto" ? (
                <>
                  <input
                    type="text"
                    value={draft.preheader ?? ""}
                    onChange={e => setCampo(posicion, { preheader: e.target.value })}
                    placeholder="Preheader: la frase que asoma en la bandeja (opcional)"
                    className={`${inputClass} mb-2`}
                  />
                  <div className="flex flex-wrap gap-1 mb-1">
                    <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `**${s}**`, "**texto**"); }} title="Negrita"><strong>B</strong></button>
                    <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `_${s}_`, "_texto_"); }} title="Cursiva"><em>I</em></button>
                    <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `[${s}](https://)`, "[texto](https://)"); }} title="Enlace">🔗 enlace</button>
                    <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `[[${s}](https://)]`, "[[Descargar](https://)]"); }} title="Botón con recuadro">▭ botón</button>
                    <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `- ${s}`, "- punto"); }} title="Punto de lista">• lista</button>
                  </div>
                </>
              ) : (
              <div className="flex flex-wrap gap-1 mb-1">
                <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `${P_ABRE}${s}</p>`, `${P_ABRE}Texto</p>`); }} title="Párrafo">¶ párrafo</button>
                <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `<strong>${s}</strong>`, "<strong>texto</strong>"); }} title="Negrita"><strong>B</strong></button>
                <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `<em>${s}</em>`, "<em>texto</em>"); }} title="Cursiva"><em>I</em></button>
                <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `<a href="https://" style="color:#2a9d8f;">${s}</a>`, '<a href="https://" style="color:#2a9d8f;">texto</a>'); }} title="Enlace">🔗 enlace</button>
                <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, s => `${s}<br>`, "<br>"); }} title="Salto de línea">↵ salto</button>
                <button
                  type="button"
                  className={toolbarBtnClass}
                  onMouseDown={e => { e.preventDefault(); convertirAParrafos(posicion); }}
                  title="Convierte el texto seleccionado (o todo, si no hay selección) en párrafos con el estilo de la secuencia"
                >
                  texto → párrafos
                </button>
              </div>
              )}
              {(MARCADORES[secuencia] ?? []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  <span className="text-[0.68rem] text-gray-400 mr-1">Marcadores:</span>
                  {(MARCADORES[secuencia] ?? []).map(m => (
                    <button
                      key={m.clave}
                      type="button"
                      className={toolbarBtnClass}
                      title={m.descripcion}
                      onMouseDown={e => { e.preventDefault(); editarSeleccion(posicion, () => `{{${m.clave}}}`, `{{${m.clave}}}`); }}
                    >
                      {`{{${m.clave}}}`}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                id={`nurture-body-${posicion}`}
                value={draft.cuerpo_html ?? ""}
                onChange={e => setCampo(posicion, { cuerpo_html: e.target.value })}
                rows={14}
                placeholder={(draft.formato ?? "html") === "texto" ? "Escribe aquí.\n\nUn salto de línea deja hueco pequeño.\nUna línea en blanco, hueco grande." : `${P_ABRE}Escribe aquí…</p>`}
                className={`${inputClass} resize-y font-mono text-[0.78rem] leading-relaxed`}
              />
              <p className="text-[0.68rem] text-gray-400 mt-1">
                {(draft.formato ?? "html") === "texto"
                  ? "Salto de línea = hueco pequeño · línea en blanco = hueco grande. La cabecera, el pie y los enlaces de baja e idioma se añaden solos."
                  : "La cabecera, el pie con el contacto y los enlaces de baja e idioma se añaden solos al enviar."}
              </p>
            </div>

            {(draft.cuerpo_html ?? "").trim() && (
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-2">Preview</p>
                <div style={{ fontFamily: "Georgia, serif", color: "#1a1a1a", background: "#fff", padding: "1.5rem", border: "1px solid #eee", maxWidth: 580 }}>
                  <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>
                    {sustituirMarcadores(draft.asunto?.trim() || "—", ejemploDe(secuencia))}
                  </p>
                  <div
                    style={{ fontSize: "0.95rem", lineHeight: 1.9 }}
                    dangerouslySetInnerHTML={{
                      __html: cuerpoDelMail(
                        draft.cuerpo_html,
                        draft.formato,
                        draft.preheader,
                        ejemploDe(secuencia),
                        // Los bloques resueltos por su rama "sí": sin esto, la
                        // vista previa enseñaba los {{#si_ventana}} como si
                        // fueran párrafos del correo.
                        CONDICIONES_DE_MUESTRA
                      ),
                    }}
                  />
                  <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.8rem", color: "#999" }}>
                    <p style={{ margin: "0 0 0.2rem" }}>Alain Zulaika · contacto@alainzulaika.com</p>
                    <p style={{ margin: 0, color: "#ccc" }}>Cambiar idioma · Dejar de recibir estos emails</p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2 items-end">
              <button
                onClick={() => guardar(posicion)}
                disabled={guardando === posicion || !sucio}
                className="px-5 py-2 bg-[#1a1a1a] text-white text-sm disabled:opacity-40"
              >
                {guardando === posicion ? "Guardando..." : "Guardar"}
              </button>
              {sucio && (
                <button onClick={() => descartar(posicion)} className="px-4 py-2 border border-gray-300 text-sm hover:border-gray-500">
                  Descartar cambios
                </button>
              )}
              <div className="flex-1 min-w-[220px]">
                <p className="text-[0.72rem] text-gray-500 mb-1">Enviar prueba a</p>
                <input
                  type="text"
                  value={testEmails}
                  onChange={e => setTestEmails(e.target.value)}
                  placeholder="tuemail@ejemplo.com, otro@ejemplo.com"
                  className={inputClass}
                />
              </div>
              <button
                onClick={() => enviarPrueba(posicion)}
                disabled={enviandoTest === posicion || !testEmails.trim() || !(draft.cuerpo_html ?? "").trim()}
                className="px-4 py-2 border border-[#1a1a1a] text-[#1a1a1a] text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                {enviandoTest === posicion ? "Enviando..." : "Enviar prueba"}
              </button>
              {existe && (
                borrarTarget === posicion ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-[0.72rem] text-[#DC2626]">¿Borrar este mail?</span>
                    <button onClick={() => borrar(posicion)} disabled={guardando === posicion} className="px-3 py-1.5 bg-[#DC2626] text-white text-[0.75rem] disabled:opacity-50">
                      Sí, borrar
                    </button>
                    <button onClick={() => setBorrarTarget(null)} className="px-3 py-1.5 border border-gray-300 text-[0.75rem]">No</button>
                  </div>
                ) : (
                  <button onClick={() => setBorrarTarget(posicion)} className="px-3 py-2 text-[0.75rem] text-[#DC2626] border border-red-200 hover:bg-red-50">
                    Borrar
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-6">
        <div className="flex gap-0 border-b border-gray-200">
          {SUB_TABS.map(t => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`px-4 py-2 text-[0.78rem] border-b-2 transition-colors ${subTab === t ? "border-[#1a1a1a] text-[#1a1a1a]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              {t === "Contactos" ? `Contactos (${activos.length})` : `Mails de la secuencia (${mails.length})`}
            </button>
          ))}
        </div>
      </div>

      {subTab === "Contactos" && (
        <section className="bg-white border border-gray-200 p-5 md:p-6 space-y-8">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-5">
              En secuencia ({activos.length})
            </p>
            {loading ? (
              <p className="text-sm text-gray-400 italic">Cargando...</p>
            ) : activos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nadie en secuencia todavía.</p>
            ) : (
              <div>{activos.map(c => <Row key={c.id} c={c} />)}</div>
            )}
          </div>

          {excluidos.length > 0 && (
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-5">
                Excluidos / reservados ({excluidos.length})
              </p>
              <div>{excluidos.map(c => <Row key={c.id} c={c} />)}</div>
            </div>
          )}

          {completados.length > 0 && (
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-5">
                Secuencia completada ({completados.length})
              </p>
              <div>{completados.map(c => <Row key={c.id} c={c} />)}</div>
            </div>
          )}
        </section>
      )}

      {subTab === "Mails" && (
        <section className="bg-white border border-gray-200 p-5 md:p-6 space-y-8">
          {/* Todas las secuencias automáticas viven en la misma tabla; aquí
              se elige cuál se está editando. Las bilingües traen además el
              selector de idioma, porque cada idioma es una fila distinta. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex border border-gray-300 text-[0.75rem]">
              {SECUENCIAS.map(sq => (
                <button
                  key={sq}
                  type="button"
                  onClick={() => { setSecuencia(sq); setIdiomaEdicion("es"); }}
                  className={`px-3 py-1.5 ${secuencia === sq ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-gray-800"}`}
                >
                  {SECUENCIA_ETIQUETA[sq]}
                </button>
              ))}
            </div>
            {bilingue && (
              <div className="flex border border-gray-300 text-[0.75rem]">
                {(["es", "eu"] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setIdiomaEdicion(l)}
                    className={`px-3 py-1.5 ${idiomaEdicion === l ? "bg-[#D4860A] text-white" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {l === "es" ? "Castellano" : "Euskera"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a]">
                {secuencia === "nurture" ? "Secuencia de leads de Meta Ads" : SECUENCIA_ETIQUETA[secuencia]}
              </p>
              {secuencia === "nurture" && (
                <button onClick={nuevoMail} className="px-3 py-1.5 text-xs border border-gray-300 hover:border-gray-500">
                  + Añadir mail al final
                </button>
              )}
            </div>
            <p className="text-[0.72rem] text-gray-500 mb-5">
              Los cambios afectan solo a los mails que aún no se han enviado. Un mail inactivo o vacío detiene la
              secuencia: quien esté en esa posición se queda parado ahí hasta que lo actives.
            </p>

            {loadingMails ? (
              <p className="text-sm text-gray-400 italic">Cargando...</p>
            ) : normales.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aún no hay mails en la secuencia.</p>
            ) : (
              <div className="space-y-2">
                {normales.map(p => mailCard(p))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-2">Mails puntuales</p>
            <p className="text-[0.72rem] text-gray-500 mb-5">
              No forman parte de la progresión: cada uno se dispara por su propia regla.
            </p>
            {especiales.length > 0 && (
              <div className="space-y-2">
                {especiales.map(p => mailCard(p))}
              </div>
            )}
            {faltanEspeciales.length > 0 && !loadingMails && (
              <div className="flex flex-wrap gap-2 mt-3">
                {faltanEspeciales.map(p => (
                  <button key={p} onClick={() => crearEspecial(p)} className="px-3 py-1.5 text-xs border border-gray-300 hover:border-gray-500">
                    + Crear &quot;{ESPECIALES[p].titulo}&quot;
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
