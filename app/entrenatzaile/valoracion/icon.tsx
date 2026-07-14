import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF3E8",
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "68%",
            height: "68%",
            borderRadius: "50%",
            background: "#D4860A",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
