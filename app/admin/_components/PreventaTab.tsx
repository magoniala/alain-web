"use client";

// Pestaña «Preventa» (26-11-2026): la preventa de las masterclasses de diciembre.
// Contador n de 3 por producto, compras, familia y amigos (no cuentan),
// devoluciones con fecha y motivo, recuento del 10-dic, desistimientos y
// ajustes (vídeos y correos de prueba). Lógica: lib/preventa.ts · reglas:
// lib/preventa-reglas.ts · API: app/api/admin/preventa.

import { useCallback, useEffect, useState } from "react";
import { confirmar } from "./confirmar";

const pw = () => sessionStorage.getItem("admin_pw") || "";

interface Compra {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string;
  producto: "B" | "A" | "subida";
  importe_cent: number;
  estado: string;
  devuelto_cent: number;
  prueba: boolean;
  pagado_en: string | null;
  newsletter_ok: boolean;
  confirmacion_enviada: boolean;
  confirmacion_error: string | null;
}
interface Datos {
  fase: string;
  cuenta: { llegaA: boolean; llegaB: boolean; cuenta: { A: number; B: number } };
  recuento: null | { llegaA: boolean; llegaB: boolean; cuenta: { A: number; B: number }; en: string };
  pendientes: { compra_id: string; email: string; importe: number; motivo: string }[];
  compras: Compra[];
  intentos: number;
  excluidos: string[];
  desistimientos: { id: string; email: string; nombre: string | null; mensaje: string | null; atendido: boolean; created_at: string }[];
  devoluciones: { id: string; compra_id: string; importe_cent: number; motivo: string; nota: string | null; created_at: string }[];
  envios: Record<string, number>;
  config: Record<string, string>;
}

const eur = (c: number) => (c % 100 === 0 ? `${c / 100} €` : `${(c / 100).toFixed(2).replace(".", ",")} €`);
const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const FASE: Record<string, string> = {
  antes: "Aún no ha abierto (abre el mar 1-dic)",
  B: "Fase B: 7 € (hasta el vie 4-dic 23:59)",
  A: "Fase A: 17 € / subida 10 € (hasta el mié 9-dic 23:59)",
  cerrada: "Cerrada",
};
const PRODUCTO: Record<string, string> = { B: "B · empezar", A: "A · espalda (+B)", subida: "Subida B→A" };
const MOTIVO: Record<string, string> = { umbral_no: "no llegó a 3", diferencia_a: "B sí, A no", desistimiento: "desistimiento", manual: "manual" };

