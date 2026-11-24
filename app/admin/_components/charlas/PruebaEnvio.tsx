"use client";

import { useState } from "react";

// Botón discreto de la barra de la Bandeja: reenvía el último Mail 1 real
// a una dirección de prueba (mail-tester) por el mismo camino que el panel.
export default function PruebaEnvio({ headers }: { headers: () => Record<string, string> }) {
  const [abierto, setAbierto] = useState(false);
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  async function enviar() {
    setEnviando(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/charlas/prueba-envio", { method: "POST", headers: headers(), body: JSON.stringify({ para }) });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `Enviado a ${d.enviado_a} · «${d.asunto}»` : `Error: ${d.error || r.status}`);
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto)
    return (
      <button onClick={() => setAbierto(true)} className="text-[0.78rem] text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline">
        🧪 Probar envío
      </button>
    );
  return (
    <span className="flex w-full flex-wrap items-center gap-2 text-[0.8rem]">
      <span className="text-gray-500">Último Mail 1 real a:</span>
      <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="test-xxx@srv1.mail-tester.com" className="min-w-[16rem] flex-1 border border-gray-300 px-2 py-1" />
      <button onClick={enviar} disabled={enviando || !para.trim()} className="bg-gray-800 px-3 py-1 text-white disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar prueba"}
      </button>
      <button onClick={() => { setAbierto(false); setMsg(""); }} className="text-gray-400 hover:text-gray-700">Cerrar</button>
      {msg && <span className="w-full text-gray-700">{msg}</span>}
    </span>
  );
}
