"use client";

import { useState, useEffect } from "react";
import NewsletterTab from "./_components/NewsletterTab";
import NurtureTab from "./_components/NurtureTab";
import ArroganteTab from "./_components/ArroganteTab";
import EstadisticasGuiasTab from "./_components/EstadisticasGuiasTab";
import EmbudoEspaldaTab from "./_components/EmbudoEspaldaTab";
import MagicTab from "./_components/MagicTab";
import HojaDeRutaTab from "./_components/HojaDeRutaTab";
import AcompanamientoTab from "./_components/AcompanamientoTab";
import ValoracionTab from "./_components/ValoracionTab";
import ParqTab from "./_components/ParqTab";

const TABS = ["Valoración", "PAR-Q+", "Newsletter", "Nurture", "Hoja de Ruta", "Acompañamiento", "Arrogante", "Estadísticas guías", "Embudo espalda", "Magic"] as const;
type Tab = (typeof TABS)[number];

// El menú lateral, agrupado por para qué se usa cada pestaña.
const GRUPOS: { titulo: string; tabs: Tab[] }[] = [
  { titulo: "Clientes", tabs: ["Valoración", "PAR-Q+", "Acompañamiento", "Hoja de Ruta"] },
  { titulo: "Correo", tabs: ["Newsletter", "Nurture"] },
  { titulo: "Métricas", tabs: ["Estadísticas guías", "Embudo espalda"] },
  { titulo: "Otros", tabs: ["Arrogante", "Magic"] },
];

// Iconos de trazo, 20×20. Uno por pestaña para reconocerlas de un vistazo
// también con el menú plegado.
const ICONO: Record<Tab, React.ReactNode> = {
  Valoración: <path d="M6 3h8l3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h6m-6 3h6m-6-6h3" />,
  "PAR-Q+": <path d="M10 17s-6-3.5-6-8a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 16 9c0 4.5-6 8-6 8Zm-3-7h2l1-2 1.5 4 1-2H15" />,
  Newsletter: <path d="M3 5h14v10H3zM3 5l7 6 7-6" />,
  Nurture: <path d="M10 17c-4-2-6-5-6-8a6 6 0 0 1 6-6 6 6 0 0 1 6 6c0 3-2 6-6 8Zm0-11v7m-3-4 3 3 3-3" />,
  "Hoja de Ruta": <path d="M4 4l4-1 4 2 4-1v13l-4 1-4-2-4 1zM8 3v13m4-11v13" />,
  Acompañamiento: <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 0a3 3 0 1 0 0-6M2 17c0-3 2-5 5-5s5 2 5 5m1-5c3 0 5 2 5 5" />,
  Arrogante: <path d="M10 3l2 4.5 5 .5-3.8 3.3 1.1 4.9L10 13.8 5.7 16.2l1.1-4.9L3 8l5-.5z" />,
  "Estadísticas guías": <path d="M4 16V9m4 7V5m4 11v-5m4 5V7" />,
  "Embudo espalda": <path d="M3 4h14l-5 6v5l-4 2v-7z" />,
  Magic: <path d="M4 16 14 6m-1-3 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM15 11l.6 1.4L17 13l-1.4.6L15 15l-.6-1.4L13 13l1.4-.6z" />,
};

function Icono({ tab }: { tab: Tab }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {ICONO[tab]}
    </svg>
  );
}

