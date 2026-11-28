"use client";

import { useCallback, useEffect, useState } from "react";

// Correo › Testimonios: los guardados desde las tarjetas de «Por revisar», con
// filtros por vía, permiso y dónde usarlos. Se espejan al vault en la pasada
// horaria (scripts/crm/espejo-correo.mjs). Datos: /api/admin/correo/panel?vista=testimonios.

const pw = () => sessionStorage.getItem("admin_pw") || "";

interface Testimonio {
  id: string; fecha: string | null; quien: string | null; centro: string | null; via: string; idioma: string | null;
  permiso: "solo_anonimo" | "con_nombre" | "no_consta"; donde: string[]; texto: string; espejado_en: string | null; vault_nota: string | null;
}

const PERMISO: Record<string, { nombre: string; clase: string }> = {
  solo_anonimo: { nombre: "SOLO ANÓNIMO", clase: "bg-red-100 text-red-900" },
  no_consta: { nombre: "PERMISO NO CONSTA", clase: "bg-amber-100 text-amber-900" },
  con_nombre: { nombre: "Con nombre", clase: "bg-green-100 text-green-900" },
};
const DONDE: Record<string, string> = { objecion: "Objeción", dossier: "Dossier", cierre: "Cierre", web: "Web" };
const campo = "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[0.85rem] text-gray-900";

export default function TestimoniosCorreoTab() {
  const [lista, setLista] = useState<Testimonio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [via, setVia] = useState("");
  const [permiso, setPermiso] = useState("");
  const [donde, setDonde] = useState("");

  const cargar = useCallback(async () => {
    try {
      const p = new URLSearchParams({ vista: "testimonios" });
      if (via) p.set("via", via);
      if (permiso) p.set("permiso", permiso);
      if (donde) p.set("donde", donde);
      const r = await fetch(`/api/admin/correo/panel?${p}`, { headers: { "x-admin-password": pw() } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
      setLista(j.testimonios);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [via, permiso, donde]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="space-y-4">
      <p className="text-[0.85rem] text-gray-500">
        Testimonios guardados desde el correo (Correo › Por revisar › «Guardar testimonio»). Los que no son «con nombre» no se ofrecen nunca para copy con nombre. Aquí no están los de Arreta, Opiniones eventos ni Opiniones familias: tienen su pestaña.
      </p>
      <div className="flex flex-wrap gap-2">
        <select className={campo} value={via} onChange={(e) => setVia(e.target.value)}>
          <option value="">Todas las vías</option>
          <option value="charlas">Charlas</option>
          <option value="entrenatzaile">Entrenatzaile</option>
          <option value="magia">Magia</option>
        </select>
        <select className={campo} value={permiso} onChange={(e) => setPermiso(e.target.value)}>
          <option value="">Todos los permisos</option>
          <option value="con_nombre">Con nombre</option>
          <option value="solo_anonimo">Solo anónimo</option>
          <option value="no_consta">No consta</option>
        </select>
        <select className={campo} value={donde} onChange={(e) => setDonde(e.target.value)}>
          <option value="">Dónde usarlo: todo</option>
          {Object.entries(DONDE).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </div>
      {error && <p className="text-[0.9rem] text-red-700">{error}</p>}
      {!lista && !error && <p className="text-[0.9rem] text-gray-500">Cargando…</p>}
      {lista && !lista.length && <p className="text-[0.9rem] text-gray-500">Aún no hay testimonios guardados con estos filtros.</p>}
      {(lista ?? []).map((t) => {
        const p = PERMISO[t.permiso];
        return (
          <article key={t.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[0.9rem] font-semibold text-gray-900">{t.quien || "Sin nombre"}{t.centro ? ` · ${t.centro}` : ""}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] text-gray-700">{t.via}</span>
              {t.idioma && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] text-gray-700">{t.idioma}</span>}
              <span className={`rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ${p.clase}`}>{p.nombre}</span>
              {t.donde.map((d) => <span key={d} className="rounded bg-blue-50 px-1.5 py-0.5 text-[0.7rem] text-blue-800">{DONDE[d] ?? d}</span>)}
              <span className="ml-auto text-[0.75rem] text-gray-400">{t.fecha}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[0.85rem] text-gray-800">{t.texto}</p>
            <p className="mt-2 text-[0.75rem] text-gray-500">
              {t.espejado_en ? `En el vault: ${t.vault_nota ?? "volcado"}` : "Pendiente de volcar al vault (pasada horaria)."}
            </p>
          </article>
        );
      })}
    </div>
  );
}
