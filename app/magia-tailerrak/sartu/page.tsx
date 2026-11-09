"use client";

// Entrar en la plataforma de magia desde otro dispositivo: email → código → dentro.
import Link from "next/link";
import { useState } from "react";
import Goiburua from "../_components/Goiburua";
import Oina from "../_components/Oina";
import { K, boton, contenedor, etiqueta, input, main } from "../_components/estiloa";

export default function Sartu() {
  const [email, setEmail] = useState("");
  const [kodea, setKodea] = useState("");
  const [urratsa, setUrratsa] = useState<"email" | "kodea" | "ezDago">("email");
  const [lanean, setLanean] = useState(false);
  const [mezua, setMezua] = useState("");

  async function kodeaEskatu(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMezua("Sartu posta elektroniko baliodun bat.");
    setLanean(true); setMezua("");
    const res = await fetch("/api/magia-tailerrak/kodea", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setLanean(false);
    if (d.ezDago) return setUrratsa("ezDago");
    if (d.kodea) {
      setUrratsa("kodea");
      return setMezua(d.kodea === "itxaron" ? "Kode bat bidali berri dizugu: begiratu zure posta (baita spama ere)." : "Kode bat bidali dizugu: begiratu zure posta (baita spama ere).");
    }
    setMezua(d.error || "Zerbait gaizki joan da. Saiatu berriro.");
  }

  async function egiaztatu(e: React.FormEvent) {
    e.preventDefault();
    setLanean(true); setMezua("");
    const res = await fetch("/api/magia-tailerrak/egiaztatu", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), kodea }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) { window.location.href = d.librillo ? `/magia-tailerrak/${d.librillo}` : "/magia-tailerrak"; return; }
    setLanean(false);
    setMezua(d.error || "Kode hori ez da zuzena.");
  }

  return (
    <main style={main}>
      <Goiburua email={null} />
      <section style={{ ...contenedor, maxWidth: "460px", padding: "3rem 1.25rem 5rem" }}>
        <p style={{ ...etiqueta, marginBottom: "1rem" }}>Zure magia-gunea</p>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: "1rem" }}>Sartu</h1>

        {urratsa === "ezDago" ? (
          <>
            <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>
              Email horrekin ez dago konturik. Zure liburutxoaren orrian utz dezakezu emaila, opariaren ondoan.
            </p>
            <Link href="/magia-tailerrak" style={{ color: K.cyan }}>Joan liburutxoetara</Link>
          </>
        ) : urratsa === "email" ? (
          <form onSubmit={kodeaEskatu}>
            <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>Idatzi zure emaila eta kode bat bidaliko dizugu.</p>
            <input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setMezua(""); }} placeholder="Zure posta elektronikoa" style={{ ...input, marginBottom: "1.5rem" }} />
            {mezua && <p style={{ fontSize: "0.85rem", color: "#ff6b6b", marginBottom: "1rem" }}>{mezua}</p>}
            <button type="submit" disabled={lanean} style={boton}>{lanean ? "Bidaltzen…" : "Bidali kodea"}</button>
          </form>
        ) : (
          <form onSubmit={egiaztatu}>
            <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>{mezua}</p>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={kodea} onChange={(e) => setKodea(e.target.value.replace(/\D/g, ""))} placeholder="6 zenbakiko kodea" style={{ ...input, fontSize: "1.4rem", letterSpacing: "0.3em", marginBottom: "1.5rem" }} />
            <button type="submit" disabled={kodea.length !== 6 || lanean} style={boton}>{lanean ? "Egiaztatzen…" : "Sartu"}</button>
          </form>
        )}
      </section>
      <Oina />
    </main>
  );
}
