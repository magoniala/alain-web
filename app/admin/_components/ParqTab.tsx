"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CONDICIONES, ETIQUETA_CORTA, PREGUNTAS_GENERALES, type ResultadoParq } from "@/lib/parq";
import { TESTS, criterioTests } from "@/lib/parq-criterio";
import { abrirPdf } from "./valoracion/pdf";
import { RESULTADO_COLOR, RESULTADO_CORTO, idsSi, snapshotParq, type ParqCompleto } from "./parq/comun";
import { csvParq, descargarCsv, htmlFichaParq, htmlVariosParq } from "./parq/exportar";

// Todos los PAR-Q+ recibidos en /parq: lista con buscador y filtro, ficha
// completa de cada persona, PDF (uno o todos los filtrados) y CSV. Desde la
// ficha se abre la valoración vinculada o se crea una nueva ya vinculada.

const FILTROS: ("todos" | ResultadoParq)[] = ["todos", "consultar", "aptoTrasSeguimiento", "apto"];

const normal = (x: string) =>
  x
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function enlaceWa(tel: string): string | null {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.length === 9) n = `34${n}`;
  return n.length >= 10 ? `https://wa.me/${n}` : null;
}

function bloqueado() {
  window.alert("El navegador ha bloqueado la ventana. Permite ventanas emergentes para este sitio.");
}

function Resultado({ r }: { r: ResultadoParq }) {
  const c = RESULTADO_COLOR[r];
  return (
    <span
      className="inline-block rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium"
      style={{ background: c.fondo, color: c.texto, borderColor: c.borde }}
    >
      {RESULTADO_CORTO[r]}
    </span>
  );
}

// Crea una valoración nueva con este PAR-Q+ ya vinculado y la abre. Se
// escribe como copia local sin subir: al abrirla, la hoja la sube sola.
function nuevaValoracion(p: ParqCompleto) {
  const id = crypto.randomUUID();
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const datos = {
    fecha: `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`,
    hora: `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`,
    cliente: p.nombre,
    parqId: p.id,
    parq: snapshotParq(p),
    parqRecibido: idsSi(p).length ? "Sí, con bandera(s)" : "Sí, sin banderas",
  };
  try {
    localStorage.setItem(`valoracion:${id}`, JSON.stringify({ datos, subido: false, t: Date.now() }));
  } catch {
    window.alert("No se ha podido preparar la valoración en este navegador.");
    return;
  }
  window.location.href = `/admin?tab=${encodeURIComponent("Valoración")}&valoracion=${id}`;
}

