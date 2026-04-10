export default function BajaArrogantePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#DC2626", marginBottom: "2.5rem" }}>
        Experimento — Madrid
      </p>
      <p style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
        Te has dado de baja.
      </p>
      <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.55)", maxWidth: "420px", lineHeight: 1.75 }}>
        No recibirás más emails sobre el experimento.
      </p>
    </main>
  );
}
