"use client";

import { parrafosHtml, tieneFormato } from "@/lib/correo-cuerpo";

// Debajo del borrador en las bandejas: cómo le llega el correo al destinatario.
// Lo que va entre ** sale en negrita (sin asteriscos) y el dossier, adjunto
// debajo. Solo se abre sola cuando hay formato que en el cuadro se ve raro.
export default function VistaCorreo({ texto, adjunto }: { texto: string; adjunto?: string | null }) {
  if (!texto.trim()) return null;
  const formato = tieneFormato(texto);
  return (
    <details open={formato} className="mt-2 rounded-lg border border-gray-200 bg-white text-[0.82rem]">
      <summary className="cursor-pointer px-3 py-1.5 text-gray-500">
        Así le llega{formato ? " · lo que va entre ** sale en negrita, sin asteriscos" : ""}
      </summary>
      <div className="border-t border-gray-100 px-3 py-2 text-[0.88rem] leading-relaxed text-gray-900">
        <div dangerouslySetInnerHTML={{ __html: parrafosHtml(texto) }} />
        {adjunto && <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-[0.78rem] text-gray-700">📎 {adjunto}</p>}
      </div>
    </details>
  );
}