function Ficha({ p, onEliminado }: { p: ParqCompleto; onEliminado: () => void }) {
  const r = new Map(p.respuestas.map((x) => [x.id, x.respuesta]));
  const generales = PREGUNTAS_GENERALES.filter((q) => r.get(q.id) === "si");
  const conds = CONDICIONES.filter((c) => r.get(c.id) === "si");
  const crit = criterioTests(idsSi(p));
  const grupo = (n: string) => crit.filter((c) => c.nivel === n);
  const wa = enlaceWa(p.telefono);
  const [todas, setTodas] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function eliminar() {
    const vinc = p.valoraciones.length
      ? `\n\nEstá vinculado a ${p.valoraciones.length === 1 ? "una valoración" : `${p.valoraciones.length} valoraciones`}: se quitará de ahí la copia de sus respuestas. Tus notas de la sesión se quedan.`
      : "";
    if (!window.confirm(`¿Eliminar el PAR-Q+ de ${p.nombre}?${vinc}\n\nNo se puede deshacer.`)) return;
    setBorrando(true);
    try {
      const res = await fetch(`/api/admin/parq?id=${p.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`No se ha podido eliminar: ${j.error || `error ${res.status}`}`);
        return;
      }
      onEliminado();
    } catch {
      window.alert("No se ha podido eliminar: sin conexión.");
    } finally {
      setBorrando(false);
    }
  }
  const etiqueta = "mb-2 text-[0.72rem] font-medium uppercase text-gray-400";

  return (
    <div className="admin-fade space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[1.35rem] font-semibold leading-tight">{p.nombre}</p>
            <p className="mt-1 text-[0.88rem] text-gray-500">
              <a href={`mailto:${p.email}`} className="hover:text-[#0F2240] hover:underline">
                {p.email}
              </a>
              {" · "}
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="hover:text-[#0F2240] hover:underline">
                  {p.telefono}
                </a>
              ) : (
                p.telefono
              )}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-gray-400">
              Recibido el {new Date(p.enviado_en).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
          <Resultado r={p.resultado} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => abrirPdf(htmlFichaParq(p)) || bloqueado()}
            className="bg-[#1a1a1a] px-3.5 py-2 text-[0.82rem] text-white"
          >
            Descargar PDF
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="rounded-[0.65rem] border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500">
              WhatsApp
            </a>
          )}
          {p.valoraciones.map((v) => (
            <a
              key={v.id}
              href={`/admin?tab=${encodeURIComponent("Valoración")}&valoracion=${v.id}`}
              className="rounded-[0.65rem] border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500"
            >
              Abrir valoración{v.fecha ? ` del ${v.fecha}` : ""} →
            </a>
          ))}
          {!p.valoraciones.length && (
            <button
              onClick={() => nuevaValoracion(p)}
              className="border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500"
            >
              + Nueva valoración con este PAR-Q+
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>Banderas</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {generales.length ? (
            generales.map((q) => (
              <span key={q.id} className="rounded-full border border-[#F4C7C3] bg-[#FDECEB] px-2.5 py-0.5 text-[0.8rem] text-[#B3261E]">
                {ETIQUETA_CORTA[q.id]}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-[#BFE3C8] bg-[#E7F4EA] px-2.5 py-0.5 text-[0.8rem] text-[#1E7B3A]">
              Todo «no» en las generales
            </span>
          )}
        </div>
        {conds.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {conds.map((c) => {
              const b = c.subpreguntas.filter((s) => r.get(s.id) === "si");
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-l-4 px-3 py-2 text-[0.85rem]"
                  style={{ borderColor: b.length ? "#F4C7C3" : "#BFE3C8", borderLeftColor: b.length ? "#B3261E" : "#1E7B3A" }}
                >
                  <p className="font-medium">{ETIQUETA_CORTA[c.id]}</p>
                  {b.length ? (
                    b.map((s) => (
                      <p key={s.id} className="text-[#B3261E]">
                        ⚑ {ETIQUETA_CORTA[s.id]}
                      </p>
                    ))
                  ) : (
                    <p className="text-[#1E7B3A]">La tiene, sin banderas</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>En la valoración online</p>
        {(
          [
            ["no", "No hacer", "#B3261E"],
            ["precaucion", "Con precaución", "#9A6400"],
          ] as const
        ).map(([n, t, col]) =>
          grupo(n).length ? (
            <div key={n} className="mb-3">
              <p className="mb-1 text-[0.85rem] font-semibold" style={{ color: col }}>
                {t}
              </p>
              {grupo(n).map((c) => (
                <p key={c.test} className="text-[0.85rem]">
                  <span className="font-medium">{TESTS[c.test]}</span>
                  <span className="text-gray-500"> — {c.motivos.join(" ")}</span>
                </p>
              ))}
            </div>
          ) : null
        )}
        <p className="text-[0.85rem]">
          <span className="font-semibold text-[#1E7B3A]">Se puede:</span> {grupo("si").map((c) => TESTS[c.test]).join(" · ")}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className={etiqueta}>Respuestas</p>
          <button onClick={() => setTodas(!todas)} className="text-[0.8rem] text-gray-500 underline underline-offset-4">
            {todas ? "Solo los «sí»" : "Ver todas"}
          </button>
        </div>
        <ol className="space-y-1.5 text-[0.86rem]">
          {p.respuestas
            .filter((x) => todas || x.respuesta === "si")
            .map((x) => {
              const sub = /^c\d+[a-z]$/.test(x.id);
              const si = x.respuesta === "si";
              return (
                <li key={x.id} className={`flex gap-2.5 ${sub && todas ? "pl-5" : ""}`}>
                  <span
                    className={`mt-0.5 inline-block w-8 shrink-0 rounded-full text-center text-[0.72rem] font-semibold ${
                      si ? "bg-[#FDECEB] text-[#B3261E]" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {si ? "SÍ" : "no"}
                  </span>
                  <span className={si ? "" : "text-gray-500"}>
                    <span className="mr-1 text-[0.72rem] text-gray-400">{x.id.toUpperCase()}</span>
                    {x.pregunta}
                  </span>
                </li>
              );
            })}
          {!todas && !idsSi(p).length && <li className="text-gray-400">Ningún «sí».</li>}
        </ol>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-[0.85rem]">
        <p className={etiqueta}>Consentimiento y origen</p>
        <p>
          {p.consent_datos ? "Aceptado" : "No consta"}
          {p.consent_datos_en && ` el ${new Date(p.consent_datos_en).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`}
          {p.consentimientos_version && <span className="text-gray-400"> · versión {p.consentimientos_version}</span>}
        </p>
        {p.consent_datos_texto && <p className="mt-1 text-gray-500 italic">«{p.consent_datos_texto}»</p>}
        {(p.utm_source || p.utm_campaign || p.referrer) && (
          <p className="mt-2 text-gray-500">
            Origen: {[p.utm_source, p.utm_medium, p.utm_campaign, p.utm_content].filter(Boolean).join(" / ") || "—"}
            {p.referrer && <span className="block truncate text-gray-400">{p.referrer}</span>}
          </p>
        )}
        {p.aviso_enviado === false && (
          <p className="mt-2 text-[#B3261E]">El correo de aviso no salió{p.aviso_error ? `: ${p.aviso_error}` : "."}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={eliminar}
          disabled={borrando}
          className="flex items-center gap-2 border border-transparent px-3 py-2 text-[0.8rem] text-gray-400 hover:border-[#F4C7C3] hover:bg-[#FDECEB] hover:text-[#B3261E] disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M9 9v5m2-5v5" />
          </svg>
          {borrando ? "Eliminando…" : "Eliminar este PAR-Q+"}
        </button>
      </div>
    </div>
  );
}

export default function ParqTab() {
  const [lista, setLista] = useState<ParqCompleto[] | null>(null);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todos");
  const [elegido, setElegido] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/parq", {
        headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setLista(j.parq);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLista((l) => l ?? []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = normal(busca.trim());
    const qd = busca.replace(/\D/g, "");
    return (lista ?? []).filter(
      (p) =>
        (filtro === "todos" || p.resultado === filtro) &&
        (!q || normal(p.nombre).includes(q) || normal(p.email).includes(q) || (qd.length >= 3 && p.telefono.replace(/\D/g, "").includes(qd)))
    );
  }, [lista, busca, filtro]);

  const actual = filtrados.find((p) => p.id === elegido) ?? (lista ?? []).find((p) => p.id === elegido) ?? null;
  const cuenta = (f: (typeof FILTROS)[number]) => (lista ?? []).filter((p) => f === "todos" || p.resultado === f).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
          className="min-w-[240px] flex-1 border border-gray-300 px-3.5 py-2.5 text-[0.9rem] outline-none"
        />
        <button
          onClick={() => (filtrados.length ? abrirPdf(htmlVariosParq(filtrados)) || bloqueado() : null)}
          disabled={!filtrados.length}
          className="border border-gray-300 bg-white px-3.5 py-2.5 text-[0.82rem] text-gray-700 hover:border-gray-500 disabled:opacity-40"
          title="Un PDF con todos los de la lista, uno por página"
        >
          PDF de {filtrados.length === (lista ?? []).length ? "todos" : `estos ${filtrados.length}`}
        </button>
        <button
          onClick={() => descargarCsv(`parq_${new Date().toISOString().slice(0, 10)}.csv`, csvParq(filtrados))}
          disabled={!filtrados.length}
          className="border border-gray-300 bg-white px-3.5 py-2.5 text-[0.82rem] text-gray-700 hover:border-gray-500 disabled:opacity-40"
          title="Para abrir en Excel o Numbers"
        >
          CSV
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-3.5 py-1.5 text-[0.82rem] ${
              filtro === f ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
            }`}
          >
            {f === "todos" ? "Todos" : RESULTADO_CORTO[f]} <span className="opacity-60">{cuenta(f)}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
          No se han podido cargar ({error}). Si la tabla aún no existe, hay que ejecutar parq_respuestas.sql.
        </p>
      )}

      {!lista ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : !lista.length ? (
        <p className="text-sm text-gray-400">Aún no ha llegado ningún PAR-Q+.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className={`divide-y divide-gray-100 self-start border border-gray-200 bg-white ${actual ? "hidden lg:block" : ""}`}>
            {filtrados.length === 0 && <p className="p-4 text-[0.85rem] text-gray-400">Ninguno coincide.</p>}
            {filtrados.map((p) => {
              const n = idsSi(p).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setElegido(p.id)}
                  className={`block w-full px-4 py-3 text-left ${elegido === p.id ? "bg-gray-50" : "hover:bg-gray-50"}`}
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.nombre}</span>
                    <Resultado r={p.resultado} />
                  </div>
                  <p className="mt-0.5 flex justify-between gap-2 text-[0.78rem] text-gray-400">
                    <span className="truncate">{new Date(p.enviado_en).toLocaleDateString("es-ES")} · {p.email}</span>
                    <span className="shrink-0">
                      {n ? `${n} «sí»` : "todo «no»"}
                      {p.valoraciones.length > 0 && " · valorado"}
                    </span>
                  </p>
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            {actual ? (
              <>
                <button onClick={() => setElegido(null)} className="mb-3 text-[0.82rem] text-gray-500 lg:hidden">
                  ← Volver a la lista
                </button>
                <Ficha
                  key={actual.id}
                  p={actual}
                  onEliminado={() => {
                    setElegido(null);
                    setLista((l) => (l ? l.filter((x) => x.id !== actual.id) : l));
                  }}
                />
              </>
            ) : (
              <div className="hidden rounded-2xl border border-dashed border-gray-300 p-10 text-center text-[0.9rem] text-gray-400 lg:block">
                Elige un cuestionario de la lista para ver la ficha.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

