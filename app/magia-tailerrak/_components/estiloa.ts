// Colores y estilos comunes de la plataforma de magia (los de /tumision).
import type { CSSProperties } from "react";

export const K = {
  bg: "#0B0B0C",
  fg: "#F2F2F0",
  cyan: "#2ED3E6",
  tenue: "rgba(242,242,240,0.60)",
  muy: "rgba(242,242,240,0.38)",
  borde: "rgba(242,242,240,0.14)",
  caja: "rgba(242,242,240,0.025)",
};

export const main: CSSProperties = { minHeight: "100vh", background: K.bg, color: K.fg };
export const contenedor: CSSProperties = { maxWidth: "680px", margin: "0 auto", padding: "0 1.25rem" };
export const etiqueta: CSSProperties = { fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.28em", color: K.cyan };
export const tarjeta: CSSProperties = { border: `1px solid ${K.borde}`, background: K.caja, padding: "1.5rem 1.25rem" };
export const boton: CSSProperties = {
  width: "100%", background: "transparent", color: K.fg, border: "1px solid rgba(242,242,240,0.3)",
  padding: "0.95rem", fontSize: "0.95rem", letterSpacing: "0.05em", cursor: "pointer",
};
export const input: CSSProperties = {
  width: "100%", background: "transparent", border: "none", borderBottom: "1px solid rgba(242,242,240,0.25)",
  padding: "0.75rem 0", fontSize: "1rem", color: K.fg, outline: "none", boxSizing: "border-box",
};
