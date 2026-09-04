"use client";

import { useEffect, useState } from "react";

const AMBER = "#D4860A";
const NAVY = "#1C3A5E";
const DARK_NAVY = "#0F2240";
const ROJO = "#B3261E";

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

interface Paso {
  clave: string;
  etiqueta: string;
  sesiones: number;
  pctTotal: number | null;
  caida: number | null;
}

interface Anuncio {
  utmContent: string;
  pasos: Paso[];
}

interface Dia {
  fecha: string;
  sesiones: number;
  formStart: number;
  submitOk: number;
}

// El embudo dibujado: una barra por paso, ancha en proporción al total, y
// a la derecha lo único que importa de verdad — cuánta gente se ha caído
// desde el paso anterior. El peor escalón se marca en rojo.
function Embudo({ pasos }: { pasos: Paso[] }) {
  const total = pasos[0]?.sesiones ?? 0;
  const peor = Math.max(0, ...pasos.map((p) => p.caida ?? 0));

  if (!total) return <p style={{ color: "rgba(15,34,64,0.55)" }}>Sin sesiones en este rango.</p>;

  return (
    <div>
      {pasos.map((p) => {
        const esPeor = p.caida !== null && p.caida === peor && peor > 0;
        return (
          <div
            key={p.clave}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}
          >
            <span style={{ width: "170px", fontSize: "0.85rem", flexShrink: 0 }}>{p.etiqueta}</span>
            <div style={{ flex: 1, background: "rgba(28,58,94,0.08)", height: "18px" }}>
              <div style={{ width: `${(p.sesiones / total) * 100}%`, background: NAVY, height: "100%" }} />
            </div>
            <span style={{ width: "42px", textAlign: "right", fontSize: "0.85rem", flexShrink: 0 }}>
              {p.sesiones}
            </span>
            <span
              style={{
                width: "48px",
                textAlign: "right",
                fontSize: "0.8rem",
                flexShrink: 0,
                color: "rgba(15,34,64,0.5)",
              }}
            >
              {p.pctTotal !== null ? `${p.pctTotal}%` : ""}
            </span>
            <span
              style={{
                width: "78px",
                textAlign: "right",
                fontSize: "0.8rem",
                flexShrink: 0,
                color: esPeor ? ROJO : "rgba(15,34,64,0.5)",
                fontWeight: esPeor ? 600 : 400,
              }}
            >
              {p.caida !== null ? `−${p.caida}%` : ""}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: "0.75rem", color: "rgba(15,34,64,0.45)", marginTop: "0.6rem" }}>
        Sesiones · % sobre el total · caída respecto al paso anterior.
      </p>
    </div>
  );
}

export default function EmbudoEspaldaTab() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(toISODate(new Date()));
  const [total, setTotal] = useState<Paso[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [errores, setErrores] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pw() {
    return sessionStorage.getItem("admin_pw") || "";
  }

  async function consultar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/entrenatzaile/embudo?landing=espalda&from=${from}&to=${to}`, {
        headers: { "x-admin-password": pw() },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error consultando el embudo.");
        return;
      }
      setTotal(data.total ?? []);
      setAnuncios(data.anuncios ?? []);
      setDias(data.dias ?? []);
      setErrores(data.errores ?? 0);
    } catch {
      setError("Error consultando el embudo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxDia = Math.max(1, ...dias.map((d) => d.sesiones));

  return (
    <div style={{ color: DARK_NAVY }}>
      {/* FILTRO DE FECHAS */}
      <div
        className="p-5 md:p-6"
        style={{ border: "1px solid rgba(28,58,94,0.18)", background: "rgba(28,58,94,0.04)", marginBottom: "2rem" }}
      >
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(28,58,94,0.65)",
                display: "block",
                marginBottom: "0.3rem",
              }}
            >
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
            <label
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(28,58,94,0.65)",
                display: "block",
                marginBottom: "0.3rem",
              }}
            >
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

      {error && <p style={{ color: ROJO, marginBottom: "1rem" }}>{error}</p>}

      {/* EMBUDO DEL RANGO */}
      <p style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.6)", marginBottom: "0.75rem" }}>
        Embudo de /espalda en el rango
      </p>
      <div style={{ marginBottom: "2.5rem" }}>
        <Embudo pasos={total} />
      </div>

      {errores > 0 && (
        <p style={{ color: ROJO, marginBottom: "2.5rem", fontSize: "0.9rem" }}>
          {errores} {errores === 1 ? "sesión pulsó" : "sesiones pulsaron"} enviar y el envío falló. El código del
          fallo está en <span style={{ fontFamily: "monospace" }}>espalda_eventos.detalle</span>.
        </p>
      )}

      {/* POR ANUNCIO */}
      {anuncios.length > 0 && (
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.6)", marginBottom: "1rem" }}>
            Embudo por utm_content
          </p>
          {anuncios.map((a) => (
            <div key={a.utmContent} style={{ marginBottom: "1.75rem" }}>
              <p style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>{a.utmContent}</p>
              <Embudo pasos={a.pasos} />
            </div>
          ))}
        </div>
      )}

      {/* POR DÍA */}
      {dias.length > 0 && (
        <div>
          <p style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.6)", marginBottom: "0.75rem" }}>
            Por día — sesiones, cuántas tocan el formulario y cuántas envían
          </p>
          {dias.map((d) => (
            <div key={d.fecha} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
              <span style={{ width: "90px", fontSize: "0.85rem", flexShrink: 0 }}>{d.fecha}</span>
              <div style={{ flex: 1, background: "rgba(28,58,94,0.08)", height: "18px" }}>
                <div style={{ width: `${(d.sesiones / maxDia) * 100}%`, background: AMBER, height: "100%" }} />
              </div>
              <span style={{ width: "110px", textAlign: "right", fontSize: "0.85rem", flexShrink: 0 }}>
                {d.sesiones} · {d.formStart} · {d.submitOk}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
