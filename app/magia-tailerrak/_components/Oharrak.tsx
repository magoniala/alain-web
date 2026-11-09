"use client";

import { useEffect, useRef, useState } from "react";
import { K } from "./estiloa";

/** Notas del juego, guardadas solo en este dispositivo (localStorage). */
export default function Oharrak({ gakoa }: { gakoa: string }) {
  const k = `magia-oharrak:${gakoa}`;
  const [testua, setTestua] = useState("");
  const [gordeta, setGordeta] = useState(false);
  const kargatuta = useRef(false);
  const tenporizadorea = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let t = "";
    try { t = localStorage.getItem(k) ?? ""; } catch { /* sin almacenamiento: notas solo en memoria */ }
    kargatuta.current = true;
    // Sincronizar con lo guardado en el dispositivo al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setTestua(t);
  }, [k]);

  function aldatu(v: string) {
    setTestua(v);
    setGordeta(false);
    if (tenporizadorea.current) clearTimeout(tenporizadorea.current);
    tenporizadorea.current = setTimeout(() => {
      try { localStorage.setItem(k, v); setGordeta(true); } catch { /* nada */ }
    }, 500);
  }

  return (
    <div>
      <label htmlFor="oharrak" style={{ display: "block", fontSize: "1.15rem", fontWeight: 500, marginBottom: "0.35rem" }}>Nire oharrak</label>
      <p style={{ fontSize: "0.85rem", color: K.muy, marginBottom: "0.75rem" }}>Idatzi hemen zer ikasi duzun edo zer landu behar duzun. Gailu honetan bakarrik gordetzen dira.</p>
      <textarea
        id="oharrak" value={testua} onChange={(e) => aldatu(e.target.value)} rows={5}
        placeholder="Adibidez: eskua lasai mantendu, eta begiratu ikusleari begietara…"
        style={{ width: "100%", boxSizing: "border-box", background: "rgba(242,242,240,0.04)", color: K.fg, border: `1px solid ${K.borde}`, borderRadius: 10, padding: "0.85rem", fontSize: "0.98rem", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }}
      />
      <p aria-live="polite" style={{ fontSize: "0.78rem", color: K.muy, minHeight: "1.2em", marginTop: "0.35rem" }}>{gordeta ? "Gordeta" : ""}</p>
    </div>
  );
}
