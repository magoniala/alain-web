"use client";

import Link from "next/link";
import { useState } from "react";
import { K } from "./estiloa";

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
      <Link href="/magia-tailerrak" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: K.fg, fontWeight: 500, fontSize: "0.95rem", textDecoration: "none" }}>
        <span aria-hidden style={{ width: 20, height: 28, borderRadius: 4, background: K.fg, color: K.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", boxShadow: `0 0 0 1px ${K.cyan}` }}>♠</span>
        Niala magoa
      </Link>
      {email ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.8rem", color: K.muy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45vw" }}>{email}</span>
          <button onClick={irten} disabled={irtetzen} style={lotura}>Irten</button>
        </div>
      ) : (
        <Link href="/magia-tailerrak/sartu" style={{ ...lotura, border: `1px solid ${K.borde}`, borderRadius: 999, padding: "0.4rem 0.95rem" }}>Sartu</Link>
      )}
    </header>
  );
}
