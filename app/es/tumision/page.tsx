"use client";

import { useState } from "react";

export default function MisionPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Introduce un correo válido.");
      return;
    }
    setError("");
    setStatus("sending");

    const res = await fetch("/api/mision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      setStatus("error");
      setError("Algo fue mal. Inténtalo de nuevo.");
    }
  }

  if (status === "done") {
    return (
      <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
          Alain Zulaika
        </p>
        <p style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
          Misión aceptada.
        </p>
        <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.60)", maxWidth: "440px", lineHeight: 1.75 }}>
          Revisa tu correo. El primer secreto ya está en camino.
        </p>
        <p style={{ fontSize: "0.9rem", color: "rgba(242,242,240,0.35)", maxWidth: "380px", lineHeight: 1.7, marginTop: "1.25rem" }}>
          Si no aparece en unos minutos, revisa la carpeta de spam.
        </p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0" }}>
      {/* Header */}
      <header style={{ padding: "1.75rem 2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6" }}>
          Alain Zulaika
        </p>
      </header>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "3rem 1.5rem 1.5rem", maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "2rem" }}>
          Tu misión no acaba aquí.
        </h1>
        <p style={{ fontSize: "clamp(1.1rem, 1.6vw, 1.35rem)", lineHeight: 1.7, color: "rgba(242,242,240,0.70)", maxWidth: "500px", margin: "0 auto" }}>
          2 € pueden ilusionar a tu hij@,<br />
          pero el asombro compartido crea recuerdos que no se compran.
        </p>
      </section>

      {/* Form card */}
      <section style={{ maxWidth: "540px", margin: "3rem auto 0", padding: "0 1.5rem" }}>
        <div style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)", padding: "2.5rem 2rem" }}>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "rgba(242,242,240,0.85)", marginBottom: "1.5rem", textAlign: "center" }}>
            Déjame enviarte uno o dos trucos que tú mismo/a<br />
            puedes hacer esta semana con tu hijo/a.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", textAlign: "center", marginBottom: "0.4rem" }}>
            Sin experiencia previa.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", textAlign: "center", marginBottom: "0" }}>
            Con materiales que tienes en casa.
          </p>

          <div style={{ height: "1px", background: "rgba(242,242,240,0.08)", margin: "2rem 0" }} />

          <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(242,242,240,0.65)", textAlign: "center", marginBottom: "0.75rem" }}>
            Tardarás menos de 3 minutos en aprender cada secreto.
          </p>
          <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(242,242,240,0.65)", textAlign: "center", marginBottom: "2.5rem" }}>
            Y puedes crear uno de esos{" "}
            <strong style={{ color: "rgba(242,242,240,0.88)", fontWeight: 500 }}>recuerdos de padre e hijo</strong>
            <br />que duran toda la vida.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
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
                marginBottom: error ? "0.5rem" : "1.75rem",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full border border-white/20 px-10 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "transparent", cursor: "pointer" }}
            >
              {status === "sending" ? "Enviando..." : "Acepto mi misión"}
            </button>
          </form>
        </div>
      </section>

      {/* Pd */}
      <section style={{ maxWidth: "540px", margin: "2.5rem auto 5rem", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.92rem", lineHeight: 1.85, color: "rgba(242,242,240,0.42)" }}>
          <strong style={{ color: "rgba(242,242,240,0.58)", fontWeight: 500 }}>Pd:</strong>{" "}
          Si trabajas en eventos o en una empresa… sigue atento a los próximos mails.
          <br />No solo hago desaparecer pelotas.
        </p>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "1.75rem 2rem", borderTop: "1px solid rgba(242,242,240,0.06)" }}>
        <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.25)" }}>© 2025 por Alain Zulaika.</p>
      </footer>
    </main>
  );
}
