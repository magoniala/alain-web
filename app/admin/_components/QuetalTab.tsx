"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ESTADOS,
  ESTADO_CORTO,
  PERMISO_CORTO,
  REPETIR_CORTO,
  TIPOS_EVENTO,
  TIPO_CORTO,
  VALORACIONES,
  VALORACION_CORTO,
  mensajeWhatsApp,
  urlQuetal,
  type Estado,
  type Idioma,
  type TipoEvento,
} from "@/lib/quetal";
import { QUETAL_TEXTOS } from "@/lib/quetal-textos";
import { descargarCsv } from "./parq/exportar";
import {
  colorNps,
  csvRespuestas,
  fechaCorta,
  metricas,
  publicable,
  quiereRepetir,
  textoParaPublicar,
  tieneReferido,
  type Enlace,
  type Respuesta,
} from "./quetal/comun";

// Valoraciones que me dejan los organizadores en /quetal, y los enlaces
// personalizados que les mando después de cada evento.

const pw = () => sessionStorage.getItem("admin_pw") || "";
const etiqueta = "mb-2 text-[0.72rem] font-medium uppercase text-gray-400";
const boton = "border border-gray-300 bg-white px-3.5 py-2 text-[0.82rem] text-gray-700 hover:border-gray-500 disabled:opacity-40";

async function copiar(texto: string, aviso: (m: string) => void, ok = "Copiado") {
  try {
    await navigator.clipboard.writeText(texto);
    aviso(ok);
  } catch {
    window.prompt("Cópialo desde aquí:", texto);
  }
}

function Nps({ n }: { n: number }) {
  const c = colorNps(n);
  return (
    <span
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[0.82rem] font-semibold"
      style={{ background: c.fondo, color: c.texto, borderColor: c.borde }}
      title={`NPS ${n}`}
    >
      {n}
    </span>
  );
}

function Badges({ r }: { r: Respuesta }) {
  return (
    <span className="flex gap-1 text-[0.85rem]">
      {quiereRepetir(r) && <span title="Quiere repetir">🔁</span>}
      {tieneReferido(r) && <span title="Trae un referido">🤝</span>}
      {r.destacado && <span title="Destacado">⭐</span>}
      {!publicable(r) && <span title="No publicable">🔒</span>}
    </span>
  );
}

