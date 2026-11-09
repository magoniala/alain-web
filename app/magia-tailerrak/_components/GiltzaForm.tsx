"use client";

import { useState } from "react";
import { boton, input } from "./estiloa";

/** Pide la palabra mágica escrita a mano en el librillo. */
export default function GiltzaForm({ librillo }: { librillo: string }) {
  const [giltza, setGiltza] = useState("");
  const [bidaltzen, setBidaltzen] = useState(false);
  const [mezua, setMezua] = useState("");

  async function bidali(e: React.FormEvent) {
    e.preventDefault();
    if (!giltza.trim()) return setMezua("Idatzi hitz magikoa.");
    setBidaltzen(true);
    setMezua("");
    const res = await fetch("/api/magia-tailerrak/aukeratu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ librillo, giltza }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) { window.location.href = `/magia-tailerrak/${librillo}`; return; }
    setBidaltzen(false);
    setMezua(d.error || "Zerbait gaizki joan da. Saiatu berriro.");
  }

  return (
    <form onSubmit={bidali}>
      <input
        value={giltza} autoComplete="off" autoCapitalize="none" spellCheck={false}
        onChange={(e) => { setGiltza(e.target.value); setMezua(""); }}
        placeholder="Hitz magikoa" aria-label="Hitz magikoa" className="placeholder:text-[#F2F2F0]/30"
        style={{ ...input, fontSize: "1.3rem", letterSpacing: "0.05em", marginBottom: "1.25rem" }}
      />
      {mezua && <p role="alert" style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{mezua}</p>}
      <button type="submit" disabled={bidaltzen} style={boton}>
        {bidaltzen ? "…" : "Ireki nire magia-gunea"}
      </button>
    </form>
  );
}
