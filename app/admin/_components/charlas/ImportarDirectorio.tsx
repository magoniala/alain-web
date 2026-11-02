"use client";

import { useState } from "react";

// Importar un directorio oficial de centros (Navarra, Cantabria…) desde el
// panel. Se le da un enlace al CSV/XLSX, el id de un dataset de datos.gob.es
// o un fichero del ordenador; primero "Previsualizar" (no toca nada) y, si
// cuadra, "Importar". El servidor (Vercel) descarga y procesa; el espejo
// escribe las fichas nuevas en el vault en su siguiente pasada.

type Resultado = {
  fuente?: string;
  filas?: number;
  columnas?: string[];
  columnas_usadas?: Record<string, string | null>;
  resumen?: { centros: number; por_tipo: Record<string, number>; con_email: number; con_telefono: number; con_web: number; euskera: number };
  muestra?: Record<string, unknown>[];
  importacion?: { nuevas: number; ya_existian: number; insertados: number; errores: string[] };
  diagnostico?: { ensenanza: string[]; tipo_centro: string[]; columnas_fichero: string[]; primeras_filas: Record<string, string>[] };
  error?: string;
};

export default function ImportarDirectorio({ pw, onImportado }: { pw: () => string; onImportado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [territorio, setTerritorio] = useState("Navarra");
  const [fuente, setFuente] = useState("a15002917-centros-educativos1");
  const [fichero, setFichero] = useState<File | null>(null);
  const [trabajando, setTrabajando] = useState<string>("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function lanzar(accion: "inspeccionar" | "previsualizar" | "importar") {
    if (accion === "importar" && !confirm(`¿Importar los centros de ${territorio} al CRM? Solo se crean los que no existan.`)) return;
    setTrabajando(accion);
    setRes(null);
    try {
      let r: Response;
      if (fichero) {
        const fd = new FormData();
        fd.set("accion", accion);
        fd.set("territorio", territorio);
        fd.set("fichero", fichero);
        r = await fetch("/api/admin/charlas/directorio", { method: "POST", headers: { "x-admin-password": pw() }, body: fd });
      } else {
        const f = fuente.trim();
        const body = /^https?:\/\//i.test(f) ? { accion, territorio, url: f } : { accion, territorio, dataset: f };
        r = await fetch("/api/admin/charlas/directorio", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-password": pw() }, body: JSON.stringify(body) });
      }
      const d = (await r.json().catch(() => ({ error: `Respuesta no válida (${r.status})` }))) as Resultado;
      setRes(d);
      if (accion === "importar" && r.ok) onImportado();
    } catch (e) {
      setRes({ error: (e as Error).message });
    } finally {
      setTrabajando("");
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-baseline justify-between text-left">
        <h2 className="text-[1rem] font-semibold">Importar un directorio oficial (Navarra, Cantabria…)</h2>
        <span className="text-[0.8rem] text-gray-500">{abierto ? "cerrar" : "abrir"}</span>
      </button>
      {abierto && (
        <div className="mt-3 space-y-3 text-[0.85rem]">
          <p className="text-gray-600">
            Pega el enlace al CSV/XLSX del directorio, el id de un dataset de datos.gob.es, o elige un fichero. Solo entran los centros con ESO o Bachillerato, en estado
            &quot;0 Por llamar&quot;, con prioridad A para públicos y modelo D. Primero <b>Previsualizar</b>; si cuadra, <b>Importar</b>. No duplica los que ya existan.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-gray-600">
              Territorio
              <input value={territorio} onChange={(e) => setTerritorio(e.target.value)} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-gray-900" />
            </label>
            <label className="text-gray-600 sm:col-span-2">
              Enlace o id de dataset (datos.gob.es)
              <input value={fuente} onChange={(e) => setFuente(e.target.value)} disabled={!!fichero} className="mt-1 w-full border border-gray-300 px-2 py-1.5 text-gray-900 disabled:opacity-50" placeholder="https://… .csv  ·  a15002917-centros-educativos1" />
            </label>
            <label className="text-gray-600 sm:col-span-3">
              … o un fichero de tu ordenador (CSV, XLSX, JSON)
              <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,.json" onChange={(e) => setFichero(e.target.files?.[0] ?? null)} className="mt-1 block" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => lanzar("inspeccionar")} disabled={!!trabajando} className="border border-gray-300 px-3 py-1.5 disabled:opacity-40">Ver columnas</button>
            <button onClick={() => lanzar("previsualizar")} disabled={!!trabajando} className="border border-gray-900 px-3 py-1.5 font-medium disabled:opacity-40">Previsualizar</button>
            <button onClick={() => lanzar("importar")} disabled={!!trabajando || !res?.resumen} className="bg-[#1a1a1a] px-3 py-1.5 font-medium text-white disabled:opacity-40">Importar</button>
            {trabajando && <span className="self-center text-gray-500">{trabajando === "importar" ? "Importando…" : "Descargando y leyendo…"}</span>}
          </div>
          {res?.error && <p className="text-[#DC2626]">{res.error}</p>}
          {res?.columnas && (
            <div>
              <p className="text-gray-800">{res.filas} filas · columnas: {res.columnas.join(" · ")}</p>
              <pre className="mt-2 max-h-56 overflow-auto bg-gray-50 p-2 text-[0.75rem]">{JSON.stringify(res.muestra, null, 1)}</pre>
            </div>
          )}
          {res?.resumen && (
            <div className="space-y-2">
              <p className="text-gray-800">
                {res.filas} filas en el fichero → <b>{res.resumen.centros} centros con secundaria</b> · por tipo: {Object.entries(res.resumen.por_tipo).map(([k, v]) => `${k} ${v}`).join(", ")} · con email {res.resumen.con_email} · con teléfono {res.resumen.con_telefono} · con web {res.resumen.con_web} · modelo D {res.resumen.euskera}
              </p>
              <p className="text-gray-500">Columnas usadas: {Object.entries(res.columnas_usadas ?? {}).map(([k, v]) => `${k}=${v ?? "—"}`).join(" · ")}</p>
              <pre className="max-h-56 overflow-auto bg-gray-50 p-2 text-[0.75rem]">{JSON.stringify(res.muestra, null, 1)}</pre>
              {res.diagnostico && (
                <details open={res.resumen.centros === 0} className="text-[0.78rem] text-gray-700">
                  <summary className="cursor-pointer">Diagnóstico (mándale captura a Álex si algo no cuadra)</summary>
                  <p className="mt-1"><b>Columnas del fichero:</b> {res.diagnostico.columnas_fichero.join(" · ")}</p>
                  <p className="mt-1"><b>Valores de enseñanza:</b> {res.diagnostico.ensenanza.join(" · ")}</p>
                  <p className="mt-1"><b>Valores de tipo de centro:</b> {res.diagnostico.tipo_centro.join(" · ")}</p>
                  <pre className="mt-1 max-h-56 overflow-auto bg-gray-50 p-2 text-[0.72rem]">{JSON.stringify(res.diagnostico.primeras_filas, null, 1)}</pre>
                </details>
              )}
              {res.importacion && (
                <p className="font-medium text-gray-900">
                  Importados {res.importacion.insertados} ({res.importacion.ya_existian} ya existían){res.importacion.errores.length ? ` · ⚠️ ${res.importacion.errores.join(" | ")}` : ""}. El espejo los escribirá en el vault en su próxima pasada; el rastreo web empezará a buscarles correo de orientación.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
