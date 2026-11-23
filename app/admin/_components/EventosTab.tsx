"use client";

// Pestaña «Eventos» (23-11-2026): los eventos de magia con la checklist del
// protocolo. Los mensajes salen solos como tarjeta en la Bandeja de Magia en su
// fecha ideal; lo interno va a la nota diaria. Aquí se ve todo de un vistazo,
// se marca lo hecho o lo que no aplica y se crean los eventos nuevos.
// Lógica: lib/eventos.ts · reglas: lib/eventos-protocolo.ts.

import { useCallback, useEffect, useState } from "react";

const pw = () => sessionStorage.getItem("admin_pw") || "";

interface Paso {
  id: string;
  clave: string;
  tipo: "mensaje" | "interno";
  titulo: string;
  fecha_ideal: string;
  fecha_limite: string;
  estado: "pendiente" | "hecho" | "no_aplica";
  hecho_en: string | null;
  hecho_por: string | null;
  tarea_id: string | null;
  tarea_estado: string | null;
  aplazado_hasta: string | null;
  nota: string | null;
}
interface Evento {
  id: string;
  nombre: string;
  fecha_evento: string;
  estado_evento: string;
  tipo: string;
  cliente_ficha: string | null;
  frontmatter: Record<string, unknown>;
  ficha: { id: string; nombre: string; responsable: string | null } | null;
  espejado_en: string | null;
  pasos: Paso[];
}
interface Postventa {
  clave: string;
  nombre: string;
  fecha_evento: string;
  d1_tarea: string | null;
  d1_omitido: string | null;
  d30_tarea: string | null;
  d30_omitido: string | null;
}
interface Datos {
  hoy: string;
  eventos: Evento[];
  postventa: Postventa[];
  ganados_sin_evento: { id: string; nombre: string }[];
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}-${MESES[d.getUTCMonth()]}`;
};
const dias = (de: string, a: string) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 86400000);
const nombreCorto = (n: string) => n.replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
const txt = (v: unknown) => (v === null || v === undefined || v === false ? "" : String(v));

async function api(body?: Record<string, unknown>) {
  const res = await fetch("/api/admin/eventos", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-admin-password": pw() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`);
  return d;
}

function colorPaso(p: Paso, hoy: string): [string, string] {
  if (p.estado === "hecho") return ["bg-emerald-500", `Hecho${p.hecho_en ? ` el ${corta(p.hecho_en)}` : ""}${p.hecho_por ? ` (${p.hecho_por})` : ""}`];
  if (p.estado === "no_aplica") return ["bg-gray-300", "No aplica"];
  if (hoy > p.fecha_limite) return ["bg-[#DC2626]", "Pasado el límite"];
  if (hoy === p.fecha_limite) return ["bg-[#DC2626]", "Hoy es el límite"];
  if (hoy >= p.fecha_ideal) return ["bg-[#E8A33D]", "Toca ya"];
  return ["bg-gray-200", "Por venir"];
}

