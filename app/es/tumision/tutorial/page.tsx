"use client";

import { useState } from "react";

export default function TutorialPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);

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
          {/* Reemplaza YOUTUBE_VIDEO_ID con el ID real del vídeo */}
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", background: "rgba(242,242,240,0.04)", border: "1px solid rgba(242,242,240,0.10)" }}>
            <iframe
              src="https://www.youtube.com/embed/YeVxIkatxlw?controls=0&modestbranding=1&rel=0"
              title="El secreto de la desaparición inesperada"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
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
          style={{
            marginTop: "1.25rem",
            width: "100%",
            background: "#2ED3E6",
            color: "#0B0B0C",
            border: "none",
            padding: "0.9rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            cursor: "pointer",
          }}
        >
          Acceder
        </button>
      </form>
    </main>
  );
}
