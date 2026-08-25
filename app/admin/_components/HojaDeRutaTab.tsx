"use client";

import { useCallback, useEffect, useState } from "react";

interface ReservaCalendario {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  etiqueta: string;
  elegibilidad: string | null;
  dias_desde_alta: number | null;
}

interface DiaCalendario {
  dia: string;
  libres: number;
  primero: string | null;
  motivo: null | "reservado" | "semana-llena" | "bloqueado" | "sin-margen";
  reservas: ReservaCalendario[];
  semana: string;
}

interface BloqueoFila {
  id: string;
  dia: string;
  hora_desde: string | null;
  hora_hasta: string | null;
  motivo: string | null;
}

interface Datos {
  dias: DiaCalendario[];
  bloqueos: BloqueoFila[];
  semanas: Record<string, number>;
  limites: { porDia: number; porSemana: number };
}

const ETIQUETA_ELEGIBILIDAD: Record<string, string> = {
  elegible: "GRATIS",
  fuera_ventana: "NO GRATIS",
  no_en_lista: "NO EN LA LISTA",
};

const MOTIVO_TEXTO: Record<string, string> = {
  reservado: "Reservado",
  "semana-llena": "Semana completa",
  bloqueado: "Bloqueado",
  "sin-margen": "Sin margen",
};

