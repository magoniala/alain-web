"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function IdiomaContent() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const idioma = params.get("idioma");
  const email = params.get("email");

  if (ok) {
    return (
      <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
          Alain Zulaika
        </p>
        <p style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
          {idioma === "eu" ? "Ados, euskaraz bidaliko dizut." : "Perfecto, te escribiré en castellano."}
        </p>
        <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.55)", maxWidth: "420px", lineHeight: 1.75 }}>
          {idioma === "eu"
            ? "Hemendik aurrera, nire emailak euskaraz jasoko dituzu."
            : "A partir de ahora recibirás mis emails en castellano."}
        </p>
      </main>
    );
  }

  if (!email) {
    return (
      <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(242,242,240,0.4)" }}>Enlace no válido.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
        Alain Zulaika
      </p>
      <p style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "2.5rem" }}>
        ¿En qué idioma quieres recibir los emails?
      </p>
      <div style={{ display: "flex", gap: "1rem" }}>
        <a
          href={`/api/newsletter/idioma?email=${encodeURIComponent(email)}&idioma=eu`}
          style={{ padding: "0.9rem 2rem", background: "#2ED3E6", color: "#0B0B0C", fontWeight: 600, fontSize: "1rem", letterSpacing: "0.05em", textDecoration: "none" }}
        >
          Euskara
        </a>
        <a
          href={`/api/newsletter/idioma?email=${encodeURIComponent(email)}&idioma=es`}
          style={{ padding: "0.9rem 2rem", border: "1px solid rgba(242,242,240,0.3)", color: "#F2F2F0", fontWeight: 400, fontSize: "1rem", textDecoration: "none" }}
        >
          Castellano
        </a>
      </div>
    </main>
  );
}

export default function IdiomaPage() {
  return (
    <Suspense>
      <IdiomaContent />
    </Suspense>
  );
}
