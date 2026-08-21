"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Contacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string;
  fecha_alta: string;
  origen: string;
  unsubscribed: boolean;
  tags: string[] | null;
}

interface Campana {
  id: string;
  subject_eu: string | null;
  body_eu: string | null;
  preheader_eu: string | null;
  subject_es: string | null;
  body_es: string | null;
  preheader_es: string | null;
  programado_para: string | null;
  estado: string;
  enviado_en: string | null;
  enviados_eu: number | null;
  enviados_es: number | null;
  excluidos: string[] | null;
  remitente: string | null;
  orden_cola: number | null;
}

interface SendResult {
  ok?: boolean;
  enviados?: number;
  eu?: number;
  es?: number;
  error?: string;
}

const TABS = ["Nuevo email", "Programadas", "Cola B", "Suscriptores"] as const;
type Tab = (typeof TABS)[number];

const REMITENTES = ["newsletter@alainzulaika.com"] as const;

export default function NewsletterTab() {
  const [tab, setTab] = useState<Tab>("Nuevo email");

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [campanas, setCampanas] = useState<Campana[]>([]);

  // Compose state
  const [subjectEu, setSubjectEu] = useState("");
  const [preheaderEu, setPreheaderEu] = useState("");
  const [bodyEu, setBodyEu] = useState("");
  const [subjectEs, setSubjectEs] = useState("");
  const [preheaderEs, setPreheaderEs] = useState("");
  const [bodyEs, setBodyEs] = useState("");
  const [remitente, setRemitente] = useState<string>(REMITENTES[0]);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // Test send state
  const [testEmails, setTestEmails] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string; count?: number } | null>(null);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  // Cola B state
  const [addingCola, setAddingCola] = useState(false);
  const [colaResult, setColaResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [reordering, setReordering] = useState(false);

  // Add contact state
  const [newEmail, setNewEmail] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newIdioma, setNewIdioma] = useState("es");
  const [newOrigen, setNewOrigen] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [addContactResult, setAddContactResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeImgTarget, setActiveImgTarget] = useState<{ id: string; setValue: (v: string) => void; getValue: () => string } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [activePdfTarget, setActivePdfTarget] = useState<{ id: string; setValue: (v: string) => void; getValue: () => string; selStart: number; selEnd: number } | null>(null);
  const [pdfError, setPdfError] = useState<{ id: string; message: string } | null>(null);

  // Edit campaign state
  const [editing, setEditing] = useState<Campana | null>(null);
  const [editSubjectEu, setEditSubjectEu] = useState("");
  const [editPreheaderEu, setEditPreheaderEu] = useState("");
  const [editBodyEu, setEditBodyEu] = useState("");
  const [editSubjectEs, setEditSubjectEs] = useState("");
  const [editPreheaderEs, setEditPreheaderEs] = useState("");
  const [editBodyEs, setEditBodyEs] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editExcluidos, setEditExcluidos] = useState<string[]>([]);
  const [editExcludeInput, setEditExcludeInput] = useState("");
  const [editRemitente, setEditRemitente] = useState<string>(REMITENTES[0]);
  const [saving, setSaving] = useState(false);

  // Cancel confirmation state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelInput, setCancelInput] = useState("");

  // Error de las acciones sobre una campaña ya guardada (mover, reordenar,
  // editar, cancelar). Sin esto un fallo del servidor no se ve: el botón
  // simplemente no hace nada.
  const [accionError, setAccionError] = useState<string | null>(null);

  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-password": pw(),
  }), [pw]);

  const DRAFT_KEY = "nl_draft";

  useEffect(() => {
    loadAll();
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.subjectEu) setSubjectEu(d.subjectEu);
        if (d.preheaderEu) setPreheaderEu(d.preheaderEu);
        if (d.bodyEu) setBodyEu(d.bodyEu);
        if (d.subjectEs) setSubjectEs(d.subjectEs);
        if (d.preheaderEs) setPreheaderEs(d.preheaderEs);
        if (d.bodyEs) setBodyEs(d.bodyEs);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!subjectEu && !bodyEu && !subjectEs && !bodyEs) {
      localStorage.removeItem(DRAFT_KEY);
    } else {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ subjectEu, preheaderEu, bodyEu, subjectEs, preheaderEs, bodyEs }));
    }
  }, [subjectEu, preheaderEu, bodyEu, subjectEs, preheaderEs, bodyEs]);

  async function loadAll() {
    const [c, camp] = await Promise.all([
      fetch("/api/newsletter", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } }).then(r => r.json()),
      fetch("/api/newsletter/campanas", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } }).then(r => r.json()),
    ]);
    if (Array.isArray(c)) setContactos(c);
    if (Array.isArray(camp)) setCampanas(camp);
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/newsletter/send", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs, remitente }),
    });
    const data = await res.json();
    setSendResult(data);
    setSending(false);
    setConfirm(false);
    if (data.ok) { setSubjectEu(""); setPreheaderEu(""); setBodyEu(""); setSubjectEs(""); setPreheaderEs(""); setBodyEs(""); localStorage.removeItem(DRAFT_KEY); }
  }

  async function handleSendTest() {
    const list = testEmails.split(",").map(e => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setSendingTest(true);
    setTestResult(null);
    const res = await fetch("/api/newsletter/send", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs, test_emails: list, remitente }),
    });
    const data = await res.json();
    setSendingTest(false);
    if (data.ok) setTestResult({ ok: true, count: list.length });
    else setTestResult({ error: data.error || "Error al enviar la prueba." });
  }

  function limpiarFormulario() {
    setSubjectEu(""); setPreheaderEu(""); setBodyEu(""); setSubjectEs(""); setPreheaderEs(""); setBodyEs("");
    localStorage.removeItem(DRAFT_KEY);
  }

  async function handleSchedule() {
    if (!scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setScheduleResult(null);
    setColaResult(null);
    const programado_para = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const res = await fetch("/api/newsletter/campanas", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs, programado_para, remitente }),
    });
    const data = await res.json();
    if (data.id) {
      setScheduleResult({ ok: true });
      limpiarFormulario();
      setScheduleDate(""); setScheduleTime("");
      setCampanas(prev => [...prev, data]);
    } else {
      setScheduleResult({ error: data.error || "Error al programar." });
    }
    setScheduling(false);
  }

  // Guarda el borrador al final de la cola B: sin fecha, a la espera de un día
  // en el que no haya nada programado.
  async function handleAddToCola() {
    setAddingCola(true);
    setColaResult(null);
    setScheduleResult(null);
    const res = await fetch("/api/newsletter/campanas", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs, remitente, en_cola: true }),
    });
    const data = await res.json();
    if (data.id) {
      setColaResult({ ok: true });
      limpiarFormulario();
      setCampanas(prev => [...prev, data]);
    } else {
      setColaResult({ error: data.error || "Error al guardar en la cola." });
    }
    setAddingCola(false);
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAddingContact(true);
    setAddContactResult(null);
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: newEmail.trim(), nombre: newNombre.trim() || null, idioma: newIdioma, origen: newOrigen.trim() || "manual" }),
    });
    const data = await res.json();
    if (data.ok) {
      setAddContactResult({ ok: true });
      if (data.contacto) setContactos(prev => [data.contacto, ...prev]);
      setNewEmail(""); setNewNombre(""); setNewIdioma("es"); setNewOrigen("");
    } else {
      setAddContactResult({ error: data.error || "Error al añadir." });
    }
    setAddingContact(false);
  }

  function handleCancel(id: string) {
    setCancelTarget(id);
    setCancelInput("");
  }

  async function handleCancelConfirm() {
    if (!cancelTarget || cancelInput !== "CANCELAR") return;
    setAccionError(null);
    const res = await fetch("/api/newsletter/campanas", {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ id: cancelTarget }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAccionError(data.error || `Error ${res.status} al cancelar.`);
      return;
    }
    setCampanas(prev => prev.map(c => c.id === cancelTarget ? { ...c, estado: "cancelado" } : c));
    setCancelTarget(null);
    setCancelInput("");
  }

  function startEdit(c: Campana) {
    setEditing(c);
    setEditSubjectEu(c.subject_eu ?? "");
    setEditPreheaderEu(c.preheader_eu ?? "");
    setEditBodyEu(c.body_eu ?? "");
    setEditSubjectEs(c.subject_es ?? "");
    setEditPreheaderEs(c.preheader_es ?? "");
    setEditBodyEs(c.body_es ?? "");
    const pad = (n: number) => String(n).padStart(2, "0");
    if (c.programado_para) {
      const d = new Date(c.programado_para);
      setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setEditTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      // En la cola B no hay fecha: los campos quedan vacíos hasta que se decida
      // sacarla de la cola y programarla.
      setEditDate("");
      setEditTime("");
    }
    setEditExcluidos(c.excluidos ?? []);
    setEditExcludeInput("");
    setEditRemitente(c.remitente ?? REMITENTES[0]);
  }

  function edicionActual() {
    return {
      subject_eu: editSubjectEu, body_eu: editBodyEu, preheader_eu: editPreheaderEu,
      subject_es: editSubjectEs, body_es: editBodyEs, preheader_es: editPreheaderEs,
      excluidos: editExcluidos, remitente: editRemitente,
    };
  }

  // Devuelve true solo si el servidor confirma el cambio. Si falla, deja el
  // motivo a la vista en lugar de que el botón parezca no responder.
  async function patchCampana(payload: Record<string, unknown>): Promise<boolean> {
    setAccionError(null);
    const res = await fetch("/api/newsletter/campanas", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    setAccionError(data.error || `Error ${res.status} al guardar el cambio.`);
    return false;
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const esCola = editing.estado === "cola";
    // En la cola no se toca la fecha: el PATCH sin programado_para ni en_cola
    // deja la campaña donde está y solo actualiza el contenido.
    const programado_para = esCola ? null : new Date(`${editDate}T${editTime}`).toISOString();
    const cambios = { ...edicionActual(), ...(esCola ? {} : { programado_para }) };
    const ok = await patchCampana({ id: editing.id, ...cambios });
    if (ok) {
      setCampanas(prev => prev.map(c => c.id === editing.id ? { ...c, ...cambios } : c));
      setEditing(null);
    }
    setSaving(false);
  }

  // Cola B → calendario: le pone fecha y la saca de la cola.
  async function handleProgramarDesdeCola() {
    if (!editing || !editDate || !editTime) return;
    setSaving(true);
    const programado_para = new Date(`${editDate}T${editTime}`).toISOString();
    const ok = await patchCampana({ id: editing.id, ...edicionActual(), programado_para });
    if (ok) {
      setCampanas(prev => prev.map(c => c.id === editing.id
        ? { ...c, ...edicionActual(), programado_para, estado: "programado", orden_cola: null }
        : c
      ));
      setEditing(null);
      setTab("Programadas");
    }
    setSaving(false);
  }

  // Calendario → cola B: le quita la fecha y la manda al final de la cola.
  async function handleMandarACola(c: Campana) {
    const ok = await patchCampana({
      id: c.id,
      subject_eu: c.subject_eu, body_eu: c.body_eu, preheader_eu: c.preheader_eu,
      subject_es: c.subject_es, body_es: c.body_es, preheader_es: c.preheader_es,
      excluidos: c.excluidos, remitente: c.remitente, en_cola: true,
    });
    if (!ok) return;
    if (editing?.id === c.id) setEditing(null);
    await loadAll();
    setTab("Cola B");
  }

  // Sube o baja un mail dentro de la cola (dir: -1 arriba, +1 abajo).
  async function handleMoveCola(id: string, dir: -1 | 1) {
    const ordenada = [...cola];
    const i = ordenada.findIndex(c => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordenada.length) return;
    [ordenada[i], ordenada[j]] = [ordenada[j], ordenada[i]];

    const posiciones = new Map(ordenada.map((c, idx) => [c.id, idx + 1]));
    setCampanas(prev => prev.map(c => posiciones.has(c.id) ? { ...c, orden_cola: posiciones.get(c.id)! } : c));

    setReordering(true);
    setAccionError(null);
    const res = await fetch("/api/newsletter/campanas/orden", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ids: ordenada.map(c => c.id) }),
    });
    setReordering(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAccionError(data.error || `Error ${res.status} al reordenar.`);
      await loadAll(); // si falla, se recupera el orden real
    }
  }

  const activos = contactos.filter(c => !c.unsubscribed);
  const bajas = contactos.filter(c => c.unsubscribed);
  const activosEu = activos.filter(c => c.idioma === "eu");
  const activosEs = activos.filter(c => c.idioma !== "eu");
  const hasEu = !!(subjectEu.trim() && bodyEu.trim());
  const hasEs = !!(subjectEs.trim() && bodyEs.trim());
  const canSend = hasEu || hasEs;
  const pendientes = campanas
    .filter(c => c.estado === "programado")
    .sort((a, b) => (a.programado_para ?? "").localeCompare(b.programado_para ?? ""));
  const enviadas = campanas
    .filter(c => c.estado === "enviado")
    .sort((a, b) => (b.enviado_en ?? "").localeCompare(a.enviado_en ?? ""));
  const cola = campanas
    .filter(c => c.estado === "cola")
    .sort((a, b) => (a.orden_cola ?? 0) - (b.orden_cola ?? 0));

  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  function applyFormat(id: string, syntax: string, setValue: (v: string) => void, getValue: () => string) {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = getValue();
    const selected = val.slice(start, end);
    const wrapped = selected ? `${syntax}${selected}${syntax}` : `${syntax}texto${syntax}`;
    const newVal = val.slice(0, start) + wrapped + val.slice(end);
    setValue(newVal);
    // Restore cursor
    requestAnimationFrame(() => {
      el.focus();
      const newEnd = start + wrapped.length;
      el.setSelectionRange(selected ? start : start + syntax.length, selected ? newEnd : newEnd - syntax.length);
    });
  }

  function applyLink(id: string, setValue: (v: string) => void, getValue: () => string) {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = getValue();
    const selected = val.slice(start, end) || "texto";
    const wrapped = `[${selected}](https://)`;
    const newVal = val.slice(0, start) + wrapped + val.slice(end);
    setValue(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const urlStart = start + selected.length + 3;
      el.setSelectionRange(urlStart, urlStart + 8);
    });
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeImgTarget) return;
    e.target.value = "";
    setUploadingImg(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/newsletter/upload", { method: "POST", headers: { "x-admin-password": pw() }, body: form });
    const data = await res.json();
    setUploadingImg(false);
    if (!data.url) return;
    const { id, setValue, getValue } = activeImgTarget;
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    const pos = el?.selectionStart ?? getValue().length;
    const val = getValue();
    const inserted = `![](${data.url})`;
    setValue(val.slice(0, pos) + inserted + val.slice(pos));
  }

  const MAX_PDF_BYTES = 4 * 1024 * 1024;

  async function handlePdfFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = activePdfTarget;
    if (!file || !target) return;
    e.target.value = "";
    setPdfError(null);
    if (file.size > MAX_PDF_BYTES) {
      setPdfError({ id: target.id, message: `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB — el máximo es 4 MB (límite del servidor). Comprímelo e inténtalo de nuevo.` });
      return;
    }
    setUploadingPdf(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/newsletter/upload", { method: "POST", headers: { "x-admin-password": pw() }, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setPdfError({ id: target.id, message: data.error || `Error al subir el PDF (${res.status}).` });
        return;
      }
      const { setValue, getValue, selStart, selEnd } = target;
      const val = getValue();
      const selected = val.slice(selStart, selEnd) || file.name.replace(/\.pdf$/i, "");
      const inserted = `[${selected}](${data.url})`;
      setValue(val.slice(0, selStart) + inserted + val.slice(selEnd));
    } catch {
      setPdfError({ id: target.id, message: "Error de red al subir el PDF. Inténtalo de nuevo." });
    } finally {
      setUploadingPdf(false);
    }
  }

  function applyImage(id: string, setValue: (v: string) => void, getValue: () => string) {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const val = getValue();
    const inserted = `![](https://)`;
    const newVal = val.slice(0, start) + inserted + val.slice(start);
    setValue(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 4, start + 12);
    });
  }

  const IMG_PREVIEW_RE = /^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/;

  function processPreview(text: string) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
      .replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, '<a href="$2" style="color:#2ED3E6;text-decoration:underline;">$1</a>');
  }

  function renderPreviewLine(line: string, i: number) {
    const t = line.trim();
    if (!t) return <p key={i} style={{ margin: "0 0 0.8rem" }}>&nbsp;</p>;
    const img = t.match(IMG_PREVIEW_RE);
    if (img) return <img key={i} src={img[2]} alt={img[1]} style={{ maxWidth: "100%", height: "auto", display: "block", margin: "1.2rem 0" }} />;
    return <p key={i} style={{ margin: "0 0 1.2rem" }} dangerouslySetInnerHTML={{ __html: processPreview(t) }} />;
  }

  const toolbarBtnClass = "px-2 py-1 text-[0.72rem] border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-600 hover:text-gray-900 select-none";

  function Toolbar({ id, setValue, getValue }: { id: string; setValue: (v: string) => void; getValue: () => string }) {
    return (
      <div className="mb-1">
        <div className="flex gap-1">
          <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); applyFormat(id, "**", setValue, getValue); }} title="Negrita"><strong>B</strong></button>
          <button type="button" className={toolbarBtnClass} onMouseDown={e => { e.preventDefault(); applyFormat(id, "_", setValue, getValue); }} title="Cursiva"><em>I</em></button>
          <button type="button" className={`${toolbarBtnClass} text-[0.65rem]`} onMouseDown={e => { e.preventDefault(); applyLink(id, setValue, getValue); }} title="Enlace">🔗 enlace</button>
          <button type="button" className={`${toolbarBtnClass} text-[0.65rem]`} onMouseDown={e => { e.preventDefault(); applyImage(id, setValue, getValue); }} title="URL imagen">🖼 url</button>
          <button
            type="button"
            className={`${toolbarBtnClass} text-[0.65rem]`}
            disabled={uploadingImg}
            onMouseDown={e => {
              e.preventDefault();
              setActiveImgTarget({ id, setValue, getValue });
              fileInputRef.current?.click();
            }}
            title="Subir imagen desde ordenador"
          >
            {uploadingImg ? "subiendo…" : "🖼 subir"}
          </button>
          <button
            type="button"
            className={`${toolbarBtnClass} text-[0.65rem]`}
            disabled={uploadingPdf}
            onMouseDown={e => {
              e.preventDefault();
              setPdfError(null);
              const el = document.getElementById(id) as HTMLTextAreaElement | null;
              setActivePdfTarget({ id, setValue, getValue, selStart: el?.selectionStart ?? getValue().length, selEnd: el?.selectionEnd ?? getValue().length });
              pdfInputRef.current?.click();
            }}
            title="Adjuntar PDF (se enlaza al texto seleccionado)"
          >
            {uploadingPdf ? "subiendo…" : "📎 PDF"}
          </button>
        </div>
        {pdfError?.id === id && (
          <p className="text-[0.7rem] text-[#DC2626] mt-1">{pdfError.message}</p>
        )}
      </div>
    );
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // Editor compartido por las campañas programadas y las de la cola B. En la
  // cola no hay fecha que editar: la fecha aparece abajo, como forma de sacar
  // ese mail de la cola y ponerlo en el calendario.
  function renderEditor(c: Campana) {
    const esCola = c.estado === "cola";
    return (
      <div className="border border-gray-300 p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[0.72rem] uppercase tracking-wider text-gray-400">Euskera</p>
            <input type="text" value={editSubjectEu} onChange={e => setEditSubjectEu(e.target.value)} placeholder="Gaia" className={inputClass} />
            <input type="text" value={editPreheaderEu} onChange={e => setEditPreheaderEu(e.target.value)} placeholder="Preview (opcional)" className={inputClass} />
            <Toolbar id="edit-body-eu" setValue={setEditBodyEu} getValue={() => editBodyEu} />
            <textarea id="edit-body-eu" value={editBodyEu} onChange={e => setEditBodyEu(e.target.value)} rows={6} className={`${inputClass} resize-none`} />
          </div>
          <div className="space-y-2">
            <p className="text-[0.72rem] uppercase tracking-wider text-gray-400">Castellano</p>
            <input type="text" value={editSubjectEs} onChange={e => setEditSubjectEs(e.target.value)} placeholder="Asunto" className={inputClass} />
            <input type="text" value={editPreheaderEs} onChange={e => setEditPreheaderEs(e.target.value)} placeholder="Preview (opcional)" className={inputClass} />
            <Toolbar id="edit-body-es" setValue={setEditBodyEs} getValue={() => editBodyEs} />
            <textarea id="edit-body-es" value={editBodyEs} onChange={e => setEditBodyEs(e.target.value)} rows={6} className={`${inputClass} resize-none`} />
          </div>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <p className="text-[0.72rem] text-gray-500 mb-1">Remitente</p>
            <select value={editRemitente} onChange={e => setEditRemitente(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none">
              {REMITENTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {!esCola && (
            <>
              <div>
                <p className="text-[0.72rem] text-gray-500 mb-1">Fecha</p>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <p className="text-[0.72rem] text-gray-500 mb-1">Hora</p>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
              </div>
            </>
          )}
          <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 text-sm">
            Cancelar
          </button>
        </div>

        {esCola ? (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[0.72rem] uppercase tracking-wider text-gray-400 mb-2">Sacar de la cola y programar</p>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <p className="text-[0.72rem] text-gray-500 mb-1">Fecha</p>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <p className="text-[0.72rem] text-gray-500 mb-1">Hora</p>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
              </div>
              <button
                onClick={handleProgramarDesdeCola}
                disabled={saving || !editDate || !editTime}
                className="px-4 py-2 border border-[#1a1a1a] text-[#1a1a1a] text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Programar para esta fecha
              </button>
            </div>
            <p className="text-[0.7rem] text-gray-400 mt-1.5">Guarda los cambios y lo mueve a &quot;Programadas&quot;.</p>
          </div>
        ) : (
          <div className="border-t border-gray-100 pt-4">
            <button onClick={() => handleMandarACola({ ...c, ...edicionActual() })} className="text-[0.75rem] text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5">
              ↓ Quitar la fecha y mandarlo a la cola B
            </button>
            <p className="text-[0.7rem] text-gray-400 mt-1.5">Guarda los cambios y lo manda al final de la cola, sin fecha.</p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-[0.72rem] uppercase tracking-wider text-gray-400">Excluir de este envío</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={editExcludeInput}
              onChange={e => setEditExcludeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = editExcludeInput.trim().toLowerCase();
                  if (v && !editExcluidos.includes(v)) setEditExcluidos(prev => [...prev, v]);
                  setEditExcludeInput("");
                }
              }}
              placeholder="email@ejemplo.com"
              className="border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-500 w-56"
            />
            <button
              type="button"
              onClick={() => {
                const v = editExcludeInput.trim().toLowerCase();
                if (v && !editExcluidos.includes(v)) setEditExcluidos(prev => [...prev, v]);
                setEditExcludeInput("");
              }}
              className="px-3 py-1.5 border border-gray-300 text-sm hover:border-gray-500"
            >
              Excluir
            </button>
          </div>
          {editExcluidos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {editExcluidos.map(email => (
                <span key={email} className="flex items-center gap-1 bg-gray-100 text-gray-600 text-[0.72rem] px-2 py-0.5">
                  {email}
                  <button onClick={() => setEditExcluidos(prev => prev.filter(e => e !== email))} className="text-gray-400 hover:text-gray-700 ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[0.75rem] text-gray-500">
          {activos.length} activos ({activosEu.length} eu · {activosEs.length} es) · {bajas.length} bajas
          {pendientes.length > 0 && <> · <span className="text-amber-600">{pendientes.length} programada{pendientes.length > 1 ? "s" : ""}</span></>}
          {cola.length > 0 && <> · <span className="text-teal-600">{cola.length} en cola B</span></>}
        </span>
      </div>

      {/* Tabs internas */}
      <div className="mb-6">
        <div className="flex gap-0 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[0.78rem] border-b-2 transition-colors ${tab === t ? "border-[#1a1a1a] text-[#1a1a1a]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              {t}
              {t === "Programadas" && pendientes.length > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-[0.65rem] px-1.5 py-0.5 rounded-full">{pendientes.length}</span>
              )}
              {t === "Cola B" && (
                <span className={`ml-1.5 text-[0.65rem] px-1.5 py-0.5 rounded-full ${cola.length > 0 ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-600"}`}>{cola.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">

        {/* ── TAB: NUEVO EMAIL ── */}
        {tab === "Nuevo email" && (
          <>
            <section className="bg-white border border-gray-200 p-5 md:p-6">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-6">Redactar</p>

              {sendResult?.ok && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-sm text-green-700">
                  ✓ Enviado a {sendResult.enviados} suscriptores ({sendResult.eu} eu · {sendResult.es} es).
                </div>
              )}
              {sendResult?.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">Error: {sendResult.error}</div>
              )}
              {scheduleResult?.ok && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-sm text-blue-700">
                  ✓ Campaña programada. Aparece en la pestaña &quot;Programadas&quot;.
                </div>
              )}
              {scheduleResult?.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{scheduleResult.error}</div>
              )}
              {colaResult?.ok && (
                <div className="mb-6 p-4 bg-teal-50 border border-teal-200 text-sm text-teal-700">
                  ✓ Guardado al final de la cola B ({cola.length} en cola).
                </div>
              )}
              {colaResult?.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{colaResult.error}</div>
              )}

              <div className="mb-6">
                <p className="text-[0.75rem] text-gray-500 mb-1">Remitente</p>
                <select value={remitente} onChange={e => setRemitente(e.target.value)} className={`${inputClass} w-auto`}>
                  {REMITENTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Euskera */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[0.75rem] font-semibold uppercase tracking-wider">Euskera</p>
                    <span className="text-[0.7rem] text-gray-400">{activosEu.length} sub.</span>
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Asunto</p>
                    <input type="text" value={subjectEu} onChange={e => setSubjectEu(e.target.value)} placeholder="Gaia..." className={inputClass} />
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Preview <span className="text-gray-400">(opcional)</span></p>
                    <input type="text" value={preheaderEu} onChange={e => setPreheaderEu(e.target.value)} placeholder="Testua posta-zerrendan ikusi aurretik..." className={inputClass} />
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Mezua</p>
                    <Toolbar id="body-eu" setValue={setBodyEu} getValue={() => bodyEu} />
                    <textarea id="body-eu" value={bodyEu} onChange={e => setBodyEu(e.target.value)} rows={12} placeholder="Idatzi hemen..." className={`${inputClass} resize-none`} />
                  </div>
                </div>
                {/* Castellano */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[0.75rem] font-semibold uppercase tracking-wider">Castellano</p>
                    <span className="text-[0.7rem] text-gray-400">{activosEs.length} sub.</span>
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Asunto</p>
                    <input type="text" value={subjectEs} onChange={e => setSubjectEs(e.target.value)} placeholder="Asunto..." className={inputClass} />
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Preview <span className="text-gray-400">(opcional)</span></p>
                    <input type="text" value={preheaderEs} onChange={e => setPreheaderEs(e.target.value)} placeholder="Texto visible antes de abrir el email..." className={inputClass} />
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-gray-500 mb-1">Cuerpo</p>
                    <Toolbar id="body-es" setValue={setBodyEs} getValue={() => bodyEs} />
                    <textarea id="body-es" value={bodyEs} onChange={e => setBodyEs(e.target.value)} rows={12} placeholder="Escribe aquí..." className={`${inputClass} resize-none`} />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {(subjectEu || bodyEu || subjectEs || bodyEs) && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-4">Preview</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {(subjectEu || bodyEu) && (
                      <div style={{ fontFamily: "Georgia, serif", color: "#1a1a1a", background: "#fff", padding: "1.5rem", border: "1px solid #eee" }}>
                        {preheaderEu && <p style={{ fontSize: "0.72rem", color: "#aaa", marginBottom: "0.75rem", fontStyle: "italic" }}>↳ {preheaderEu}</p>}
                        <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>{subjectEu || "—"}</p>
                        <div style={{ fontSize: "0.95rem", lineHeight: 1.9 }}>
                          {bodyEu.split(/\n/).map((line, i) => renderPreviewLine(line, i))}
                        </div>
                        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.8rem", color: "#999" }}>
                          <p style={{ margin: "0 0 0.2rem" }}>Alain Zulaika · kontaktu@alainzulaika.com</p>
                          <p style={{ margin: 0, color: "#ccc" }}>Cambiar idioma · Dejar de recibir estos emails</p>
                        </div>
                      </div>
                    )}
                    {(subjectEs || bodyEs) && (
                      <div style={{ fontFamily: "Georgia, serif", color: "#1a1a1a", background: "#fff", padding: "1.5rem", border: "1px solid #eee" }}>
                        {preheaderEs && <p style={{ fontSize: "0.72rem", color: "#aaa", marginBottom: "0.75rem", fontStyle: "italic" }}>↳ {preheaderEs}</p>}
                        <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>{subjectEs || "—"}</p>
                        <div style={{ fontSize: "0.95rem", lineHeight: 1.9 }}>
                          {bodyEs.split(/\n/).map((line, i) => renderPreviewLine(line, i)
                          )}
                        </div>
                        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.8rem", color: "#999" }}>
                          <p style={{ margin: "0 0 0.2rem" }}>Alain Zulaika · contacto@alainzulaika.com</p>
                          <p style={{ margin: 0, color: "#ccc" }}>Cambiar idioma · Dejar de recibir estos emails</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Test send */}
              <div className="mt-6 border-t border-gray-100 pt-5">
                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-3">Enviar prueba</p>
                {testResult?.ok && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 text-sm text-green-700">
                    ✓ Prueba enviada a {testResult.count} destinatario{testResult.count === 1 ? "" : "s"}.
                  </div>
                )}
                {testResult?.error && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{testResult.error}</div>
                )}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <input
                      type="text"
                      value={testEmails}
                      onChange={e => setTestEmails(e.target.value)}
                      placeholder="tuemail@ejemplo.com, otro@ejemplo.com"
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={handleSendTest}
                    disabled={!canSend || !testEmails.trim() || sendingTest}
                    className="px-5 py-2 border border-[#1a1a1a] text-[#1a1a1a] text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {sendingTest ? "Enviando..." : "Enviar prueba"}
                  </button>
                </div>
                <p className="text-[0.7rem] text-gray-400 mt-1.5">
                  Envía el asunto &quot;[PRUEBA] ...&quot; con el contenido tal cual a estas direcciones, sin tocar a los suscriptores. Si hay versión eu y es, llegan las dos.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-3">
                {/* Schedule */}
                <div className="flex gap-2 items-end">
                  <div>
                    <p className="text-[0.72rem] text-gray-500 mb-1">Fecha</p>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" />
                  </div>
                  <div>
                    <p className="text-[0.72rem] text-gray-500 mb-1">Hora</p>
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" />
                  </div>
                  <button
                    onClick={handleSchedule}
                    disabled={!canSend || !scheduleDate || !scheduleTime || scheduling}
                    className="px-5 py-2 border border-[#1a1a1a] text-[#1a1a1a] text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    {scheduling ? "Programando..." : "Programar envío"}
                  </button>
                </div>

                {/* Cola B */}
                <div>
                  <button
                    onClick={handleAddToCola}
                    disabled={!canSend || addingCola}
                    className="px-5 py-2 border border-teal-600 text-teal-700 text-sm disabled:opacity-40 hover:bg-teal-50 transition-colors"
                  >
                    {addingCola ? "Guardando..." : "Guardar en la cola B (sin fecha) →"}
                  </button>
                  <p className="text-[0.7rem] text-gray-400 mt-1.5">
                    Se queda esperando al final de la cola. Si algún día no hay nada programado ni enviado, a las 19:15 sale el primero de la cola.
                  </p>
                </div>

                {/* Send now */}
                {!confirm ? (
                  <button onClick={() => setConfirm(true)} disabled={!canSend} className="w-full bg-[#1a1a1a] text-white py-3 text-sm disabled:opacity-40 hover:bg-[#333] transition-colors">
                    Enviar ahora a {activos.length}{hasEu && hasEs ? ` (${activosEu.length} eu · ${activosEs.length} es)` : hasEu ? " (versión euskera)" : " (versión castellano)"} →
                  </button>
                ) : (
                  <div className="border border-[#DC2626] p-4 space-y-3">
                    <p className="text-sm font-medium text-[#DC2626]">
                      ¿Confirmas el envío a {activos.length} suscriptores?{hasEu && hasEs ? ` (${activosEu.length} eu · ${activosEs.length} es)` : hasEu ? " (versión euskera a todos)" : " (versión castellano a todos)"}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={handleSend} disabled={sending} className="px-5 py-2 bg-[#DC2626] text-white text-sm disabled:opacity-50">
                        {sending ? "Enviando..." : "Sí, enviar"}
                      </button>
                      <button onClick={() => setConfirm(false)} className="px-5 py-2 border border-gray-300 text-sm hover:border-gray-500">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── TAB: PROGRAMADAS ── */}
        {tab === "Programadas" && (
          <section className="bg-white border border-gray-200 p-5 md:p-6 space-y-8">
            {accionError && (
              <div className="p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{accionError}</div>
            )}
            {/* Pending */}
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-5">
                Pendientes ({pendientes.length})
              </p>
              {pendientes.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin campañas programadas.</p>
              ) : (
                <div className="space-y-4">
                  {pendientes.map(c => (
                    <div key={c.id}>
                      {editing?.id === c.id ? (
                        renderEditor(c)
                      ) : (
                        <div className="border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {[c.subject_eu, c.subject_es].filter(Boolean).join(" / ") || "Sin asunto"}
                              </p>
                              <p className="text-[0.75rem] text-gray-400 mt-0.5">{fmtDate(c.programado_para)}</p>
                              <p className="text-[0.7rem] text-gray-400 mt-0.5">
                                {[c.subject_eu && "eu", c.subject_es && "es"].filter(Boolean).join(" + ")} · {c.remitente ?? REMITENTES[0]}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => startEdit(c)} className="text-[0.75rem] text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5">
                                Editar
                              </button>
                              <button onClick={() => handleMandarACola(c)} title="Quitarle la fecha y mandarlo al final de la cola B" className="text-[0.75rem] text-teal-700 hover:text-teal-900 border border-teal-200 px-3 py-1.5">
                                → Cola B
                              </button>
                              <button onClick={() => handleCancel(c.id)} className="text-[0.75rem] text-[#DC2626] hover:text-red-700 border border-red-200 px-3 py-1.5">
                                Cancelar
                              </button>
                            </div>
                          </div>
                          {cancelTarget === c.id && (
                            <div className="mt-3 pt-3 border-t border-red-100">
                              <p className="text-[0.72rem] text-[#DC2626] mb-2">Escribe CANCELAR para confirmar:</p>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  value={cancelInput}
                                  onChange={e => setCancelInput(e.target.value)}
                                  placeholder="CANCELAR"
                                  className="border border-gray-300 px-2 py-1 text-sm outline-none focus:border-red-400 w-28"
                                  autoFocus
                                />
                                <button
                                  onClick={handleCancelConfirm}
                                  disabled={cancelInput !== "CANCELAR"}
                                  className="px-3 py-1 bg-[#DC2626] text-white text-[0.75rem] disabled:opacity-30"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setCancelTarget(null)}
                                  className="px-3 py-1 border border-gray-300 text-[0.75rem] hover:border-gray-500"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent history */}
            {enviadas.length > 0 && (
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-4">
                  Enviadas ({enviadas.length})
                </p>
                <div className="space-y-1">
                  {enviadas.map(c => {
                    const isOpen = expandedId === c.id;
                    return (
                      <div key={c.id} className="border border-gray-100">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : c.id)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm text-gray-700">
                              {[c.subject_eu, c.subject_es].filter(Boolean).join(" / ") || "—"}
                            </p>
                            <p className="text-[0.72rem] text-gray-400 mt-0.5">
                              {c.enviado_en ? fmtDate(c.enviado_en) : "—"} · {(c.enviados_eu ?? 0) + (c.enviados_es ?? 0)} enviados
                              {c.enviados_eu ? ` (${c.enviados_eu} eu` : ""}
                              {c.enviados_eu && c.enviados_es ? " · " : ""}
                              {c.enviados_es ? `${c.enviados_es} es)` : c.enviados_eu ? ")" : ""}
                              {" · "}{c.remitente ?? REMITENTES[0]}
                              {/* typeof, no !== null: si la columna faltase en la respuesta
                                  llegaría undefined y la etiqueta saldría en todas. */}
                              {typeof c.orden_cola === "number" && <span className="text-teal-600"> · desde cola B</span>}
                            </p>
                          </div>
                          <span className="text-gray-400 text-[0.75rem] shrink-0 ml-4">{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-100 px-4 py-4 grid md:grid-cols-2 gap-6 bg-gray-50">
                            {c.body_eu && (
                              <div>
                                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-2">Euskera</p>
                                {c.preheader_eu && <p className="text-[0.72rem] italic text-gray-400 mb-2">↳ {c.preheader_eu}</p>}
                                <p className="text-[0.78rem] font-medium text-gray-600 mb-3">{c.subject_eu}</p>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body_eu}</div>
                              </div>
                            )}
                            {c.body_es && (
                              <div>
                                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-2">Castellano</p>
                                {c.preheader_es && <p className="text-[0.72rem] italic text-gray-400 mb-2">↳ {c.preheader_es}</p>}
                                <p className="text-[0.78rem] font-medium text-gray-600 mb-3">{c.subject_es}</p>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body_es}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── TAB: COLA B ── */}
        {tab === "Cola B" && (
          <section className="bg-white border border-gray-200 p-5 md:p-6">
            {accionError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{accionError}</div>
            )}
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-2">
              Cola B ({cola.length})
            </p>
            <p className="text-[0.78rem] text-gray-500 mb-5 leading-relaxed">
              Mails de reserva sin fecha. Cada día a las 19:15, si no ha salido ni hay programado ningún otro envío, se manda el primero de la lista y desaparece de aquí.
              {cola.length === 0
                ? <span className="text-[#DC2626]"> Ahora mismo la cola está vacía: un día sin programar sería un día sin newsletter.</span>
                : <> Con {cola.length} mail{cola.length > 1 ? "es" : ""} tienes {cola.length} día{cola.length > 1 ? "s" : ""} de colchón.</>}
            </p>

            {cola.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Nada en la cola. Escribe uno en &quot;Nuevo email&quot; y dale a &quot;Guardar en la cola B&quot;.
              </p>
            ) : (
              <div className="space-y-4">
                {cola.map((c, i) => (
                  <div key={c.id}>
                    {editing?.id === c.id ? (
                      renderEditor(c)
                    ) : (
                      <div className="border border-gray-200">
                        <div className="flex items-start gap-3 p-4">
                          <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                            <button
                              onClick={() => handleMoveCola(c.id, -1)}
                              disabled={i === 0 || reordering}
                              title="Subir"
                              className="text-[0.7rem] leading-none px-1.5 py-1 border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-25 disabled:hover:border-gray-200"
                            >▲</button>
                            <button
                              onClick={() => handleMoveCola(c.id, 1)}
                              disabled={i === cola.length - 1 || reordering}
                              title="Bajar"
                              className="text-[0.7rem] leading-none px-1.5 py-1 border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-25 disabled:hover:border-gray-200"
                            >▼</button>
                          </div>
                          <span className={`shrink-0 text-[0.7rem] w-6 h-6 flex items-center justify-center mt-0.5 ${i === 0 ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {[c.subject_eu, c.subject_es].filter(Boolean).join(" / ") || "Sin asunto"}
                            </p>
                            <p className="text-[0.7rem] text-gray-400 mt-0.5">
                              {[c.subject_eu && "eu", c.subject_es && "es"].filter(Boolean).join(" + ")} · {c.remitente ?? REMITENTES[0]}
                              {i === 0 && <span className="text-teal-600"> · el siguiente en salir</span>}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="text-[0.75rem] text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5">
                              {expandedId === c.id ? "Ocultar" : "Ver"}
                            </button>
                            <button onClick={() => startEdit(c)} className="text-[0.75rem] text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5">
                              Editar
                            </button>
                            <button onClick={() => handleCancel(c.id)} className="text-[0.75rem] text-[#DC2626] hover:text-red-700 border border-red-200 px-3 py-1.5">
                              Eliminar
                            </button>
                          </div>
                        </div>
                        {expandedId === c.id && (
                          <div className="border-t border-gray-100 px-4 py-4 grid md:grid-cols-2 gap-6 bg-gray-50">
                            {c.body_eu && (
                              <div>
                                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-2">Euskera</p>
                                {c.preheader_eu && <p className="text-[0.72rem] italic text-gray-400 mb-2">↳ {c.preheader_eu}</p>}
                                <p className="text-[0.78rem] font-medium text-gray-600 mb-3">{c.subject_eu}</p>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body_eu}</div>
                              </div>
                            )}
                            {c.body_es && (
                              <div>
                                <p className="text-[0.7rem] uppercase tracking-wider text-gray-400 mb-2">Castellano</p>
                                {c.preheader_es && <p className="text-[0.72rem] italic text-gray-400 mb-2">↳ {c.preheader_es}</p>}
                                <p className="text-[0.78rem] font-medium text-gray-600 mb-3">{c.subject_es}</p>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body_es}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {cancelTarget === c.id && (
                          <div className="border-t border-red-100 px-4 py-3">
                            <p className="text-[0.72rem] text-[#DC2626] mb-2">Escribe CANCELAR para sacarlo de la cola:</p>
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={cancelInput}
                                onChange={e => setCancelInput(e.target.value)}
                                placeholder="CANCELAR"
                                className="border border-gray-300 px-2 py-1 text-sm outline-none focus:border-red-400 w-28"
                                autoFocus
                              />
                              <button onClick={handleCancelConfirm} disabled={cancelInput !== "CANCELAR"} className="px-3 py-1 bg-[#DC2626] text-white text-[0.75rem] disabled:opacity-30">
                                Confirmar
                              </button>
                              <button onClick={() => setCancelTarget(null)} className="px-3 py-1 border border-gray-300 text-[0.75rem] hover:border-gray-500">
                                No
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── TAB: SUSCRIPTORES ── */}
        {tab === "Suscriptores" && (
          <section className="bg-white border border-gray-200 p-5 md:p-6 space-y-8">

            {/* Add contact form */}
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-5">Añadir contacto</p>
              {addContactResult?.ok && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-sm text-green-700">✓ Contacto añadido.</div>
              )}
              {addContactResult?.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{addContactResult.error}</div>
              )}
              <form onSubmit={handleAddContact} className="flex flex-wrap gap-2 items-end">
                <div>
                  <p className="text-[0.72rem] text-gray-500 mb-1">Email *</p>
                  <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@ejemplo.com" className={`${inputClass} w-56`} />
                </div>
                <div>
                  <p className="text-[0.72rem] text-gray-500 mb-1">Nombre</p>
                  <input type="text" value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Opcional" className={`${inputClass} w-36`} />
                </div>
                <div>
                  <p className="text-[0.72rem] text-gray-500 mb-1">Idioma</p>
                  <select value={newIdioma} onChange={e => setNewIdioma(e.target.value)} className={`${inputClass} w-20`}>
                    <option value="es">ES</option>
                    <option value="eu">EU</option>
                  </select>
                </div>
                <div>
                  <p className="text-[0.72rem] text-gray-500 mb-1">Origen</p>
                  <input type="text" value={newOrigen} onChange={e => setNewOrigen(e.target.value)} placeholder="entrenamiento…" className={`${inputClass} w-36`} />
                </div>
                <button type="submit" disabled={addingContact || !newEmail} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm disabled:opacity-40">
                  {addingContact ? "Añadiendo..." : "Añadir"}
                </button>
              </form>
            </div>

            <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-6">
              Activos ({activos.length})
            </p>
            {activos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin suscriptores todavía.</p>
            ) : (
              <div className="space-y-1">
                {activos.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">{c.email}</p>
                      {c.nombre && <p className="text-[0.7rem] text-gray-400">{c.nombre}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className="text-[0.62rem] uppercase tracking-wider px-1.5 py-0.5 bg-gray-100 text-gray-500">
                        {c.idioma ?? "es"}
                      </span>
                      <span className={`text-[0.65rem] uppercase tracking-wider px-2 py-0.5 ${
                        c.origen === "comodin" ? "bg-teal-50 text-teal-600" :
                        c.origen === "tumision" ? "bg-purple-50 text-purple-500" :
                        c.origen === "arrogante" ? "bg-red-50 text-red-500" :
                        c.origen === "importado" ? "bg-gray-100 text-gray-500" :
                        "bg-blue-50 text-blue-500"
                      }`}>
                        {c.origen}
                      </span>
                      {c.tags?.map(tag => (
                        <span key={tag} className="text-[0.65rem] tracking-wider px-2 py-0.5 bg-amber-50 text-amber-700">
                          {tag}
                        </span>
                      ))}
                      <p className="text-[0.72rem] text-gray-400">
                        {new Date(c.fecha_alta).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>
        )}

      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfFileChange}
      />
    </div>
  );
}
