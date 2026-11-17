"use client";

import { useEffect, useState } from "react";

// Aviso de confirmación propio del panel, en lugar de window.confirm().
// El navegador del panel en la app de escritorio de Claude (Electron) no muestra
// confirm(): devuelve false al instante y el botón no hacía nada (17-11-2026).
// Uso: `if (!(await confirmar("¿Borrar X?"))) return;`
// <ConfirmarHost /> va una sola vez en app/admin/layout.tsx.

type Opciones = { aceptar?: string; cancelar?: string; peligro?: boolean };
type Pendiente = { texto: string; opciones: Opciones; resolver: (ok: boolean) => void };

let escucha: ((p: Pendiente) => void) | null = null;

export function confirmar(texto: string, opciones: Opciones = {}): Promise<boolean> {
  // Sin host montado (no debería pasar en /admin): el confirm() del navegador.
  if (!escucha) return Promise.resolve(typeof window !== "undefined" ? window.confirm(texto) : false);
  return new Promise((resolver) => escucha!({ texto, opciones, resolver }));
}

export default function ConfirmarHost() {
  const [cola, setCola] = useState<Pendiente[]>([]);

  useEffect(() => {
    escucha = (p) => setCola((c) => [...c, p]);
    return () => {
      escucha = null;
    };
  }, []);

  const actual = cola[0];
  const cerrar = (ok: boolean) => {
    if (!actual) return;
    actual.resolver(ok);
    setCola((c) => c.slice(1));
  };

  useEffect(() => {
    if (!actual) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  if (!actual) return null;
  const { texto, opciones } = actual;
  const peligro = opciones.peligro ?? true;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={() => cerrar(false)} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-gray-800">{texto}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => cerrar(false)} className="px-3 py-1.5 text-[0.82rem] text-gray-700 ring-1 ring-gray-300">
            {opciones.cancelar ?? "Cancelar"}
          </button>
          <button
            autoFocus
            onClick={() => cerrar(true)}
            className={`px-3 py-1.5 text-[0.82rem] font-medium text-white ${peligro ? "bg-red-600" : "bg-[#1a1a1a]"}`}
          >
            {opciones.aceptar ?? "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
