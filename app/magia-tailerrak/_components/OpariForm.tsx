"use client";

import Link from "next/link";
import { useState } from "react";
import { K, boton, input } from "./estiloa";

type Egoera = "hasiera" | "bidaltzen" | "kodea" | "errorea";

/** Formulario del extra: email del adulto + casilla. Si ya tenía cuenta, pide el código. */
export default function OpariForm({ librillo, helburua }: { librillo: string; helburua: string }) {
  const [email, setEmail] = useState("");
  const [baimena, setBaimena] = useState(false);
  const [kodea, setKodea] = useState("");
  const [egoera, setEgoera] = useState<Egoera>("hasiera");
  const [mezua, setMezua] = useState("");

  async function bidali(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMezua("Sartu posta elektroniko baliodun bat.");
    if (!baimena) return setMezua("Markatu laukia jarraitzeko.");
    setMezua("");
    setEgoera("bidaltzen");
    const res = await fetch("/api/magia-tailerrak/alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), baimena, librillo }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) { window.location.href = `${helburua}?desblokeatuta=1`; return; }
    if (res.ok && d.kodea) {
      setEgoera("kodea");
      setMezua(d.kodea === "itxaron"
        ? "Kode bat bidali berri dizugu: begiratu zure posta (baita spama ere)."
        : "Email hori badago gure gunean. Kode bat bidali dizugu: begiratu zure posta (baita spama ere).");
      return;
    }
    setEgoera("errorea");
    setMezua(d.error || "Zerbait gaizki joan da. Saiatu berriro.");
  }

  async function egiaztatu(e: React.FormEvent) {
    e.preventDefault();
    setEgoera("bidaltzen");
    const res = await fetch("/api/magia-tailerrak/egiaztatu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), kodea }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) { window.location.href = `${helburua}?desblokeatuta=1`; return; }
    setEgoera("kodea");
    setMezua(d.error || "Kode hori ez da zuzena.");
  }

  if (egoera === "kodea" || (egoera === "bidaltzen" && kodea)) {
    return (
      <form onSubmit={egiaztatu}>
        <p style={{ fontSize: "0.95rem", color: K.tenue, lineHeight: 1.7, marginBottom: "1rem" }}>{mezua}</p>
        <input
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={kodea}
          onChange={(e) => setKodea(e.target.value.replace(/\D/g, ""))}
          placeholder="6 zenbakiko kodea" style={{ ...input, fontSize: "1.4rem", letterSpacing: "0.3em", marginBottom: "1.5rem" }}
        />
        <button type="submit" disabled={kodea.length !== 6 || egoera === "bidaltzen"} style={boton}>
          {egoera === "bidaltzen" ? "Egiaztatzen…" : "Sartu"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={bidali}>
      <input
        type="email" value={email} autoComplete="email"
        onChange={(e) => { setEmail(e.target.value); setMezua(""); }}
        placeholder="Zure posta elektronikoa" className="placeholder:text-[#F2F2F0]/30"
        style={{ ...input, marginBottom: "1.25rem" }}
      />
      <label style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", fontSize: "0.85rem", color: K.tenue, lineHeight: 1.6, marginBottom: "1.5rem", cursor: "pointer" }}>
        <input type="checkbox" checked={baimena} onChange={(e) => { setBaimena(e.target.checked); setMezua(""); }} style={{ marginTop: "0.3rem", accentColor: K.cyan }} />
        <span>
          Heldua naiz eta onartzen dut Alainen mezuak jasotzea (magia-jolas berriak eta bere buletina). Nahi dudanean utz diezaioket jasotzeari.{" "}
          <Link href="/privacidad" style={{ color: K.tenue }}>Pribatutasuna</Link>
        </span>
      </label>
      {mezua && <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{mezua}</p>}
      <button type="submit" disabled={egoera === "bidaltzen"} style={boton}>
        {egoera === "bidaltzen" ? "Bidaltzen…" : "Desblokeatu bideoa"}
      </button>
    </form>
  );
}
