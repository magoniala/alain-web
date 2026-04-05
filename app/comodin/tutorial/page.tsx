"use client";

import { useState } from "react";

export default function ComodinTutorialPage() {
  const [playing, setPlaying] = useState(false);

  const VIDEO_ID = "YeVxIkatxlw";

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: "760px" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", textAlign: "center", marginBottom: "0.75rem" }}>
          Ustekabeko desagerpenaren sekretua
        </p>
        <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.45)", textAlign: "center", marginBottom: "2rem" }}>
          Edalontzi bat. Aluminio papera. Hiru minutu.
        </p>

        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
          {playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
              title="Ustekabeko desagerpenaren sekretua"
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
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
              <div style={{
                position: "relative", zIndex: 1,
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(0,0,0,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid rgba(242,242,240,0.45)",
              }}>
                <div style={{
                  width: 0, height: 0,
                  borderTop: "11px solid transparent",
                  borderBottom: "11px solid transparent",
                  borderLeft: "18px solid rgba(242,242,240,0.90)",
                  marginLeft: "5px",
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
