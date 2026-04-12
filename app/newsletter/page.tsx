"use client";

import { useState, useEffect, useCallback } from "react";

interface Contacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string;
  fecha_alta: string;
  origen: string;
  unsubscribed: boolean;
}

interface Campana {
  id: string;
  subject_eu: string | null;
  body_eu: string | null;
  preheader_eu: string | null;
  subject_es: string | null;
  body_es: string | null;
  preheader_es: string | null;
  programado_para: string;
  estado: string;
  enviado_en: string | null;
  enviados_eu: number | null;
  enviados_es: number | null;
}

interface SendResult {
  ok?: boolean;
  enviados?: number;
  eu?: number;
  es?: number;
  error?: string;
}

const TABS = ["Nuevo email", "Programadas", "Suscriptores"] as const;
type Tab = (typeof TABS)[number];

export default function NewsletterPage() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);
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
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ ok?: boolean; error?: string } | null>(null);

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
  const [saving, setSaving] = useState(false);

  const pw = useCallback(() => sessionStorage.getItem("nl_pw") || "", []);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "x-nl-password": pw(),
  }), [pw]);

  useEffect(() => {
    if (sessionStorage.getItem("nl_auth") === "1") {
      setAuth(true);
      loadAll();
    }
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChecking(true);
    setAuthError("");
    const res = await fetch("/api/newsletter/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem("nl_auth", "1");
      sessionStorage.setItem("nl_pw", password);
      setAuth(true);
      loadAll();
    } else {
      setAuthError("Contraseña incorrecta.");
    }
    setChecking(false);
  }

  async function loadAll() {
    const [c, camp] = await Promise.all([
      fetch("/api/newsletter", { headers: { "x-nl-password": sessionStorage.getItem("nl_pw") || "" } }).then(r => r.json()),
      fetch("/api/newsletter/campanas", { headers: { "x-nl-password": sessionStorage.getItem("nl_pw") || "" } }).then(r => r.json()),
    ]);
    if (Array.isArray(c)) setContactos(c);
    if (Array.isArray(camp)) setCampanas(camp);
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/newsletter/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw(), subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs }),
    });
    const data = await res.json();
    setSendResult(data);
    setSending(false);
    setConfirm(false);
    if (data.ok) { setSubjectEu(""); setPreheaderEu(""); setBodyEu(""); setSubjectEs(""); setPreheaderEs(""); setBodyEs(""); }
  }

  async function handleSchedule() {
    if (!scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setScheduleResult(null);
    const programado_para = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const res = await fetch("/api/newsletter/campanas", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject_eu: subjectEu, body_eu: bodyEu, preheader_eu: preheaderEu, subject_es: subjectEs, body_es: bodyEs, preheader_es: preheaderEs, programado_para }),
    });
    const data = await res.json();
    if (data.id) {
      setScheduleResult({ ok: true });
      setSubjectEu(""); setPreheaderEu(""); setBodyEu(""); setSubjectEs(""); setPreheaderEs(""); setBodyEs("");
      setScheduleDate(""); setScheduleTime("");
      setCampanas(prev => [...prev, data].sort((a, b) => a.programado_para.localeCompare(b.programado_para)));
    } else {
      setScheduleResult({ error: data.error || "Error al programar." });
    }
    setScheduling(false);
  }

  async function handleCancel(id: string) {
    if (!confirm) {
      await fetch("/api/newsletter/campanas", {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      setCampanas(prev => prev.map(c => c.id === id ? { ...c, estado: "cancelado" } : c));
    }
  }

  function startEdit(c: Campana) {
    setEditing(c);
    setEditSubjectEu(c.subject_eu ?? "");
    setEditPreheaderEu(c.preheader_eu ?? "");
    setEditBodyEu(c.body_eu ?? "");
    setEditSubjectEs(c.subject_es ?? "");
    setEditPreheaderEs(c.preheader_es ?? "");
    setEditBodyEs(c.body_es ?? "");
    const d = new Date(c.programado_para);
    setEditDate(d.toISOString().slice(0, 10));
    setEditTime(d.toISOString().slice(11, 16));
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const programado_para = new Date(`${editDate}T${editTime}`).toISOString();
    await fetch("/api/newsletter/campanas", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id: editing.id, subject_eu: editSubjectEu, body_eu: editBodyEu, preheader_eu: editPreheaderEu, subject_es: editSubjectEs, body_es: editBodyEs, preheader_es: editPreheaderEs, programado_para }),
    });
    setCampanas(prev => prev.map(c => c.id === editing.id
      ? { ...c, subject_eu: editSubjectEu, body_eu: editBodyEu, preheader_eu: editPreheaderEu, subject_es: editSubjectEs, body_es: editBodyEs, preheader_es: editPreheaderEs, programado_para }
      : c
    ));
    setEditing(null);
    setSaving(false);
  }

  const activos = contactos.filter(c => !c.unsubscribed);
  const bajas = contactos.filter(c => c.unsubscribed);
  const activosEu = activos.filter(c => c.idioma === "eu");
  const activosEs = activos.filter(c => c.idioma !== "eu");
  const hasEu = !!(subjectEu.trim() && bodyEu.trim());
  const hasEs = !!(subjectEs.trim() && bodyEs.trim());
  const canSend = hasEu || hasEs;
  const pendientes = campanas.filter(c => c.estado === "programado");
  const enviadas = campanas.filter(c => c.estado === "enviado");

  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  if (!auth) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white border border-gray-200 p-8 w-full max-w-[360px]">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-6">Newsletter — Acceso</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} autoFocus />
            {authError && <p className="text-[#DC2626] text-sm">{authError}</p>}
            <button type="submit" disabled={checking || !password} className="w-full bg-[#1a1a1a] text-white py-2.5 text-sm disabled:opacity-40">
              {checking ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-[960px] mx-auto">
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400">Newsletter</p>
          <div className="flex items-center gap-4">
            <span className="text-[0.75rem] text-gray-500">
              {activos.length} activos ({activosEu.length} eu · {activosEs.length} es) · {bajas.length} bajas
              {pendientes.length > 0 && <> · <span className="text-amber-600">{pendientes.length} programada{pendientes.length > 1 ? "s" : ""}</span></>}
            </span>
            <button onClick={() => { sessionStorage.removeItem("nl_auth"); sessionStorage.removeItem("nl_pw"); setAuth(false); }} className="text-[0.75rem] text-gray-400 hover:text-gray-600">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-[960px] mx-auto px-5 pt-6">
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
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-5 py-8 space-y-8">

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
                  ✓ Campaña programada. Aparece en la pestaña "Programadas".
                </div>
              )}
              {scheduleResult?.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">{scheduleResult.error}</div>
              )}

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
                    <textarea value={bodyEu} onChange={e => setBodyEu(e.target.value)} rows={12} placeholder="Idatzi hemen..." className={`${inputClass} resize-none`} />
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
                    <textarea value={bodyEs} onChange={e => setBodyEs(e.target.value)} rows={12} placeholder="Escribe aquí..." className={`${inputClass} resize-none`} />
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
                          {bodyEu.split(/\n/).map((line, i) => line.trim()
                            ? <p key={i} style={{ margin: "0 0 1.2rem" }} dangerouslySetInnerHTML={{ __html: line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#2ED3E6;text-decoration:underline;">$1</a>') }} />
                            : <p key={i} style={{ margin: "0 0 0.8rem" }}>&nbsp;</p>
                          )}
                        </div>
                        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.8rem", color: "#999" }}>
                          <p style={{ margin: "0 0 0.2rem" }}>Alain Zulaika · contacto@niala.es</p>
                          <p style={{ margin: 0, color: "#ccc" }}>Cambiar idioma · Dejar de recibir estos emails</p>
                        </div>
                      </div>
                    )}
                    {(subjectEs || bodyEs) && (
                      <div style={{ fontFamily: "Georgia, serif", color: "#1a1a1a", background: "#fff", padding: "1.5rem", border: "1px solid #eee" }}>
                        {preheaderEs && <p style={{ fontSize: "0.72rem", color: "#aaa", marginBottom: "0.75rem", fontStyle: "italic" }}>↳ {preheaderEs}</p>}
                        <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>{subjectEs || "—"}</p>
                        <div style={{ fontSize: "0.95rem", lineHeight: 1.9 }}>
                          {bodyEs.split(/\n/).map((line, i) => line.trim()
                            ? <p key={i} style={{ margin: "0 0 1.2rem" }} dangerouslySetInnerHTML={{ __html: line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#2ED3E6;text-decoration:underline;">$1</a>') }} />
                            : <p key={i} style={{ margin: "0 0 0.8rem" }}>&nbsp;</p>
                          )}
                        </div>
                        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.8rem", color: "#999" }}>
                          <p style={{ margin: "0 0 0.2rem" }}>Alain Zulaika · contacto@niala.es</p>
                          <p style={{ margin: 0, color: "#ccc" }}>Cambiar idioma · Dejar de recibir estos emails</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        <div className="border border-gray-300 p-4 space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-[0.72rem] uppercase tracking-wider text-gray-400">Euskera</p>
                              <input type="text" value={editSubjectEu} onChange={e => setEditSubjectEu(e.target.value)} placeholder="Gaia" className={inputClass} />
                              <input type="text" value={editPreheaderEu} onChange={e => setEditPreheaderEu(e.target.value)} placeholder="Preview (opcional)" className={inputClass} />
                              <textarea value={editBodyEu} onChange={e => setEditBodyEu(e.target.value)} rows={6} className={`${inputClass} resize-none`} />
                            </div>
                            <div className="space-y-2">
                              <p className="text-[0.72rem] uppercase tracking-wider text-gray-400">Castellano</p>
                              <input type="text" value={editSubjectEs} onChange={e => setEditSubjectEs(e.target.value)} placeholder="Asunto" className={inputClass} />
                              <input type="text" value={editPreheaderEs} onChange={e => setEditPreheaderEs(e.target.value)} placeholder="Preview (opcional)" className={inputClass} />
                              <textarea value={editBodyEs} onChange={e => setEditBodyEs(e.target.value)} rows={6} className={`${inputClass} resize-none`} />
                            </div>
                          </div>
                          <div className="flex gap-2 items-end">
                            <div>
                              <p className="text-[0.72rem] text-gray-500 mb-1">Fecha</p>
                              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
                            </div>
                            <div>
                              <p className="text-[0.72rem] text-gray-500 mb-1">Hora</p>
                              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="border border-gray-300 px-3 py-2 text-sm outline-none" />
                            </div>
                            <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm disabled:opacity-50">
                              {saving ? "Guardando..." : "Guardar"}
                            </button>
                            <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 text-sm">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-gray-200 p-4 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {[c.subject_eu, c.subject_es].filter(Boolean).join(" / ") || "Sin asunto"}
                            </p>
                            <p className="text-[0.75rem] text-gray-400 mt-0.5">{fmtDate(c.programado_para)}</p>
                            <p className="text-[0.7rem] text-gray-400 mt-0.5">
                              {[c.subject_eu && "eu", c.subject_es && "es"].filter(Boolean).join(" + ")}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => startEdit(c)} className="text-[0.75rem] text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5">
                              Editar
                            </button>
                            <button onClick={() => handleCancel(c.id)} className="text-[0.75rem] text-[#DC2626] hover:text-red-700 border border-red-200 px-3 py-1.5">
                              Cancelar
                            </button>
                          </div>
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
                <div className="space-y-2">
                  {enviadas.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-700">
                          {[c.subject_eu, c.subject_es].filter(Boolean).join(" / ") || "—"}
                        </p>
                        <p className="text-[0.72rem] text-gray-400">
                          {c.enviado_en ? fmtDate(c.enviado_en) : "—"}
                        </p>
                      </div>
                      <p className="text-[0.72rem] text-gray-400 shrink-0 ml-4">
                        {(c.enviados_eu ?? 0) + (c.enviados_es ?? 0)} enviados
                        {c.enviados_eu ? ` · ${c.enviados_eu} eu` : ""}
                        {c.enviados_es ? ` · ${c.enviados_es} es` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── TAB: SUSCRIPTORES ── */}
        {tab === "Suscriptores" && (
          <section className="bg-white border border-gray-200 p-5 md:p-6">
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
                      <p className="text-[0.72rem] text-gray-400">
                        {new Date(c.fecha_alta).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
