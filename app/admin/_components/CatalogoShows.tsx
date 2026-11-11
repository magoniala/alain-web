"use client";

import { useCallback, useEffect, useState } from "react";
import { olvidarDocsCatalogo } from "./CajaFaltanDatos";

// Catálogo de shows que leen la IA de Prospectos de magia y la de Charlas
// (crm_conocimiento, carril magia, tipo "catalogo"). Manda sobre cualquier otra
// fuente para describir shows y dar precios. Si un dato no está, la IA no lo
// inventa: lo pide en la tarjeta («Me falta información»).

interface Doc {
  clave: string;
  titulo: string | null;
  tipo: string;
  texto: string;
  activo: boolean;
  orden: number;
  actualizado_en: string;
}
interface Otro {
  clave: string;
  titulo: string | null;
  tipo: string;
  activo: boolean;
  kb: number;
}

const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default function CatalogoShows() {
  const [catalogo, setCatalogo] = useState<Doc[]>([]);
  const [otros, setOtros] = useState<Otro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" }), []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/crm/conocimiento", { headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setCatalogo(d.catalogo ?? []);
      setOtros(d.otros ?? []);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/crm/conocimiento", { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Error");
    olvidarDocsCatalogo();
    return d as { clave?: string };
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 text-[0.85rem] text-gray-700">
        <h2 className="text-[1rem] font-semibold text-gray-900">Catálogo de shows</h2>
        <p className="mt-1">Lo leen la IA de Prospectos de magia y la de Charlas para describir los shows y dar precios. <b>Manda sobre cualquier otra fuente</b>; si un cliente tiene un precio pactado en su ficha, manda ese. Lo que no esté aquí (o diga «SIN DATO») la IA no lo inventa: te lo pide en la tarjeta con la caja «Me falta información».</p>
        <p className="mt-1 text-gray-500">Precios siempre «+ IVA». Los cambios valen desde la siguiente respuesta que redacte la IA.</p>
      </section>
      {aviso && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[0.85rem] text-amber-900">{aviso}</p>}
      {cargando && <p className="text-[0.85rem] text-gray-500">Cargando…</p>}
      {!cargando && catalogo.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[0.9rem] text-gray-500">
          <p>El catálogo está vacío. Dalo de alta con los datos sacados del vault (Magia Zaparrada, taller, itinerante, presentador, cumpleaños, condiciones y notas) y luego revísalo aquí.</p>
          <button
            onClick={async () => {
              try {
                const r = (await post({ accion: "sembrar" })) as { creados?: string[] };
                setAviso(`Dados de alta: ${r.creados?.length ?? 0} documentos.`);
                await cargar();
              } catch (e) {
                setAviso((e as Error).message);
              }
            }}
            className="mt-3 bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white"
          >
            Dar de alta el catálogo inicial
          </button>
        </div>
      )}
      <div className="space-y-3">
        {catalogo.map((d) =>
          editando === d.clave ? (
            <EditorDoc key={d.clave} d={d} onCancelar={() => setEditando(null)} onGuardar={async (titulo, texto) => { await post({ accion: "guardar", clave: d.clave, titulo, texto }); setEditando(null); await cargar(); }} />
          ) : (
            <article key={d.clave} className={`rounded-2xl border bg-white p-4 ${d.activo ? "border-gray-200" : "border-dashed border-gray-300 opacity-70"}`}>
              <header className="flex flex-wrap items-center gap-2">
                <h3 className="text-[0.95rem] font-semibold">{d.titulo ?? d.clave}</h3>
                <span className="text-[0.75rem] text-gray-400">{d.clave} · actualizado {fmt(d.actualizado_en)}</span>
                {(d.texto.match(/SIN DATO/g) ?? []).length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.72rem] text-amber-900">{(d.texto.match(/SIN DATO/g) ?? []).length} SIN DATO</span>}
                <span className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[0.78rem] text-gray-600" title="Si lo desactivas, la IA deja de leerlo">
                    <input type="checkbox" checked={d.activo} onChange={async (e) => { try { await post({ accion: "activar", clave: d.clave, activo: e.target.checked }); await cargar(); } catch (er) { setAviso((er as Error).message); } }} />
                    La IA lo lee
                  </label>
                  <button onClick={() => setEditando(d.clave)} className="rounded-full px-3 py-1 text-[0.78rem] ring-1 ring-gray-300">Editar</button>
                </span>
              </header>
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.8rem] text-gray-500">Ver texto</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[0.84rem] leading-relaxed text-gray-800">{d.texto}</pre>
              </details>
            </article>
          )
        )}
      </div>
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre de un show nuevo (p. ej. Morir o No Morir)" className="min-w-0 flex-1 border border-gray-300 px-2 py-1.5 text-[0.85rem]" />
        <button
          onClick={async () => {
            try {
              const r = await post({ accion: "nuevo", titulo: nuevo });
              setNuevo("");
              await cargar();
              if (r.clave) setEditando(r.clave);
            } catch (e) {
              setAviso((e as Error).message);
            }
          }}
          disabled={!nuevo.trim()}
          className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40"
        >
          Crear con la plantilla
        </button>
      </section>
      {otros.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white p-4 text-[0.82rem] text-gray-600">
          <summary className="cursor-pointer">Otros documentos que lee la IA de magia · {otros.length} (vienen del vault; se recargan con el script, no se editan aquí)</summary>
          <ul className="mt-2 space-y-1">
            {otros.map((o) => (
              <li key={o.clave}>
                <b className="text-gray-800">{o.titulo ?? o.clave}</b> · {o.tipo} · {o.kb} KB{o.activo ? "" : " · desactivado"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EditorDoc({ d, onGuardar, onCancelar }: { d: Doc; onGuardar: (titulo: string, texto: string) => Promise<void>; onCancelar: () => void }) {
  const [titulo, setTitulo] = useState(d.titulo ?? "");
  const [texto, setTexto] = useState(d.texto);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");
  return (
    <article className="rounded-2xl border border-[#0F2240]/40 bg-white p-4">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full border border-gray-300 px-2 py-1.5 text-[0.92rem] font-semibold" />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(32, Math.max(10, texto.split("\n").length + 2))} className="mt-2 w-full border border-gray-300 px-2 py-1.5 font-mono text-[0.82rem] leading-relaxed" />
      <p className="mt-1 text-[0.75rem] text-gray-500">Lo que no sepas, déjalo como «SIN DATO»: la IA no lo dará y te lo pedirá cuando haga falta.</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            setGuardando(true);
            setErr("");
            try {
              await onGuardar(titulo, texto);
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setGuardando(false);
            }
          }}
          disabled={guardando || !titulo.trim() || !texto.trim()}
          className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancelar} className="px-4 py-2 text-[0.85rem] text-gray-700 ring-1 ring-gray-300">Cancelar</button>
      </div>
      {err && <p className="mt-2 text-[0.82rem] text-[#DC2626]">{err}</p>}
    </article>
  );
}
