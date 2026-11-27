"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HIZKUNTZA_COOKIE, TESTUAK, URTE_BAT_S, type Hizkuntza } from "@/lib/magia-hizkuntza";
import { K } from "./estiloa";

/** Selector EU | ES: guarda el idioma en la cookie `lang` (la de toda la web) y recarga. */
function HizkuntzaAukera({ h }: { h: Hizkuntza }) {
  const [aldatzen, setAldatzen] = useState(false);
  function aukeratu(berria: Hizkuntza) {
    if (berria === h || aldatzen) return;
    setAldatzen(true);
    document.cookie = `${HIZKUNTZA_COOKIE}=${berria}; path=/; max-age=${URTE_BAT_S}; samesite=lax`;
    window.location.reload();
  }
  const botoia = (aktiboa: boolean) => ({
    background: aktiboa ? K.fg : "transparent", color: aktiboa ? K.bg : K.tenue, border: "none", borderRadius: 999,
    padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em", cursor: aktiboa ? "default" : "pointer",
  });
  return (
    <div role="group" aria-label={TESTUAK[h].aldatuHizkuntza} style={{ display: "inline-flex", border: `1px solid ${K.borde}`, borderRadius: 999, padding: 2, flexShrink: 0 }}>
      <button type="button" lang="eu" aria-pressed={h === "eu"} onClick={() => aukeratu("eu")} style={botoia(h === "eu")}>EU</button>
      <button type="button" lang="es" aria-pressed={h === "es"} onClick={() => aukeratu("es")} style={botoia(h === "es")}>ES</button>
    </div>
  );
}

/** Cabecera: marca a la izquierda; idioma y «Sartu» o el email + «Irten» a la derecha. */
export default function Goiburua({ email, h }: { email: string | null; h: Hizkuntza }) {
  const t = TESTUAK[h];
  const [irtetzen, setIrtetzen] = useState(false);
  // El <html> de la web es lang="eu"; en castellano se corrige aquí (lectores de pantalla, traductor).
  useEffect(() => { document.documentElement.lang = h; }, [h]);
  async function irten() {
    setIrtetzen(true);
    await fetch("/api/magia-tailerrak/irten", { method: "POST" });
    window.location.href = "/magia-tailerrak";
  }
  const lotura = { color: K.tenue, fontSize: "0.85rem", textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0 };
  return (
    <header style={{ padding: "1.5rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
      <Link href="/magia-tailerrak" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: K.fg, fontWeight: 500, fontSize: "0.95rem", textDecoration: "none", flexShrink: 0 }}>
        <span aria-hidden style={{ width: 20, height: 28, borderRadius: 4, background: K.fg, color: K.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", boxShadow: `0 0 0 1px ${K.cyan}` }}>♠</span>
        {t.izena}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
        <HizkuntzaAukera h={h} />
        {email ? (
          <>
            <span style={{ fontSize: "0.8rem", color: K.muy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "30vw" }}>{email}</span>
            <button onClick={irten} disabled={irtetzen} style={lotura}>{t.irten}</button>
          </>
        ) : (
          <Link href="/magia-tailerrak/sartu" style={{ ...lotura, border: `1px solid ${K.borde}`, borderRadius: 999, padding: "0.4rem 0.95rem", whiteSpace: "nowrap" }}>{t.sartu}</Link>
        )}
      </div>
    </header>
  );
}
