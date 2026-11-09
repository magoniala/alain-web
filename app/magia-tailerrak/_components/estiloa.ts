// Colores y estilos comunes de la plataforma de magia (la «baraja»: ver magia.module.css).
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
export const etiqueta: CSSProperties = { fontSize: "0.9rem", color: K.cyan };
export const tarjeta: CSSProperties = { border: `1px solid ${K.borde}`, background: K.caja, padding: "1.5rem 1.25rem" };
export const boton: CSSProperties = {
  width: "100%", background: K.cyan, color: K.bg, border: "none", borderRadius: 999,
  padding: "0.95rem 1.25rem", fontSize: "1rem", fontWeight: 600, cursor: "pointer",
};
export const input: CSSProperties = {
  width: "100%", background: "rgba(242,242,240,0.04)", border: "1px solid rgba(242,242,240,0.18)", borderRadius: 10,
  padding: "0.85rem 1rem", fontSize: "1rem", color: K.fg, boxSizing: "border-box", fontFamily: "inherit",
};
