"use client";

import { useState } from "react";

export default function TutorialPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);

  const VIDEO_ID = "YeVxIkatxlw";

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (password.trim().toLowerCase() === "ander") {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) {
    return (
      <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "760px" }}>
          <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", textAlign: "center", marginBottom: "0.75rem" }}>
            El secreto de la desaparición inesperada
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.45)", textAlign: "center", marginBottom: "2rem" }}>
            Un vaso. Papel de aluminio. Tres minutos.
          </p>

          {/* Video container */}
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
            {playing ? (
              <iframe
                src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="El secreto de la desaparición inesperada"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div
                onClick={() => setPlaying(true)}
                style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundImage: `url(https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Overlay oscuro sutil */}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
                {/* Botón de play */}
                <div style={{
                  position: "relative",
                  zIndex: 1,
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(242,242,240,0.45)",
                  transition: "border-color 0.2s, transform 0.2s",
                }}>
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: "11px solid transparent",
                    borderBottom: "11px solid transparent",
                    borderLeft: "18px solid rgba(242,242,240,0.90)",
                    marginLeft: "5px",
                  }} />
                </div>
              </div>
            )}
          </div>

          <p style={{ marginTop: "2rem", fontSize: "1rem", color: "rgba(242,242,240,0.50)", textAlign: "center", lineHeight: 1.75 }}>
            Cuando lo hayas hecho, respóndeme al mail y cuéntame cómo fue.<br />
            Tengo un segundo truco esperándote.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
        Alain Zulaika
      </p>
      <p style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)", color: "rgba(242,242,240,0.85)", marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
        Introduce la contraseña del mail.
      </p>
      <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.38)", marginBottom: "2.5rem" }}>
        La encontrarás en el primer email que te envié.
      </p>
      <form onSubmit={handleUnlock} style={{ width: "100%", maxWidth: "320px" }}>
        <input
          type="text"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Contraseña"
          className="placeholder:text-[#F2F2F0]/30"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${error ? "#ff6b6b" : "rgba(242,242,240,0.22)"}`,
            padding: "0.75rem 0",
            fontSize: "1rem",
            color: "#F2F2F0",
            outline: "none",
            textAlign: "center",
            marginBottom: "0.5rem",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "0.5rem" }}>Contraseña incorrecta.</p>
        )}
        <button
          type="submit"
          className="w-full border border-white/20 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6]"
          style={{ marginTop: "1.25rem", background: "transparent", cursor: "pointer" }}
        >
          Acceder
        </button>
      </form>
    </main>
  );
}
