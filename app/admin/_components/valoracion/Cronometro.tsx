"use client";

import { useEffect, useRef, useState } from "react";

// Cronómetro para los tests con tiempo: cuenta atrás de 10 s (bird-dog),
// 30 s (sit-to-stand, monopodal), 1 min (sentadillas) y 2 min (step), y cronómetro libre para
// la plancha y el monopodal. Pita al terminar la cuenta atrás.
type Estado =
  | { tipo: "parado"; ms: number; total: number | null }
  | { tipo: "corriendo"; inicio: number; base: number; total: number | null };

function pitido(veces = 1) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < veces; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.3;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
    }
    setTimeout(() => ctx.close(), veces * 300 + 400);
  } catch {
    // Sin audio no pasa nada: el número se ve igual.
  }
}

function formato(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const resto = s - m * 60;
  return `${m}:${resto.toFixed(1).padStart(4, "0")}`;
}

export default function Cronometro() {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado", ms: 0, total: null });
  const [, setTick] = useState(0);
  const avisado = useRef(false);

  useEffect(() => {
    if (estado.tipo !== "corriendo") return;
    const t = setInterval(() => setTick((x) => x + 1), 100);
    return () => clearInterval(t);
  }, [estado.tipo]);

  const transcurrido = estado.tipo === "corriendo" ? estado.base + (Date.now() - estado.inicio) : estado.ms;
  const total = estado.total;
  const mostrado = total !== null ? total - transcurrido : transcurrido;

  useEffect(() => {
    if (estado.tipo === "corriendo" && total !== null && transcurrido >= total && !avisado.current) {
      avisado.current = true;
      pitido(2);
      setEstado({ tipo: "parado", ms: total, total });
    }
  });

  function cuenta(segundos: number) {
    avisado.current = false;
    setEstado({ tipo: "corriendo", inicio: Date.now(), base: 0, total: segundos * 1000 });
  }
  function libre() {
    avisado.current = false;
    setEstado({ tipo: "corriendo", inicio: Date.now(), base: 0, total: null });
  }
  function pausar() {
    if (estado.tipo === "corriendo") setEstado({ tipo: "parado", ms: transcurrido, total });
    else if (estado.ms > 0 && (total === null || estado.ms < total))
      setEstado({ tipo: "corriendo", inicio: Date.now(), base: estado.ms, total });
  }
  function reset() {
    avisado.current = false;
    setEstado({ tipo: "parado", ms: 0, total: null });
  }

  const boton = "border border-gray-300 bg-white px-2 py-1 text-[0.75rem] text-gray-600 hover:border-gray-500";
  const corriendo = estado.tipo === "corriendo";
  const acabado = total !== null && !corriendo && estado.ms >= total;

  return (
    <div className="border border-gray-200 bg-white p-3">
      <p className="mb-1 text-[0.68rem] uppercase tracking-[0.14em] text-gray-400">
        {total !== null ? "Cuenta atrás" : "Cronómetro"}
      </p>
      <p
        className={`mb-2 font-mono text-[1.9rem] leading-none tabular-nums ${
          acabado ? "text-[#B3261E]" : corriendo ? "text-[#1a1a1a]" : "text-gray-500"
        }`}
      >
        {formato(mostrado)}
      </p>
      <div className="mb-1.5 flex flex-wrap gap-1">
        <button type="button" className={boton} onClick={() => cuenta(10)}>
          10 s
        </button>
        <button type="button" className={boton} onClick={() => cuenta(30)}>
          30 s
        </button>
        <button type="button" className={boton} onClick={() => cuenta(60)}>
          1 min
        </button>
        <button type="button" className={boton} onClick={() => cuenta(120)}>
          2 min
        </button>
        <button type="button" className={boton} onClick={libre}>
          Libre
        </button>
      </div>
      <div className="flex gap-1">
        <button type="button" className={`${boton} flex-1`} onClick={pausar}>
          {corriendo ? "Parar" : "Seguir"}
        </button>
        <button type="button" className={`${boton} flex-1`} onClick={reset}>
          Cero
        </button>
      </div>
    </div>
  );
}
