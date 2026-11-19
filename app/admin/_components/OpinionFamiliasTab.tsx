"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ESTADOS, ESTADO_CORTO, NOTAS, NOTA_CORTO, NOTA_EMOJI, ORIGENES, ORIGEN_CORTO, PERMISO_CORTO, SITIO, type Estado, type Nota, type Origen, type Permiso } from "@/lib/opinion";
import { copiarTexto } from "./copiarTexto";
import { confirmar } from "./confirmar";
import { abrirInformeOpiniones, htmlInformeOpiniones } from "./opiniones/informe";

// /admin → Opiniones familias: lo que dicen las familias y los espectadores
// después de un evento (/opinion-mirariak2026 y /opinion/<evento>). No es
// «Opiniones eventos», que son las valoraciones de quien contrata (/quetal).

type Opinion = {
  id: string;
  creado: string;
  evento: string;
  origen: Origen | null;
  idioma: "es" | "eu";
  nota: Nota;
  texto_peques: string | null;
  texto_adulto: string | null;
  palabra: string | null;
  mejora_privada: string | null;
  permiso: Permiso | null;
  nombre: string | null;
  email: string | null;
  terminado: boolean;
  estado: Estado;
  destacado: boolean;
  texto_editado: string | null;
  notas_internas: string | null;
};
type Evento = { clave: string; nombre: string; ruta: string };

const pw = () => sessionStorage.getItem("admin_pw") || "";
const etiqueta = "mb-2 text-[0.72rem] font-medium uppercase text-gray-400";
const boton = "border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500 disabled:opacity-40";
const select = "border border-gray-300 bg-white px-3 py-2 text-[0.82rem] text-gray-600 outline-none";
const fecha = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const publicable = (o: Opinion) => o.permiso === "sin_nombre" || o.permiso === "con_nombre";
const textoDe = (o: Opinion) => (o.texto_editado?.trim() || [o.texto_adulto, o.texto_peques].filter(Boolean).join(" ")).trim();

// Lo que se puede pegar en la web: solo con permiso, y con nombre solo si lo pidió.
function paraPublicar(o: Opinion, evento: string): string | null {
  const t = textoDe(o);
  if (!publicable(o) || !t) return null;
  return `"${t}" — ${o.permiso === "con_nombre" && o.nombre ? o.nombre : `Familia asistente a ${evento}`}`;
}

// Resumen sin nombres ni correos para quien organizó el evento. La «mejora» es
// privada y no entra.
function resumenOrganizador(lista: Opinion[], evento: string): string {
  const n = lista.length;
  const lineas = [`${evento} — opinión de las familias (${n} ${n === 1 ? "respuesta" : "respuestas"})`, ""];
  for (const k of NOTAS) {
    const c = lista.filter((o) => o.nota === k).length;
    lineas.push(`${NOTA_EMOJI[k]} ${NOTA_CORTO[k]}: ${c}${n ? ` (${Math.round((c / n) * 100)} %)` : ""}`);
  }
  const palabras = lista.map((o) => o.palabra?.trim()).filter(Boolean);
  if (palabras.length) lineas.push("", `En una palabra: ${palabras.join(" · ")}`);
  const frases = lista.flatMap((o) => [o.texto_peques, o.texto_adulto]).map((t) => t?.trim()).filter(Boolean);
  if (frases.length) lineas.push("", "Lo que cuentan:", ...frases.map((f) => `- ${f}`));
  return lineas.join("\n");
}