function saludo() {
  const h = new Date().getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<Tab>("Newsletter");
  const [plegado, setPlegado] = useState(false);

  useEffect(() => {
    setAuth(sessionStorage.getItem("admin_auth") === "1");
    setCheckingSession(false);
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab);
    try {
      setPlegado(localStorage.getItem("admin_menu_plegado") === "1");
    } catch {}
  }, []);

  // La pestaña va en la URL: recargar deja donde estabas.
  function elegir(t: Tab) {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    if (t !== "Valoración") url.searchParams.delete("valoracion");
    window.history.replaceState(null, "", url);
  }

  function plegar() {
    setPlegado(!plegado);
    try {
      localStorage.setItem("admin_menu_plegado", plegado ? "0" : "1");
    } catch {}
  }

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

  if (checkingSession) return null;

  if (!auth) {
    return (
      <main className="admin flex min-h-screen items-center justify-center px-5">
        <div className="admin-fade w-full max-w-[380px] rounded-3xl border border-gray-200 bg-white p-9 shadow-[0_20px_60px_-20px_rgba(60,40,20,0.25)]">
          <div className="mb-7 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F2240] text-[0.95rem] font-semibold text-white">AZ</span>
            <div>
              <p className="text-[1.05rem] font-semibold leading-tight">Panel</p>
              <p className="text-[0.82rem] text-gray-500">Alain Zulaika · Entrenatzaile</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 px-4 py-3 text-[0.95rem] outline-none"
              autoFocus
            />
            {authError && <p className="text-sm text-[#DC2626]">{authError}</p>}
            <button
              type="submit"
              disabled={checking || !password}
              className="w-full bg-[#1a1a1a] py-3 text-[0.95rem] font-medium text-white disabled:opacity-40"
            >
              {checking ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const ancho = tab === "Valoración" || tab === "PAR-Q+" ? "max-w-[1320px]" : "max-w-[1040px]";

  return (
    <main className="admin min-h-screen">
      {/* Móvil: barra arriba con desplegable */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#f6f2ec]/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0F2240] text-[0.75rem] font-semibold text-white">AZ</span>
        <select
          value={tab}
          onChange={(e) => elegir(e.target.value as Tab)}
          className="min-w-0 flex-1 border border-gray-300 px-3 py-2 text-[0.9rem]"
        >
          {GRUPOS.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.tabs.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={logout} className="text-[0.8rem] text-gray-500">
          Salir
        </button>
      </header>

      <div className="flex">
        {/* Escritorio: menú lateral */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-gray-200 bg-[#fbf9f5] transition-[width] duration-200 lg:flex ${
            plegado ? "w-[68px]" : "w-[236px]"
          }`}
        >
          <div className={`flex items-center gap-3 px-4 pb-4 pt-5 ${plegado ? "justify-center px-0" : ""}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F2240] text-[0.8rem] font-semibold text-white">AZ</span>
            {!plegado && (
              <div className="min-w-0">
                <p className="text-[0.95rem] font-semibold leading-tight">Panel</p>
                <p className="truncate text-[0.75rem] text-gray-500">Entrenatzaile</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="mt-4 first:mt-1">
                {!plegado && <p className="mb-1 px-2.5 text-[0.7rem] font-medium uppercase text-gray-400">{g.titulo}</p>}
                {plegado && <div className="mx-auto mb-2 h-px w-6 bg-gray-200" />}
                {g.tabs.map((t) => {
                  const activa = tab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => elegir(t)}
                      title={plegado ? t : undefined}
                      className={`mb-0.5 flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[0.88rem] ${
                        plegado ? "justify-center" : ""
                      } ${
                        activa
                          ? "bg-white font-medium text-[#0F2240] shadow-[0_1px_3px_rgba(60,40,20,0.08)] ring-1 ring-gray-200"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span className={activa ? "text-[#C47800]" : "text-gray-400"}>
                        <Icono tab={t} />
                      </span>
                      {!plegado && t}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={`flex items-center gap-1 border-t border-gray-200 p-3 ${plegado ? "flex-col" : ""}`}>
            <button
              onClick={plegar}
              title={plegado ? "Desplegar menú" : "Plegar menú"}
              className="flex h-9 w-9 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${plegado ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l-5 5 5 5" />
              </svg>
            </button>
            <button
              onClick={logout}
              title="Salir"
              className={`flex h-9 items-center gap-2 px-2.5 text-[0.85rem] text-gray-500 hover:bg-gray-100 hover:text-gray-800 ${plegado ? "w-9 justify-center px-0" : "ml-auto"}`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3m5-3 3-3-3-3m3 3H8" />
              </svg>
              {!plegado && "Salir"}
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className={`${ancho} mx-auto px-5 pb-16 pt-6 md:px-8 md:pt-9`}>
            <div className="mb-7">
              <p className="text-[0.85rem] text-gray-500">
                {saludo()}, Alain ·{" "}
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-0.5 text-[1.75rem] font-semibold tracking-[-0.02em] text-gray-900">{tab}</h1>
            </div>

            <div key={tab} className="admin-fade">
              {tab === "Valoración" && <ValoracionTab />}
              {tab === "PAR-Q+" && <ParqTab />}
              {tab === "Newsletter" && <NewsletterTab />}
              {tab === "Nurture" && <NurtureTab />}
              {tab === "Hoja de Ruta" && <HojaDeRutaTab />}
              {tab === "Acompañamiento" && <AcompanamientoTab />}
              {tab === "Arrogante" && <ArroganteTab />}
              {tab === "Estadísticas guías" && <EstadisticasGuiasTab />}
              {tab === "Embudo espalda" && <EmbudoEspaldaTab />}
              {tab === "Magic" && <MagicTab />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
