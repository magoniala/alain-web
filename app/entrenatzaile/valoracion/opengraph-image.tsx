import { ImageResponse } from "next/og";

export const alt = "Entrenatzaile — Valoración gratuita";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#D4860A",
          padding: "90px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#0F2240",
            marginBottom: 36,
          }}
        >
          Entrenatzaile · Valoración gratuita
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#0F2240",
            maxWidth: 1000,
          }}
        >
          ¿Y si llevas años dando vueltas?
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#1C3A5E",
            marginTop: 36,
            maxWidth: 860,
          }}
        >
          No necesitas más esfuerzo. Necesitas un mejor mapa.
        </div>
      </div>
    ),
    { ...size }
  );
}