function Ficha({ o, evento, onCambio, onBorrada, aviso }: { o: Opinion; evento: string; onCambio: (o: Opinion) => void; onBorrada: (id: string) => void; aviso: (m: string) => void }) {
  const [editado, setEditado] = useState(o.texto_editado ?? "");
  const [notas, setNotas] = useState(o.notas_internas ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar(cambios: Partial<Opinion>) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/opinion?id=${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": pw() },
        body: JSON.stringify(cambios),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      onCambio(j.opinion);
      aviso("Guardado");
    } catch (e) {
      aviso(`No se ha guardado: ${e instanceof Error ? e.message : e}`);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!(await confirmar("¿Eliminar esta respuesta para siempre? Es para las de prueba: no se puede deshacer. Para apartar una real, usa «Archivado».", { aceptar: "Eliminar", peligro: true }))) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/opinion?id=${o.id}`, { method: "DELETE", headers: { "x-admin-password": pw() } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      onBorrada(o.id);
      aviso("Eliminada");
    } catch (e) {
      aviso(`No se ha eliminado: ${e instanceof Error ? e.message : e}`);
    } finally {
      setGuardando(false);
    }
  }

  const publicar = paraPublicar({ ...o, texto_editado: editado }, evento);
  const dato = (p: string, r: string | null) =>
    r ? (
      <div className="mb-3">
        <p className="text-[0.78rem] text-gray-400">{p}</p>
        <p className="whitespace-pre-wrap text-[0.95rem] text-gray-900">{r}</p>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[2rem] leading-none">{NOTA_EMOJI[o.nota]}</span>
          <div>
            <p className="font-medium text-gray-900">{NOTA_CORTO[o.nota]}</p>
            <p className="text-[0.78rem] text-gray-400">
              {evento} · {fecha(o.creado)} · {o.origen ? ORIGEN_CORTO[o.origen] : "Sin origen"} · {o.idioma.toUpperCase()}
              {o.terminado ? "" : " · no llegó al final"}
            </p>
          </div>
        </div>
        {dato("Lo que más gustó a los peques", o.texto_peques)}
        {dato("Lo que más gustó al adulto", o.texto_adulto)}
        {dato("En una palabra", o.palabra)}
        {o.mejora_privada && (
          <div className="mb-3 rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2">
            <p className="text-[0.78rem] text-[#7a4e00]">🔒 ¿Qué mejorarías? · privado, no se publica</p>
            <p className="whitespace-pre-wrap text-[0.95rem] text-gray-900">{o.mejora_privada}</p>
          </div>
        )}
        <p className="text-[0.85rem] text-gray-600">
          <b>Permiso:</b> {o.permiso ? PERMISO_CORTO[o.permiso] : "No contestó → no se publica"}
          {o.nombre ? ` · ${o.nombre}` : ""}
          {o.email ? ` · ${o.email}` : ""}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>Para publicar</p>
        {publicable(o) ? (
          <>
            <textarea value={editado} onChange={(e) => setEditado(e.target.value)} rows={3} placeholder={textoDe({ ...o, texto_editado: null }) || "Texto pulido para la web"} className="w-full border border-gray-300 px-3 py-2 text-[0.9rem] outline-none" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => guardar({ texto_editado: editado })} disabled={guardando} className={boton}>
                Guardar texto
              </button>
              <button onClick={async () => aviso(publicar && (await copiarTexto(publicar)) ? "Copiado" : "No hay texto que copiar")} disabled={!publicar} className={boton}>
                Copiar para publicar
              </button>
            </div>
          </>
        ) : (
          <p className="text-[0.85rem] text-gray-500">Sin permiso expreso: esta opinión no se publica. Sirve para ti y, sin nombre, para el resumen del organizador.</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>Gestión</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={o.estado} onChange={(e) => guardar({ estado: e.target.value as Estado })} className={select}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_CORTO[e]}
              </option>
            ))}
          </select>
          <button onClick={() => guardar({ destacado: !o.destacado })} className={boton}>
            {o.destacado ? "⭐ Destacada" : "☆ Destacar"}
          </button>
          <button onClick={eliminar} disabled={guardando} className={`${boton} ml-auto border-red-200 text-red-700 hover:border-red-500`} title="Para respuestas de prueba. Una real, mejor «Archivado»">
            Eliminar
          </button>
        </div>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas internas" className="mt-3 w-full border border-gray-300 px-3 py-2 text-[0.9rem] outline-none" />
        <button onClick={() => guardar({ notas_internas: notas })} disabled={guardando} className={`${boton} mt-2`}>
          Guardar notas
        </button>
      </div>
    </div>
  );
}

export default function OpinionFamiliasTab() {
  const [lista, setLista] = useState<Opinion[] | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState("");
  const [elegido, setElegido] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [fEvento, setFEvento] = useState("");
  const [fOrigen, setFOrigen] = useState<Origen | "sin" | "">("");
  const [fEstado, setFEstado] = useState<Estado | "">("");
  const [fPublicables, setFPublicables] = useState(false);

  const aviso = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/opinion", { headers: { "x-admin-password": pw() } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setLista(j.opiniones);
      setEventos(j.eventos);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLista((l) => l ?? []);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreEvento = useCallback((clave: string) => eventos.find((e) => e.clave === clave)?.nombre ?? clave, [eventos]);
  const filtrados = useMemo(
    () =>
      (lista ?? []).filter(
        (o) =>
          (!fEvento || o.evento === fEvento) &&
          (!fOrigen || (fOrigen === "sin" ? !o.origen : o.origen === fOrigen)) &&
          (fEstado ? o.estado === fEstado : o.estado !== "archivado") &&
          (!fPublicables || publicable(o))
      ),
    [lista, fEvento, fOrigen, fEstado, fPublicables]
  );
  const actual = filtrados.find((o) => o.id === elegido) ?? null;
  const eventoResumen = fEvento || (eventos.length === 1 ? eventos[0].clave : "");

  // Informe visual para quien organizó el evento (Guardar como PDF). Si el evento tiene reservas, se dice a cuántas llegó el mail.
  async function informePdf() {
    const nombre = eventoResumen ? nombreEvento(eventoResumen) : "Eventos";
    let reservas: number | null = null;
    if (eventoResumen) {
      try {
        const r = await fetch(`/api/admin/opinion/reservas?evento=${eventoResumen}`, { headers: { "x-admin-password": pw() } });
        if (r.ok) {
          const j = (await r.json()) as { destinatarios?: { envio: { estado: string } | null }[] };
          const n = (j.destinatarios ?? []).filter((d) => d.envio?.estado === "aceptado").length;
          reservas = n || null;
        }
      } catch {
        reservas = null;
      }
    }
    const { html, titulo } = htmlInformeOpiniones(filtrados, nombre, { reservas });
    const como = abrirInformeOpiniones(html, titulo);
    aviso(como === "abierto" ? "Informe abierto: elige «Guardar como PDF»" : "El navegador bloqueó la ventana: informe descargado (ábrelo e imprímelo como PDF)");
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[0.85rem] text-gray-500">
        Lo que cuentan las familias y los espectadores después de un evento. Sin permiso expreso no se publica nada, y «¿Qué mejorarías?» es siempre privado.
        {eventos.map((e) => (
          <span key={e.clave}>
            {" "}
            Formulario de {e.nombre}:{" "}
            <button onClick={async () => aviso((await copiarTexto(`${SITIO}${e.ruta}`)) ? "Enlace copiado" : "No se ha podido copiar")} className="underline underline-offset-2">
              {e.ruta}
            </button>
            .
          </span>
        ))}
      </p>

      <div className="mb-5 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} className={select}>
          <option value="">Todos los eventos</option>
          {eventos.map((e) => (
            <option key={e.clave} value={e.clave}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select value={fOrigen} onChange={(e) => setFOrigen(e.target.value as Origen | "sin" | "")} className={select}>
          <option value="">Todos los orígenes</option>
          {ORIGENES.map((o) => (
            <option key={o} value={o}>
              {ORIGEN_CORTO[o]}
            </option>
          ))}
          <option value="sin">Sin origen</option>
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value as Estado | "")} className={select}>
          <option value="">Todo menos archivado</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_CORTO[e]}
            </option>
          ))}
        </select>
        <button onClick={() => setFPublicables(!fPublicables)} className={`${select} ${fPublicables ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : ""}`}>
          Publicables
        </button>
        <button
          onClick={async () => aviso((await copiarTexto(resumenOrganizador(filtrados, eventoResumen ? nombreEvento(eventoResumen) : "Eventos"))) ? "Resumen copiado" : "No se ha podido copiar")}
          disabled={!filtrados.length}
          className={`${select} text-gray-700 hover:border-gray-500 disabled:opacity-40 md:ml-auto`}
          title="Notas, palabras y frases de lo que ves en la lista, sin nombres ni correos y sin la «mejora» privada"
        >
          Copiar resumen anónimo para el organizador
        </button>
        <button
          onClick={informePdf}
          disabled={!filtrados.length}
          className={`${select} border-[#1a1a1a] bg-[#1a1a1a] text-white disabled:opacity-40`}
          title="Informe visual en PDF de lo que ves en la lista: nota media, reparto, palabras y frases. Sin nombres, sin correos y sin la «mejora» privada"
        >
          Informe PDF para el organizador
        </button>
      </div>

      {filtrados.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2 text-[0.85rem] text-gray-700">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            <b>{filtrados.length}</b> {filtrados.length === 1 ? "respuesta" : "respuestas"}
          </span>
          {NOTAS.map((n) => (
            <span key={n} className="rounded-full border border-gray-200 bg-white px-3 py-1">
              {NOTA_EMOJI[n]} {filtrados.filter((o) => o.nota === n).length}
            </span>
          ))}
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">Publicables: {filtrados.filter(publicable).length}</span>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
          No se han podido cargar ({error}). Si la tabla aún no existe, hay que ejecutar sql/opiniones_eventos.sql en Supabase.
        </p>
      )}

      {!lista ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : !lista.length ? (
        <p className="text-sm text-gray-400">Aún no ha llegado ninguna opinión.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(300px,400px)_1fr]">
          <div className={`divide-y divide-gray-100 self-start border border-gray-200 bg-white ${actual ? "hidden lg:block" : ""}`}>
            {filtrados.length === 0 && <p className="p-4 text-[0.85rem] text-gray-400">Ninguna coincide.</p>}
            {filtrados.map((o) => (
              <button key={o.id} onClick={() => setElegido(o.id)} className={`block w-full px-4 py-3 text-left ${elegido === o.id ? "bg-gray-50" : "hover:bg-gray-50"}`} style={{ borderRadius: 0 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-gray-900">
                    {NOTA_EMOJI[o.nota]} {o.palabra || textoDe(o) || NOTA_CORTO[o.nota]}
                  </span>
                  <span className="shrink-0 text-[0.72rem] text-gray-400">
                    {o.destacado ? "⭐ " : ""}
                    {o.mejora_privada ? "🔒 " : ""}
                    {publicable(o) ? "✓ publicable" : ""}
                  </span>
                </div>
                <p className="mt-0.5 flex justify-between gap-2 text-[0.78rem] text-gray-400">
                  <span className="truncate">
                    {nombreEvento(o.evento)} · {o.origen ? ORIGEN_CORTO[o.origen] : "Sin origen"}
                  </span>
                  <span className="shrink-0">
                    {fecha(o.creado)} · {ESTADO_CORTO[o.estado]}
                  </span>
                </p>
              </button>
            ))}
          </div>
          <div>
            {actual ? (
              <>
                <button onClick={() => setElegido(null)} className="mb-3 text-[0.82rem] text-gray-500 lg:hidden">
                  ← Volver a la lista
                </button>
                <Ficha key={actual.id} o={actual} evento={nombreEvento(actual.evento)} aviso={aviso} onCambio={(n) => setLista((l) => (l ?? []).map((x) => (x.id === n.id ? n : x)))} onBorrada={(id) => { setLista((l) => (l ?? []).filter((x) => x.id !== id)); setElegido(null); }} />
              </>
            ) : (
              <p className="hidden text-sm text-gray-400 lg:block">Elige una opinión de la lista.</p>
            )}
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-[#1a1a1a] px-4 py-2 text-[0.85rem] text-white shadow-lg">{toast}</div>}
    </div>
  );
}
