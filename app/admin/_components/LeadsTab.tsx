"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UltimosMensajes, { type Ultimos } from "./UltimosMensajes";
import AplazarTarea from "./AplazarTarea";
import UltimosCambios, { type Reciente } from "./UltimosCambios";
import PreguntaEnLinea from "./PreguntaEnLinea";
import Reservas from "./hoja-de-ruta/Reservas";
import { confirmar } from "./confirmar";
import { copiarTexto } from "./copiarTexto";

// Pestaña «Leads Entrenatzaile» (23-11-2026). Carril "entrenatzaile" del CRM
// genérico (crm_fichas, espejo de Vías/Entrenatzaile/Leads/ en el vault).
// Diseño y decisiones: vault, «2026-11-20 Encargo — leads de Entrenatzaile y
// check-ins en admin» (Resultado). Arriba, «Te toca a ti» con las vencidas
// primero; debajo, las reservas de la Hoja de Ruta (misma bandeja que en su
// pestaña) y la lista de fichas. Nada se envía solo.

type Datos = Record<string, string | number | null | undefined>;
interface FichaT {
  id: string;
  nombre: string;
  estado: string;
  canal: string | null;
  email: string | null;
  telefono: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  fecha_ultimo_contacto?: string | null;
  mails_enviados?: number;
  datos?: Datos | null;
  cuerpo_antes?: string | null;
}
interface Tarea {
  id: string;
  tipo: string;
  canal: "mail" | "whatsapp" | "llamada" | "ninguno";
  estado: string;
  borrador_asunto: string | null;
  borrador_texto: string | null;
  destinatario: string | null;
  cambios_crm: Record<string, unknown>;
  nota_para_alain: string | null;
  contexto: { instagram?: boolean; fecha_ficha?: string | null } | null;
  creado_en: string;
  ficha: FichaT | null;
  ultimos?: Ultimos;
  hilo_asunto?: string | null;
}
interface FichaLista extends FichaT {
  actualizado_en: string;
}