function Bloque({ titulo, children, destacar }: { titulo: string; children: React.ReactNode; destacar?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${destacar ? "border-[#F0D9A8] bg-[#FFF8EA]" : "border-gray-200 bg-white"}`}>
      <p className={destacar ? "mb-2 text-[0.72rem] font-medium uppercase text-[#9A6400]" : etiqueta}>{titulo}</p>
      <div className="space-y-3 text-[0.9rem]">{children}</div>
    </div>
  );
}

function Dato({ p, r }: { p: string; r: React.ReactNode }) {
  if (r == null || r === "") return null;
  return (
    <div>
      <p className="text-[0.8rem] text-gray-500">{p}</p>
      <p className="whitespace-pre-wrap">{r}</p>
    </div>
  );
}

// --- Detalle -------------------------------------------------------------

function Ficha({ r, onCambio, aviso }: { r: Respuesta; onCambio: (r: Respuesta) => void; aviso: (m: string) => void }) {
  const [editado, setEditado] = useState(r.testimonio_editado ?? "");
  const [notas, setNotas] = useState(r.notas_internas ?? "");
  const [guardando, setGuardando] = useState(false);
  const sucio = editado !== (r.testimonio_editado ?? "") || notas !== (r.notas_internas ?? "");

  async function guardar(cambios: Partial<Respuesta>) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/quetal?id=${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": pw() },
        body: JSON.stringify(cambios),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      onCambio(j.valoracion);
      aviso("Guardado");
    } catch (e) {
      window.alert(`No se ha podido guardar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setGuardando(false);
    }
  }

  const publicar = textoParaPublicar({ ...r, testimonio_editado: editado });
  const T = QUETAL_TEXTOS.es;

  return (
    <div className="admin-fade space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.35rem] font-semibold leading-tight">{r.entidad}</p>
            <p className="mt-1 text-[0.88rem] text-gray-500">
              {r.nombre_evento} · {TIPO_CORTO[r.tipo_evento]} · {fechaCorta(r.fecha_evento)}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-gray-400">
              Recibida el {new Date(r.created_at).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })} · en {r.idioma === "eu" ? "euskera" : "castellano"}
              {r.link_id ? " · por enlace" : " · sin enlace"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badges r={r} />
            <Nps n={r.nps} />
          </div>
        </div>
        {r.aviso_enviado === false && (
          <p className="mt-3 text-[0.82rem] text-[#B3261E]">El email de aviso no salió{r.aviso_error ? `: ${r.aviso_error}` : "."}</p>
        )}
      </div>

      {/* Gestión */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>Gestión</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={r.estado}
            disabled={guardando}
            onChange={(e) => guardar({ estado: e.target.value as Estado })}
            className="border border-gray-300 px-3 py-2 text-[0.88rem]"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_CORTO[e]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[0.88rem]">
            <input type="checkbox" checked={r.destacado} disabled={guardando} onChange={(e) => guardar({ destacado: e.target.checked })} />
            ⭐ Destacado
          </label>
          <span className="text-[0.82rem] text-gray-500">Permiso: {PERMISO_CORTO[r.permiso_publicacion]}</span>
        </div>

        <p className={`${etiqueta} mt-5`}>Testimonio editado (mi versión para publicar)</p>
        <textarea
          value={editado}
          onChange={(e) => setEditado(e.target.value)}
          rows={4}
          placeholder={r.testimonio}
          className="w-full border border-gray-300 px-3 py-2 text-[0.9rem] outline-none"
        />
        <p className={`${etiqueta} mt-4`}>Notas internas</p>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 px-3 py-2 text-[0.9rem] outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => guardar({ testimonio_editado: editado, notas_internas: notas })}
            disabled={!sucio || guardando}
            className="bg-[#1a1a1a] px-3.5 py-2 text-[0.82rem] text-white disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar texto y notas"}
          </button>
          <button
            onClick={() => publicar && copiar(publicar, aviso, "Testimonio copiado")}
            disabled={!publicar}
            title={publicar ? publicar : "No da permiso para publicar"}
            className={boton}
          >
            Copiar testimonio para publicar
          </button>
        </div>
        {publicar ? (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[0.85rem] text-gray-600">{publicar}</p>
        ) : (
          <p className="mt-3 text-[0.82rem] text-gray-400">🔒 No publicable: «No, es solo para ti».</p>
        )}
        <p className="mt-2 text-[0.8rem] text-gray-500">
          Logo: {r.permiso_logo ? "sí" : "no"} · Fotos/vídeos: {r.permiso_fotos ? "sí" : "no"}
        </p>
      </div>

      <Bloque titulo="1 · Tú">
        <Dato p="Nombre" r={r.nombre} />
        <Dato p="Cargo / papel" r={r.cargo} />
        <Dato p="Entidad" r={r.entidad} />
        <Dato
          p="Email"
          r={
            r.email ? (
              <a href={`mailto:${r.email}`} className="hover:underline">
                {r.email}
              </a>
            ) : null
          }
        />
      </Bloque>

      <Bloque titulo="2 · La valoración">
        <Dato p="NPS" r={<Nps n={r.nps} />} />
        <Dato p="Lo que le diría a otro organizador" r={r.testimonio} />
        <Dato p={T.momento} r={r.momento} />
        <Dato p={T.dudas} r={r.dudas_previas} />
      </Bloque>

      <Bloque titulo={`3 · Según el tipo (${TIPO_CORTO[r.tipo_evento]})`}>
        {r.respuestas_tipo.length ? (
          r.respuestas_tipo.map((x) => <Dato key={x.id} p={x.pregunta} r={x.respuesta} />)
        ) : (
          <p className="text-gray-400">Sin contestar.</p>
        )}
      </Bloque>

      <Bloque titulo="4 · Trabajar conmigo">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {VALORACIONES.map((k) => (
            <p key={k} className="flex justify-between gap-3 rounded-lg bg-gray-50 px-3 py-1.5">
              <span className="text-gray-600">{VALORACION_CORTO[k]}</span>
              <span className="font-semibold">{r[k] == null ? <span className="font-normal text-gray-400">N/A</span> : `${r[k]}/5`}</span>
            </p>
          ))}
        </div>
        <Dato p={T.comentarioTrato} r={r.comentario_trato} />
      </Bloque>

      <Bloque titulo="5 · Lo que viene">
        <Dato p="¿Repetir?" r={r.repetir ? `${quiereRepetir(r) ? "🔁 " : ""}${REPETIR_CORTO[r.repetir]}` : "Sin contestar"} />
        {tieneReferido(r) ? (
          <Dato
            p="🤝 Referido"
            r={`${[r.referido_nombre, r.referido_contacto].filter(Boolean).join(" · ")}\n${
              r.referido_permiso_mencion ? "Puedo decirle que vengo de su parte." : "Sin permiso para mencionarle."
            }`}
          />
        ) : (
          <Dato p="Referido" r="No" />
        )}
      </Bloque>

      {r.mejora_privada && (
        <Bloque titulo="🔒 Privado · Lo que mejoraría" destacar>
          <p className="whitespace-pre-wrap">{r.mejora_privada}</p>
        </Bloque>
      )}
    </div>
  );
}

