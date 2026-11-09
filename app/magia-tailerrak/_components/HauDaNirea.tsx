"use client";

import { useState } from "react";
import { boton } from "./estiloa";

/** Sin cuenta: cambiar de librillo si se eligió el que no era. */
export default function HauDaNirea({ librillo }: { librillo: string }) {
  const [bidaltzen, setBidaltzen] = useState(false);
  async function aldatu() {
    setBidaltzen(true);
    await fetch("/api/magia-tailerrak/aukeratu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ librillo }),
    });
    window.location.reload();
  }
  return (
    <button onClick={aldatu} disabled={bidaltzen} style={boton}>
      {bidaltzen ? "…" : "Hau da nire liburutxoa"}
    </button>
  );
}
