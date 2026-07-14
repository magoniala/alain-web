import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Entrenatzaile — Doako balorazioa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "public/entrenatzaile-logo.png"), "base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
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
            position: "absolute",
            top: 56,
            right: 56,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={140} height={109} />
        </div>
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
          Entrenatzaile · Doako balorazioa
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
          Eta urteak badaramatzazu bueltaka?
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
          Ez duzu beste ahaleginik behar. Mapa hobea behar duzu.
        </div>
      </div>
    ),
    { ...size }
  );
}
