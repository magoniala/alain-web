export default function EuskeraPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>
        Alain Zulaika
      </p>
      <p style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
        Eginda.
      </p>
      <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.55)", maxWidth: "420px", lineHeight: 1.75 }}>
        Aurrerantzean euskaraz jasoko dituzu mezu elektronikoak.
      </p>
    </main>
  );
}
