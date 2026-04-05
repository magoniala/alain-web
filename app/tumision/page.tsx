"use client";

import { useState } from "react";

export default function MisionPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Sartu posta elektroniko baliodun bat.");
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
      setError("Zerbait gaizki joan da. Saiatu berriro.");
    }
  }

  if (status === "done") {
    return (
      <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
          Alain Zulaika
        </p>
        <p style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
          Misioa onartua.
        </p>
        <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.60)", maxWidth: "440px", lineHeight: 1.75 }}>
          Egiaztatu zure posta. Lehen sekretua dagoeneko bidean dago.
        </p>
        <p style={{ fontSize: "0.9rem", color: "rgba(242,242,240,0.35)", maxWidth: "380px", lineHeight: 1.7, marginTop: "1.25rem" }}>
          Minutu batzuetan agertzen ez bada, begiratu spam karpeta.
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

      {/* Content */}
      <section style={{ maxWidth: "540px", margin: "0 auto", padding: "3rem 1.5rem 6rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "2rem" }}>
          Zure misioa ez da hemen amaitzen.
        </h1>

        <div style={{ marginBottom: "3rem" }}>
          <p style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)", lineHeight: 1.75, color: "rgba(242,242,240,0.65)", marginBottom: "0.6rem" }}>
            Txanpon batek zure seme-alabari ilusioa eman diezaioke.
          </p>
          <p style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)", lineHeight: 1.75, color: "rgba(242,242,240,0.65)" }}>
            Baina aita-seme oroitzapen bat sortzeak ez du preziorik.
          </p>
        </div>

        {/* Card */}
        <div style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)", padding: "2.5rem 2rem", textAlign: "left" }}>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "rgba(242,242,240,0.85)", marginBottom: "2rem" }}>
            Utzi iezadazu aste honetan zeure seme-alabarekin<br />
            egin ditzakezun truko bat edo bi bidaltzen.
          </p>

          <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", marginBottom: "0.5rem" }}>Aurre esperientziarik gabe.</p>
          <p style={{ fontSize: "1rem", color: "rgba(242,242,240,0.55)", marginBottom: "2rem" }}>Etxean dituzun materialekin.</p>

          <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(242,242,240,0.65)", marginBottom: "2.5rem" }}>
            3 minutu baino gutxiago beharko dituzu sekretu bakoitza ikasteko.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
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
              className="w-full border border-white/20 py-4 text-[0.95rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "transparent", cursor: "pointer" }}
            >
              {status === "sending" ? "Bidaltzen..." : "Nire misioa onartzen dut"}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "1.75rem 2rem", borderTop: "1px solid rgba(242,242,240,0.06)" }}>
        <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.25)" }}>© 2025 Alain Zulaika.</p>
      </footer>
    </main>
  );
}
