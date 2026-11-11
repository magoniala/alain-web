"use client";

// Último correo recibido y último enviado a una ficha, para que la tarjeta no se
// quede sin contexto cuando no trae un correo entrante asociado (tarjetas por fecha,
// «correo suyo sin respuesta», «buscar email», etc.).

export interface MensajeResumen {
  id: string;
  direccion: string;
  de: string | null;
  para?: string[] | null;
  asunto: string | null;
  fecha: string | null;
  texto: string | null;
}
export interface Ultimos {
  entrante: MensajeResumen | null;
  saliente: MensajeResumen | null;
}

const fh = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function UltimosMensajes({ ultimos, omitirEntrante = false }: { ultimos?: Ultimos | null; omitirEntrante?: boolean }) {
  if (!ultimos) return null;
  const { entrante, saliente } = ultimos;
  const mostrarEntrante = !omitirEntrante && entrante;
  if (!mostrarEntrante && !saliente) return null;
  return (
    <div className="mt-3 space-y-1.5 text-[0.82rem] text-gray-700">
      {mostrarEntrante && (
        <details open className="rounded bg-sky-50/60 px-3 py-2">
          <summary className="cursor-pointer text-gray-600">
            Último mensaje suyo · {entrante.de} · {fh(entrante.fecha)}
            {entrante.asunto ? ` · ${entrante.asunto}` : ""}
          </summary>
          <pre className="mt-1 max-h-[260px] overflow-auto whitespace-pre-wrap font-sans">{(entrante.texto ?? "(sin texto)").trim()}</pre>
        </details>
      )}
      {saliente && (
        <details className="rounded bg-gray-50 px-3 py-2">
          <summary className="cursor-pointer text-gray-600">
            Tu último mensaje · {(saliente.para ?? []).join(", ")} · {fh(saliente.fecha)}
            {saliente.asunto ? ` · ${saliente.asunto}` : ""}
          </summary>
          <pre className="mt-1 max-h-[260px] overflow-auto whitespace-pre-wrap font-sans">{(saliente.texto ?? "(sin texto)").trim()}</pre>
        </details>
      )}
    </div>
  );
}
