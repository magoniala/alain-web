"use client";

import { useState } from "react";

/** Vídeo de YouTube que solo se carga al pulsar (miniatura + botón de play). */
export default function Bideoa({ id, izenburua }: { id: string; izenburua: string }) {
  const [martxan, setMartxan] = useState(false);
  return (
    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", background: "#000" }}>
      {martxan ? (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={izenburua}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          onClick={() => setMartxan(true)}
          aria-label={`Ikusi bideoa: ${izenburua}`}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", cursor: "pointer",
            backgroundImage: `url(https://img.youtube.com/vi/${id}/hqdefault.jpg)`, backgroundSize: "cover", backgroundPosition: "center",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <span style={{
            position: "relative", width: 68, height: 68, borderRadius: "50%", background: "rgba(0,0,0,0.65)",
            border: "2px solid rgba(242,242,240,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ width: 0, height: 0, borderTop: "11px solid transparent", borderBottom: "11px solid transparent", borderLeft: "18px solid rgba(242,242,240,0.92)", marginLeft: 5 }} />
          </span>
        </button>
      )}
    </div>
  );
}
