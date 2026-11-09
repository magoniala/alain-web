"use client";

import { useEffect } from "react";

/** Sin cuenta ni librillo elegido: el primero que abre pasa a ser «el suyo». */
export default function Gogoratu({ librillo }: { librillo: string }) {
  useEffect(() => {
    fetch("/api/magia-tailerrak/aukeratu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ librillo }),
    }).catch(() => {});
  }, [librillo]);
  return null;
}
