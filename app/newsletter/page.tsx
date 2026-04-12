"use client";

import { useState, useEffect } from "react";

interface Contacto {
  id: string;
  email: string;
  fecha_alta: string;
  origen: string;
  unsubscribed: boolean;
}

export default function NewsletterPage() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok?: boolean; enviados?: number; error?: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("nl_auth");
    if (saved === "1") { setAuth(true); loadContactos(); }
  }, []);

  async function handleLogin(e: React.FormEvent) {
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
      setAuth(true);
      loadContactos();
    } else {
      setAuthError("Contraseña incorrecta.");
    }
    setChecking(false);
  }

  async function loadContactos() {
    const data = await fetch("/api/newsletter").then(r => r.json());
    setContactos(data);
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/newsletter/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: sessionStorage.getItem("nl_auth") === "1" ? password || sessionStorage.getItem("nl_pw") : password, subject, body }),
    });
    const data = await res.json();
    setSendResult(data);
    setSending(false);
    setConfirm(false);
    if (data.ok) { setSubject(""); setBody(""); }
  }

  const activos = contactos.filter(c => !c.unsubscribed);
  const bajas = contactos.filter(c => c.unsubscribed);

  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  if (!auth) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white border border-gray-200 p-8 w-full max-w-[360px]">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-6">Newsletter — Acceso</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              autoFocus
            />
            {authError && <p className="text-[#DC2626] text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={checking || !password}
              className="w-full bg-[#1a1a1a] text-white py-2.5 text-sm disabled:opacity-40"
            >
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
        <div className="flex items-center justify-between max-w-[720px] mx-auto">
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400">Panel — Newsletter</p>
          <div className="flex items-center gap-4">
            <span className="text-[0.75rem] text-gray-500">{activos.length} activos · {bajas.length} bajas</span>
            <button
              onClick={() => { sessionStorage.removeItem("nl_auth"); setAuth(false); }}
              className="text-[0.75rem] text-gray-400 hover:text-gray-600"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-5 py-8 space-y-10">

        {/* COMPOSE */}
        <section className="bg-white border border-gray-200 p-5 md:p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-6">Nuevo email</p>

          {sendResult?.ok && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-sm text-green-700">
              ✓ Enviado a {sendResult.enviados} suscriptores.
            </div>
          )}
          {sendResult?.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-[#DC2626]">
              Error: {sendResult.error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-[0.78rem] font-medium text-gray-500 mb-1">Asunto</p>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del email..."
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-[0.78rem] font-medium text-gray-500 mb-1">Cuerpo</p>
              <p className="text-[0.72rem] text-gray-400 mb-2">Separa párrafos con una línea en blanco.</p>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                placeholder="Escribe aquí el contenido del email..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                disabled={!subject.trim() || !body.trim()}
                className="w-full bg-[#1a1a1a] text-white py-3 text-sm disabled:opacity-40 hover:bg-[#333] transition-colors"
              >
                Enviar a {activos.length} suscriptores →
              </button>
            ) : (
              <div className="border border-[#DC2626] p-4 space-y-3">
                <p className="text-sm font-medium text-[#DC2626]">¿Confirmas el envío a {activos.length} personas?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="px-5 py-2 bg-[#DC2626] text-white text-sm disabled:opacity-50"
                  >
                    {sending ? "Enviando..." : "Sí, enviar"}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="px-5 py-2 border border-gray-300 text-sm hover:border-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PREVIEW */}
        {(subject || body) && (
          <section className="bg-white border border-gray-200 p-5 md:p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-4">Preview</p>
            <div style={{ fontFamily: "Georgia, serif", maxWidth: 560, color: "#1a1a1a" }}>
              <p style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.5rem" }}>
                Asunto: {subject || "—"}
              </p>
              <div style={{ fontSize: "1.05rem", lineHeight: 2 }}>
                {body.split(/\n\n+/).map((p, i) => (
                  <p key={i} style={{ margin: "0 0 1.4rem" }}>{p}</p>
                ))}
              </div>
              <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.85rem", color: "#999" }}>
                <p style={{ margin: 0 }}>Alain Zulaika · contacto@niala.es</p>
                <p style={{ margin: 0 }}>Dejar de recibir estos emails</p>
              </div>
            </div>
          </section>
        )}

        {/* CONTACTOS */}
        <section className="bg-white border border-gray-200 p-5 md:p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-6">
            Suscriptores activos ({activos.length})
          </p>
          {activos.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin suscriptores todavía.</p>
          ) : (
            <div className="space-y-2">
              {activos.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700">{c.email}</p>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
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

      </div>
    </main>
  );
}