const ESTADOS = ["0 Por escribir", "1 Escrito", "2 Seguimiento enviado", "3 En conversación", "4 Hoja de Ruta propuesta", "5 Hoja de Ruta reservada", "6 Hoja de Ruta hecha", "7 Cliente", "8 Perdido", "9 Aparcado"];
const ETIQUETA: Record<string, string> = { check_in: "Check-in", seguimiento: "Seguimiento", recordatorio: "Recordatorio", aparcar: "Aparcar" };
const hoyISO = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const fmt = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const fase = (e: string) => Number(/^(\d)/.exec(e)?.[1] ?? -1);
const colorEstado = (e: string) => (fase(e) === 7 ? "bg-emerald-100 text-emerald-800" : fase(e) === 8 ? "bg-gray-200 text-gray-600" : fase(e) === 9 ? "bg-amber-50 text-amber-800" : fase(e) >= 3 ? "bg-sky-50 text-sky-800" : "bg-gray-100 text-gray-700");
/** «Su caso» y la respuesta del formulario, sacados del cuerpo de la nota del vault. */
const suCaso = (cuerpo: string | null | undefined) => (cuerpo ?? "").replace(/^\s*>.*$/gm, "").replace(/^#+\s*Su caso\s*$/m, "").trim();

export default function LeadsTab() {
  const [seccion, setSeccion] = useState<"bandeja" | "fichas">("bandeja");
  const pw = useCallback(() => sessionStorage.getItem("admin_pw") || "", []);
  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-admin-password": pw() }), [pw]);

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const [modo, setModo] = useState<string>("apagado");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);

  const accion = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch("/api/admin/crm/bandeja", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(d.error || "Error"), { duplicado: !!d.duplicado });
      return d;
    },
    [headers],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/crm/bandeja?carril=entrenatzaile", { headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setTareas(d.tareas ?? []);
      setRecientes(d.recientes ?? []);
      setModo(String(d.config?.leads_modo ?? "apagado"));
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const h = hoyISO();
  // Vencidas primero (la más antigua arriba), luego las de hoy.
  const ordenadas = useMemo(() => [...tareas].sort((a, b) => String(a.ficha?.fecha_proxima_accion ?? a.contexto?.fecha_ficha ?? h).localeCompare(String(b.ficha?.fecha_proxima_accion ?? b.contexto?.fecha_ficha ?? h)) || a.creado_en.localeCompare(b.creado_en)), [tareas, h]);
  const vencidas = ordenadas.filter((t) => (t.ficha?.fecha_proxima_accion ?? h) < h).length;

  async function cambiarModo(m: string) {
    if (m === "activo" && !(await confirmar("En modo activo, «Enviar» manda el correo de verdad al lead (desde alain@, en su hilo). ¿Activar?", { aceptar: "Activar" }))) return;
    await accion({ accion: "config", leads_modo: m }).catch((e) => setAviso((e as Error).message));
    cargar();
  }
  async function buscarAhora() {
    setBuscando(true);
    setAviso("");
    try {
      const r = (await accion({ accion: "motor_leads" })) as { modo: string; creadas: number; solos: number; ya_abiertas: number; errores: string[] };
      setAviso(r.modo === "apagado" ? "El motor está apagado: ponlo en «Prueba» o «Activo»." : `Hecho: ${r.creadas} tarjetas nuevas · ${r.solos} pasos automáticos · ${r.ya_abiertas} ya tenían tarjeta${r.errores.length ? ` · errores: ${r.errores.join("; ")}` : ""}`);
      await cargar();
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["bandeja", "fichas"] as const).map((s) => (
          <button key={s} onClick={() => setSeccion(s)} className={`rounded-full px-4 py-1.5 text-[0.85rem] ${seccion === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-300"}`}>
            {s === "bandeja" ? `Te toca a ti${tareas.length ? ` (${tareas.length})` : ""}` : "Fichas"}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 text-[0.8rem] text-gray-500">
          Motor:
          {(["apagado", "prueba", "activo"] as const).map((m) => (
            <button key={m} onClick={() => cambiarModo(m)} className={`rounded-full px-3 py-1 ring-1 ${modo === m ? (m === "activo" ? "bg-emerald-600 text-white ring-emerald-600" : m === "prueba" ? "bg-amber-500 text-white ring-amber-500" : "bg-gray-700 text-white ring-gray-700") : "text-gray-600 ring-gray-300"}`}>
              {m === "apagado" ? "Apagado" : m === "prueba" ? "Prueba" : "Activo"}
            </button>
          ))}
        </span>
      </div>
      {modo === "prueba" && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[0.82rem] text-amber-900">Modo prueba: «Enviar» manda el correo solo a ti, y la tarjeta se queda. WhatsApp, «Ya lo he enviado», «Ha contestado» y «Aplazar» sí tocan la ficha.</p>}
      {aviso && <p className="rounded-xl bg-sky-50 px-4 py-2 text-[0.82rem] text-sky-900">{aviso}</p>}

      {seccion === "bandeja" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.95rem] font-medium">
              {cargando ? "Cargando…" : tareas.length ? `${vencidas} vencidas · ${tareas.length - vencidas} de hoy` : "Nada pendiente con leads ahora mismo."}
            </p>
            <button onClick={buscarAhora} disabled={buscando} className="rounded-full px-3 py-1 text-[0.8rem] text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
              {buscando ? "Buscando…" : "Buscar lo que toca ahora"}
            </button>
          </div>
          <UltimosCambios key={recientes[0]?.id ?? "vacio"} recientes={recientes} accion={accion} alTerminar={cargar} />
          <div className="space-y-4">
            {ordenadas.map((t) => (
              <TarjetaLead key={t.id} t={t} accion={accion} alTerminar={cargar} />
            ))}
          </div>
          <section className="space-y-2 pt-4">
            <h3 className="text-[0.95rem] font-semibold">Reservas de la Hoja de Ruta</h3>
            <p className="text-[0.8rem] text-gray-500">La misma bandeja que en la pestaña Hoja de Ruta: lo que hagas aquí se ve allí.</p>
            <Reservas />
          </section>
        </>
      ) : (
        <ListaFichas headers={headers} />
      )}
    </div>
  );
}

