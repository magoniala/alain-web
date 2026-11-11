"use client";

import { useEffect, useState } from "react";

// Caja «Me falta información» de las tarjetas de la bandeja (Magia y Charlas).
// La IA devuelve faltan_datos cuando no encuentra en el catálogo de shows lo
// que necesita para contestar. Alain lo escribe aquí, elige en qué documento
// del catálogo se guarda y la tarjeta se rehace con el dato. No envía nada.

export interface FaltaDato {
  que: string;
  documento: string | null;
}
interface DocCatalogo {
  clave: string;
  titulo: string | null;
  activo: boolean;
}

// Una sola petición para todas las tarjetas de la bandeja.
let cacheDocs: Promise<DocCatalogo[]> | null = null;
function cargarDocs(): Promise<DocCatalogo[]> {
  if (!cacheDocs) {
    cacheDocs = fetch("/api/admin/crm/conocimiento", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } })
      .then((r) => r.json())
      .then((d) => (d.catalogo ?? []) as DocCatalogo[])
      .catch(() => {
        cacheDocs = null;
        return [];
      });
  }
  return cacheDocs;
}
export function olvidarDocsCatalogo() {
  cacheDocs = null;
}

const NOTAS = "notas_alain";

export default function CajaFaltanDatos({ faltan, ocupado, onGuardar }: { faltan: FaltaDato[] | undefined; ocupado: boolean; onGuardar: (clave: string, texto: string) => Promise<void> }) {
  const lista = faltan ?? [];
  const [docs, setDocs] = useState<DocCatalogo[]>([]);
  const [texto, setTexto] = useState("");
  const sugerido = lista.find((f) => f.documento)?.documento ?? NOTAS;
  const [clave, setClave] = useState(sugerido);
  const [abierta, setAbierta] = useState(lista.length > 0);

  useEffect(() => {
    if (!abierta) return;
    cargarDocs().then((d) => {
      setDocs(d);
      // Si la IA sugiere un documento que no existe, a las notas de Alain.
      if (!d.some((x) => x.clave === sugerido)) setClave(d.some((x) => x.clave === NOTAS) ? NOTAS : d[0]?.clave ?? NOTAS);
    });
  }, [abierta, sugerido]);

  const formulario = (
    <div className="mt-2 space-y-2">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Añádelo aquí (p. ej. la sinopsis del show, la duración, lo que necesitas en el espacio…)" className="w-full border border-gray-300 bg-white px-2 py-1.5 text-[0.85rem] text-gray-900" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[0.78rem] text-gray-600">
          Guardar en
          <select value={clave} onChange={(e) => setClave(e.target.value)} className="min-w-0 flex-1 border border-gray-300 bg-white px-2 py-1 text-[0.82rem] text-gray-900">
            {docs.length === 0 && <option value={clave}>{clave === NOTAS ? "Notas de Alain" : clave}</option>}
            {docs.map((d) => (
              <option key={d.clave} value={d.clave}>
                {d.titulo ?? d.clave}
                {d.clave === sugerido && lista.length ? " (sugerido)" : ""}
                {d.activo ? "" : " · desactivado"}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={async () => {
            await onGuardar(clave, texto);
            olvidarDocsCatalogo();
          }}
          disabled={ocupado || !texto.trim()}
          className="whitespace-nowrap bg-[#0F2240] px-3 py-1.5 text-[0.82rem] font-medium text-white disabled:opacity-40"
        >
          {ocupado ? "Guardando y rehaciendo…" : "Guardar en el conocimiento y rehacer"}
        </button>
      </div>
      <p className="text-[0.72rem] text-gray-500">Se guarda con fecha en el catálogo de shows (lo leen la IA de magia y la de charlas, también la próxima vez) y se rehace el borrador. No se envía nada.</p>
    </div>
  );

  if (lista.length > 0) {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[0.82rem] text-amber-950">
        <p className="font-medium">Me falta información para contestar bien</p>
        <ul className="mt-1 list-disc pl-5">
          {lista.map((f, i) => (
            <li key={i}>{f.que}</li>
          ))}
        </ul>
        {formulario}
      </div>
    );
  }
  return (
    <details className="mt-3 text-[0.82rem]" onToggle={(e) => setAbierta((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-[0.78rem] text-gray-500">＋ Añadir información al catálogo de shows y rehacer</summary>
      {formulario}
    </details>
  );
}
