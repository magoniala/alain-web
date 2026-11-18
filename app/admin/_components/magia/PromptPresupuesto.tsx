"use client";

import { useState } from "react";
import { copiarTexto } from "../copiarTexto";

// Botón «Copiar prompt de presupuesto» (tarjeta de magia que pide presupuesto
// y ficha del CRM). El prompt lo compone el servidor solo con datos que ya
// existen (lib/crm-presupuesto-prompt); lo que falta va como «FALTA: preguntar
// a Alain». Se pega en el chat de presupuestos (skill presupuestos-niala).

interface Respuesta { prompt: string; shows: { clave: string; titulo: string }[]; show: string | null; origen_show: "elegido" | "detectado" | "ninguno"; faltan: number }

export default function PromptPresupuesto({ fichaId }: { fichaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function cargar(show?: string) {
    setCargando(true);
    setAviso("");
    try {
      const q = new URLSearchParams({ ficha: fichaId, ...(show ? { show } : {}) });
      const r = await fetch(`/api/admin/crm/presupuesto?${q}`, { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setDatos(d);
      setTexto(d.prompt);
      return d as Respuesta;
    } catch (e) {
      setAviso((e as Error).message);
      return null;
    } finally {
      setCargando(false);
    }
  }

  async function copiar(t: string) {
    setAviso((await copiarTexto(t)) ? "Copiado ✓ · pégalo en el chat de presupuestos" : "No se ha podido copiar: cópialo a mano del recuadro");
  }

  if (!abierto) {
    return (
      <button onClick={async () => { setAbierto(true); const d = await cargar(); if (d && d.show) copiar(d.prompt); }} className="px-4 py-2 text-[0.85rem] font-medium text-[#0F2240] ring-1 ring-[#0F2240]/40">
        📋 Copiar prompt de presupuesto
      </button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-2 rounded-xl bg-[#F3F6FB] px-3 py-3 text-[0.85rem]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[#0F2240]">Prompt de presupuesto</span>
        {datos && (
          <label className="text-[0.78rem] text-gray-600">
            Show{" "}
            <select value={datos.show ?? ""} onChange={(e) => cargar(e.target.value)} disabled={cargando} className="border border-gray-300 bg-white px-2 py-1 text-[0.82rem] text-gray-900">
              {!datos.show && <option value="">— elige el show —</option>}
              {datos.shows.map((s) => <option key={s.clave} value={s.clave}>{s.titulo}</option>)}
            </select>
          </label>
        )}
        {datos && <span className="text-[0.75rem] text-gray-500">{datos.origen_show === "detectado" ? "detectado en el Registro/correos" : datos.origen_show === "ninguno" ? "no se sabe cuál: elígelo" : ""}</span>}
        {datos && datos.faltan > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.75rem] text-amber-900">{datos.faltan} × FALTA</span>}
      </div>
      {cargando && !datos && <p className="text-gray-500">Componiendo…</p>}
      {datos && <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} className="w-full border border-gray-300 bg-white px-2 py-1.5 font-mono text-[0.78rem] leading-relaxed" />}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => copiar(texto)} disabled={!texto || cargando} className="bg-[#1a1a1a] px-3 py-1.5 text-[0.82rem] font-medium text-white disabled:opacity-40">{cargando ? "Componiendo…" : "Copiar prompt"}</button>
        <button onClick={() => { setAbierto(false); setDatos(null); setAviso(""); }} className="px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300 bg-white">Cerrar</button>
      </div>
      {aviso && <p className="text-[0.78rem] text-gray-700">{aviso}</p>}
    </div>
  );
}