export default function EventosTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<null | { fichaId: string }>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErr("");
    try {
      setDatos(await api());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const url = new URL(window.location.href);
    const crear = url.searchParams.get("crear");
    if (crear !== null) {
      setForm({ fichaId: crear });
      // Que no se vuelva a abrir el formulario al cambiar de pestaña y volver.
      url.searchParams.delete("crear");
      window.history.replaceState(null, "", url.toString());
    }
  }, [cargar]);

  const hoy = datos?.hoy ?? new Date().toISOString().slice(0, 10);
  const proximos = (datos?.eventos ?? []).filter((e) => e.fecha_evento >= hoy);
  const pasados = (datos?.eventos ?? []).filter((e) => e.fecha_evento < hoy).reverse();
  const vencidos = proximos.flatMap((e) => e.pasos.filter((p) => p.estado === "pendiente" && hoy >= p.fecha_limite)).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] font-semibold">Eventos</h1>
          <p className="text-[0.85rem] text-gray-500">Los pasos del protocolo salen solos: los mensajes, como tarjeta en la Bandeja de Magia en su fecha ideal; la preparación, en la nota diaria. El día límite llega un aviso al móvil.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="px-3 py-2 text-[0.85rem] text-gray-700 ring-1 ring-gray-300">{cargando ? "Cargando…" : "Actualizar"}</button>
          <button onClick={() => setForm({ fichaId: "" })} className="bg-[#0F2240] px-4 py-2 text-[0.85rem] font-medium text-white">+ Crear evento</button>
        </div>
      </header>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-[0.85rem] text-red-800">{err}</p>}

      {!!datos?.ganados_sin_evento.length && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[0.85rem] font-medium text-amber-900">Clientes ganados sin evento creado</p>
          <p className="text-[0.8rem] text-amber-800">Sin evento no sale ningún aviso del protocolo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {datos.ganados_sin_evento.map((f) => (
              <button key={f.id} onClick={() => setForm({ fichaId: f.id })} className="rounded-full bg-white px-3 py-1 text-[0.8rem] text-amber-900 ring-1 ring-amber-300">📅 {f.nombre} → Crear evento</button>
            ))}
          </div>
        </div>
      )}

      {form && datos && <FormEvento fichaInicial={form.fichaId} ganados={datos.ganados_sin_evento} onCerrar={() => setForm(null)} onCreado={() => { setForm(null); cargar(); }} />}

      {vencidos > 0 && <p className="rounded-xl bg-red-50 px-3 py-2 text-[0.85rem] text-red-800">⚠ {vencidos} {vencidos === 1 ? "paso con el límite hoy o pasado" : "pasos con el límite hoy o pasado"}.</p>}

      <section className="space-y-3">
        <h2 className="text-[0.8rem] font-semibold uppercase tracking-wide text-gray-500">Próximos · {proximos.length}</h2>
        {!cargando && !proximos.length && <p className="text-[0.85rem] text-gray-500">No hay eventos próximos. Los del vault entran solos con la pasada horaria del espejo.</p>}
        {proximos.map((e) => (
          <TarjetaEvento key={e.id} e={e} hoy={hoy} onCambio={cargar} />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-[0.8rem] font-semibold uppercase tracking-wide text-gray-500">Después del evento (últimos 60 días)</h2>
        <p className="text-[0.8rem] text-gray-500">El día siguiente: /quetal + factura. A los 30 días: plantear repetir. Salen solos en la Bandeja de Magia (protocolo post-evento).</p>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {(datos?.postventa ?? []).map((p) => (
            <div key={p.clave} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 text-[0.85rem] last:border-0">
              <span className="font-medium">{p.nombre} <span className="font-normal text-gray-500">· {corta(p.fecha_evento)}</span></span>
              <span className="text-[0.78rem] text-gray-600">
                D+1: {p.d1_tarea ? "✓ tarjeta creada" : p.d1_omitido ? `— ${p.d1_omitido}` : "pendiente"} · D+30: {p.d30_tarea ? "✓ tarjeta creada" : p.d30_omitido ? `— ${p.d30_omitido}` : dias(hoy, p.fecha_evento) + 30 > 0 ? `el ${corta(new Date(Date.parse(p.fecha_evento + "T12:00:00Z") + 30 * 86400000).toISOString())}` : "pendiente"}
              </span>
            </div>
          ))}
          {!datos?.postventa.length && <p className="px-4 py-3 text-[0.85rem] text-gray-500">Nada en los últimos 60 días.</p>}
        </div>
        {!!pasados.length && (
          <details className="text-[0.82rem] text-gray-600">
            <summary className="cursor-pointer">Eventos pasados en la tabla ({pasados.length})</summary>
            <ul className="mt-1 list-disc pl-5">{pasados.map((e) => <li key={e.id}>{corta(e.fecha_evento)} · {nombreCorto(e.nombre)} · {e.estado_evento}</li>)}</ul>
          </details>
        )}
      </section>
    </div>
  );
}

function TarjetaEvento({ e, hoy, onCambio }: { e: Evento; hoy: string; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState("");
  const [err, setErr] = useState("");
  const [editar, setEditar] = useState(false);
  const [fecha, setFecha] = useState(e.fecha_evento);
  const [estado, setEstado] = useState(e.estado_evento);
  const fm = e.frontmatter ?? {};
  const n = dias(hoy, e.fecha_evento);

  async function hacer(clave: string, body: Record<string, unknown>) {
    setOcupado(clave);
    setErr("");
    try {
      await api(body);
      onCambio();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setOcupado("");
    }
  }

  const pagos = [txt(fm.via_pago), fm.importe_total ? `${fm.importe_total} €` : "", fm.factura_emitida ? `factura ${txt(fm.factura_emitida)}` : "", fm.fecha_cobro ? `cobrado ${txt(fm.fecha_cobro)}` : ""].filter(Boolean).join(" · ");
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[1rem] font-semibold">{nombreCorto(e.nombre)}</h3>
          <p className="text-[0.82rem] text-gray-600">
            {corta(e.fecha_evento)} · {n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`}
            {[txt(fm.hora), txt(fm.lugar), txt(fm.show_base)].filter(Boolean).map((x) => ` · ${x}`).join("")}
          </p>
          {pagos && <p className="text-[0.78rem] text-gray-500">{pagos}</p>}
          {!e.ficha && <p className="mt-1 text-[0.78rem] text-[#DC2626]">Sin ficha en el CRM ({e.cliente_ficha ?? "—"}): los mensajes no pueden salir como tarjeta. Revisa el nombre de la ficha en la nota del vault.</p>}
          {!e.espejado_en && <p className="mt-1 text-[0.78rem] text-gray-500">La nota del vault se crea en la próxima pasada horaria del espejo.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{e.estado_evento}</span>
          {e.tipo === "recurrente" && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">Sesión recurrente</span>}
          <button onClick={() => setEditar(!editar)} className="text-gray-500 underline">Cambiar fecha o estado</button>
        </div>
      </header>
      {editar && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3 text-[0.82rem]">
          <label>Fecha<input type="date" value={fecha} onChange={(x) => setFecha(x.target.value)} className="mt-0.5 block border border-gray-300 px-2 py-1" /></label>
          <label>Estado<input value={estado} onChange={(x) => setEstado(x.target.value)} placeholder="confirmado / cancelado / aplazado" className="mt-0.5 block border border-gray-300 px-2 py-1" /></label>
          <button disabled={!!ocupado} onClick={() => hacer("editar", { accion: "editar", id: e.id, fecha_evento: fecha, estado_evento: estado })} className="bg-[#1a1a1a] px-3 py-1.5 text-white disabled:opacity-40">{ocupado === "editar" ? "Guardando…" : "Guardar"}</button>
          <span className="text-gray-500">Las fechas de los pasos pendientes se recalculan solas. «cancelado» o «aplazado» cierra sus tarjetas.</span>
        </div>
      )}
      <ul className="mt-3 divide-y divide-gray-100">
        {e.pasos.map((p) => {
          const [color, etiqueta] = colorPaso(p, hoy);
          const enBandeja = p.estado === "pendiente" && (p.tarea_estado === "revisar" || p.tarea_estado === "error");
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} title={etiqueta} />
                <div className="min-w-0">
                  <p className={`text-[0.88rem] ${p.estado === "no_aplica" ? "text-gray-400 line-through" : ""}`}>{p.titulo}</p>
                  <p className="text-[0.75rem] text-gray-500">
                    {p.tipo === "mensaje" ? "📱 Bandeja" : "📝 Nota diaria"} · ideal {corta(p.fecha_ideal)} · límite {corta(p.fecha_limite)} · {etiqueta}
                    {enBandeja && " · tarjeta en la Bandeja de Magia"}
                    {p.aplazado_hasta && p.estado === "pendiente" ? ` · aplazado al ${corta(p.aplazado_hasta)}` : ""}
                    {p.nota ? ` · ${p.nota}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 text-[0.78rem]">
                {p.estado === "pendiente" ? (
                  <>
                    {enBandeja && <a href="/admin?tab=Prospectos%20magia" className="px-2.5 py-1 text-[#0F2240] ring-1 ring-[#0F2240]/40">Ir a la Bandeja</a>}
                    <button disabled={!!ocupado} onClick={() => hacer(p.id, { accion: "paso", id: p.id, estado: "hecho" })} className="bg-[#1a1a1a] px-2.5 py-1 text-white disabled:opacity-40">{ocupado === p.id ? "…" : "Hecho"}</button>
                    <button disabled={!!ocupado} onClick={() => hacer(p.id, { accion: "paso", id: p.id, estado: "no_aplica" })} className="px-2.5 py-1 text-gray-600 ring-1 ring-gray-300 disabled:opacity-40">No aplica</button>
                  </>
                ) : (
                  <button disabled={!!ocupado} onClick={() => hacer(p.id, { accion: "paso", id: p.id, estado: "pendiente" })} className="px-2.5 py-1 text-gray-500 ring-1 ring-gray-200 disabled:opacity-40">Deshacer</button>
                )}
              </div>
            </li>
          );
        })}
        {!e.pasos.length && <li className="py-2 text-[0.85rem] text-gray-500">Los pasos se crean en la próxima pasada del cron (cada 10 minutos).</li>}
      </ul>
      {err && <p className="mt-2 text-[0.82rem] text-[#DC2626]">{err}</p>}
    </article>
  );
}

