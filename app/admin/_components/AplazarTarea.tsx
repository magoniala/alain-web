"use client";

import { useState } from "react";

// «Aplazar»: la acción de esta tarjeta pasa a otro día (p. ej. «la llamo mañana»).
// Mueve la fecha de la próxima acción de la ficha, apunta una línea en el Registro y
// cierra la tarjeta sin marcarla como hecha. El día elegido, el sistema la vuelve a sacar.
// Desde el 23-11-2026 (decisión de Alain) pide FECHA y MOTIVO, en todos los carriles:
// sin motivo no se aplaza, para no posponer al azar. El motivo queda en el Registro.

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

export default function AplazarTarea({ onAplazar, ocupado, deshabilitado = false, titulo }: { onAplazar: (fecha: string, motivo: string) => void; ocupado: boolean; deshabilitado?: boolean; titulo?: string }) {
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const opciones: [string, Date][] = [
    ["Mañana", mas(1)],
    ["En 3 días", mas(3)],
    ["Lunes", proximoLunes()],
  ];
  const off = ocupado || deshabilitado;
  const listo = !!fecha && motivo.trim().length >= 3;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-[0.8rem]" title={titulo}>
      <span className="text-gray-500">Aplazar a:</span>
      {opciones.map(([etiqueta, d]) => (
        <button key={etiqueta} onClick={() => setFecha(iso(d))} disabled={off} className={`rounded-full px-3 py-1 ring-1 disabled:opacity-40 ${fecha === iso(d) ? "bg-gray-900 text-white ring-gray-900" : "text-gray-700 ring-gray-300"}`}>
          {etiqueta} <span className={fecha === iso(d) ? "text-gray-300" : "text-gray-400"}>({corto(d)})</span>
        </button>
      ))}
      <input type="date" value={fecha} min={iso(new Date())} onChange={(e) => setFecha(e.target.value)} disabled={off} className="border border-gray-300 px-2 py-1 text-gray-900" />
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={off} placeholder="Motivo (obligatorio): p. ej. me dijo que le escriba después del puente" className="min-w-[16rem] flex-1 border border-gray-300 px-2 py-1 text-gray-900" />
      <button onClick={() => listo && onAplazar(fecha, motivo.trim())} disabled={off || !listo} title={listo ? undefined : "Elige fecha y escribe el motivo"} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
        Aplazar
      </button>
    </div>
  );
}
