"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import { ACOMPANAMIENTO_TEXTOS, CONSENT_AVISO_PLAZAS } from "@/lib/acompanamiento";
import { mensajeErrorFormulario, type Utm } from "@/lib/entrenatzaile-formularios";
import { botonClase, botonStyle, casillaStyle, leerUtm } from "./comun";

// Lo que se ve con el contador a 0: solo un email para avisar de las
// siguientes plazas.
export default function AvisoPlazas() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const utm = useRef<Utm>({});

  useEffect(() => {
    utm.current = leerUtm();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Escribe un email válido.");
      return;
    }
    if (!consent) {
      setError("Marca la casilla para que pueda avisarte.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/acompanamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "aviso", email, consentAviso: consent, utm: utm.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      setEnviado(true);
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="context-fade-in p-6 md:p-10" style={cardStyle}>
        <h2 className="mb-6 font-[family-name:var(--font-fraunces)] text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] font-medium tracking-[-0.02em] text-[#0F2240]">
          {ACOMPANAMIENTO_TEXTOS.avisoGraciasTitulo}
        </h2>
        <p className="text-[1.05rem] leading-[1.8] text-[#0F2240]/80">{ACOMPANAMIENTO_TEXTOS.avisoGraciasParrafo}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10" style={cardStyle}>
      <form onSubmit={enviar} noValidate>
        <div style={fieldStyle}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            className="placeholder:text-[#0F2240]/35"
          />
        </div>
        <label style={casillaStyle}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          {CONSENT_AVISO_PLAZAS}
        </label>
        <p style={{ fontSize: "0.88rem", marginTop: "0.9rem", color: "rgba(15,34,64,0.50)" }}>
          <a href="/privacidad" className="underline underline-offset-4 transition-colors hover:text-[#0F2240]">
            {ACOMPANAMIENTO_TEXTOS.privacidad}
          </a>
        </p>

        {error && (
          <p role="alert" style={{ fontSize: "0.92rem", color: "#B3261E", marginTop: "1.5rem", lineHeight: 1.6 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando} style={botonStyle(enviando)} className={botonClase}>
          {enviando ? ACOMPANAMIENTO_TEXTOS.enviando : ACOMPANAMIENTO_TEXTOS.avisoBoton}
        </button>
      </form>
    </div>
  );
}
