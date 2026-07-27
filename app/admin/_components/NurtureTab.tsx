"use client";

import { useState, useEffect, useCallback } from "react";

interface NurtureContacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string;
  recibe_secuencia: boolean;
  posicion_secuencia: number;
  secuencia_completada: boolean;
  fecha_ultimo_mail_secuencia: string | null;
  unsubscribed: boolean;
  siguiente_asunto: string | null;
}

export default function NurtureTab() {
  const [contactos, setContactos] = useState<NurtureContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-password": sessionStorage.getItem("admin_pw") || "",
  }), []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/admin/nurture/contactos", { headers: authHeaders() }).then(r => r.json());
    if (Array.isArray(data)) setContactos(data);
    setLoading(false);
  }

  async function toggleRecibe(id: string, recibe_secuencia: boolean) {
    setUpdatingId(id);
    setContactos(prev => prev.map(c => c.id === id ? { ...c, recibe_secuencia } : c));
    await fetch("/api/admin/nurture/contactos", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, recibe_secuencia }),
    });
    setUpdatingId(null);
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // Buckets mutuamente excluyentes: excluido manda sobre completada.
  const excluidos = contactos.filter(c => !c.recibe_secuencia);
  const completados = contactos.filter(c => c.recibe_secuencia && c.secuencia_completada);
  const activos = contactos.filter(c => c.recibe_secuencia && !c.secuencia_completada);

  const btnClass = "px-3 py-1.5 text-xs border transition-colors";

  function Row({ c }: { c: NurtureContacto }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-700 truncate">{c.email}</p>
          <p className="text-[0.7rem] text-gray-400">
            Posición {c.posicion_secuencia}
            {c.siguiente_asunto && <> · Siguiente: {c.siguiente_asunto}</>}
            {" · "}Último envío: {fmtDate(c.fecha_ultimo_mail_secuencia)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.secuencia_completada && (
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 bg-green-50 text-green-600">completada</span>
          )}
          {!c.recibe_secuencia && (
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 bg-gray-100 text-gray-500">excluido</span>
          )}
          {c.recibe_secuencia ? (
            <button
              onClick={() => toggleRecibe(c.id, false)}
              disabled={updatingId === c.id}
              className={`${btnClass} border-gray-300 hover:border-gray-500 disabled:opacity-40`}
            >
              Marcar como reservado
            </button>
          ) : (
            <button
              onClick={() => toggleRecibe(c.id, true)}
              disabled={updatingId === c.id}
              className={`${btnClass} border-green-400 text-green-700 hover:bg-green-50 disabled:opacity-40`}
            >
              Reactivar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 p-5 md:p-6 space-y-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#1a1a1a] mb-5">
          En secuencia ({activos.length})
        </p>
        {loading ? (
          <p className="text-sm text-gray-400 italic">Cargando...</p>
        ) : activos.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nadie en secuencia todavía.</p>
        ) : (
          <div>{activos.map(c => <Row key={c.id} c={c} />)}</div>
        )}
      </div>

      {excluidos.length > 0 && (
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-5">
            Excluidos / reservados ({excluidos.length})
          </p>
          <div>{excluidos.map(c => <Row key={c.id} c={c} />)}</div>
        </div>
      )}

      {completados.length > 0 && (
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-5">
            Secuencia completada ({completados.length})
          </p>
          <div>{completados.map(c => <Row key={c.id} c={c} />)}</div>
        </div>
      )}
    </section>
  );
}
