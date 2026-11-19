"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// «Pedir opinión a las reservas de este evento»: un único correo por persona
// a quienes reservaron, con el enlace al formulario de opinión de familias.
// Aquí se ve a quién le llegaría, el mail tal cual (EU y ES), se manda una
// prueba solo a Alain y, cuando él lo decide, se envía de verdad escribiendo
// la confirmación. Nadie entra en la newsletter ni en ninguna secuencia.

type Envio = { estado: "pendiente" | "aceptado" | "error"; error: string | null; enviado_en: string | null } | null;
type Dest = { email: string; nombre: string; idioma: "es" | "eu"; formularios: number; actividades: string[]; asistencia: "entrada" | "sin_control"; envio: Envio; yaOpino: boolean };
type Datos = {
  evento: { clave: string; nombre: string; ruta: string };
  envioRealAbierto: boolean;
  enProduccion: boolean;
  faltaSql: boolean;
  destinatarios: Dest[];
  excluidos: { email: string; nombre: string; motivo: string }[];
  pasesConControl: string[];
  pasesSinControl: string[];
  respuestas: number;
  respuestasMail: number;
  vistaPrevia: Record<"es" | "eu", { asunto: string; html: string; enlace: string }>;
  pruebaA: string;
};

const pw = () => sessionStorage.getItem("admin_pw") || "";
const btn = "px-3 py-1.5 text-[0.82rem] text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40";
const btnFuerte = "px-3 py-1.5 text-[0.82rem] font-medium bg-gray-900 text-white disabled:opacity-40";
const fecha = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PedirOpinionReservas({ evento }: { evento: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [idioma, setIdioma] = useState<"eu" | "es">("eu");
  const [excluir, setExcluir] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState("");
  const [ocupado, setOcupado] = useState<"" | "prueba" | "enviar">("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/opinion/reservas?evento=${encodeURIComponent(evento)}`, { headers: { "x-admin-password": pw() } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setD(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [evento]);
  useEffect(() => {
    if (abierto && !d) cargar();
  }, [abierto, d, cargar]);

  const cuenta = useMemo(() => {
    const dest = d?.destinatarios ?? [];
    const hecho = (x: Dest) => x.envio?.estado === "aceptado" || x.envio?.estado === "pendiente";
    const dentro = dest.filter((x) => !excluir.has(x.email) && (hecho(x) || !x.yaOpino));
    return {
      total: dentro.length,
      faltan: dentro.filter((x) => !hecho(x)).length,
      enviados: dest.filter((x) => x.envio?.estado === "aceptado").length,
      dudosos: dest.filter((x) => x.envio?.estado === "pendiente").length,
      errores: dest.filter((x) => x.envio?.estado === "error").length,
      eu: dentro.filter((x) => x.idioma === "eu").length,
      es: dentro.filter((x) => x.idioma === "es").length,
      entrada: dest.filter((x) => x.asistencia === "entrada").length,
      sinControl: dest.filter((x) => x.asistencia === "sin_control").length,
    };
  }, [d, excluir]);

  async function post(cuerpo: Record<string, unknown>) {
    const r = await fetch("/api/admin/opinion/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": pw() },
      body: JSON.stringify({ evento, ...cuerpo }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
    return j;
  }

  async function prueba() {
    setOcupado("prueba");
    setMensaje("");
    try {
      const j = await post({ accion: "prueba" });
      setMensaje(`Prueba enviada a ${j.enviadoA} (${j.versiones.join(" y ").toUpperCase()}). Mira el correo y abre el enlace.`);
    } catch (e) {
      setMensaje(`La prueba no ha salido: ${e instanceof Error ? e.message : e}`);
    } finally {
      setOcupado("");
    }
  }

  // Envío real, por tandas, hasta que no quede nadie. Los que fallan en esta
  // operación no se reintentan en cada tanda; se reintentan al volver a pulsar.
  async function enviar() {
    setOcupado("enviar");
    setMensaje("");
    let enviados = 0;
    const fallidos: string[] = [];
    try {
      for (let i = 0; i < 50; i++) {
        const j = await post({ accion: "enviar", confirmar, excluir: [...excluir], saltar: fallidos });
        enviados += j.enviados;
        for (const e of j.errores as { email: string }[]) fallidos.push(e.email);
        setMensaje(`Enviando… ${enviados} enviados${fallidos.length ? `, ${fallidos.length} con error` : ""}`);
        if (!j.quedan) break;
      }
      setMensaje(`Hecho: ${enviados} correos enviados${fallidos.length ? `, ${fallidos.length} con error (abajo, en la lista; vuelve a pulsar para reintentarlos)` : ""}.`);
      setConfirmar("");
    } catch (e) {
      setMensaje(`${enviados ? `${enviados} enviados y después: ` : ""}${e instanceof Error ? e.message : e}`);
    } finally {
      setOcupado("");
      cargar();
    }
  }

  const frase = `ENVIAR ${cuenta.total}`;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Después del evento</p>
          <h3 className="text-[1.05rem] font-semibold text-gray-900">Pedir opinión a las reservas de este evento</h3>
          <p className="text-[0.82rem] text-gray-500">Un único correo por persona, con el enlace al formulario de familias. No apunta a nadie a la newsletter.</p>
        </div>
        <button onClick={() => setAbierto(!abierto)} className={btn}>
          {abierto ? "Cerrar" : "Abrir"}
        </button>
      </div>

      {abierto && !d && <p className="mt-4 text-sm text-gray-400">{error || "Cargando…"}</p>}

      {abierto && d && (
        <div className="mt-5 space-y-6">
          {error && <p className="text-sm text-[#DC2626]">{error}</p>}
          {d.faltaSql && (
            <p className="rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
              Falta ejecutar <b>sql/opiniones_eventos.sql</b> en Supabase. La vista previa y la prueba funcionan; el envío real y el formulario, no.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [cuenta.total, "Personas a las que llegaría", `${cuenta.eu} en euskera · ${cuenta.es} en castellano`],
              [cuenta.entrada, "Consta que entraron", "marcadas en el control de entrada"],
              [cuenta.sinControl, "Con plaza, sin control", "no se sabe si vinieron"],
              [d.respuestas, "Opiniones recibidas", `${d.respuestasMail} llegaron por este mail`],
            ].map(([v, t, s]) => (
              <div key={String(t)} className="rounded-xl border border-gray-200 p-3">
                <p className="text-[1.5rem] font-semibold tabular-nums text-gray-900">{v}</p>
                <p className="text-[0.8rem] text-gray-700">{t}</p>
                <p className="text-[0.72rem] text-gray-400">{s}</p>
              </div>
            ))}
          </div>
          <p className="text-[0.8rem] text-gray-500">
            Un correo por dirección, aunque rellenaran varios formularios. Fuera: reservas anuladas, lista de espera que no entró y quien no vino a un pase con control de entrada.
            {d.pasesSinControl.length > 0 && <> En estos pases no se marcó la entrada, así que quien tenía plaza entra en la lista aunque no se sepa si vino (el correo lo dice): {d.pasesSinControl.join(" · ")}.</>}
          </p>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Vista previa</p>
              {(["eu", "es"] as const).map((l) => (
                <button key={l} onClick={() => setIdioma(l)} className={idioma === l ? btnFuerte : btn}>
                  {l === "eu" ? "Euskera" : "Castellano"}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[0.85rem] text-gray-700">
              <b>Asunto:</b> {d.vistaPrevia[idioma].asunto}
            </p>
            {/* sandbox sin permisos: es solo para ver el HTML del correo. */}
            <iframe title="Vista previa del correo" sandbox="" srcDoc={d.vistaPrevia[idioma].html} className="h-[460px] w-full border border-gray-200 bg-white" />
            <p className="mt-1 text-[0.75rem] text-gray-400">El botón lleva a {d.vistaPrevia[idioma].enlace}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={prueba} disabled={ocupado !== ""} className={btnFuerte}>
              {ocupado === "prueba" ? "Enviando la prueba…" : `Enviarme una prueba (solo a ${d.pruebaA})`}
            </button>
            <span className="text-[0.78rem] text-gray-500">Llegan las dos versiones, EU y ES. No se envía a nadie más ni queda registrado como enviado.</span>
          </div>

          <details>
            <summary className="cursor-pointer text-[0.85rem] text-gray-700">
              Ver destinatarios ({d.destinatarios.length}) y quién queda fuera ({d.excluidos.length})
            </summary>
            <div className="mt-3 max-h-[420px] overflow-auto border border-gray-200">
              <table className="w-full text-left text-[0.8rem]">
                <thead className="sticky top-0 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5">Enviar</th>
                    <th className="px-2 py-1.5">Nombre</th>
                    <th className="px-2 py-1.5">Correo</th>
                    <th className="px-2 py-1.5">Idioma</th>
                    <th className="px-2 py-1.5">Vino a</th>
                    <th className="px-2 py-1.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {d.destinatarios.map((x) => {
                    const hecho = x.envio?.estado === "aceptado" || x.envio?.estado === "pendiente";
                    return (
                      <tr key={x.email} className={excluir.has(x.email) ? "text-gray-400" : "text-gray-800"}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            aria-label={`Enviar a ${x.email}`}
                            disabled={hecho || (x.yaOpino && !hecho)}
                            checked={hecho || (!excluir.has(x.email) && !x.yaOpino)}
                            onChange={(e) => {
                              const n = new Set(excluir);
                              if (e.target.checked) n.delete(x.email);
                              else n.add(x.email);
                              setExcluir(n);
                              setConfirmar("");
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">{x.nombre}</td>
                        <td className="px-2 py-1.5">{x.email}</td>
                        <td className="px-2 py-1.5">{x.idioma.toUpperCase()}</td>
                        <td className="px-2 py-1.5">
                          {x.actividades.join(" + ")}
                          {x.asistencia === "sin_control" ? " · sin control de entrada" : ""}
                          {x.formularios > 1 ? ` · ${x.formularios} formularios` : ""}
                        </td>
                        <td className="px-2 py-1.5">
                          {x.envio?.estado === "aceptado"
                            ? `Enviado${x.envio.enviado_en ? ` · ${fecha(x.envio.enviado_en)}` : ""}`
                            : x.envio?.estado === "pendiente"
                              ? "Sin confirmar (no se reenvía solo)"
                              : x.envio?.estado === "error"
                                ? `Error: ${x.envio.error ?? ""}`
                                : x.yaOpino
                                  ? "Ya dejó su opinión"
                                  : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {d.excluidos.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[0.8rem] text-gray-500">
                {d.excluidos.map((x) => (
                  <li key={x.email || x.nombre}>
                    <b className="font-medium text-gray-700">{x.nombre || "(sin nombre)"}</b> · {x.email || "(sin correo)"} · {x.motivo}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[0.9rem] font-medium text-gray-900">Envío real</p>
            {(cuenta.enviados > 0 || cuenta.errores > 0 || cuenta.dudosos > 0) && (
              <p className="mt-1 text-[0.82rem] text-gray-600">
                Enviados: {cuenta.enviados}
                {cuenta.errores ? ` · con error: ${cuenta.errores}` : ""}
                {cuenta.dudosos ? ` · sin confirmar: ${cuenta.dudosos}` : ""} · faltan: {cuenta.faltan}
              </p>
            )}
            {!d.envioRealAbierto ? (
              <p className="mt-1 text-[0.82rem] text-gray-600">Cerrado para este evento (se abre en lib/opinion.ts).</p>
            ) : !d.enProduccion ? (
              <p className="mt-1 text-[0.82rem] text-gray-600">
                Esto es una versión de prueba: desde aquí solo funcionan la vista previa y la prueba. El envío real a las {cuenta.faltan} personas se lanza desde el panel de producción (alainzulaika.com/admin).
              </p>
            ) : cuenta.faltan === 0 ? (
              <p className="mt-1 text-[0.82rem] text-gray-600">No queda nadie por recibirlo.</p>
            ) : (
              <>
                <p className="mt-1 text-[0.82rem] text-gray-600">
                  Va a salir un correo a <b>{cuenta.faltan}</b> personas ({cuenta.total} en total con las ya enviadas). No se puede deshacer. Para enviarlo, escribe <b>{frase}</b>.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder={frase} aria-label="Confirmación del envío" className="w-44 border border-gray-300 bg-white px-3 py-1.5 text-[0.85rem] outline-none" />
                  <button onClick={enviar} disabled={ocupado !== "" || confirmar.trim().toUpperCase() !== frase || d.faltaSql} className={btnFuerte}>
                    {ocupado === "enviar" ? "Enviando…" : `Enviar a ${cuenta.faltan} personas`}
                  </button>
                </div>
              </>
            )}
          </div>

          {mensaje && <p className="text-[0.85rem] text-gray-800">{mensaje}</p>}
        </div>
      )}
    </section>
  );
}
