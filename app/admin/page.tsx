"use client";

import { useState, useEffect } from "react";
import NewsletterTab from "./_components/NewsletterTab";
import NurtureTab from "./_components/NurtureTab";
import ArroganteTab from "./_components/ArroganteTab";
import EstadisticasGuiasTab from "./_components/EstadisticasGuiasTab";

const TABS = ["Newsletter", "Nurture", "Arrogante", "Estadísticas guías"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<Tab>("Newsletter");

  useEffect(() => {
    setAuth(sessionStorage.getItem("admin_auth") === "1");
    setCheckingSession(false);
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab);
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChecking(true);
    setAuthError("");
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem("admin_auth", "1");
      sessionStorage.setItem("admin_pw", password);
      setAuth(true);
    } else {
      setAuthError("Contraseña incorrecta.");
    }
    setChecking(false);
  }

  function logout() {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_pw");
    setAuth(false);
  }

  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  if (checkingSession) return null;

  if (!auth) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white border border-gray-200 p-8 w-full max-w-[360px]">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-6">Panel — Acceso</p>
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
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400">Panel</p>
          <button onClick={logout} className="text-[0.75rem] text-gray-400 hover:text-gray-600">
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-[960px] mx-auto px-5 pt-6">
        <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[0.78rem] whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-[#1a1a1a] text-[#1a1a1a]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-5 py-8">
        {tab === "Newsletter" && <NewsletterTab />}
        {tab === "Nurture" && <NurtureTab />}
        {tab === "Arrogante" && <ArroganteTab />}
        {tab === "Estadísticas guías" && <EstadisticasGuiasTab />}
      </div>
    </main>
  );
}
