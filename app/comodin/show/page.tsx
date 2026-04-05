"use client";

import { useState } from "react";

export default function ComodinShowPage() {
  const [playing, setPlaying] = useState(false);

  const VIDEO_ID = "3JJe0WcmTE8";

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", padding: "3rem 1.5rem 5rem" }}>
      <div style={{ width: "100%", maxWidth: "760px", margin: "0 auto" }}>

        {/* Header */}
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", textAlign: "center", marginBottom: "3.5rem" }}>
          Alain Zulaika
        </p>

        {/* Erritual */}
        <div style={{ marginBottom: "3.5rem" }}>
          <p style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "2.5rem" }}>
            Play sakatu aurretik.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", fontSize: "1.05rem", lineHeight: 1.85, color: "rgba(242,242,240,0.70)" }}>
            <p>Konektatu mugikorra edo ordenagailu eramangarria telebistara.</p>
            <p>Prestatu kresal batzuk.</p>
            <p>Bildu zurekin bizi dena.</p>
            <p style={{ color: "rgba(242,242,240,0.40)", fontStyle: "italic" }}>
              Gogoa baduzu: inprimatu sarrerak eta eskatu atean.
            </p>
          </div>

          <div style={{ borderTop: "1px solid rgba(242,242,240,0.08)", margin: "2.5rem 0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", fontSize: "1.05rem", lineHeight: 1.85, color: "rgba(242,242,240,0.55)" }}>
            <p>Antzerkia ez da soilik eszenatokian gertatzen dena.</p>
            <p>Sartu aurretiko urduria da.<br />Argiak itzaltzean egiten den isiltasuna.<br />Denbora hori gorde izana.<br />Norbait ondoan izanik bizi izana.</p>
            <p>Erritual horrek zero euro balio du.<br />Eta gero datorren guztia bikoitza bihurtzen du.</p>
          </div>
        </div>

        {/* Video */}
        <p style={{ fontSize: "0.9rem", color: "rgba(242,242,240,0.35)", textAlign: "center", marginBottom: "1.25rem", letterSpacing: "0.02em" }}>
          Bihurtu zure egongela mikroantzoki bat · 18 min
        </p>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
          {playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
              title="Bihurtu zure egongela mikroantzoki bat"
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
