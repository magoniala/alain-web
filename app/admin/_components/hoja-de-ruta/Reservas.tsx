"use client";

import { useCallback, useEffect, useState } from "react";

// Bandeja de reservas de la Hoja de Ruta: lo que pide WhatsApp de
// confirmación ahora, lo que espera pago y lo ya hecho. Sustituye al correo
// de aviso como sitio de trabajo (el correo sigue llegando de respaldo).

interface Reserva {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  hueco: string;
  hueco_en: string | null;
  tipo: string | null;
  elegibilidad: string | null;
  dias_desde_alta: number | null;
  pago_estado: string | null;
  pagado_en: string | null;
  creado_en: string;
  wa_confirmacion_en: string | null;
  wa_confirmacion_nota: string | null;
  panel_descartada_en: string | null;
  panel_nota: string | null;
  confirmada: boolean;
  cuando: string;
  wa_url: string;
  wa_con_numero: boolean;
  wa_texto: string;
}

const cabeceras = () => ({ "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" });
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function Reservas() {
  const [d, setD] = useState<{ pendientes_wa: Reserva[]; esperando_pago: Reserva[]; recientes: Reserva[] } | null>(null);
  const [error, setError] = useState("");
  const [faltaSql, setFaltaSql] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/hoja-de-ruta/bandeja", { headers: cabeceras() });
      const j = await r.json();
      if (!r.ok) {
        setFaltaSql(!!j.falta_sql);
        setError(j.error ?? "Error");
        return;
      }
      setD(j);
      setError("");
    } catch {
      setError("Sin conexión.");
    }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const accion = async (body: Record<string, unknown>) => {
    setOcupado(String(body.id));
    try {
      const r = await fetch("/api/admin/hoja-de-ruta/bandeja", { method: "POST", headers: cabeceras(), body: JSON.stringify(body) });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "No se pudo guardar.");
      await cargar();
    } finally {
      setOcupado(null);
    }
  };

  if (faltaSql) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[0.85rem] text-amber-950">Falta ejecutar <code>hoja_ruta_bandeja.sql</code> en Supabase para la bandeja de reservas.</p>;
  if (!d) return <p className="text-sm text-gray-400">{error || "Cargando reservas…"}</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Te toca: WhatsApp de confirmación ({d.pendientes_wa.length})</p>
        {d.pendientes_wa.length === 0 ? (
          <p className="text-sm text-gray-500">Nada pendiente. Cuando alguien reserve (o pague), aparece aquí y te llega un aviso al móvil.</p>
        ) : (
          <div className="space-y-3">
            {d.pendientes_wa.map((r) => (
              <article key={r.id} className="rounded-2xl border border-[#25D366]/40 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[1rem] font-semibold text-gray-900">{r.nombre || r.email}</p>
                    <p className="text-[0.82rem] text-gray-600">
                      <b>{r.cuando}</b> · {r.pago_estado ? `pagada ${fecha(r.pagado_en)}` : "gratuita"}{r.elegibilidad ? ` · ${r.elegibilidad}` : ""}{r.dias_desde_alta !== null ? ` · día ${r.dias_desde_alta} desde el alta` : ""}
                    </p>
                    <p className="text-[0.78rem] text-gray-500">{r.email}{r.telefono ? ` · ${r.telefono}` : " · sin teléfono"} · reservó {fecha(r.hueco_en)}</p>
                  </div>
                </div>
                <details className="mt-2 text-[0.82rem] text-gray-700">
                  <summary className="cursor-pointer text-gray-500">Ver el mensaje</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 font-sans">{r.wa_texto}</pre>
                </details>
                {!r.wa_con_numero && <p className="mt-1 text-[0.78rem] text-amber-800">No he sabido leer su teléfono: el botón abre WhatsApp con el mensaje y eliges tú el contacto.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={r.wa_url} target="_blank" rel="noreferrer" className="bg-[#25D366] px-4 py-2 text-[0.85rem] font-medium text-white">Abrir WhatsApp con el mensaje</a>
                  <button onClick={() => accion({ accion: "wa_enviado", id: r.id })} disabled={ocupado === r.id} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">
                    {ocupado === r.id ? "Guardando…" : "Ya lo he enviado"}
                  </button>
                  <button onClick={() => { const n = prompt("¿Por qué lo quitas sin WhatsApp? (p. ej. ya hablé con él)") ?? ""; accion({ accion: "descartar", id: r.id, nota: n }); }} disabled={ocupado === r.id} className="px-3 py-2 text-[0.82rem] text-gray-600 ring-1 ring-gray-300 disabled:opacity-40">
                    Quitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {d.esperando_pago.length > 0 && (
        <section>
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Hueco apartado, esperando pago ({d.esperando_pago.length})</p>
          <ul className="space-y-1 text-[0.85rem] text-gray-700">
            {d.esperando_pago.map((r) => (
              <li key={r.id}>{r.nombre || r.email} · {r.cuando} · reservó {fecha(r.hueco_en)} <span className="text-gray-400">· el WhatsApp sale al pagar</span></li>
            ))}
          </ul>
        </section>
      )}

      {d.recientes.length > 0 && (
        <section>
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Últimas confirmadas</p>
          <ul className="space-y-1 text-[0.82rem] text-gray-600">
            {d.recientes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>{r.nombre || r.email} · {r.cuando}</span>
                {r.wa_confirmacion_en ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.75rem] text-emerald-800">WhatsApp enviado {fecha(r.wa_confirmacion_en)}</span> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.75rem] text-gray-600">quitada{r.panel_nota ? `: ${r.panel_nota}` : ""}</span>}
                <button onClick={() => accion({ accion: "deshacer", id: r.id })} className="text-[0.75rem] text-gray-400 hover:text-gray-700">deshacer</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
