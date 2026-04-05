"use client";

import Link from "next/link";
import { useState } from "react";

type Opcion = "aprender" | "ver" | "contratar";

const VIDEO_ID = "3JJe0WcmTE8";

export default function ComodinPage() {
  const [selected, setSelected] = useState<Opcion | null>(null);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [playing, setPlaying] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Introduce un correo válido.");
      return;
    }
    setEmailError("");
    setEmailStatus("sending");

    const res = await fetch("/api/comodin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (res.ok) {
      setEmailStatus("done");
    } else {
      setEmailStatus("error");
      setEmailError("Algo fue mal. Inténtalo de nuevo.");
    }
  }

  const opciones: { key: Opcion; label: string; sub: string }[] = [
    { key: "aprender", label: "Aprenderlo", sub: "Tú sorprendes a otros" },
    { key: "ver",      label: "Verlo",      sub: "Lo compartís y sorprendéis juntos" },
    { key: "contratar",label: "Contratarlo", sub: "Él sorprende a los tuyos" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0" }}>
      {/* Header */}
      <header style={{ padding: "1.75rem 2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6" }}>
          Alain Zulaika
        </p>
      </header>

      {/* Content */}
      <section style={{ maxWidth: "580px", margin: "0 auto", padding: "3rem 1.5rem 6rem", textAlign: "center" }}>

        {/* Opening */}
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "rgba(242,242,240,0.38)", marginBottom: "1.75rem" }}>
          El comodín
        </p>
        <h1 style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: "1.5rem" }}>
          Eso que tienes en la mano ya es el primer truco.
        </h1>
        <p style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)", lineHeight: 1.75, color: "rgba(242,242,240,0.55)", marginBottom: "4rem" }}>
          ¿Qué quieres hacer ahora?
        </p>

        {/* Opciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginBottom: selected ? "2.5rem" : "0" }}>
          {opciones.map((op) => {
            const isSelected = selected === op.key;
            const isDimmed = selected !== null && !isSelected;
            return (
              <button
                key={op.key}
                onClick={() => {
                  setSelected(isSelected ? null : op.key);
                  setPlaying(false);
                }}
                style={{
                  background: "transparent",
                  border: `1px solid ${isSelected ? "rgba(46,211,230,0.55)" : "rgba(242,242,240,0.16)"}`,
                  padding: "1.2rem 1.75rem",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: isDimmed ? 0.3 : 1,
                  transition: "all 0.25s",
                }}
              >
                <span>
                  <span style={{
                    display: "block",
                    fontSize: "1rem",
                    letterSpacing: "0.04em",
                    color: isSelected ? "#2ED3E6" : "rgba(242,242,240,0.85)",
                    fontWeight: isSelected ? 500 : 400,
                    transition: "color 0.25s",
                    marginBottom: "0.2rem",
                  }}>
                    {op.label}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.38)" }}>
                    {op.sub}
                  </span>
                </span>
                <span style={{ fontSize: "1rem", color: isSelected ? "#2ED3E6" : "rgba(242,242,240,0.28)" }}>
                  {isSelected ? "−" : "+"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenido según opción */}

        {selected === "aprender" && (
          emailStatus === "done" ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
              <p style={{ fontSize: "clamp(1.6rem, 2.5vw, 2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                Perfecto.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", lineHeight: 1.75 }}>
                El truco está en tu correo.
              </p>
              <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.32)", marginTop: "0.75rem" }}>
                Si no lo ves, revisa la carpeta de spam.
              </p>
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(242,242,240,0.12)", background: "rgba(242,242,240,0.02)", padding: "2rem 1.75rem", textAlign: "left" }}>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(242,242,240,0.82)", marginBottom: "1.25rem" }}>
                Te mando un tutorial corto: un truco que puedes hacer esta semana con lo que tengas en casa.
              </p>
              <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "0.4rem" }}>Sin experiencia previa.</p>
              <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "2rem" }}>En tres minutos ya lo sabes hacer.</p>
              <form onSubmit={handleEmailSubmit}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  placeholder="Tu correo electrónico aquí"
                  className="placeholder:text-[#F2F2F0]/30"
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(242,242,240,0.22)",
                    padding: "0.75rem 0",
                    fontSize: "1rem",
                    color: "#F2F2F0",
                    outline: "none",
                    marginBottom: emailError ? "0.5rem" : "1.75rem",
                    boxSizing: "border-box",
                  }}
                />
                {emailError && (
                  <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{emailError}</p>
                )}
                <button
                  type="submit"
                  disabled={emailStatus === "sending"}
                  className="w-full border border-white/20 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "transparent", cursor: "pointer" }}
                >
                  {emailStatus === "sending" ? "Enviando..." : "Quiero el truco"}
                </button>
              </form>
            </div>
          )
        )}

        {selected === "ver" && (
          <div>
            <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.40)", marginBottom: "1.25rem" }}>
              "Convierte tu sala en un microteatro" · 20 min
            </p>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
              {playing ? (
                <iframe
                  src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                  title="Convierte tu sala en un microteatro"
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
        )}

        {selected === "contratar" && (
          <div style={{ border: "1px solid rgba(242,242,240,0.12)", background: "rgba(242,242,240,0.02)", padding: "2rem 1.75rem", textAlign: "left" }}>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(242,242,240,0.82)", marginBottom: "1.5rem" }}>
              Para eventos de empresa, cumpleaños, hostelería, cultura...
            </p>
            <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "2rem" }}>
              Diez minutos de conversación suelen aclarar si tiene sentido.
            </p>
            <Link
              href="/contacto"
              className="inline-block border border-white/20 px-8 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6]"
            >
              Hablemos
            </Link>
          </div>
        )}

      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "1.75rem 2rem", borderTop: "1px solid rgba(242,242,240,0.06)" }}>
        <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.25)" }}>© Alain Zulaika</p>
      </footer>
    </main>
  );
}
