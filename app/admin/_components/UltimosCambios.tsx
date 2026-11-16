"use client";

import { useState } from "react";

// «Control Z» de la bandeja (Charlas y Magia): lo último que Alain ha aplicado,
// aplazado o descartado desde el panel, con un botón para dejarlo como estaba.
// La lógica está en lib/bandeja-deshacer.ts. Los mensajes enviados no salen aquí.

export interface Reciente {
  id: string;
  nombre: string;
  resumen: string;
  en: string;
}

function cuando(iso: string) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const dia = (x: Date) => x.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  return dia(d) === dia(new Date()) ? hora : `ayer ${hora}`;
}

export default function UltimosCambios({ recientes, accion, alTerminar }: { recientes: Reciente[]; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void }) {
  // Abierto solo si el último cambio es de hace menos de 15 minutos (lo normal tras un clic sin querer).
  const [abierto, setAbierto] = useState(() => !!recientes[0] && Date.now() - new Date(recientes[0].en).getTime() < 15 * 60000);
  const [ocupado, setOcupado] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function deshacer(r: Reciente) {
    setOcupado(r.id);
    setMensaje("");
    try {
      const res = (await accion({ accion: "deshacer", id: r.id })) as { avisos?: string[] };
      setMensaje(`Deshecho: ${r.nombre} vuelve a estar como antes y la tarjeta está otra vez en la bandeja.${res?.avisos?.length ? ` Ojo: ${res.avisos.join("; ")}.` : ""}`);
      alTerminar();
    } catch (e) {
      setMensaje(`No se pudo deshacer: ${(e as Error).message}`);
    } finally {
      setOcupado("");
    }
  }

  if (!recientes.length) return mensaje ? <p className="rounded-xl bg-emerald-50 px-4 py-2 text-[0.82rem] text-emerald-900">{mensaje}</p> : null;

  return (
    <details open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[0.82rem]">
      <summary className="cursor-pointer select-none font-medium text-gray-700">↶ Últimos cambios · deshacer ({recientes.length})</summary>
      <p className="mt-1 text-[0.78rem] text-gray-500">Lo aplicado, aplazado o descartado desde aquí en las últimas 48 h. «Deshacer» deja la ficha y la tarjeta como estaban. Los mensajes enviados no se pueden deshacer.</p>
      {mensaje && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-900">{mensaje}</p>}
      <ul className="mt-2 divide-y divide-gray-100">
        {recientes.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-1.5">
            <span className="w-14 shrink-0 text-[0.75rem] text-gray-400">{cuando(r.en)}</span>
            <span className="min-w-0 flex-1">
              <b className="font-medium">{r.nombre}</b>
              <span className="block truncate text-[0.75rem] text-gray-500">{r.resumen}</span>
            </span>
            <button onClick={() => deshacer(r)} disabled={!!ocupado} className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-[0.78rem] disabled:opacity-40">
              {ocupado === r.id ? "Deshaciendo…" : "Deshacer"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