// --- Enlaces -------------------------------------------------------------

const VACIO = { tipo_evento: "" as TipoEvento | "", nombre_evento: "", fecha_evento: "", entidad: "", contacto_nombre: "", idioma: "eu" as Idioma };

function Enlaces({ aviso }: { aviso: (m: string) => void }) {
  const [lista, setLista] = useState<Enlace[] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState(VACIO);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quetal/enlaces", { headers: { "x-admin-password": pw() } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setLista(j.enlaces);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLista((l) => l ?? []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    try {
      const res = await fetch("/api/admin/quetal/enlaces", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": pw() },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setLista((l) => [j.enlace, ...(l ?? [])]);
      setF({ ...VACIO, idioma: f.idioma });
      copiar(urlQuetal(j.enlace.token), aviso, "Enlace creado y copiado");
    } catch (e) {
      window.alert(`No se ha podido crear: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCreando(false);
    }
  }

  const input = "w-full border border-gray-300 px-3 py-2 text-[0.9rem] outline-none";

  return (
    <div className="space-y-5">
      <form onSubmit={crear} className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className={etiqueta}>Nuevo enlace</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-[0.82rem] text-gray-600">
            Tipo de evento
            <select required value={f.tipo_evento} onChange={(e) => setF({ ...f, tipo_evento: e.target.value as TipoEvento })} className={`${input} mt-1`}>
              <option value="">Elige…</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CORTO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.82rem] text-gray-600">
            Nombre del evento
            <input required value={f.nombre_evento} onChange={(e) => setF({ ...f, nombre_evento: e.target.value })} placeholder="Fiestas de San Bartolomé" className={`${input} mt-1`} />
          </label>
          <label className="text-[0.82rem] text-gray-600">
            Fecha
            <input type="date" value={f.fecha_evento} onChange={(e) => setF({ ...f, fecha_evento: e.target.value })} className={`${input} mt-1`} />
          </label>
          <label className="text-[0.82rem] text-gray-600">
            Entidad
            <input required value={f.entidad} onChange={(e) => setF({ ...f, entidad: e.target.value })} placeholder="Comisión de fiestas de Elgoibar" className={`${input} mt-1`} />
          </label>
          <label className="text-[0.82rem] text-gray-600">
            Persona de contacto
            <input required value={f.contacto_nombre} onChange={(e) => setF({ ...f, contacto_nombre: e.target.value })} className={`${input} mt-1`} />
          </label>
          <div className="text-[0.82rem] text-gray-600">
            Idioma
            <div className="mt-1 flex gap-1.5">
              {(["eu", "es"] as const).map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setF({ ...f, idioma: l })}
                  className={`rounded-full border px-3.5 py-1.5 text-[0.82rem] ${
                    f.idioma === l ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
                  }`}
                >
                  {l === "eu" ? "Euskera" : "Castellano"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button type="submit" disabled={creando} className="mt-4 bg-[#1a1a1a] px-3.5 py-2 text-[0.82rem] text-white disabled:opacity-40">
          {creando ? "Creando…" : "Crear enlace"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
          No se han podido cargar ({error}). Si la tabla aún no existe, hay que ejecutar feedback_organizadores.sql.
        </p>
      )}

      {!lista ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : !lista.length ? (
        <p className="text-sm text-gray-400">Aún no has creado ningún enlace.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 bg-white">
          {lista.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {l.entidad} <span className="font-normal text-gray-500">· {l.nombre_evento}</span>
                </p>
                <p className="text-[0.78rem] text-gray-400">
                  {TIPO_CORTO[l.tipo_evento]} · {fechaCorta(l.fecha_evento)} · {l.contacto_nombre} · {l.idioma.toUpperCase()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[0.75rem] ${
                    l.usado ? "border-[#BFE3C8] bg-[#E7F4EA] text-[#1E7B3A]" : "border-gray-300 bg-gray-50 text-gray-500"
                  }`}
                >
                  {l.usado ? `Respondido${l.respondido_at ? ` · ${fechaCorta(l.respondido_at)}` : ""}` : "Pendiente"}
                </span>
                <button onClick={() => copiar(urlQuetal(l.token), aviso, "Enlace copiado")} className={boton}>
                  Copiar enlace
                </button>
                <button onClick={() => copiar(mensajeWhatsApp(l), aviso, "Mensaje copiado")} className={boton}>
                  Copiar mensaje de WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Pestaña -------------------------------------------------------------

type FiltroNps = "todos" | "detractores" | "pasivos" | "promotores";
const RANGOS: Record<FiltroNps, [string, (n: number) => boolean]> = {
  todos: ["Todo NPS", () => true],
  detractores: ["0–6", (n) => n <= 6],
  pasivos: ["7–8", (n) => n >= 7 && n <= 8],
  promotores: ["9–10", (n) => n >= 9],
};

export default function QuetalTab() {
  const [vista, setVista] = useState<"respuestas" | "enlaces">("respuestas");
  const [lista, setLista] = useState<Respuesta[] | null>(null);
  const [error, setError] = useState("");
  const [elegido, setElegido] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [fTipo, setFTipo] = useState<TipoEvento | "">("");
  const [fEstado, setFEstado] = useState<Estado | "">("");
  const [fNps, setFNps] = useState<FiltroNps>("todos");
  const [fReferido, setFReferido] = useState(false);
  const [fRepetir, setFRepetir] = useState(false);
  const [fPublicables, setFPublicables] = useState(false);

  const aviso = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quetal", { headers: { "x-admin-password": pw() } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setLista(j.valoraciones);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLista((l) => l ?? []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(
    () =>
      (lista ?? []).filter(
        (r) =>
          (!fTipo || r.tipo_evento === fTipo) &&
          (!fEstado || r.estado === fEstado) &&
          RANGOS[fNps][1](r.nps) &&
          (!fReferido || tieneReferido(r)) &&
          (!fRepetir || quiereRepetir(r)) &&
          (!fPublicables || publicable(r))
      ),
    [lista, fTipo, fEstado, fNps, fReferido, fRepetir, fPublicables]
  );

  const m = metricas(filtrados);
  const actual = (lista ?? []).find((r) => r.id === elegido) ?? null;
  const select = "border border-gray-300 bg-white px-3 py-2 text-[0.85rem]";
  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[0.82rem] ${on ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"}`;

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#0F2240] px-4 py-2 text-[0.85rem] text-white shadow-lg">{toast}</div>
      )}

      <div className="mb-5 flex gap-1.5">
        <button onClick={() => setVista("respuestas")} className={chip(vista === "respuestas")}>
          Respuestas {lista && <span className="opacity-60">{lista.length}</span>}
        </button>
        <button onClick={() => setVista("enlaces")} className={chip(vista === "enlaces")}>
          Generar enlaces
        </button>
      </div>

      {vista === "enlaces" ? (
        <Enlaces aviso={aviso} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["Respuestas", String(m.n)],
                ["NPS medio", m.media == null ? "—" : m.media.toFixed(1).replace(".", ",")],
                ["NPS neto", m.neto == null ? "—" : `${m.neto > 0 ? "+" : ""}${m.neto}`],
                ["Referidos pendientes", String(m.referidos)],
              ] as const
            ).map(([t, v]) => (
              <div key={t} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-[0.72rem] font-medium uppercase text-gray-400">{t}</p>
                <p className="mt-0.5 text-[1.6rem] font-semibold tabular-nums leading-tight">{v}</p>
              </div>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value as TipoEvento | "")} className={select}>
              <option value="">Todos los tipos</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CORTO[t]}
                </option>
              ))}
            </select>
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value as Estado | "")} className={select}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_CORTO[e]}
                </option>
              ))}
            </select>
            <select value={fNps} onChange={(e) => setFNps(e.target.value as FiltroNps)} className={select}>
              {(Object.keys(RANGOS) as FiltroNps[]).map((k) => (
                <option key={k} value={k}>
                  {RANGOS[k][0]}
                </option>
              ))}
            </select>
            <button
              onClick={() => descargarCsv(`valoraciones_${new Date().toISOString().slice(0, 10)}.csv`, csvRespuestas(filtrados))}
              disabled={!filtrados.length}
              className={`${select} text-gray-700 hover:border-gray-500 disabled:opacity-40 md:ml-auto`}
              title="Exporta lo que ves en la lista, con los filtros aplicados"
            >
              CSV {filtrados.length !== (lista ?? []).length && `(${filtrados.length})`}
            </button>
          </div>
          <div className="mb-5 flex flex-wrap gap-1.5">
            <button onClick={() => setFReferido(!fReferido)} className={chip(fReferido)}>
              🤝 Con referido
            </button>
            <button onClick={() => setFRepetir(!fRepetir)} className={chip(fRepetir)}>
              🔁 Quiere repetir
            </button>
            <button onClick={() => setFPublicables(!fPublicables)} className={chip(fPublicables)}>
              Publicables
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border-l-[3px] border-[#D4860A] bg-[#FFF7E6] px-3 py-2 text-[0.85rem] text-[#7a4e00]">
              No se han podido cargar ({error}). Si la tabla aún no existe, hay que ejecutar feedback_organizadores.sql.
            </p>
          )}

          {!lista ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : !lista.length ? (
            <p className="text-sm text-gray-400">Aún no ha llegado ninguna valoración.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(300px,400px)_1fr]">
              <div className={`divide-y divide-gray-100 self-start border border-gray-200 bg-white ${actual ? "hidden lg:block" : ""}`}>
                {filtrados.length === 0 && <p className="p-4 text-[0.85rem] text-gray-400">Ninguna coincide.</p>}
                {filtrados.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setElegido(r.id)}
                    className={`block w-full px-4 py-3 text-left ${elegido === r.id ? "bg-gray-50" : "hover:bg-gray-50"}`}
                    style={{ borderRadius: 0 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{r.entidad}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badges r={r} />
                        <Nps n={r.nps} />
                      </span>
                    </div>
                    <p className="mt-0.5 flex justify-between gap-2 text-[0.78rem] text-gray-400">
                      <span className="truncate">
                        {fechaCorta(r.fecha_evento)} · {TIPO_CORTO[r.tipo_evento]}
                      </span>
                      <span className="shrink-0">
                        {ESTADO_CORTO[r.estado]} · {PERMISO_CORTO[r.permiso_publicacion]}
                      </span>
                    </p>
                  </button>
                ))}
              </div>

              <div className="min-w-0">
                {actual ? (
                  <>
                    <button onClick={() => setElegido(null)} className="mb-3 text-[0.82rem] text-gray-500 lg:hidden">
                      ← Volver a la lista
                    </button>
                    <Ficha
                      key={actual.id}
                      r={actual}
                      aviso={aviso}
                      onCambio={(n) => setLista((l) => (l ? l.map((x) => (x.id === n.id ? n : x)) : l))}
                    />
                  </>
                ) : (
                  <div className="hidden rounded-2xl border border-dashed border-gray-300 p-10 text-center text-[0.9rem] text-gray-400 lg:block">
                    Elige una valoración de la lista para verla entera.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
