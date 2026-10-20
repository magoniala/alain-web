import { UTM_KEYS, type Utm } from "@/lib/entrenatzaile-formularios";

// Solo el origen de la campaña se lee de la URL (la newsletter enlaza con
// ?utm_source=diario). Las respuestas van en el cuerpo del POST y punto.
export function leerUtm(): Utm {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v;
  }
  if (document.referrer) utm.referrer = document.referrer;
  return utm;
}

export const casillaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.6rem",
  cursor: "pointer",
  fontSize: "0.95rem",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.72)",
};

export const pistaStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  fontStyle: "italic",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.50)",
  marginBottom: "0.7rem",
};

export const botonClase =
  "rounded-xl scale-100 bg-[#0F2240] text-[#F7F1E6] shadow-md transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-lg";

export const botonStyle = (enviando: boolean): React.CSSProperties => ({
  marginTop: "2.5rem",
  border: "none",
  padding: "0.95rem 2.5rem",
  fontSize: "0.98rem",
  letterSpacing: "0.08em",
  cursor: enviando ? "default" : "pointer",
  display: "block",
  opacity: enviando ? 0.6 : 1,
});