export default function PreventaTab() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/preventa", { headers: { "x-admin-password": pw() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Error al cargar. ¿Está aplicada sql/preventa_masterclass.sql?");
    setError("");
    setD(j);
    setCfg(j.config ?? {});
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, 0);
    return () => clearTimeout(t);
  }, [cargar]);

  async function accion(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    const r = await fetch("/api/admin/preventa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": pw() },
      body: JSON.stringify(cuerpo),
    });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) {
      setError(j.error ?? "Error.");
      return null;
    }
    await cargar();
    return j;
  }

  async function devolverCompra(c: Compra) {
    const queda = c.importe_cent - c.devuelto_cent;
    const txt = window.prompt(`¿Cuánto devuelves a ${c.email}? (queda ${eur(queda)}). Escribe el importe en euros:`, String(queda / 100));
    if (!txt) return;
    const importe = Math.round(parseFloat(txt.replace(",", ".")) * 100);
    if (!(importe > 0)) return;
    const motivo = window.prompt("Motivo: desistimiento · manual · umbral_no · diferencia_a", "desistimiento") ?? "manual";
    if (!(await confirmar(`Devolver ${eur(importe)} a ${c.email} (${motivo}). Sale de Stripe al momento y no se puede deshacer.`))) return;
    await accion({ accion: "devolver", compra_id: c.id, importe_cent: importe, motivo });
  }

  if (error && !d) return <p className="text-red-600">{error}</p>;
  if (!d) return <p>Cargando…</p>;
  const fuera = new Set(d.excluidos);
  const n = d.recuento ?? d.cuenta;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Preventa de masterclasses</h2>
        <p className="text-sm opacity-75">{FASE[d.fase] ?? d.fase} · landing: entrenatzaile.alainzulaika.com/es/masterclass y /masterclass</p>
        {error && <p className="mt-2 text-red-600">{error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["B", "A"] as const).map((p) => (
          <div key={p} className="rounded-xl border p-5">
            <p className="text-sm opacity-70">{p === "B" ? "B · Por dónde empezar a partir de los 50" : "A · Que la espalda no te pare"}</p>
            <p className="text-4xl font-semibold">
              {n.cuenta[p]} <span className="text-lg font-normal opacity-60">de 3</span>
            </p>
            <p className="text-sm">{(p === "B" ? n.llegaB : n.llegaA) ? "✅ Llega: se graba" : "Aún no llega"}</p>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-70">
        Cuenta personas distintas; A suma también en B. No cuentan: familia y amigos marcados, compras de prueba y devueltas enteras. La landing solo enseña «ya somos 3» cuando se llega.
        {d.intentos ? ` Intentos sin pagar: ${d.intentos}.` : ""}
      </p>

      <section className="rounded-xl border p-5">
        <h3 className="mb-2 font-semibold">Recuento (jue 10-dic, 9:00, automático)</h3>
        {d.recuento ? (
          <>
            <p className="text-sm">
              Hecho el {fecha(d.recuento.en)}: B {d.recuento.cuenta.B} de 3 ({d.recuento.llegaB ? "llega" : "no llega"}) · A {d.recuento.cuenta.A} de 3 (
              {d.recuento.llegaA ? "llega" : "no llega"}). Avisos enviados: {d.envios.recuento ?? 0}.
            </p>
            {d.pendientes.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm">
                  Devoluciones pendientes: {d.pendientes.length} · {eur(d.pendientes.reduce((s, p) => s + p.importe, 0))}
                </p>
                <ul className="my-2 text-sm">
                  {d.pendientes.map((p) => (
                    <li key={p.compra_id}>
                      {p.email} · {eur(p.importe)} · {MOTIVO[p.motivo]}
                    </li>
                  ))}
                </ul>
                <button
                  className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                  disabled={ocupado}
                  onClick={async () => {
                    if (!(await confirmar(`Devolver ${d.pendientes.length} pagos por Stripe ahora. No se puede deshacer.`))) return;
                    const r = await accion({ accion: "devolver_recuento" });
                    if (r?.errores?.length) setError(r.errores.join(" · "));
                  }}
                >
                  Devolver lo del recuento
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm">No hay devoluciones pendientes por el recuento.</p>
            )}
          </>
        ) : (
          <p className="text-sm">
            Todavía no. El jueves 10 a las 9:00 se congela la cuenta, cada comprador recibe su aviso automático y te llega un resumen. Las devoluciones se hacen aquí con un botón.
          </p>
        )}
        <p className="mt-2 text-xs opacity-70">
          Entregas automáticas: B el lun 28-dic, A el dom 10-ene, a las 9:00, si llegó a 3 y hay vídeo puesto abajo. Enviadas: B {d.envios.entrega_B ?? 0} · A {d.envios.entrega_A ?? 0}.
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Compras ({d.compras.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="p-2">Pagado</th>
                <th className="p-2">Quién</th>
                <th className="p-2">Producto</th>
                <th className="p-2">Importe</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Cuenta</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {d.compras.map((c) => {
                const excl = fuera.has(c.email.toLowerCase());
                return (
                  <tr key={c.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">{fecha(c.pagado_en)}</td>
                    <td className="p-2">
                      {c.nombre ?? "—"}
                      <br />
                      <span className="opacity-70">{c.email}</span> · {c.idioma}
                      {c.newsletter_ok && <span className="opacity-70"> · newsletter</span>}
                      {!c.confirmacion_enviada && <span className="block text-red-600">Confirmación no enviada{c.confirmacion_error ? `: ${c.confirmacion_error}` : ""}</span>}
                    </td>
                    <td className="p-2">{PRODUCTO[c.producto]}</td>
                    <td className="p-2">
                      {eur(c.importe_cent)}
                      {c.devuelto_cent > 0 && <span className="block opacity-70">devuelto {eur(c.devuelto_cent)}</span>}
                    </td>
                    <td className="p-2">{c.prueba ? "PRUEBA" : c.estado}</td>
                    <td className="p-2">
                      {c.prueba ? (
                        <span className="opacity-60">no cuenta</span>
                      ) : (
                        <button
                          className="underline disabled:opacity-50"
                          disabled={ocupado}
                          onClick={() => accion(excl ? { accion: "incluir", email: c.email } : { accion: "excluir", email: c.email, motivo: "familia o amigo" })}
                        >
                          {excl ? "Familia/amigo: no cuenta (quitar)" : "Cuenta · marcar familia/amigo"}
                        </button>
                      )}
                    </td>
                    <td className="p-2">
                      {c.devuelto_cent < c.importe_cent && (
                        <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={ocupado} onClick={() => devolverCompra(c)}>
                          Devolver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {d.desistimientos.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Desistimientos (devolver en 14 días naturales como mucho)</h3>
          <ul className="space-y-2 text-sm">
            {d.desistimientos.map((x) => (
              <li key={x.id} className={`rounded border p-3 ${x.atendido ? "opacity-50" : ""}`}>
                {fecha(x.created_at)} · {x.nombre ?? "—"} · {x.email}
                {x.mensaje && <span className="block opacity-80">{x.mensaje}</span>}
                {!x.atendido && (
                  <button className="mt-1 underline" disabled={ocupado} onClick={() => accion({ accion: "desistimiento_atendido", id: x.id })}>
                    Marcar como atendido (después de devolver)
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.devoluciones.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Devoluciones hechas</h3>
          <ul className="text-sm">
            {d.devoluciones.map((x) => {
              const c = d.compras.find((y) => y.id === x.compra_id);
              return (
                <li key={x.id}>
                  {fecha(x.created_at)} · {c?.email ?? x.compra_id} · {eur(x.importe_cent)} · {MOTIVO[x.motivo] ?? x.motivo}
                  {x.nota ? ` · ${x.nota}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border p-5">
        <h3 className="mb-3 font-semibold">Ajustes</h3>
        {(
          [
            ["video_B", "Vídeo de B (URL del reproductor, con la descarga desactivada)"],
            ["video_A", "Vídeo de A (URL del reproductor, con la descarga desactivada)"],
            ["correos_prueba", "Correos de prueba (pueden comprar antes de abrir; sus compras no cuentan)"],
            ["prueba_fase", "Fase que ven los correos de prueba: B o A"],
          ] as const
        ).map(([k, etiqueta]) => (
          <label key={k} className="mb-3 block text-sm">
            <span className="opacity-75">{etiqueta}</span>
            <div className="mt-1 flex gap-2">
              <input className="w-full rounded border px-2 py-1" value={cfg[k] ?? ""} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} />
              <button className="rounded border px-3 disabled:opacity-50" disabled={ocupado || (cfg[k] ?? "") === (d.config[k] ?? "")} onClick={() => accion({ accion: "config", clave: k, valor: cfg[k] ?? "" })}>
                Guardar
              </button>
            </div>
          </label>
        ))}
      </section>
    </div>
  );
}
