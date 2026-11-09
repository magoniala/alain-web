"use client";

import Link from "next/link";
import { useState } from "react";
import { K, etiqueta } from "./estiloa";

/** Cabecera: marca a la izquierda; «Sartu» o el email + «Irten» a la derecha. */
export default function Goiburua({ email }: { email: string | null }) {
  const [irtetzen, setIrtetzen] = useState(false);
  async function irten() {
    setIrtetzen(true);
    await fetch("/api/magia-tailerrak/irten", { method: "POST" });
    window.location.href = "/magia-tailerrak";
  }
  const lotura = { color: K.tenue, fontSize: "0.85rem", textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0 };
  return (
    <header style={{ padding: "1.5rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
      <Link href="/magia-tailerrak" style={{ ...etiqueta, textDecoration: "none" }}>Niala magoa</Link>
      {email ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.8rem", color: K.muy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45vw" }}>{email}</span>
          <button onClick={irten} disabled={irtetzen} style={lotura}>Irten</button>
        </div>
      ) : (
        <Link href="/magia-tailerrak/sartu" style={{ ...lotura, border: `1px solid ${K.borde}`, padding: "0.35rem 0.8rem" }}>Sartu</Link>
      )}
    </header>
  );
}
