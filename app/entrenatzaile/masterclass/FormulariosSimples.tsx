"use client";

import { useState } from "react";
import type { Idioma } from "@/lib/preventa-reglas";
import { NAVY, fieldStyle, inputStyle, labelStyle as labelBase } from "../_ui";

// Etiquetas legibles para gente de 50+: sin mayúsculas pequeñas (26-11-2026).
const labelStyle: React.CSSProperties = { ...labelBase, fontSize: "1rem", textTransform: "none", letterSpacing: 0, color: "rgba(15,34,64,0.85)", fontWeight: 600 };

const boton =
  "inline-block rounded-xl bg-[#0F2240] px-8 py-4 text-[0.98rem] tracking-[0.06em] text-[#F7F1E6] shadow-md transition-all duration-200 hover:brightness-110 disabled:opacity-50";

const T = {
  es: {
    email: "Correo con el que compraste",
    nombre: "Nombre",
    mensaje: "Qué masterclass y, si quieres, el motivo (no hace falta)",
    enviarEnlace: "Mandarme el enlace",
    enlaceOk: "Si ese correo tiene una compra, te acabo de mandar el enlace. Mira también en spam.",
    desistir: "Enviar el desistimiento",
    desistirOk: "Recibido. Te he mandado un correo de confirmación y te devuelvo el dinero en un máximo de 14 días naturales.",
    cargando: "Un momento…",
    error: "Algo ha fallado. Escríbeme a contacto@alainzulaika.com.",
  },
  eu: {
    email: "Erosteko erabili zenuen posta",
    nombre: "Izena",
    mensaje: "Zein masterclass eta, nahi baduzu, arrazoia (ez da beharrezkoa)",
    enviarEnlace: "Esteka bidali",
    enlaceOk: "Posta horrekin erosketarik badago, esteka bidali dizut. Begiratu spam karpetan ere.",
    desistir: "Atzera egitea bidali",
    desistirOk: "Jaso dut. Berrespen-mezu bat bidali dizut, eta dirua itzuliko dizut gehienez 14 egun naturaleko epean.",
    cargando: "Itxaron…",
    error: "Zerbait gaizki atera da. Idatzi contacto@alainzulaika.com helbidera.",
  },
};

export function EnlaceForm({ idioma }: { idioma: Idioma }) {
  const t = T[idioma];
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"" | "cargando" | "ok" | "error">("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado("cargando");
        const r = await fetch("/api/entrenatzaile/preventa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "enlace", email, idioma }),
        }).catch(() => null);
        setEstado(r?.ok ? "ok" : "error");
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="pv-enlace">
          {t.email}
        </label>
        <input id="pv-enlace" type="email" required style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button className={boton} disabled={estado === "cargando"}>
        {estado === "cargando" ? t.cargando : t.enviarEnlace}
      </button>
      {estado === "ok" && <p style={{ color: NAVY, marginTop: "1rem" }}>{t.enlaceOk}</p>}
      {estado === "error" && <p style={{ color: "#A33", marginTop: "1rem" }}>{t.error}</p>}
    </form>
  );
}

export function DesistimientoForm({ idioma }: { idioma: Idioma }) {
  const t = T[idioma];
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"" | "cargando" | "ok" | "error">("");
  if (estado === "ok") return <p style={{ color: NAVY, fontSize: "1.1rem", lineHeight: 1.7 }}>{t.desistirOk}</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado("cargando");
        const r = await fetch("/api/entrenatzaile/preventa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "desistir", email, nombre, mensaje, idioma }),
        }).catch(() => null);
        setEstado(r?.ok ? "ok" : "error");
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="ds-nombre">
          {t.nombre}
        </label>
        <input id="ds-nombre" style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="ds-email">
          {t.email}
        </label>
        <input id="ds-email" type="email" required style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="ds-mensaje">
          {t.mensaje}
        </label>
        <textarea id="ds-mensaje" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
      </div>
      <button className={boton} disabled={estado === "cargando"}>
        {estado === "cargando" ? t.cargando : t.desistir}
      </button>
      {estado === "error" && <p style={{ color: "#A33", marginTop: "1rem" }}>{t.error}</p>}
    </form>
  );
}
