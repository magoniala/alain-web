"use client";

import { useEffect, useState } from "react";

// Respuestas anónimas de la encuesta /arreta (alumnos de las charlas).

type Fila = {
  id: string;
  created_at: string;
  probatu: "bai" | "oraindik-ez" | "ez";
  ikasi: string | null;
  gustatu: string | null;
  gehitu: string | null;
  saioa: string | null;
};

const PROBATU: Record<Fila["probatu"], string> = { bai: "Sí", "oraindik-ez": "Aún no, pero lo probará", ez: "No" };
const CAMPOS = [
  ["ikasi", "Qué ha aprendido de sí"],
  ["gustatu", "Qué le ha gustado más"],
  ["gehitu", "Algo que añadir"],
] as const;

export default function ArretaTab() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/arreta", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Error");
        setFilas(j.respuestas);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!filas) return <p className="text-sm text-gray-400">Cargando…</p>;

  const cuenta = (k: Fila["probatu"]) => filas.filter((f) => f.probatu === k).length;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        {filas.length} respuestas · Sí {cuenta("bai")} · Aún no {cuenta("oraindik-ez")} · No {cuenta("ez")}
      </p>
      {filas.length === 0 && <p className="text-sm text-gray-400">Todavía no hay respuestas.</p>}
      <div className="space-y-3">
        {filas.map((f) => (
          <div key={f.id} className="border border-gray-200 bg-white p-4">
            <p className="mb-2 text-[0.72rem] uppercase text-gray-400">
              {new Date(f.created_at).toLocaleString("es-ES")} · {f.saioa ?? "sin sesión"} · ¿Lo ha probado? {PROBATU[f.probatu]}
            </p>
            {CAMPOS.map(([k, t]) =>
              f[k] ? (
                <p key={k} className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                  <span className="text-gray-400">{t}: </span>
                  {f[k]}
                </p>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
