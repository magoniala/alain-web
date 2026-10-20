"use client";

import { useState, useEffect, useCallback } from "react";

const OPCIONES = [2, 1, 0] as const;

// Contador de plazas de /acompanamiento. Con 0, la página deja de mostrar el
// formulario y pide solo un email para avisar de las siguientes.
export default function AcompanamientoTab() {
  const [plazas, setPlazas] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-admin-password": sessionStorage.getItem("admin_pw") || "",
    }),
    []
  );

  useEffect(() => {
    fetch("/api/entrenatzaile/acompanamiento/config", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setPlazas(typeof d.plazasLibres === "number" ? d.plazasLibres : null));
  }, [authHeaders]);

  async function elegir(n: number) {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/entrenatzaile/acompanamiento/config", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ plazasLibres: n }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Error ${res.status}`);
        return;
      }
      setPlazas(n);
    } finally {
      setPending(false);
    }
  }

  if (plazas === null) return <p className="text-sm text-gray-400">Cargando…</p>;

  return (
    <div className="border border-gray-200 p-5">
      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400 mb-1">Plazas libres (/acompanamiento)</p>
      <p className="text-sm text-gray-500 mb-4">
        Con 0, la página muestra «Plazas de noviembre cubiertas» y deja un campo de email para avisar de las siguientes.
      </p>
      <div className="flex gap-2">
        {OPCIONES.map((n) => (
          <button
            key={n}
            onClick={() => elegir(n)}
            disabled={pending}
            className={`px-4 py-2 text-sm border transition-colors ${
              plazas === n
                ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                : "border-gray-300 text-gray-600 hover:border-gray-500"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-[#DC2626]">{error}</p>}
    </div>
  );
}
