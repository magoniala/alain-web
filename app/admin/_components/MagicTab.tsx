"use client";

import { useState, useEffect, useCallback } from "react";

interface Testimonial {
  quote: string;
  author: string;
}

interface MagicConfig {
  hideSchedule: boolean;
  testimonialsEnabled: boolean;
  testimonials: Testimonial[];
}

export default function MagicTab() {
  const [config, setConfig] = useState<MagicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  // Edición local de testimonios (se guarda con el botón "Guardar testimonios")
  const [draftTestimonials, setDraftTestimonials] = useState<Testimonial[]>([]);
  const [savingTestimonials, setSavingTestimonials] = useState(false);

  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);
  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-password": pw(),
  }), [pw]);

  useEffect(() => {
    fetch("/api/magic/config", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: MagicConfig) => {
        setConfig(d);
        setDraftTestimonials(d.testimonials);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(body: Partial<MagicConfig>) {
    setPending(true);
    try {
      await fetch("/api/magic/config", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      setConfig((prev) => (prev ? { ...prev, ...body } : prev));
    } finally {
      setPending(false);
    }
  }

  async function saveTestimonials() {
    setSavingTestimonials(true);
    try {
      const cleaned = draftTestimonials.filter((t) => t.quote.trim() && t.author.trim());
      await patch({ testimonials: cleaned });
      setDraftTestimonials(cleaned);
    } finally {
      setSavingTestimonials(false);
    }
  }

  function updateDraft(i: number, field: keyof Testimonial, value: string) {
    setDraftTestimonials((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function removeDraft(i: number) {
    setDraftTestimonials((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDraft() {
    setDraftTestimonials((prev) => [...prev, { quote: "", author: "" }]);
  }

  const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  if (loading || !config) return <p className="text-sm text-gray-400">Cargando…</p>;

  return (
    <div className="space-y-8">
      {/* BLOQUE DE HORARIOS */}
      <div className="border border-gray-200 p-5">
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400 mb-1">
          Bloque de horarios (/magic)
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Se oculta solo a partir del 9 de agosto de 2026 (hora de Bruselas). Este botón lo oculta antes de esa fecha si hace falta.
        </p>
        <button
          onClick={() => patch({ hideSchedule: !config.hideSchedule })}
          disabled={pending}
          className={`px-4 py-2 text-sm border transition-colors ${
            config.hideSchedule
              ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
              : "border-gray-300 text-gray-600 hover:border-gray-500"
          }`}
        >
          {config.hideSchedule ? "✓ Bloque oculto manualmente" : "Ocultar bloque de horarios"}
        </button>
      </div>

      {/* TESTIMONIOS */}
      <div className="border border-gray-200 p-5">
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400 mb-1">
          Testimonios (/magic)
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Solo se muestran en la web si están activados y hay al menos uno relleno.
        </p>
        <button
          onClick={() => patch({ testimonialsEnabled: !config.testimonialsEnabled })}
          disabled={pending}
          className={`mb-5 px-4 py-2 text-sm border transition-colors ${
            config.testimonialsEnabled
              ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
              : "border-gray-300 text-gray-600 hover:border-gray-500"
          }`}
        >
          {config.testimonialsEnabled ? "✓ Visibles en la web" : "Activar testimonios en la web"}
        </button>

        <div className="space-y-4">
          {draftTestimonials.map((t, i) => (
            <div key={i} className="border border-gray-200 p-3 space-y-2">
              <textarea
                placeholder="Cita del testimonio"
                value={t.quote}
                onChange={(e) => updateDraft(i, "quote", e.target.value)}
                className={inputClass}
                rows={2}
              />
              <div className="flex gap-2">
                <input
                  placeholder="Autor / empresa"
                  value={t.author}
                  onChange={(e) => updateDraft(i, "author", e.target.value)}
                  className={inputClass}
                />
                <button
                  onClick={() => removeDraft(i)}
                  className="px-3 text-sm text-gray-400 hover:text-red-600 whitespace-nowrap"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={addDraft} className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:border-gray-500">
            + Añadir testimonio
          </button>
          <button
            onClick={saveTestimonials}
            disabled={savingTestimonials}
            className="px-4 py-2 text-sm bg-[#1a1a1a] text-white disabled:opacity-40"
          >
            {savingTestimonials ? "Guardando…" : "Guardar testimonios"}
          </button>
        </div>
      </div>
    </div>
  );
}
