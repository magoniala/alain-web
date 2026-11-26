"use client";

import { useState } from "react";
import { CONTENIDO } from "./_contenido";
import { BOTON_PAGO, CASILLA_NEWSLETTER } from "@/lib/preventa-textos";
import type { Idioma, Oferta } from "@/lib/preventa-reglas";
import { AMBER, CARD, LINE, NAVY, fieldStyle, inputStyle, labelStyle } from "../_ui";

// Formulario de compra en dos pasos:
//   1) nombre + correo + casilla de newsletter (aparte y sin marcar) → el
//      servidor dice si ese correo puede comprar hoy y si lleva el bonus
//   2) se enseña el precio final con IVA, la fecha de entrega y el
//      desistimiento, y el botón "Pedido con obligación de pago" → Stripe.

export default function CompraForm({ idioma, boton: textoBoton }: { idioma: Idioma; boton: string }) {
  const t = CONTENIDO[idioma].form;
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [paso, setPaso] = useState<"datos" | "resumen">("datos");
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [info, setInfo] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function llamar(accion: "resumen" | "pagar") {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/entrenatzaile/preventa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, email, nombre, idioma, newsletter }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.error === "email") return setError(t.errorEmail);
      if (accion === "resumen") {
        if (!r.ok) return setError(t.errorGeneral);
        setOferta(d.oferta);
        setInfo(d.info ?? []);
        setPaso("resumen");
        return;
      }
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      if (d.oferta) {
        setOferta(d.oferta);
        setPaso("resumen");
        return;
      }
      setError(t.errorGeneral);
    } catch {
      setError(t.errorGeneral);
    } finally {
      setCargando(false);
    }
  }

  const boton =
    "inline-block rounded-xl bg-[#0F2240] px-8 py-4 text-[0.98rem] tracking-[0.06em] text-[#F7F1E6] shadow-md transition-all duration-200 hover:brightness-110 disabled:opacity-50";

  if (paso === "resumen" && oferta) {
    return (
      <div>
        {oferta.tipo === "comprar" ? (
          <>
            <p style={{ ...labelStyle, color: AMBER }}>{t.antesDePagar}</p>
            <ul style={{ margin: "0 0 1.6rem 0", padding: 0, listStyle: "none" }}>
              {info.map((l, i) => (
                <li key={i} style={{ color: NAVY, lineHeight: 1.65, marginBottom: "0.55rem", fontSize: "1.02rem" }}>
                  {l}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: "0.9rem", color: "rgba(15,34,64,0.7)", marginBottom: "1.4rem" }}>
              <a href="#devolucion" style={{ textDecoration: "underline" }}>
                {t.verDesistimiento}
              </a>
            </p>
            <button type="button" className={boton} disabled={cargando} onClick={() => llamar("pagar")}>
              {cargando ? t.cargando : BOTON_PAGO[idioma]}
            </button>
          </>
        ) : (
          <p style={{ color: NAVY, fontSize: "1.05rem", lineHeight: 1.7 }}>
            {oferta.tipo === "ya_la_tiene" ? t.yaLaTiene : t.noAbierta}
          </p>
        )}
        {error && <p style={{ color: "#A33", marginTop: "1rem" }}>{error}</p>}
        <p style={{ marginTop: "1.4rem" }}>
          <button type="button" onClick={() => setPaso("datos")} style={{ color: "rgba(15,34,64,0.7)", textDecoration: "underline", fontSize: "0.92rem" }}>
            {t.cambiarCorreo}
          </button>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        llamar("resumen");
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="pv-nombre">
          {t.nombre}
        </label>
        <input id="pv-nombre" style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" maxLength={120} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="pv-email">
          {t.email}
        </label>
        <input id="pv-email" type="email" required style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} />
      </div>
      <label style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", marginBottom: "2rem", cursor: "pointer", padding: "0.9rem 1rem", border: `1px solid ${LINE}`, background: CARD, borderRadius: "0.6rem" }}>
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} style={{ marginTop: "0.3rem" }} />
        <span style={{ fontSize: "0.95rem", color: NAVY, lineHeight: 1.55 }}>{CASILLA_NEWSLETTER[idioma]}</span>
      </label>
      <button type="submit" className={boton} disabled={cargando}>
        {cargando ? t.cargando : textoBoton}
      </button>
      {error && <p style={{ color: "#A33", marginTop: "1rem" }}>{error}</p>}
    </form>
  );
}