function nombreDia(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function HojaDeRutaTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [nuevo, setNuevo] = useState({ dia: "", horaDesde: "", horaHasta: "", motivo: "" });
  const [franjaParcial, setFranjaParcial] = useState(false);

  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [destino, setDestino] = useState({ dia: "", hora: "" });

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-admin-password": sessionStorage.getItem("admin_pw") || "",
    }),
    []
  );

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/hoja-de-ruta", { headers: authHeaders(), cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "No se ha podido cargar el calendario.");
        return;
      }
      setDatos(d);
    } catch {
      setError("No se ha podido cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function bloquear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/hoja-de-ruta", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          dia: nuevo.dia,
          horaDesde: franjaParcial ? nuevo.horaDesde : "",
          horaHasta: franjaParcial ? nuevo.horaHasta : "",
          motivo: nuevo.motivo,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "No se ha podido bloquear.");
        return;
      }
      setNuevo({ dia: "", horaDesde: "", horaHasta: "", motivo: "" });
      setFranjaParcial(false);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function mover(id: string) {
    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/hoja-de-ruta", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ id, accion: "mover", dia: destino.dia, hora: destino.hora }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "No se ha podido mover la llamada.");
        return;
      }
      setMoviendo(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  // Al lead no se le avisa solo: la landing le promete que le escribes tú por
  // WhatsApp, así que el aviso lo das en persona.
  async function anular(id: string, nombre: string | null) {
    if (!confirm(`¿Anular la llamada de ${nombre ?? "esta persona"}? El hueco queda libre.`)) return;
    const motivo = prompt("Motivo (opcional):") ?? "";
    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/hoja-de-ruta", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ id, accion: "cancelar", motivo }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "No se ha podido anular.");
        return;
      }
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function quitarBloqueo(id: string) {
    setGuardando(true);
    try {
      await fetch("/api/admin/hoja-de-ruta", {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  const inputClass =
    "border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";

  if (cargando) return <p className="text-sm text-gray-400">Cargando calendario…</p>;
  if (!datos) return <p className="text-sm text-[#DC2626]">{error || "No hay datos."}</p>;

  // Los días vienen seguidos; se agrupan por semana natural para poder ver el
  // contador semanal, que es lo que cierra días aparentemente libres.
  const semanas = new Map<string, DiaCalendario[]>();
  for (const d of datos.dias) {
    const lista = semanas.get(d.semana) ?? [];
    lista.push(d);
    semanas.set(d.semana, lista);
  }

  const proximas = datos.dias.flatMap((d) => d.reservas);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-2">Reglas</p>
        <p className="text-sm text-gray-600">
          Máximo {datos.limites.porDia} llamada al día y {datos.limites.porSemana} por semana natural
          (lunes a domingo). Franjas cada media hora, de 9:00 a 20:00 como última hora de inicio. Se
          puede reservar con 48 h de antelación y hasta 30 días vista.
        </p>
      </div>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      {/* Próximas llamadas */}
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-3">
          Próximas llamadas ({proximas.length})
        </p>
        {proximas.length === 0 ? (
          <p className="text-sm text-gray-400">Ninguna reservada todavía.</p>
        ) : (
          <div className="space-y-2">
            {proximas.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium capitalize">{r.etiqueta}</span>
                  {r.elegibilidad && (
                    <span
                      className={`text-[0.68rem] uppercase tracking-[0.12em] px-2 py-0.5 ${
                        r.elegibilidad === "elegible"
                          ? "bg-[#D4860A]/15 text-[#8a5806]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {ETIQUETA_ELEGIBILIDAD[r.elegibilidad] ?? r.elegibilidad}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mt-1">
                  {r.nombre} · {r.email}
                  {r.telefono ? ` · ${r.telefono}` : ""}
                </p>

                {moviendo === r.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    <input
                      type="date"
                      value={destino.dia}
                      onChange={(e) => setDestino({ ...destino, dia: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="time"
                      step={1800}
                      value={destino.hora}
                      onChange={(e) => setDestino({ ...destino, hora: e.target.value })}
                      className={inputClass}
                    />
                    <button
                      onClick={() => mover(r.id)}
                      disabled={guardando || !destino.dia || !destino.hora}
                      className="bg-[#1a1a1a] text-white px-3 py-2 text-[0.78rem] disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setMoviendo(null)}
                      className="text-[0.78rem] text-gray-400 hover:text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-4">
                    <button
                      onClick={() => {
                        setMoviendo(r.id);
                        setDestino({ dia: "", hora: "" });
                        setError("");
                      }}
                      className="text-[0.78rem] text-gray-400 hover:text-gray-700"
                    >
                      Mover
                    </button>
                    <button
                      onClick={() => anular(r.id, r.nombre)}
                      disabled={guardando}
                      className="text-[0.78rem] text-gray-400 hover:text-[#DC2626] disabled:opacity-40"
                    >
                      Anular
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendario */}
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-3">Calendario</p>
        <div className="space-y-4">
          {Array.from(semanas.entries()).map(([lunes, dias]) => {
            const usadas = datos.semanas[lunes] ?? 0;
            const llena = usadas >= datos.limites.porSemana;
            return (
              <div key={lunes} className="bg-white border border-gray-200 p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[0.72rem] uppercase tracking-[0.16em] text-gray-400">
                    Semana del {nombreDia(lunes)}
                  </p>
                  <p className={`text-[0.72rem] ${llena ? "text-[#DC2626]" : "text-gray-400"}`}>
                    {usadas}/{datos.limites.porSemana}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                  {dias.map((d) => {
                    const reservado = d.motivo === "reservado";
                    const bloqueado = d.motivo === "bloqueado";
                    const abierto = d.libres > 0;
                    return (
                      <div
                        key={d.dia}
                        className={`border p-2 text-[0.72rem] leading-snug ${
                          reservado
                            ? "border-[#D4860A]/40 bg-[#D4860A]/10"
                            : bloqueado
                              ? "border-gray-300 bg-gray-100"
                              : abierto
                                ? "border-gray-200"
                                : "border-gray-100 bg-gray-50 text-gray-400"
                        }`}
                      >
                        <p className="font-medium capitalize">{nombreDia(d.dia)}</p>
                        {reservado ? (
                          <p className="text-[#8a5806] mt-0.5">
                            {d.reservas[0]?.etiqueta.split("·")[1]?.trim() ?? "Reservado"}
                          </p>
                        ) : abierto ? (
                          <p className="text-gray-500 mt-0.5">{d.libres} huecos</p>
                        ) : (
                          <p className="mt-0.5">{MOTIVO_TEXTO[d.motivo ?? ""] ?? "—"}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bloqueos */}
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400 mb-3">Bloquear fechas</p>

        <form onSubmit={bloquear} className="bg-white border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={nuevo.dia}
              onChange={(e) => setNuevo({ ...nuevo, dia: e.target.value })}
              className={inputClass}
              required
            />
            <input
              type="text"
              placeholder="Motivo (opcional)"
              value={nuevo.motivo}
              onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })}
              className={`${inputClass} flex-1 min-w-[180px]`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={franjaParcial}
              onChange={(e) => setFranjaParcial(e.target.checked)}
            />
            Solo una franja de ese día (si no, se bloquea el día entero)
          </label>

          {franjaParcial && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="time"
                step={1800}
                value={nuevo.horaDesde}
                onChange={(e) => setNuevo({ ...nuevo, horaDesde: e.target.value })}
                className={inputClass}
                required
              />
              <span className="text-sm text-gray-400">a</span>
              <input
                type="time"
                step={1800}
                value={nuevo.horaHasta}
                onChange={(e) => setNuevo({ ...nuevo, horaHasta: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={guardando || !nuevo.dia}
            className="bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Bloquear"}
          </button>
        </form>

        {datos.bloqueos.length > 0 && (
          <div className="mt-4 space-y-2">
            {datos.bloqueos.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between bg-white border border-gray-200 px-3 py-2 text-sm"
              >
                <span>
                  <span className="capitalize">{nombreDia(b.dia)}</span>
                  {b.hora_desde && b.hora_hasta
                    ? ` · ${b.hora_desde.slice(0, 5)}–${b.hora_hasta.slice(0, 5)}`
                    : " · día entero"}
                  {b.motivo ? <span className="text-gray-400"> · {b.motivo}</span> : null}
                </span>
                <button
                  onClick={() => quitarBloqueo(b.id)}
                  disabled={guardando}
                  className="text-[0.75rem] text-gray-400 hover:text-[#DC2626] disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
