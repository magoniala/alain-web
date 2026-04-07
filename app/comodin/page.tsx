"use client";

import Link from "next/link";
import { useState } from "react";

type Opcion = "ikasi" | "ikusi" | "kontratatu";

export default function ComodinPage() {
  const [selected, setSelected] = useState<Opcion | null>(null);
  const [hovered, setHovered] = useState<Opcion | null>(null);

  // "Ikasi" flow
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  // "Ikusi" flow
  const [verEmail, setVerEmail] = useState("");
  const [verStatus, setVerStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [verError, setVerError] = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Sartu posta elektroniko baliodun bat.");
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
      setEmailError("Zerbait gaizki joan da. Saiatu berriro.");
    }
  }

  async function handleVerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verEmail.trim())) {
      setVerError("Sartu posta elektroniko baliodun bat.");
      return;
    }
    setVerError("");
    setVerStatus("sending");

    const res = await fetch("/api/comodin/show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: verEmail.trim() }),
    });

    if (res.ok) {
      setVerStatus("done");
    } else {
      setVerStatus("error");
      setVerError("Zerbait gaizki joan da. Saiatu berriro.");
    }
  }

  const opciones: { key: Opcion; label: string; sub: string }[] = [
    { key: "ikasi",      label: "Ikasi",      sub: "Besteei zuk zeuk arritzeko" },
    { key: "ikusi",      label: "Ikusi",      sub: "Eta harritu zaitez bakarrik edo lagunartean" },
    { key: "kontratatu", label: "Kontratatu", sub: "Eta nik (Alainek) harrituko ditut zureak" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0" }}>
      {/* Header */}
      <header style={{ padding: "1.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6" }}>
          Alain Zulaika
        </p>
        <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
          <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EUS</span>
          <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
          <Link href="/es/comodin" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
        </div>
      </header>

      {/* Content */}
      <section style={{ maxWidth: "580px", margin: "0 auto", padding: "3rem 1.5rem 6rem", textAlign: "center" }}>

        {/* Opening */}
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "rgba(242,242,240,0.38)", marginBottom: "1.75rem" }}>
          Komodina
        </p>
        <h1 style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: "1.5rem" }}>
          Eskuan duzun hori dagoeneko lehen trukua da.
        </h1>
        <p style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)", lineHeight: 1.75, color: "rgba(242,242,240,0.55)", marginBottom: "4rem" }}>
          Zer egin nahi duzu orain?
        </p>

        {/* Opciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginBottom: selected ? "2.5rem" : "0" }}>
          {opciones.map((op) => {
            const isSelected = selected === op.key;
            const isDimmed = selected !== null && !isSelected;
            const isHovered = hovered === op.key && !isDimmed;
            return (
              <button
                key={op.key}
                onClick={() => {
                  setSelected(isSelected ? null : op.key);
                }}
                onMouseEnter={() => setHovered(op.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: "transparent",
                  border: `1px solid ${isSelected ? "rgba(46,211,230,0.55)" : isHovered ? "rgba(46,211,230,0.35)" : "rgba(242,242,240,0.16)"}`,
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
                    color: isSelected ? "#2ED3E6" : isHovered ? "rgba(242,242,240,1)" : "rgba(242,242,240,0.85)",
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

        {selected === "ikasi" && (
          emailStatus === "done" ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
              <p style={{ fontSize: "clamp(1.6rem, 2.5vw, 2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                Bikain.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", lineHeight: 1.75 }}>
                Trukoa zure postan dago.
              </p>
              <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.32)", marginTop: "0.75rem" }}>
                Ikusten ez baduzu, begiratu spam karpeta.
              </p>
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(242,242,240,0.12)", background: "rgba(242,242,240,0.02)", padding: "2rem 1.75rem", textAlign: "left" }}>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(242,242,240,0.82)", marginBottom: "1.25rem" }}>
                Aste honetan etxean duzunarekin egin dezakezun truko baten TUTORIAL bat bidaliko dizut.
              </p>
              <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "0.4rem" }}>Ez duzu aurre esperiantziarik behar.</p>
              <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "2rem" }}>Hiru minututan ikasiko duzu.</p>
              <form onSubmit={handleEmailSubmit}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  placeholder="Zure posta elektronikoa hemen"
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
                  {emailStatus === "sending" ? "Bidaltzen..." : "Trukoa nahi dut"}
                </button>
              </form>
            </div>
          )
        )}

        {selected === "ikusi" && (
          verStatus === "done" ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
              <p style={{ fontSize: "clamp(1.6rem, 2.5vw, 2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                Bikain.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", lineHeight: 1.75 }}>
                Show-aren esteka zure postan dago.
              </p>
              <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.32)", marginTop: "0.75rem" }}>
                Ikusten ez baduzu, begiratu spam karpeta.
              </p>
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(242,242,240,0.12)", background: "rgba(242,242,240,0.02)", padding: "2rem 1.75rem", textAlign: "left" }}>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(242,242,240,0.82)", marginBottom: "2rem" }}>
                Zure etxeko egongela mikroteatro batean bihurtuko da 18 minutuz.
              </p>
              <form onSubmit={handleVerSubmit}>
                <input
                  type="email"
                  value={verEmail}
                  onChange={(e) => { setVerEmail(e.target.value); setVerError(""); }}
                  placeholder="Zure posta elektronikoa hemen"
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
                    marginBottom: verError ? "0.5rem" : "1.75rem",
                    boxSizing: "border-box",
                  }}
                />
                {verError && (
                  <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{verError}</p>
                )}
                <button
                  type="submit"
                  disabled={verStatus === "sending"}
                  className="w-full border border-white/20 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "transparent", cursor: "pointer" }}
                >
                  {verStatus === "sending" ? "Bidaltzen..." : "Bidali esteka"}
                </button>
              </form>
            </div>
          )
        )}

        {selected === "kontratatu" && (
          <div style={{ border: "1px solid rgba(242,242,240,0.12)", background: "rgba(242,242,240,0.02)", padding: "2rem 1.75rem", textAlign: "left" }}>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(242,242,240,0.82)", marginBottom: "1.5rem" }}>
              Enpresa, kultura, ostalaritza, pribatuak....
            </p>
            <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.50)", marginBottom: "2rem" }}>
              5 minutuko elkarrizketa batek normalean argi uzten du zentzua duen ala ez.
            </p>
            <Link
              href="/contacto"
              className="inline-block border border-white/20 px-8 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6]"
            >
              Hitz egin dezagun
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
