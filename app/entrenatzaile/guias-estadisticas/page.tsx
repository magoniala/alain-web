"use client";

import { useEffect, useState } from "react";

const AMBER = "#D4860A";
const NAVY = "#1C3A5E";
const DARK_NAVY = "#0F2240";

const VARIANTES = [
  { value: "lumbar", label: "Lumbar" },
  { value: "rodilla", label: "Rodilla" },
  { value: "ereccion", label: "Erecciones" },
] as const;

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return toISODate(d);
}

interface DiaVisitas {
  fecha: string;
  visitas: number;
}

export default function GuiasEstadisticasPage() {
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [landing] = useState("guias");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(toISODate(new Date()));
  const [total, setTotal] = useState<number | null>(null);
  const [dias, setDias] = useState<DiaVisitas[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [variante, setVariante] = useState<string | null>(null);
  const [variantePending, setVariantePending] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem("stats_auth") === "1");
    setCheckingAuth(false);
  }, []);

  function pw() {
    return sessionStorage.getItem("stats_pw") || "";
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/entrenatzaile/estadisticas/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem("stats_auth", "1");
      sessionStorage.setItem("stats_pw", password);
      setAuthed(true);
    } else {
      setAuthError("Contraseña incorrecta.");
    }
  }

  function logout() {
    sessionStorage.removeItem("stats_auth");
    sessionStorage.removeItem("stats_pw");
    setAuthed(false);
  }

  async function consultar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/entrenatzaile/estadisticas?landing=${encodeURIComponent(landing)}&from=${from}&to=${to}`,
        { headers: { "x-stats-password": pw() } }
      );
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error consultando las visitas.");
        return;
      }
      setTotal(data.total);
      setDias(data.dias);
    } catch {
      setError("Error consultando las visitas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) {
      consultar();
      fetch(`/api/entrenatzaile/estadisticas/variante?landing=${landing}`, {
        headers: { "x-stats-password": pw() },
      })
        .then((r) => r.json())
        .then((d) => setVariante(d.variante))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function cambiarVariante(v: string) {
    setVariantePending(true);
    try {
      await fetch("/api/entrenatzaile/estadisticas/variante", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-stats-password": pw() },
        body: JSON.stringify({ landing, variante: v }),
      });
      setVariante(v);
    } finally {
      setVariantePending(false);
    }
  }

  if (checkingAuth) return null;

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF3E8] px-8">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-[380px] p-8"
          style={{ border: "1px solid rgba(28,58,94,0.18)", background: "rgba(28,58,94,0.04)" }}
        >
          <p style={{ fontSize: "1.1rem", color: NAVY, marginBottom: "1.5rem" }}>Estadísticas — Entrenatzaile</p>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.7rem",
              border: "1px solid rgba(28,58,94,0.25)",
              background: "none",
              color: DARK_NAVY,
              marginBottom: "1rem",
              outline: "none",
            }}
          />
          {authError && (
            <p style={{ fontSize: "0.85rem", color: "#B3261E", marginBottom: "1rem" }}>{authError}</p>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "none",
              background: NAVY,
              color: "#FAF3E8",
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const maxVisitas = Math.max(1, ...dias.map((d) => d.visitas));

  return (
    <main className="min-h-screen bg-[#FAF3E8] px-8 py-12 md:px-16" style={{ color: DARK_NAVY }}>
      <div className="mx-auto max-w-[900px]">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <p style={{ fontSize: "1.3rem", color: NAVY, fontWeight: 500 }}>Estadísticas — /guias</p>
          <button
            onClick={logout}
            style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.55)", background: "none", border: "none", cursor: "pointer" }}
          >
            Salir
          </button>
        </div>

        {/* PLANTILLA ACTIVA */}
        <div className="p-5 md:p-6" style={{ border: "1px solid rgba(28,58,94,0.18)", background: "rgba(28,58,94,0.04)", marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.6)", marginBottom: "0.75rem" }}>
            Plantilla activa en /guias
          </p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {VARIANTES.map((v) => (
              <button
                key={v.value}
                onClick={() => cambiarVariante(v.value)}
                disabled={variantePending || variante === v.value}
                style={{
                  padding: "0.55rem 1.1rem",
                  border: variante === v.value ? `1px solid ${AMBER}` : "1px solid rgba(28,58,94,0.25)",
                  color: variante === v.value ? AMBER : "rgba(28,58,94,0.62)",
                  background: variante === v.value ? "rgba(212,134,10,0.08)" : "none",
                  cursor: variante === v.value ? "default" : "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* FILTRO DE FECHAS */}
        <div className="p-5 md:p-6" style={{ border: "1px solid rgba(28,58,94,0.18)", background: "rgba(28,58,94,0.04)", marginBottom: "2rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(28,58,94,0.65)", display: "block", marginBottom: "0.3rem" }}>
                Desde
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ padding: "0.5rem", border: "1px solid rgba(28,58,94,0.25)", background: "none", color: DARK_NAVY }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(28,58,94,0.65)", display: "block", marginBottom: "0.3rem" }}>
                Hasta
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ padding: "0.5rem", border: "1px solid rgba(28,58,94,0.25)", background: "none", color: DARK_NAVY }}
              />
            </div>
            <button
              onClick={consultar}
              disabled={loading}
              style={{ padding: "0.6rem 1.5rem", border: "none", background: NAVY, color: "#FAF3E8", cursor: "pointer" }}
            >
              {loading ? "Consultando..." : "Consultar"}
            </button>
          </div>
        </div>

        {error && <p style={{ color: "#B3261E", marginBottom: "1rem" }}>{error}</p>}

        {/* TOTAL */}
        {total !== null && (
          <p style={{ fontSize: "2.2rem", fontWeight: 500, color: NAVY, marginBottom: "1.5rem" }}>
            {total} <span style={{ fontSize: "1rem", fontWeight: 400, color: "rgba(15,34,64,0.55)" }}>visitas en el rango</span>
          </p>
        )}

        {/* POR DÍA */}
        {dias.length > 0 && (
          <div>
            {dias.map((d) => (
              <div key={d.fecha} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                <span style={{ width: "90px", fontSize: "0.85rem", flexShrink: 0 }}>{d.fecha}</span>
                <div style={{ flex: 1, background: "rgba(28,58,94,0.08)", height: "18px" }}>
                  <div style={{ width: `${(d.visitas / maxVisitas) * 100}%`, background: AMBER, height: "100%" }} />
                </div>
                <span style={{ width: "36px", textAlign: "right", fontSize: "0.85rem", flexShrink: 0 }}>{d.visitas}</span>
              </div>
            ))}
          </div>
        )}

        {total === 0 && <p style={{ color: "rgba(15,34,64,0.55)" }}>Sin visitas registradas en este rango.</p>}
      </div>
    </main>
  );
}