function TarjetaLead({ t, accion, alTerminar }: { t: Tarea; accion: (b: Record<string, unknown>) => Promise<unknown>; alTerminar: () => void }) {
  const f = t.ficha;
  const h = hoyISO();
  const [texto, setTexto] = useState(t.borrador_texto ?? "");
  const [para, setPara] = useState(t.destinatario ?? "");
  const [asunto, setAsunto] = useState(t.borrador_asunto ?? (t.hilo_asunto ? `Re: ${t.hilo_asunto}` : ""));
  const [ocupado, setOcupado] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [caja, setCaja] = useState<"" | "contesto" | "fuera" | "descartar">("");
  const [canalFuera, setCanalFuera] = useState("Mail");
  const [abrioWa, setAbrioWa] = useState(false);
  // Editor de la ficha para los recordatorios (sin mensaje).
  const [estado, setEstado] = useState(f?.estado ?? "");
  const [prox, setProx] = useState(f?.proxima_accion ?? "");
  const [fechaProx, setFechaProx] = useState(f?.fecha_proxima_accion ?? "");
  const [nota, setNota] = useState("");

  const fecha = f?.fecha_proxima_accion ?? t.contexto?.fecha_ficha ?? h;
  const retraso = fecha < h ? diasEntre(fecha, h) : 0;
  const instagram = !!t.contexto?.instagram;
  const conMensaje = !!t.borrador_texto;
  const wa = t.canal === "whatsapp" && t.destinatario ? `https://wa.me/${t.destinatario}?text=${encodeURIComponent(texto)}` : null;
  const caso = suCaso(f?.cuerpo_antes);

  async function hacer(nombre: string, body: Record<string, unknown>, okTexto?: string) {
    setOcupado(nombre);
    setErr("");
    try {
      const r = (await accion(body)) as { prueba?: boolean; enviado_a?: string; encontrado?: boolean; asunto?: string | null; fecha?: string | null };
      if (body.accion === "buscar_hilo") {
        if (r.encontrado) {
          setAsunto(`Re: ${r.asunto ?? ""}`);
          setOk(`Hilo encontrado: «${r.asunto ?? "sin asunto"}» (${fmt(r.fecha)}). Saldrá como respuesta en ese hilo.`);
        } else setOk("No hay ningún correo con esta dirección en el buzón: saldrá como correo nuevo. Escribe un asunto.");
        return;
      }
      if (r?.prueba) {
        setOk(`Modo prueba: enviado solo a ti (${r.enviado_a ?? "tu correo"}). La tarjeta se queda.`);
        return;
      }
      if (okTexto) setOk(okTexto);
      alTerminar();
    } catch (e) {
      const er = e as Error & { duplicado?: boolean };
      if (er.duplicado && body.accion === "enviar" && (await confirmar(`${er.message}\n\n¿Quieres enviar este otro igualmente?`, { aceptar: "Enviar otro", peligro: false }))) {
        await hacer(nombre, { ...body, confirmar_duplicado: true }, okTexto);
        return;
      }
      setErr(er.message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <article className={`rounded-2xl border border-gray-200 border-l-4 bg-white p-5 ${retraso ? "border-l-[#DC2626]" : "border-l-[#E8A33D]"}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[1rem] font-semibold">
            {f?.nombre ?? "—"} <span className="font-normal text-gray-500">· {ETIQUETA[t.tipo] ?? t.tipo}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.78rem] text-gray-500">
            {f && <span className={`rounded-full px-2 py-0.5 ${colorEstado(f.estado)}`}>{f.estado}</span>}
            <span>{t.canal === "whatsapp" ? "WhatsApp" : t.canal === "mail" ? "Mail" : instagram ? "Instagram" : "Sin mensaje"}</span>
            {f?.datos?.tirada && <span>· {String(f.datos.tirada)}</span>}
            {f?.fecha_ultimo_contacto && <span>· último contacto {fmt(f.fecha_ultimo_contacto)}</span>}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${retraso ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{retraso ? `vence hace ${retraso} ${retraso === 1 ? "día" : "días"}` : "hoy"}</span>
      </header>

      {f?.proxima_accion && <p className="mt-3 text-[0.85rem] text-gray-700">La ficha dice: «{f.proxima_accion}»</p>}
      {f?.datos?.respuesta && <p className="mt-1 text-[0.82rem] text-gray-500">Formulario: «{String(f.datos.respuesta)}»</p>}
      {caso && (
        <details className="mt-2 text-[0.82rem]">
          <summary className="cursor-pointer text-gray-600">Su caso</summary>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-gray-700">{caso}</pre>
        </details>
      )}
      <UltimosMensajes ultimos={t.ultimos} />
      {t.nota_para_alain && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 text-[0.8rem] text-gray-600">{t.nota_para_alain}</p>}

      {conMensaje && (
        <div className="mt-3 space-y-2">
          {t.canal === "mail" && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
                <label className="text-gray-500">Para</label>
                <input value={para} onChange={(e) => setPara(e.target.value)} className="min-w-[14rem] flex-1 border border-gray-300 px-2 py-1" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
                <label className="text-gray-500">Asunto</label>
                <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Vacío = «Re:» del último correo con esta persona" className="min-w-[14rem] flex-1 border border-gray-300 px-2 py-1" />
                {!t.hilo_asunto && (
                  <button onClick={() => hacer("hilo", { accion: "buscar_hilo", id: t.id, destinatario: para })} disabled={!!ocupado} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
                    {ocupado === "hilo" ? "Buscando…" : "Buscar el hilo en el buzón"}
                  </button>
                )}
              </div>
            </>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(12, Math.max(5, texto.split("\n").length + 1))} className="w-full border border-gray-300 px-3 py-2 text-[0.9rem] leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            {t.canal === "mail" && (
              <button onClick={() => hacer("enviar", { accion: "enviar", id: t.id, texto, destinatario: para, asunto }, `Enviado a ${para}.`)} disabled={!!ocupado || !texto.trim() || !para.includes("@")} className="rounded-full bg-gray-900 px-4 py-1.5 text-[0.85rem] text-white disabled:opacity-40">
                {ocupado === "enviar" ? "Enviando…" : "Enviar (mismo hilo)"}
              </button>
            )}
            {wa && (
              <>
                <a href={wa} target="_blank" rel="noreferrer" onClick={() => { copiarTexto(texto); setAbrioWa(true); }} className="rounded-full bg-[#25D366] px-4 py-1.5 text-[0.85rem] text-white">
                  Copiar + abrir WhatsApp
                </a>
                <button onClick={() => hacer("wa", { accion: "whatsapp_enviado", id: t.id, texto }, "Apuntado como enviado por WhatsApp.")} disabled={!!ocupado} className={`rounded-full px-4 py-1.5 text-[0.85rem] ring-1 disabled:opacity-40 ${abrioWa ? "bg-emerald-600 text-white ring-emerald-600" : "text-gray-700 ring-gray-300"}`}>
                  {ocupado === "wa" ? "Guardando…" : "Ya lo he enviado"}
                </button>
              </>
            )}
            {instagram && (
              <>
                <button onClick={async () => setOk((await copiarTexto(texto)) ? "Copiado: pégalo en Instagram." : "No se ha podido copiar")} className="rounded-full px-4 py-1.5 text-[0.85rem] text-gray-700 ring-1 ring-gray-300">Copiar texto</button>
                <button onClick={() => hacer("ig", { accion: "enviado_fuera", id: t.id, canal: "Instagram", texto }, "Apuntado como enviado por Instagram.")} disabled={!!ocupado} className="rounded-full px-4 py-1.5 text-[0.85rem] text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">Ya lo he enviado</button>
              </>
            )}
            {!wa && !instagram && t.canal !== "mail" && (
              <button onClick={async () => setOk((await copiarTexto(texto)) ? "Copiado." : "No se ha podido copiar")} className="rounded-full px-4 py-1.5 text-[0.85rem] text-gray-700 ring-1 ring-gray-300">Copiar texto</button>
            )}
          </div>
        </div>
      )}

      {!conMensaje && (
        <div className="mt-3 grid gap-2 rounded-xl bg-gray-50 p-3 text-[0.82rem] sm:grid-cols-2">
          <label className="text-gray-600">
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-0.5 block w-full border border-gray-300 bg-white px-2 py-1">
              {ESTADOS.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label className="text-gray-600">
            Fecha de la próxima acción
            <input type="date" value={fechaProx} onChange={(e) => setFechaProx(e.target.value)} className="mt-0.5 block w-full border border-gray-300 bg-white px-2 py-1" />
          </label>
          <label className="text-gray-600 sm:col-span-2">
            Próxima acción
            <input value={prox} onChange={(e) => setProx(e.target.value)} className="mt-0.5 block w-full border border-gray-300 bg-white px-2 py-1" />
          </label>
          <label className="text-gray-600 sm:col-span-2">
            Qué apunto en el Registro (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} className="mt-0.5 block w-full border border-gray-300 bg-white px-2 py-1" />
          </label>
          <div className="sm:col-span-2">
            <button
              onClick={() => hacer("aplicar", { accion: "aplicar", id: t.id, cambios: { estado: estado !== f?.estado ? estado : "", proxima_accion: prox !== (f?.proxima_accion ?? "") ? prox : "", fecha_proxima_accion: fechaProx !== (f?.fecha_proxima_accion ?? "") ? fechaProx : "", nota } }, "Ficha actualizada.")}
              disabled={!!ocupado || !fechaProx || fechaProx <= h}
              title={!fechaProx || fechaProx <= h ? "Pon una fecha posterior a hoy (o usa «Aplazar»)" : undefined}
              className="rounded-full bg-gray-900 px-4 py-1.5 text-white disabled:opacity-40"
            >
              {ocupado === "aplicar" ? "Guardando…" : "Guardar en la ficha y cerrar"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-[0.8rem]">
        <button onClick={() => setCaja(caja === "contesto" ? "" : "contesto")} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300">Ha contestado</button>
        {conMensaje && <button onClick={() => setCaja(caja === "fuera" ? "" : "fuera")} className="rounded-full px-3 py-1 text-gray-700 ring-1 ring-gray-300">Lo he enviado por otra vía</button>}
        <button onClick={() => setCaja(caja === "descartar" ? "" : "descartar")} className="rounded-full px-3 py-1 text-gray-500 ring-1 ring-gray-200">Descartar</button>
      </div>
      {caja === "contesto" && (
        <PreguntaEnLinea pregunta="¿Qué te ha dicho? (pega su mensaje o resúmelo: pasa a 3 En conversación, con «contestar» para mañana)" boton="Apuntar" obligatorio ocupado={!!ocupado} onCancelar={() => setCaja("")} onAceptar={(x) => hacer("contesto", { accion: "ha_contestado", id: t.id, texto: x }, "Apuntado: pasa a 3 En conversación.")} />
      )}
      {caja === "fuera" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.82rem]">
          <span className="text-gray-600">Lo mandé por</span>
          <select value={canalFuera} onChange={(e) => setCanalFuera(e.target.value)} className="border border-gray-300 px-2 py-1">
            <option value="Mail">Mail (desde el Mac)</option>
            <option value="WhatsApp">WhatsApp (otra línea)</option>
            <option value="Instagram">Instagram</option>
          </select>
          <button onClick={() => hacer("fuera", { accion: "enviado_fuera", id: t.id, canal: canalFuera, texto }, `Apuntado como enviado por ${canalFuera}.`)} disabled={!!ocupado} className="rounded-full bg-gray-900 px-3 py-1 text-white disabled:opacity-40">
            Apuntar con este texto
          </button>
        </div>
      )}
      {caja === "descartar" && (
        <PreguntaEnLinea pregunta="¿Por qué la descartas? (la ficha no cambia: si hay que moverla, usa «Aplazar» o edita la ficha)" boton="Descartar" obligatorio ocupado={!!ocupado} onCancelar={() => setCaja("")} onAceptar={(x) => hacer("descartar", { accion: "descartar", id: t.id, motivo: x })} />
      )}
      <AplazarTarea ocupado={!!ocupado} onAplazar={(fechaA, motivo) => hacer("aplazar", { accion: "aplazar", id: t.id, fecha: fechaA, motivo }, `Aplazado al ${fmt(fechaA)}.`)} />
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-[0.82rem] text-red-800">{err}</p>}
      {ok && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[0.82rem] text-emerald-900">{ok}</p>}
    </article>
  );
}

function ListaFichas({ headers }: { headers: () => Record<string, string> }) {
  const [fichas, setFichas] = useState<FichaLista[]>([]);
  const [vista, setVista] = useState<"proximas" | "conversacion" | "ventana" | "todas">("proximas");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/admin/crm/fichas?carril=entrenatzaile", { headers: headers() })
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setFichas(d.fichas ?? [])))
      .catch((e) => setErr((e as Error).message));
  }, [headers]);
  const h = hoyISO();
  const filtradas = fichas
    .filter((f) => (q ? f.nombre.toLowerCase().includes(q.toLowerCase()) || String(f.email ?? "").toLowerCase().includes(q.toLowerCase()) : true))
    .filter((f) => (vista === "proximas" ? !!f.fecha_proxima_accion : vista === "conversacion" ? fase(f.estado) >= 3 && fase(f.estado) <= 6 : vista === "ventana" ? !!f.datos?.ventana_hasta && String(f.datos.ventana_hasta) >= h : true))
    .sort((a, b) => (vista === "ventana" ? String(a.datos?.ventana_hasta ?? "").localeCompare(String(b.datos?.ventana_hasta ?? "")) : vista === "todas" ? a.nombre.localeCompare(b.nombre) : String(a.fecha_proxima_accion ?? "9").localeCompare(String(b.fecha_proxima_accion ?? "9"))));
  const porEstado = fichas.reduce<Record<string, number>>((m, f) => ((m[f.estado] = (m[f.estado] ?? 0) + 1), m), {});
  return (
    <div className="space-y-3">
      {err && <p className="rounded-xl bg-red-50 px-4 py-2 text-[0.82rem] text-red-800">{err}</p>}
      <p className="text-[0.8rem] text-gray-500">
        {fichas.length} fichas · {Object.entries(porEstado).sort().map(([e, n]) => `${e}: ${n}`).join(" · ")}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
        {(
          [
            ["proximas", "Con próxima acción"],
            ["conversacion", "En conversación (3-6)"],
            ["ventana", "Ventana gratuita abierta"],
            ["todas", "Todas"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} className={`rounded-full px-3 py-1 ${vista === k ? "bg-gray-900 text-white" : "text-gray-700 ring-1 ring-gray-300"}`}>
            {l}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o email" className="ml-auto border border-gray-300 px-2 py-1" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-[0.82rem]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Próxima acción</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Canal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.map((f) => {
              const vence = f.fecha_proxima_accion && f.fecha_proxima_accion < h;
              return (
                <tr key={f.id}>
                  <td className="px-3 py-2 font-medium">{f.nombre}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 ${colorEstado(f.estado)}`}>{f.estado}</span>
                  </td>
                  <td className="max-w-[28rem] px-3 py-2 text-gray-600">{f.proxima_accion ?? "—"}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${vence ? "font-medium text-red-700" : ""}`}>{fmt(f.fecha_proxima_accion)}</td>
                  <td className="px-3 py-2 text-gray-500">{f.canal ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[0.78rem] text-gray-500">Para cambiar una ficha a mano: en su tarjeta, o en Obsidian (el espejo lo sube en la pasada siguiente).</p>
    </div>
  );
}
