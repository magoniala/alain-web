"use client";

import { useState } from "react";
import { TESTUAK, type Hizkuntza } from "@/lib/magia-hizkuntza";
import { boton } from "./estiloa";

/** Sin cuenta: cambiar de librillo si se eligió el que no era. */
export default function HauDaNirea({ librillo, h }: { librillo: string; h: Hizkuntza }) {
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
      {bidaltzen ? "…" : TESTUAK[h].hauDaNirea}
    </button>
  );
}
