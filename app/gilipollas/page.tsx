"use client";

import { useState, useEffect } from "react";

interface Stats {
  personas_testadas: number;
  conocen_gilipollas: number;
  creen_que_diran_su_nombre: number;
}

interface Frase {
  id: string;
  texto: string;
  sujeto_num: number;
}

interface EmailEntry {
  id: string;
  email: string;
  fecha: string;
  origen: string;
}

const STAT_LABELS: Record<keyof Stats, string> = {
  personas_testadas: "Personas que han participado",
  conocen_gilipollas: "Conocen a algún gilipollas",
  creen_que_diran_su_nombre: "Creen que alguien diría su nombre",
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [frases, setFrases] = useState<Frase[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Local edits for stats
  const [editStats, setEditStats] = useState<Stats | null>(null);

  // New frase form
  const [newTexto, setNewTexto] = useState("");
  const [newSujeto, setNewSujeto] = useState("");
  const [addingFrase, setAddingFrase] = useState(false);

  // Edit frase
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editSujeto, setEditSujeto] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [s, f, e] = await Promise.all([
      fetch("/api/arrogante/stats").then(r => r.json()),
      fetch("/api/arrogante/frases").then(r => r.json()),
      fetch("/api/arrogante/emails").then(r => r.json()),
    ]);
    setStats(s);
    setEditStats(s);
    setFrases(f);
    setEmails(e);
  }

  async function increment(field: keyof Stats) {
    if (!editStats) return;
    const newVal = (editStats[field] ?? 0) + 1;
    const updated = { ...editStats, [field]: newVal };
    setEditStats(updated);
    setSaving(field);
    await fetch("/api/arrogante/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: newVal }),
    });
    setStats(updated);
    setSaving(null);
  }

  async function saveStat(field: keyof Stats) {
    if (!editStats) return;
    setSaving(field);
    await fetch("/api/arrogante/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: editStats[field] }),
    });
    setStats({ ...editStats });
    setSaving(null);
  }

  async function addFrase() {
    if (!newTexto.trim() || !newSujeto.trim()) return;
    setAddingFrase(true);
    await fetch("/api/arrogante/frases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: newTexto.trim(), sujeto_num: parseInt(newSujeto) }),
    });
    setNewTexto("");
    setNewSujeto("");
    const f = await fetch("/api/arrogante/frases").then(r => r.json());
    setFrases(f);
    setAddingFrase(false);
  }

  async function saveEditFrase(id: string) {
    await fetch("/api/arrogante/frases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, texto: editTexto.trim(), sujeto_num: parseInt(editSujeto) }),
    });
    const f = await fetch("/api/arrogante/frases").then(r => r.json());
    setFrases(f);
    setEditingId(null);
  }

  async function deleteFrase(id: string) {
    if (!confirm("¿Eliminar esta frase?")) return;
    await fetch("/api/arrogante/frases", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setFrases(frases.filter(f => f.id !== id));
  }

  function copyEmails() {
    const text = emails.map(e => e.email).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportCSV() {
    const header = "email,fecha,origen";
    const rows = emails.map(e => `${e.email},${e.fecha},${e.origen}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arrogante-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pct = (n: number) => {
    if (!stats || stats.personas_testadas === 0) return "—";
    return Math.round((n / stats.personas_testadas) * 100) + "%";
  };

  const inputClass = "border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors w-full";
  const btnClass = "px-4 py-2 text-sm border transition-colors";

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-[720px] mx-auto">
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-gray-400">Panel — Arrogante</p>
          <a href="/arrogante" target="_blank" className="text-[0.75rem] text-[#DC2626] underline">Ver landing →</a>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-5 py-8 space-y-10">

        {/* STATS */}
        <section className="bg-white border border-gray-200 p-5 md:p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#DC2626] mb-6">Estadísticas</p>

          {/* Preview */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-[#f9f9f9] border border-gray-100">
              <div className="col-span-2">
                <p className="text-2xl font-bold">{stats.personas_testadas}</p>
                <p className="text-[0.7rem] text-gray-400 uppercase tracking-wider mt-1">Han participado</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#DC2626]">{pct(stats.conocen_gilipollas)}</p>
                <p className="text-[0.7rem] text-gray-400 uppercase tracking-wider mt-1">Conocen</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#DC2626]">{pct(stats.creen_que_diran_su_nombre)}</p>
                <p className="text-[0.7rem] text-gray-400 uppercase tracking-wider mt-1">Creen su nombre</p>
              </div>
            </div>
          )}

          {/* Controls */}
          {editStats && (Object.keys(STAT_LABELS) as (keyof Stats)[]).map((field) => (
            <div key={field} className="mb-5 pb-5 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
              <p className="text-[0.8rem] font-medium text-gray-600 mb-2">{STAT_LABELS[field]}</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={editStats[field]}
                  min={0}
                  onChange={e => setEditStats({ ...editStats, [field]: parseInt(e.target.value) || 0 })}
                  className={`${inputClass} w-24`}
                />
                <button
                  onClick={() => increment(field)}
                  className={`${btnClass} border-gray-300 hover:border-gray-500 font-mono`}
                >
                  +1
                </button>
                <button
                  onClick={() => saveStat(field)}
                  disabled={saving === field}
                  className={`${btnClass} bg-[#1a1a1a] text-white border-[#1a1a1a] hover:bg-[#333] disabled:opacity-50`}
                >
                  {saving === field ? "..." : "Guardar"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* FRASES */}
        <section className="bg-white border border-gray-200 p-5 md:p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#DC2626] mb-6">Frases reales</p>

          {/* Add new */}
          <div className="mb-6 p-4 bg-[#f9f9f9] border border-gray-100 space-y-3">
            <p className="text-[0.78rem] font-medium text-gray-500 uppercase tracking-wider">Nueva frase</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Sujeto nº"
                value={newSujeto}
                onChange={e => setNewSujeto(e.target.value)}
                className={`${inputClass} w-24`}
              />
            </div>
            <textarea
              placeholder="Texto de la frase..."
              value={newTexto}
              onChange={e => setNewTexto(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
            <button
              onClick={addFrase}
              disabled={addingFrase || !newTexto.trim() || !newSujeto.trim()}
              className={`${btnClass} bg-[#DC2626] text-white border-[#DC2626] hover:opacity-90 disabled:opacity-40 w-full`}
            >
              {addingFrase ? "Añadiendo..." : "Añadir frase"}
            </button>
          </div>

          {/* List */}
          {frases.length === 0 && (
            <p className="text-sm text-gray-400 italic">Sin frases todavía.</p>
          )}
          <div className="space-y-4">
            {frases.map((frase) => (
              <div key={frase.id} className="border border-gray-100 p-4">
                {editingId === frase.id ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editSujeto}
                      onChange={e => setEditSujeto(e.target.value)}
                      className={`${inputClass} w-24`}
                      placeholder="Sujeto nº"
                    />
                    <textarea
                      value={editTexto}
                      onChange={e => setEditTexto(e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEditFrase(frase.id)} className={`${btnClass} bg-[#1a1a1a] text-white border-[#1a1a1a]`}>Guardar</button>
                      <button onClick={() => setEditingId(null)} className={`${btnClass} border-gray-300 hover:border-gray-500`}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.2em] text-gray-400 mb-1">Sujeto {frase.sujeto_num}</p>
                    <p className="text-sm text-gray-700 italic leading-relaxed mb-3">&ldquo;{frase.texto}&rdquo;</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingId(frase.id); setEditTexto(frase.texto); setEditSujeto(String(frase.sujeto_num)); }}
                        className={`${btnClass} border-gray-300 hover:border-gray-500 text-xs`}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteFrase(frase.id)}
                        className={`${btnClass} border-red-200 text-[#DC2626] hover:border-[#DC2626] text-xs`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* EMAILS */}
        <section className="bg-white border border-gray-200 p-5 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#DC2626]">
              Emails recogidos ({emails.length})
            </p>
            <div className="flex gap-2">
              <button onClick={copyEmails} className={`${btnClass} border-gray-300 hover:border-gray-500 text-xs`}>
                {copied ? "¡Copiado!" : "Copiar todos"}
              </button>
              {emails.length > 0 && (
                <button onClick={exportCSV} className={`${btnClass} bg-[#1a1a1a] text-white border-[#1a1a1a] text-xs`}>
                  Exportar CSV
                </button>
              )}
            </div>
          </div>

          {emails.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin emails todavía.</p>
          ) : (
            <div className="space-y-2">
              {emails.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700">{entry.email}</p>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-[0.65rem] uppercase tracking-wider px-2 py-0.5 ${
                      entry.origen === "tiktok" ? "bg-pink-50 text-pink-500" :
                      entry.origen === "qr" ? "bg-gray-100 text-gray-500" :
                      entry.origen === "newsletter" ? "bg-amber-50 text-amber-600" :
                      "bg-blue-50 text-blue-500"
                    }`}>
                      {entry.origen}
                    </span>
                    <p className="text-[0.72rem] text-gray-400">
                      {new Date(entry.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