function FormEvento({ fichaInicial, ganados, onCerrar, onCreado }: { fichaInicial: string; ganados: { id: string; nombre: string }[]; onCerrar: () => void; onCreado: () => void }) {
  const [fichaId, setFichaId] = useState(fichaInicial);
  const [otro, setOtro] = useState("");
  const [d, setD] = useState({ fecha_evento: "", hora: "", lugar: "", show_base: "", titulo: "", via_pago: "", importe_total: "", importe_neto: "", cliente: "" });
  const [cartel, setCartel] = useState(true);
  const [recurrente, setRecurrente] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const campo = (k: keyof typeof d) => (x: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: x.target.value });

  const sugerir = useCallback(async (id: string) => {
    if (!id) return;
    setOcupado("sugerir");
    setErr("");
    try {
      const r = await api({ accion: "sugerir", ficha_id: id });
      const s = r.datos as Record<string, unknown>;
      setD((v) => ({
        fecha_evento: txt(s.fecha_evento) || v.fecha_evento,
        hora: txt(s.hora) || v.hora,
        lugar: txt(s.lugar) || v.lugar,
        show_base: txt(s.show_base) || v.show_base,
        titulo: txt(s.titulo) || v.titulo,
        via_pago: txt(s.via_pago) || v.via_pago,
        importe_total: txt(s.importe_total) || v.importe_total,
        importe_neto: txt(s.importe_neto) || v.importe_neto,
        cliente: v.cliente,
      }));
      if (s.cartel === false) setCartel(false);
      if (s.recurrente === true) setRecurrente(true);
      setAviso("Rellenado con el Registro de la ficha: revísalo antes de guardar.");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setOcupado("");
    }
  }, []);

  useEffect(() => {
    if (fichaInicial) sugerir(fichaInicial);
  }, [fichaInicial, sugerir]);

  async function guardar() {
    setOcupado("crear");
    setErr("");
    try {
      await api({ accion: "crear", ficha_id: fichaId || null, cliente_ficha: fichaId ? undefined : otro, ...d, cartel, recurrente });
      onCreado();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setOcupado("");
    }
  }

  const input = "mt-0.5 block w-full border border-gray-300 px-2 py-1.5 text-[0.88rem]";
  return (
    <div className="rounded-2xl border-2 border-[#0F2240]/30 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[1rem] font-semibold">Crear evento</h3>
        <button onClick={onCerrar} className="text-[0.85rem] text-gray-500">Cerrar</button>
      </div>
      <p className="text-[0.8rem] text-gray-500">Crea el evento, su checklist del protocolo y su nota en `📅 EVENTOS` (la escribe el espejo en la próxima pasada).</p>
      <div className="mt-3 grid gap-3 text-[0.8rem] text-gray-600 sm:grid-cols-2">
        <label className="sm:col-span-2">
          Cliente (ficha del CRM en 7 Ganado)
          <div className="mt-0.5 flex flex-wrap gap-2">
            <select value={fichaId} onChange={(x) => setFichaId(x.target.value)} className="border border-gray-300 px-2 py-1.5 text-[0.88rem]">
              <option value="">— Otra / sin ficha —</option>
              {fichaInicial && !ganados.some((g) => g.id === fichaInicial) && <option value={fichaInicial}>(ficha elegida)</option>}
              {ganados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            {!fichaId && <input value={otro} onChange={(x) => setOtro(x.target.value)} placeholder="Nombre exacto de la ficha" className="flex-1 border border-gray-300 px-2 py-1.5 text-[0.88rem]" />}
            {fichaId && <button onClick={() => sugerir(fichaId)} disabled={!!ocupado} className="px-3 py-1.5 text-[0.82rem] text-[#0F2240] ring-1 ring-[#0F2240]/40 disabled:opacity-40">{ocupado === "sugerir" ? "Leyendo el Registro…" : "✨ Rellenar con el Registro"}</button>}
          </div>
        </label>
        <label>Fecha<input type="date" value={d.fecha_evento} onChange={campo("fecha_evento")} className={input} /></label>
        <label>Hora<input value={d.hora} onChange={campo("hora")} placeholder="13:00-14:00" className={input} /></label>
        <label>Lugar<input value={d.lugar} onChange={campo("lugar")} className={input} /></label>
        <label>Show<input value={d.show_base} onChange={campo("show_base")} placeholder="Magia Zaparrada" className={input} /></label>
        <label>Título corto (para el nombre de la nota)<input value={d.titulo} onChange={campo("titulo")} placeholder="Magia de Navidad" className={input} /></label>
        <label>Contacto (como sale en «cliente»)<input value={d.cliente} onChange={campo("cliente")} placeholder="CAF Signalling (Leire)" className={input} /></label>
        <label className="sm:col-span-2">Cómo se cobra<input value={d.via_pago} onChange={campo("via_pago")} placeholder="reserva 20 % + 80 % a 20 días · o · contrato, a 60 días desde la factura" className={input} /></label>
        <label>Total con IVA (€)<input value={d.importe_total} onChange={campo("importe_total")} className={input} /></label>
        <label>A transferir (€)<input value={d.importe_neto} onChange={campo("importe_neto")} className={input} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cartel} onChange={(x) => setCartel(x.target.checked)} /> Lleva cartel y texto promocional</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={recurrente} onChange={(x) => setRecurrente(x.target.checked)} /> Sesión recurrente (solo guion y maleta)</label>
      </div>
      {aviso && <p className="mt-2 text-[0.8rem] text-amber-800">{aviso}</p>}
      {err && <p className="mt-2 text-[0.82rem] text-[#DC2626]">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={guardar} disabled={!!ocupado || !d.fecha_evento || (!fichaId && !otro.trim())} className="bg-[#1a1a1a] px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-40">{ocupado === "crear" ? "Creando…" : "Crear evento y su checklist"}</button>
      </div>
    </div>
  );
}
