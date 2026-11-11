"use client";

import { useState } from "react";

// «Aplazar»: la acción de esta tarjeta pasa a otro día (p. ej. «la llamo mañana»).
// Mueve la fecha de la próxima acción de la ficha, apunta una línea en el Registro y
// cierra la tarjeta sin marcarla como hecha. El día elegido, el sistema la vuelve a sacar.

const iso = (d: Date) => d.toLocaleDateString("sv-SE");
const mas = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
};
const proximoLunes = () => {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d;
};
const corto = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" });

export default function AplazarTarea({ onAplazar, ocupado, deshabilitado = false, titulo }: { onAplazar: (fecha: string) => void; ocupado: boolean; deshabilitado?: boolean; titulo?: string }) {
  const [fecha, setFecha] = useState("");
  const opciones: [string, Date][] = [
    ["Mañana", mas(1)],
    ["En 3 días", mas(3)],
    ["Lunes", proximoLunes()],
  ];
  const off = ocupado || deshabilitado;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-[0.8rem]" title={titulo}>
      <span className="text-gray-500">Aplazar a:</span>
      {opciones.map(([etiqueta, d]) => (
        <button key={etiqueta} onClick={() => onAplazar(iso(d))} disabled={off} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
          {etiqueta} <span className="text-gray-400">({corto(d)})</span>
        </button>
      ))}
      <input type="date" value={fecha} min={iso(new Date())} onChange={(e) => setFecha(e.target.value)} className="border border-gray-300 px-2 py-1 text-gray-900" />
      <button onClick={() => fecha && onAplazar(fecha)} disabled={off || !fecha} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
        Aplazar
      </button>
    </div>
  );
}
