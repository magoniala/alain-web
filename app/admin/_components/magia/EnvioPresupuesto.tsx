"use client";

import { useState } from "react";
import { copiarTexto } from "../copiarTexto";
import VistaCorreo from "../VistaCorreo";

// Fase 2 del presupuesto desde el panel: subir el PDF que ha montado el chat
// de presupuestos (queda en los adjuntos de la ficha, bucket `presupuestos`),
// pegar el mail corto y enviarlo en el mismo hilo con el PDF adjunto (o
// copiarlo). Al enviarlo la ficha pasa a «5 Propuesta enviada» con
// seguimiento a 4 días laborables (lib/crm-presupuesto-envio).

interface Adjunto { ruta: string; nombre: string; subido: string | null; url: string | null }

export default function EnvioPresupuesto({ fichaId, onEnviado }: { fichaId: string; onEnviado?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [ruta, setRuta] = useState("");
  const [para, setPara] = useState("");
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const cab = () => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" });

  async function cargar(elegir?: string) {
    const r = await fetch(`/api/admin/crm/presupuesto?ficha=${fichaId}&envio=1`, { headers: cab() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Error");
    setAdjuntos(d.adjuntos ?? []);
    setRuta(elegir ?? d.adjuntos?.[0]?.ruta ?? "");
    setPara((p) => p || d.para || "");
    setAsunto((a) => a || d.asunto || "");
  }

  async function abrir() {
    setAbierto(true);
    setOcupado("cargar");
    setAviso("");
    try { await cargar(); } catch (e) { setAviso((e as Error).message); } finally { setOcupado(""); }
  }

  async function subir(f: File) {
    setOcupado("subir");
    setAviso("");
    try {
      if (f.type && f.type !== "application/pdf") throw new Error("Tiene que ser un PDF.");
      const r = await fetch("/api/admin/crm/presupuesto", { method: "POST", headers: cab(), body: JSON.stringify({ accion: "subir", ficha: fichaId, nombre: f.name }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      const up = await fetch(j.url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: f });
      if (!up.ok) throw new Error(`No se pudo subir (${up.status})`);
      await fetch("/api/admin/crm/presupuesto", { method: "POST", headers: cab(), body: JSON.stringify({ accion: "subido", ficha: fichaId, ruta: j.ruta }) });
      await cargar(j.ruta);
      setAviso("PDF guardado en la ficha ✓");
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  async function enviar() {
    setOcupado("enviar");
    setAviso("");
    try {
      const r = await fetch("/api/admin/crm/presupuesto", { method: "POST", headers: cab(), body: JSON.stringify({ accion: "enviar", ficha: fichaId, ruta, para, asunto, texto }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      if (d.prueba) setAviso(`Modo prueba: ha ido a ${d.enviado_a}. La ficha no cambia.`);
      else {
        setAviso(`Enviado a ${d.enviado_a} con el PDF ✓ · ficha en «5 Propuesta enviada», seguimiento el ${d.siguiente}`);
        onEnviado?.();
      }
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  if (!abierto) {
    return <button onClick={abrir} className="px-4 py-2 text-[0.85rem] font-medium text-[#0F2240] ring-1 ring-[#0F2240]/40">📎 Enviar presupuesto (PDF)</button>;
  }
  const elegido = adjuntos.find((a) => a.ruta === ruta);
  return (
    <div className="mt-3 w-full space-y-2 rounded-xl bg-[#F3F6FB] px-3 py-3 text-[0.85rem]">
      <p className="font-medium text-[#0F2240]">Enviar presupuesto</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer bg-white px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300">
          {ocupado === "subir" ? "Subiendo…" : "Subir PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!ocupado} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subir(f); }} />
        </label>
        {adjuntos.length > 0 && (
          <select value={ruta} onChange={(e) => setRuta(e.target.value)} className="max-w-[320px] border border-gray-300 bg-white px-2 py-1 text-[0.82rem]">
            {adjuntos.map((a) => <option key={a.ruta} value={a.ruta}>{a.nombre}{a.subido ? ` · ${a.subido.slice(0, 10).split("-").reverse().join("/")}` : ""}</option>)}
          </select>
        )}
        {elegido?.url && <a href={elegido.url} target="_blank" rel="noreferrer" className="text-[0.8rem] text-[#0F2240] underline">Abrir</a>}
        {!adjuntos.length && ocupado !== "cargar" && <span className="text-[0.78rem] text-gray-500">Aún no hay ningún PDF en esta ficha.</span>}
      </div>
      <label className="block text-[0.75rem] text-gray-500">Para
        <input value={para} onChange={(e) => setPara(e.target.value)} className="mt-0.5 w-full border border-gray-300 bg-white px-2 py-1 text-[0.85rem] text-gray-900" />
      </label>
      <label className="block text-[0.75rem] text-gray-500">Asunto {asunto.toLowerCase().startsWith("re:") && <span>(va en el mismo hilo)</span>}
        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="No hay correo anterior con esta ficha: escribe uno" className="mt-0.5 w-full border border-gray-300 bg-white px-2 py-1 text-[0.85rem] text-gray-900" />
      </label>
      <label className="block text-[0.75rem] text-gray-500">Mail (pega el que te ha dado el chat de presupuestos)
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(12, Math.max(5, texto.split("\n").length + 1))} className="mt-0.5 w-full border border-gray-300 bg-white px-2 py-1.5 text-[0.88rem] leading-relaxed text-gray-900" />
      </label>
      {texto.trim() && <VistaCorreo texto={texto} adjunto={elegido?.nombre ?? null} />}
      <div className="flex flex-wrap gap-2">
        <button onClick={enviar} disabled={!!ocupado || !ruta || !para.includes("@") || !asunto.trim() || !texto.trim()} className="bg-[#1a1a1a] px-3 py-1.5 text-[0.82rem] font-medium text-white disabled:opacity-40">{ocupado === "enviar" ? "Enviando…" : "Enviar con el PDF"}</button>
        <button onClick={async () => setAviso((await copiarTexto(texto)) ? "Mail copiado ✓" : "No se ha podido copiar")} disabled={!texto.trim()} className="bg-white px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300 disabled:opacity-40">Copiar mail</button>
        <button onClick={() => { setAbierto(false); setAviso(""); }} className="bg-white px-3 py-1.5 text-[0.82rem] ring-1 ring-gray-300">Cerrar</button>
      </div>
      {aviso && <p className="text-[0.78rem] text-gray-700">{aviso}</p>}
    </div>
  );
}
