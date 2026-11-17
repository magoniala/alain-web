"use client";

import { useState } from "react";

// Caja de texto dentro de la tarjeta en lugar de window.prompt().
// El navegador del panel en la app de escritorio de Claude (Electron) no admite
// prompt(): lanza «prompt() is not supported» y el botón no hacía nada (17-11-2026,
// «Descartar» en la Bandeja de magia). Esto funciona en cualquier navegador.

export default function PreguntaEnLinea({
  pregunta,
  boton,
  obligatorio = false,
  inicial = "",
  ocupado = false,
  onAceptar,
  onCancelar,
}: {
  pregunta: string;
  boton: string;
  obligatorio?: boolean;
  /** Texto con el que empieza la caja (lo que antes era el valor por defecto de prompt()). */
  inicial?: string;
  ocupado?: boolean;
  onAceptar: (texto: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const vale = !obligatorio || texto.trim() !== "";
  return (
    <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[0.82rem] ring-1 ring-gray-200">
      <label className="block text-gray-600">
        {pregunta}
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && vale && !ocupado) onAceptar(texto.trim());
            if (e.key === "Escape") onCancelar();
          }}
          className="mt-1 w-full border border-gray-300 bg-white px-2 py-1 text-[0.85rem] text-gray-900"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button onClick={() => onAceptar(texto.trim())} disabled={!vale || ocupado} className="bg-[#1a1a1a] px-3 py-1.5 text-[0.8rem] font-medium text-white disabled:opacity-40">
          {boton}
        </button>
        <button onClick={onCancelar} disabled={ocupado} className="px-3 py-1.5 text-[0.8rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-40">
          Cancelar
        </button>
      </div>
    </div>
  );
}
