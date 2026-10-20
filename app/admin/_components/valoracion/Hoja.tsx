"use client";

import { useEffect, useState } from "react";
import { RESULTADO_ETIQUETA, type ResultadoParq } from "@/lib/parq";
import { TESTS, criterioTests, idsDesdeTextos, type CriterioTest, type Test } from "@/lib/parq-criterio";
import {
  baremoCintura,
  baremoMonopodal,
  baremoPlancha,
  baremoSitToStand,
  baremoStep,
  fcMaxEstimada,
  imc,
  lecturaFcReposo,
  mejorMonopodal,
  num,
  sugerenciaBirdDog,
  sugerenciaPica,
  sugerenciaSentadilla,
  txt,
} from "@/lib/valoracion";
import { Area, Aviso, Badge, Chips, Fila, Num, Pista, Seccion, Sub, Sugerido, Texto, useDatos } from "./campos";

// Índice de la hoja, en el orden de la sesión. La FC en reposo va sola y
// antes del bloque 3: en la plantilla estaba en el bloque de cardio, pero
// ahí ya ha hecho sentadillas, planchas y sit-to-stand y no es reposo. Se
// toma al final de la anamnesis, con la persona sentada desde el principio.
export const SECCIONES = [
  { id: "cabecera", titulo: "Cabecera" },
  { id: "s0", titulo: "0 · Datos previos" },
  { id: "s1", titulo: "1 · Bienvenida", tiempo: "5'" },
  { id: "s2", titulo: "2 · PAR-Q+ y anamnesis", tiempo: "12-20'" },
  { id: "fc", titulo: "FC en reposo", tiempo: "1'" },
  { id: "s3", titulo: "3 · Control postural", tiempo: "12-15'" },
  { id: "s4", titulo: "4 · Antropometría", tiempo: "5-8'" },
  { id: "s5", titulo: "5 · Fuerza y equilibrio", tiempo: "15-20'" },
  { id: "s6", titulo: "6 · Cardio", tiempo: "8-10'" },
  { id: "s7", titulo: "7 · Objetivos y cierre", tiempo: "10-13'" },
  { id: "s8", titulo: "8 · Notas post-sesión" },
  { id: "s9", titulo: "9 · Obsidian" },
  { id: "informe", titulo: "Informe" },
] as const;

const BRM = ["B", "R", "M"] as const;
const GLOBAL = ["BIEN", "REGULAR", "MAL"] as const;

type ParqFila = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  resultado: ResultadoParq;
  respuestas: { id: string; pregunta: string; respuesta: "si" | "no" }[];
  enviado_en: string;
};

function SinParq() {
  const { d } = useDatos();
  if (txt(d, "parqRecibido") !== "NO recibido") return null;
  return <Aviso tono="rojo">PAR-Q+ no recibido: sin cribado no se hacen tests de esfuerzo. Esta sesión es solo anamnesis.</Aviso>;
}

function Lectura({ r }: { r: { nivel: Parameters<typeof Badge>[0]["nivel"]; etiqueta: string; nota?: string | null } | null }) {
  if (!r) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.8rem] text-gray-500">
      <Badge nivel={r.nivel} texto={r.etiqueta} />
      {r.nota && <span className="italic">{r.nota}</span>}
    </p>
  );
}

// ---------- qué se puede hacer según el PAR-Q+ ----------

// Criterio por test a partir del PAR-Q+ vinculado. Sin PAR-Q+ vinculado no
// hay criterio y no se enseña nada.
function useCriterio(): Map<Test, CriterioTest> | null {
  const { d } = useDatos();
  const parq = d.parq as { sis?: string[]; sisIds?: string[] } | undefined;
  if (!parq) return null;
  const ids = parq.sisIds ?? idsDesdeTextos(parq.sis ?? []);
  return new Map(criterioTests(ids).map((c) => [c.test, c]));
}

const ESTILO_NIVEL = {
  no: { caja: "border-[#B3261E] bg-[#FDECEB] text-[#8c1d18]", etiqueta: "NO HACER" },
  precaucion: { caja: "border-[#D4860A] bg-[#FFF7E6] text-[#7a4e00]", etiqueta: "CON PRECAUCIÓN" },
} as const;

function CriterioDe({ t }: { t: Test }) {
  const c = useCriterio()?.get(t);
  if (!c || c.nivel === "si") return null;
  const e = ESTILO_NIVEL[c.nivel];
  return (
    <div className={`rounded-lg border-l-[3px] px-3 py-2 text-[0.85rem] leading-snug ${e.caja}`}>
      <p className="font-semibold">
        {e.etiqueta} · según PAR-Q+
      </p>
      {c.motivos.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}

function ResumenCriterio() {
  const criterio = useCriterio();
  if (!criterio) return null;
  const lista = [...criterio.values()];
  const grupo = (nivel: CriterioTest["nivel"]) => lista.filter((c) => c.nivel === nivel).map((c) => TESTS[c.test]);
  const no = grupo("no");
  const pre = grupo("precaucion");
  const si = grupo("si");
  return (
    <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-3 text-[0.85rem]">
      <p className="text-[0.72rem] font-medium uppercase text-gray-500">En esta valoración</p>
      {no.length > 0 && (
        <p>
          <span className="font-semibold text-[#B3261E]">No hacer:</span> {no.join(" · ")}
        </p>
      )}
      {pre.length > 0 && (
        <p>
          <span className="font-semibold text-[#9A6400]">Con precaución:</span> {pre.join(" · ")}
        </p>
      )}
      <p>
        <span className="font-semibold text-[#1E7B3A]">Se puede:</span> {si.join(" · ")}
      </p>
      <p className="text-[0.75rem] italic text-gray-400">
        Criterio propuesto a partir de las banderas; el motivo sale encima de cada test. Ante la duda, lo que diga su médico.
      </p>
    </div>
  );
}

// ---------- PAR-Q+ vinculado ----------

const normal = (x: string) =>
  x
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// ¿Puede ser la misma persona? Nombre igual, uno contenido en el otro
// («Antxon» / «Antxon Pérez»), o el email escrito en el campo cliente.
function coincide(cliente: string, p: ParqFila): boolean {
  const c = normal(cliente);
  if (c.length < 3) return false;
  const n = normal(p.nombre);
  return c === n || n.includes(c) || c.includes(n) || c === normal(p.email);
}

type ParqGuardado = {
  nombre: string;
  email?: string;
  telefono?: string;
  resultado: ResultadoParq;
  enviado_en: string;
  sis: string[];
  sisIds?: string[];
  respuestas?: ParqFila["respuestas"];
};

function cargarParq(): Promise<ParqFila[]> {
  return fetch("/api/admin/valoraciones/parq", {
    headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" },
  })
    .then((r) => r.json())
    .then((j) => {
      if (!j.parq) throw new Error(j.error || "No se pudo cargar.");
      return j.parq as ParqFila[];
    });
}

// Todas sus respuestas, con los «sí» marcados. Las vinculadas antes de que
// se guardara la lista completa la piden al servidor por su id.
function RespuestasCompletas() {
  const { d } = useDatos();
  const parq = d.parq as ParqGuardado | undefined;
  const [respuestas, setRespuestas] = useState<ParqFila["respuestas"] | null>(parq?.respuestas ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (respuestas || !d.parqId) return;
    cargarParq()
      .then((l) => {
        const p = l.find((x) => x.id === d.parqId);
        if (p) setRespuestas(p.respuestas);
        else setError("Ese PAR-Q+ ya no está en la tabla.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [respuestas, d.parqId]);

  if (error) return <p className="text-[0.85rem] text-[#B3261E]">{error}</p>;
  if (!respuestas) return <p className="text-[0.85rem] text-gray-400">Cargando…</p>;
  return (
    <ol className="space-y-1.5 text-[0.85rem]">
      {respuestas.map((r) => {
        const sub = /^c\d+[a-z]$/.test(r.id);
        return (
          <li key={r.id} className={`flex gap-2.5 ${sub ? "pl-5" : ""}`}>
            <span
              className={`mt-0.5 inline-block w-8 shrink-0 rounded-full text-center text-[0.72rem] font-semibold ${
                r.respuesta === "si" ? "bg-[#FDECEB] text-[#B3261E]" : "bg-gray-100 text-gray-500"
              }`}
            >
              {r.respuesta === "si" ? "SÍ" : "no"}
            </span>
            <span className={r.respuesta === "si" ? "text-[#24211d]" : "text-gray-500"}>
              <span className="mr-1 text-[0.72rem] text-gray-400">{r.id.toUpperCase()}</span>
              {r.pregunta}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// PAR-Q+ de la persona. Completo en el bloque 0 (sugerencia, buscador,
// vincular y desvincular); en el repaso del bloque 2 solo se enseña.
function ParqVinculo({ soloVer = false }: { soloVer?: boolean }) {
  const { d, setMany } = useDatos();
  const [lista, setLista] = useState<ParqFila[] | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const [verTodo, setVerTodo] = useState(false);

  const parq = d.parq as ParqGuardado | undefined;
  const cliente = txt(d, "cliente");

  // Se carga al abrir el buscador, y también si aún no hay ninguno
  // vinculado y ya hay nombre, para poder sugerir.
  const hayQueCargar = !soloVer && !lista && !error && (abierto || (!parq && cliente.length >= 3));
  useEffect(() => {
    if (!hayQueCargar) return;
    cargarParq()
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [hayQueCargar]);

  function vincular(p: ParqFila) {
    const siFilas = p.respuestas.filter((r) => r.respuesta === "si");
    const sis = siFilas.map((r) => r.pregunta);
    const cambios: Record<string, unknown> = {
      parqId: p.id,
      parq: {
        nombre: p.nombre,
        email: p.email,
        telefono: p.telefono,
        resultado: p.resultado,
        enviado_en: p.enviado_en,
        sis,
        sisIds: siFilas.map((r) => r.id),
        respuestas: p.respuestas,
      } satisfies ParqGuardado,
    };
    if (!txt(d, "parqRecibido")) cambios.parqRecibido = sis.length ? "Sí, con bandera(s)" : "Sí, sin banderas";
    if (!cliente) cambios.cliente = p.nombre;
    setMany(cambios);
    setAbierto(false);
    setBusca("");
  }

  function desvincular() {
    if (!window.confirm("¿Quitar el PAR-Q+ vinculado a esta valoración? El PAR-Q+ no se borra; solo deja de estar enlazado.")) return;
    setMany({ parqId: undefined, parq: undefined });
  }

  const sugerencias = !parq && lista ? lista.filter((p) => coincide(cliente, p)).slice(0, 3) : [];
  const filtrados = (lista ?? []).filter((p) => {
    const q = normal(busca);
    return !q || normal(p.nombre).includes(q) || normal(p.email).includes(q) || p.telefono.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~");
  });

  const fila = (p: ParqFila, onClick: () => void) => (
    <button
      key={p.id}
      type="button"
      onClick={onClick}
      className="block w-full border-b border-gray-100 px-3 py-2 text-left text-[0.85rem] last:border-b-0 hover:bg-gray-50"
    >
      <strong>{p.nombre}</strong> <span className="text-gray-400">{p.email}</span>
      <br />
      <span className="text-gray-500">
        {RESULTADO_ETIQUETA[p.resultado] ?? p.resultado} · {new Date(p.enviado_en).toLocaleDateString("es-ES")}
      </span>
    </button>
  );

  if (soloVer && !parq) return null;

  return (
    <div className="space-y-2">
      {parq && (
        <div className="border border-gray-200 bg-[#fbf9f5] p-3 text-[0.88rem]">
          <p className="mb-1">
            <strong>{parq.nombre}</strong> · {RESULTADO_ETIQUETA[parq.resultado] ?? parq.resultado} ·{" "}
            <span className="text-gray-500">{new Date(parq.enviado_en).toLocaleDateString("es-ES")}</span>
          </p>
          {(parq.email || parq.telefono) && (
            <p className="mb-2 text-[0.8rem] text-gray-500">{[parq.email, parq.telefono].filter(Boolean).join(" · ")}</p>
          )}
          {parq.sis.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-[0.85rem] text-[#8c1d18]">
              {parq.sis.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.85rem] text-[#1E7B3A]">Todo «no».</p>
          )}
          <ResumenCriterio />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-200 pt-2.5 text-[0.8rem]">
            <button type="button" onClick={() => setVerTodo(!verTodo)} className="text-gray-600 underline underline-offset-4 hover:text-[#1a1a1a]">
              {verTodo ? "Ocultar respuestas completas" : "Ver todas sus respuestas"}
            </button>
            {!soloVer && (
              <button type="button" onClick={desvincular} className="text-gray-400 underline underline-offset-4 hover:text-[#B3261E]">
                Desvincular
              </button>
            )}
          </div>
          {verTodo && (
            <div className="mt-3">
              <RespuestasCompletas />
            </div>
          )}
        </div>
      )}

      {sugerencias.length > 0 && !abierto && (
        <div className="border border-[#F2DBA6] bg-[#FFFAF0]">
          <p className="px-3 pt-2.5 text-[0.8rem] font-medium text-[#9A6400]">
            {sugerencias.length === 1 ? "¿Es este su PAR-Q+?" : "¿Es alguno de estos su PAR-Q+?"} Pulsa para vincularlo.
          </p>
          {sugerencias.map((p) => fila(p, () => vincular(p)))}
        </div>
      )}

      {!soloVer && (
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="text-[0.82rem] text-gray-500 underline underline-offset-4 hover:text-[#1a1a1a]"
        >
          {abierto ? "Cerrar" : parq ? "Cambiar PAR-Q+ vinculado" : "Buscar un PAR-Q+ recibido"}
        </button>
      )}

      {abierto && (
        <div className="border border-gray-200 bg-white">
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono"
            className="w-full border-0 border-b border-gray-200 px-3 py-2.5 text-[0.88rem] outline-none"
            style={{ borderRadius: 0, boxShadow: "none" }}
          />
          <div className="max-h-[280px] overflow-y-auto">
            {error && <p className="p-3 text-[0.85rem] text-[#B3261E]">{error}</p>}
            {!lista && !error && <p className="p-3 text-[0.85rem] text-gray-400">Cargando…</p>}
            {lista && filtrados.length === 0 && (
              <p className="p-3 text-[0.85rem] text-gray-400">{lista.length ? "Ninguno coincide." : "No hay ninguno todavía."}</p>
            )}
            {filtrados.map((p) => fila(p, () => vincular(p)))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- la hoja ----------

export default function Hoja({
  parejaNombre,
  onPareja,
}: {
  parejaNombre: string | null;
  onPareja: () => void;
}) {
  const { d } = useDatos();
  const pareja = txt(d, "modalidad") === "Pareja (90 min)";
  const esHombre = txt(d, "sexo") === "Hombre";
  const oh = txt(d, "sqVariante") === "Overhead squat";
  const diasDice = num(d, "diasDice");
  const i = imc(d);
  const fcR = num(d, "fcReposo");
  const fcMax = fcMaxEstimada(d);

  return (
    <div className="space-y-5">
      <Seccion id="cabecera" titulo="Valoración inicial · online">
        <Fila cols={3}>
          <Texto k="cliente" label="Cliente" />
          <Texto k="fecha" label="Fecha" ph="aaaa-mm-dd" />
          <Texto k="hora" label="Hora" ph="hh:mm" />
        </Fila>
        <Fila cols={3}>
          <Num k="edad" label="Edad" unidad="años" />
          <Chips k="sexo" label="Sexo (para baremos)" opciones={["Hombre", "Mujer"]} className="md:col-span-2" />
        </Fila>
        <Chips k="modalidad" label="Modalidad" opciones={["Individual (70 min)", "Pareja (90 min)"]} />
        <Chips k="conversacionPrevia" label="Conversación previa" opciones={["Sí (anamnesis abreviada)", "No (anamnesis completa)"]} />
        {pareja && (
          <>
            <Chips
              k="dispositivos"
              label="Dispositivos pareja"
              opciones={["Cada uno el suyo (recomendado)", "Compartido (plan B)"]}
            />
            <button
              type="button"
              onClick={onPareja}
              className="border border-[#1a1a1a] px-4 py-2 text-[0.85rem] hover:bg-[#1a1a1a] hover:text-white"
            >
              {d.parejaId ? `Ir a la ficha de ${parejaNombre || "la pareja"} →` : "Crear la ficha de la pareja →"}
            </button>
          </>
        )}
      </Seccion>

      <Seccion id="s0" titulo="0 · Datos previos (recibidos por WhatsApp)">
        <Fila cols={3}>
          <Num k="peso" label="Peso enviado" unidad="kg" />
          <Num k="altura" label="Altura declarada" unidad="cm" />
          <div>
            <span className="mb-1.5 block text-[0.72rem] font-medium uppercase tracking-[0.12em] text-gray-500">IMC</span>
            <p className="py-2 text-[0.92rem] tabular-nums">
              {i ? `${i.valor.toFixed(1).replace(".", ",")} · ${i.etiqueta}` : "—"}
            </p>
          </div>
        </Fila>
        <ParqVinculo />
        <Chips k="parqRecibido" label="PAR-Q+ recibido" opciones={["Sí, sin banderas", "Sí, con bandera(s)", "NO recibido"]} />
        <SinParq />
      </Seccion>

      <Seccion id="s1" titulo="1 · Bienvenida + verificación técnica" tiempo="5 min">
        <Chips
          k="chequeo"
          label="Chequeo técnico inicial"
          multi
          opciones={["Audio OK", "Vídeo OK", "Iluminación OK", "Conexión estable"]}
        />
        <Area k="notaClima" label="Clima emocional / dinámica pareja / primeras impresiones" />
      </Seccion>

      <Seccion id="s2" titulo="2 · Repaso PAR-Q+ + anamnesis" tiempo="12-20 min">
        <Sub titulo="Repaso PAR-Q+">
          <ParqVinculo soloVer />
          <Chips k="repasoParq" opciones={["Confirmado limpio", "Aclarada bandera(s)"]} />
          <Area k="notasBanderas" label="Notas sobre banderas" />
        </Sub>

        <Sub
          titulo="Arranque"
          nota="«Voy a afinar unos datos que necesito como entrenador. Si algo no os apetece responder, decís sin problema.»"
        >
          <Chips
            k="grabaAnamnesis"
            label="¿Grabas audio? (con permiso)"
            opciones={["Sí, grabo", "No"]}
            pista="Si grabas: anota solo datos duros — medicaciones (nombre exacto), cifras, fechas."
          />
        </Sub>

        <Sub titulo="A · Salud médica" nota="2 min">
          <Area k="enfermedades" label="Enfermedades diagnosticadas" />
          <Area k="operaciones" label="Operaciones importantes últimos años" />
          <Area k="medicacion" label="Medicación habitual (nombre exacto)" />
          <Area k="revisionMedica" label="Última revisión médica y qué le dijeron" />
        </Sub>

        <Sub titulo="B · Dolor y lesiones" nota="2 min">
          <Area k="dolorActual" label="Dolor / molestia / zona limitante ahora" />
          <Area k="lesionesSecuela" label="Lesiones importantes con secuela" />
          <Area k="despertar" label="Al despertar por la mañana, ¿duele o cruje algo?" />
        </Sub>

        <Sub titulo="C · Cuerpo" nota="1 min">
          <Area k="actividadActual" label="Actividad actual" />
          <Area k="facilDificil" label="¿Qué te resulta más fácil hacer con el cuerpo, y qué te cuesta más?" />
        </Sub>

        <Sub titulo="D · Hábitos" nota="1-2 min">
          <Fila>
            <Texto k="sueno" label="Sueño" />
            <Texto k="cena" label="Cena" />
          </Fila>
          <Fila>
            <Texto k="comeCasa" label="¿Come en casa o fuera?" />
            <Texto k="alcohol" label="Alcohol (tono neutro, sin juicio)" />
          </Fila>
          <Area k="estres" label="Nivel de estrés estos meses" />
        </Sub>

        <Sub titulo="E · Contexto y logística" nota="1-2 min">
          <Fila>
            <div>
              <Num k="diasDice" label="Días/semana que dice" />
              {diasDice !== null && (
                <p className="mt-1.5 text-[0.82rem] text-gray-500">
                  Apuntar: <strong>{Math.max(1, diasDice - 1)}</strong> días (lo que dice menos uno)
                </p>
              )}
            </div>
            <Texto k="momentoDia" label="Momento del día preferido" />
          </Fila>
          <Area k="material" label="Material en casa (que lo enseñe por cámara)" />
        </Sub>

        <Sub titulo="F · Motivación y expectativas" nota="3-4 min · NO comprimir">
          <Area k="porQueAhora" label="¿Qué te hizo decir que sí a arrancar ahora? (frase literal)" />
          <Area k="f3meses" label="A 3 meses: qué es lo primero que quieres notar diferente" />
          <Area k="f12meses" label="A 12 meses: qué habrá cambiado en tu vida (frases textuales para copy)" />
          <Area k="fMiedos" label="Miedos o preocupaciones (NO SALTAR)" />
        </Sub>

        {esHombre && (
          <Sub
            titulo="Señales para tema salud sexual (solo hombre, 1-a-1)"
            nota="Marcar solo si aparecen durante la anamnesis. Si al menos una → aplicar guion al cierre del bloque médico."
          >
            <Chips
              k="sexSenales"
              multi
              opciones={[
                "Mención espontánea de tema íntimo/corporal",
                "Medicación relacionada",
                "Tono confidencial marcado",
                "Pregunta abierta «¿esto ayuda con...?»",
              ]}
            />
            <Chips k="sexDecision" label="Decisión tomada" opciones={["Aplicado guion", "No aplicable"]} />
          </Sub>
        )}

        <Sub titulo="Antes de salir del bloque, tengo anotado">
          <Chips
            k="salidaAnamnesis"
            multi
            opciones={["Medicaciones (nombre exacto)", "Cirugías / operaciones", "Lesiones activas relevantes", "Frases textuales para copy"]}
          />
        </Sub>
      </Seccion>

      <Seccion
        id="fc"
        titulo="FC en reposo · antes de cualquier test"
        tiempo="1 min"
        nota="Ahora, al terminar la anamnesis: lleva un buen rato sentado y aún no ha hecho ningún esfuerzo. Después de la sentadilla o del sit-to-stand ya no sería reposo. Pulso radial o carotídeo, 30 s × 2 (o 60 s)."
      >
        <SinParq />
        <Fila cols={3}>
          <Num k="fcReposo" label="FC reposo" unidad="ppm" />
          <Chips k="fcReposoMetodo" label="Cómo" opciones={["Manual 30 s × 2", "Manual 60 s", "Reloj / pulsera"]} className="md:col-span-2" />
        </Fila>
        {fcR !== null && <Lectura r={lecturaFcReposo(fcR)} />}
        {fcR !== null && fcR > 100 && (
          <Aviso tono="rojo">Más de 100 ppm en reposo: hoy no se hacen tests de esfuerzo. Repetir la toma en 5 min.</Aviso>
        )}
      </Seccion>

      <Seccion
        id="s3"
        titulo="3 · Control postural"
        tiempo="12-15 min"
        nota="Móvil apoyado, cámara horizontal, distancia 2-3 m."
      >
        <SinParq />
        <Sub titulo="Sentadilla">
          <CriterioDe t="sentadilla" />
          <Fila>
            <Chips k="sqModo" label="Modo" opciones={["En directo, cámara lateral", "Vídeo previo autograbado"]} />
            <Chips k="sqVariante" label="Variante" opciones={["Overhead squat", "Air squat", "Sentadilla a silla"]} />
          </Fila>
          <Fila cols={3}>
            <Chips k="sqRango" label="Rango" opciones={["paralela", "supera", "no llega"]} />
            <Chips k="sqTalones" label="Talones" opciones={["OK", "despegan"]} />
            <Chips k="sqRodillas" label="Rodillas" opciones={["OK", "valgo", "varo"]} />
            <Chips k="sqTronco" label="Tronco" opciones={["erguido", "inclinación adelante"]} />
            {oh && <Chips k="sqBrazos" label="Brazos (OH)" opciones={["mantienen", "caen"]} />}
            <Chips k="sqLumbar" label="Lumbar" opciones={["neutra", "butt wink"]} />
          </Fila>
          <Chips k="sqExtra" multi label="Además" opciones={["No llega a media sentadilla", "Dolor"]} />
          <Area k="sqNotas" label="Notas específicas" />
          <div>
            <Chips
              k="sqGlobal"
              label="Puntuación global"
              opciones={GLOBAL}
              pista="0-1 compensaciones = BIEN · 2-3 = REGULAR · 4+ o no llega a media sentadilla o dolor = MAL"
            />
            {(() => {
              const s = sugerenciaSentadilla(d);
              return s ? <Sugerido nivel={s.nivel} motivo={s.motivo} /> : null;
            })()}
          </div>
        </Sub>

        <Sub
          titulo="Dorsiflexión de tobillo (rodilla-pared)"
          nota="Cinta métrica al suelo, perpendicular a la pared. Aproximación aceptable si no se puede medir preciso."
        >
          <CriterioDe t="dorsiflexion" />
          <Chips
            k="dfModo"
            label="Modo de registro"
            opciones={["Cm exactos con cinta", "Referencia visual (rodapié/baldosa)", "Impresión subjetiva por vídeo", "Omitido"]}
          />
          {(["Izq", "Dch"] as const).map((l) => (
            <Fila key={l} cols={3}>
              <Texto k={`df${l}Dist`} label={`${l === "Izq" ? "IZQ" : "DCH"} · distancia / referencia`} ph="cm o referencia" />
              <Chips k={`df${l}Talon`} label="Talón" opciones={["OK", "despega"]} />
              <Chips k={`df${l}Val`} label="Valoración" opciones={BRM} />
            </Fila>
          ))}
        </Sub>

        <Sub titulo="Bird-dog estático (10 s por lado)" nota="Aguanta 10 s estable = B · con bamboleo o rotación = R · no aguanta o cae = M">
          <CriterioDe t="birddog" />
          {([1, 2] as const).map((l) => (
            <div key={l}>
              <Fila cols={3}>
                <Chips k={`bd${l}Aguanta`} label={`Lado ${l} · aguanta 10 s`} opciones={["Sí", "No"]} />
                <Chips k={`bd${l}Espalda`} label="Espalda / compensaciones" multi exclusiva="estable" opciones={["estable", "bamboleo", "rota cadera"]} />
                <Chips k={`bd${l}Val`} label="Valoración" opciones={BRM} />
              </Fila>
              <Sugerido nivel={sugerenciaBirdDog(d, l)} />
            </div>
          ))}
        </Sub>

        <Sub
          titulo="Disociación lumbopélvica con pica"
          nota="Pica o escoba, cámara lateral. Online: que diga en voz alta cuándo nota que se despega algún contacto."
        >
          <CriterioDe t="pica" />
          <Chips
            k="picaObs"
            label="Observación"
            multi
            exclusiva="Mantiene tres contactos limpio"
            opciones={[
              "Mantiene tres contactos limpio",
              "Se despega el sacro",
              "Se despega la torácica",
              "Flexiona en bloque (sin separar cadera de columna)",
            ]}
          />
          <Chips
            k="picaRom"
            label="ROM manteniendo contactos"
            opciones={["Bisagra ligera (~45°)", "Bisagra media (~90°)", "Bisagra completa (>90°)"]}
          />
          <div>
            <Chips
              k="picaGlobal"
              label="Puntuación global"
              opciones={GLOBAL}
              pista="3 contactos hasta bisagra completa = BIEN · pierde contacto al final = REGULAR · en bloque desde el inicio o pierde rápido = MAL"
            />
            <Sugerido nivel={sugerenciaPica(d)} />
          </div>
        </Sub>
      </Seccion>

      <Seccion
        id="s4"
        titulo="4 · Antropometría"
        tiempo="5-8 min"
        nota="Online: peso (ya recibido) + cintura auto-medida guiada + fotos. Pliegues y otros perímetros omitidos por diseño."
      >
        <div>
          <Num k="cintura" label="Perímetro de cintura (mínima, u ombligo si no hay cintura definida)" unidad="cm" className="max-w-[320px]" />
          <Lectura r={baremoCintura(d)} />
          <Pista>H &lt;94 OK / 94-102 elevado / &gt;102 alto · M &lt;80 OK / 80-88 elevado / &gt;88 alto</Pista>
        </div>
        <Chips
          k="fotos"
          label="Fotos frontal / lateral / posterior"
          opciones={["Recibidas antes de la sesión", "Protocolo enviado, pendiente", "Rechazadas"]}
        />
      </Seccion>

      <Seccion id="s5" titulo="5 · Fuerza-función + equilibrio" tiempo="15-20 min">
        <SinParq />
        <Sub titulo="Sit-to-stand 30 s" nota="Silla estándar, brazos cruzados. Cronómetro: 30 s.">
          <CriterioDe t="sitToStand" />
          <div className="max-w-[260px]">
            <Num k="stsReps" label="Reps completas" />
            <Lectura r={baremoSitToStand(d)} />
          </div>
          <Area k="stsNotas" label="Notas técnica (impulso, extensión completa, rebote)" />
        </Sub>

        <Sub
          titulo="Apoyo monopodal (hasta 30 s · 2 intentos por lado)"
          nota="Brazos colgando. Corte cuando el movimiento sea exagerado o cruce el eje corporal."
        >
          <CriterioDe t="monopodal" />
          {(["Izq", "Dch"] as const).map((l) => {
            const mejor = mejorMonopodal(d, l);
            return (
              <div key={l}>
                <Fila cols={3}>
                  <Num k={`mo${l}1`} label={`${l === "Izq" ? "IZQ" : "DCH"} · intento 1`} unidad="s" />
                  <Num k={`mo${l}2`} label="Intento 2" unidad="s" />
                  <div>
                    <span className="mb-1.5 block text-[0.72rem] font-medium uppercase tracking-[0.12em] text-gray-500">Mejor</span>
                    <p className="py-2 text-[0.92rem] tabular-nums">{mejor !== null ? `${mejor} s` : "—"}</p>
                  </div>
                </Fila>
                <Lectura r={baremoMonopodal(d, l)} />
              </div>
            );
          })}
        </Sub>

        <Sub titulo="Plancha frontal" nota="Cortar cuando la cadera cae o sube, no cuando se cansa.">
          <CriterioDe t="plancha" />
          <Fila>
            <div>
              <Num k="plTiempo" label="Tiempo" unidad="s" />
              <Lectura r={baremoPlancha(d)} />
            </div>
            <Texto k="plCorte" label="Motivo de corte" />
          </Fila>
        </Sub>

        <Sub titulo="Flexiones adaptadas (nivel más exigente viable)">
          <CriterioDe t="flexiones" />
          <Chips k="flNivel" label="Nivel" opciones={["Pared", "Mesa/banco", "Rodillas", "Completa"]} />
          <Fila>
            <Num k="flReps" label="Reps con técnica" />
            <Texto k="flCorte" label="Motivo de corte" />
          </Fila>
        </Sub>

        <Sub titulo="Remo (según material)" nota="Online solo con TRX. Mesa: riesgo de estabilidad y poca verificación por pantalla → mejor omitir.">
          <CriterioDe t="remo" />
          <Chips k="reOpcion" label="Opción usada" opciones={["TRX", "Omitido (para sesión con material)"]} />
          {txt(d, "reOpcion") === "TRX" && (
            <>
              <Chips k="reAngulo" label="Ángulo del cuerpo" opciones={["30°", "45°", "60°", "Otro"]} />
              {txt(d, "reAngulo") === "Otro" && <Texto k="reAnguloOtro" label="Ángulo" className="max-w-[240px]" />}
              <Fila>
                <Texto k="reLongitud" label="Longitud correas (marca)" />
                <Num k="reReps" label="Reps con técnica" />
              </Fila>
            </>
          )}
        </Sub>
      </Seccion>

      <Seccion
        id="s6"
        titulo="6 · Cardio · 2-minute step in place"
        tiempo="8-10 min"
        nota="Marcha en el sitio 2 min; contar las subidas de la rodilla derecha a la altura marcada (punto medio rótula-cresta ilíaca). Cronómetro: 2 min."
      >
        <SinParq />
        <p className="text-[0.88rem] text-gray-600">
          FC en reposo (tomada antes de los tests):{" "}
          <strong className="tabular-nums">{fcR !== null ? `${fcR} ppm` : "sin tomar — ve a «FC en reposo»"}</strong>
          {fcMax && <span className="text-gray-400"> · FC máx. estimada {fcMax} (208 − 0,7 × edad)</span>}
        </p>
        <CriterioDe t="step" />
        <Chips k="stRef" label="Referencia altura marcada" opciones={["Cinta en muslo", "Mano como referencia", "Otra"]} />
        {txt(d, "stRef") === "Otra" && <Texto k="stRefOtra" label="¿Cuál?" className="max-w-[320px]" />}
        <Fila cols={3}>
          <div>
            <Num k="stSubidas" label="Subidas rodilla dcha (2 min)" />
            <Lectura r={baremoStep(d)} />
          </div>
          <Num k="stFcPico" label="FC pico (primeros 15 s al terminar)" unidad="ppm" />
          <Chips k="stBorg" label="Borg 0-10" opciones={["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]} />
        </Fila>
        <Area k="stIncidencias" label="Paradas o incidencias" />
        <Sub titulo="Test cuesta (opcional, autogestionado, no baseline oficial)">
          <CriterioDe t="cuesta" />
          <Chips k="cuesta" opciones={["Lo hará solo y reportará", "No aplicable / no interesa"]} />
          {txt(d, "cuesta") === "Lo hará solo y reportará" && <Area k="cuestaNotas" label="Notas" />}
        </Sub>
      </Seccion>

      <Seccion
        id="s7"
        titulo="7 · Conversación objetivos + cierre"
        tiempo="10-13 min"
        nota="REGLA: no propongas tú los objetivos primero. Que salgan de ellos; luego engarzas los tuyos. Frases textuales entre comillas."
      >
        <Chips
          k="grabaCierre"
          label="¿Grabas audio también aquí? (con permiso)"
          opciones={["Sí, grabo", "No"]}
          pista="Muy útil: aquí salen las frases textuales para copy y ficha."
        />
        <Area k="reaccion" label="Reacción a los tests: ¿qué tal os habéis visto? ¿Qué os ha sorprendido?" rows={3} />
        <Area k="obj3m" label="Objetivos a 3 meses (lo primero que quieren notar)" rows={3} />
        <Area k="vis12m" label="Visión a 12 meses (frases textuales)" rows={3} />
        <Area k="miedosCierre" label="Miedos y preocupaciones (no saltar)" rows={3} />
        <Area
          k="feedbackOnline"
          label="Feedback operativo online"
          pista="¿Algún test o momento en el que se ha visto perdido/a? ¿Se podría haber hecho mejor?"
        />
        <Chips
          k="cierre"
          label="Cierre"
          multi
          opciones={["Protocolo de fotos enviado por WhatsApp", "Timeline ficha comunicada (2-3 días)", "Dudas de última hora respondidas"]}
        />
        <Chips k="canalFicha" label="Canal para enviar la ficha" opciones={["WhatsApp", "Email"]} />
      </Seccion>

      <Seccion id="s8" titulo="8 · Notas generales y post-sesión">
        <Area k="senales" label="Señales / observaciones no capturadas arriba" rows={3} />
        <Area k="rapport" label="Impresión general de rapport y compromiso percibido" />
        <Chips k="pendientes" label="Datos pendientes de recibir por WhatsApp" multi opciones={["Fotos", "Peso", "Otras"]} />
        {(d.pendientes as string[] | undefined)?.includes("Otras") && <Texto k="pendientesOtras" label="¿Cuáles?" />}
      </Seccion>

      <Seccion id="s9" titulo="9 · Digitalización en Obsidian (post-sesión)">
        <Chips
          k="obsidian"
          multi
          opciones={[
            "Ampliar notas con re-escucha de audios",
            "Archivar vídeos con nomenclatura clara",
            "Rellenar post-sesión en la nota del cliente",
            "Marcar frases para copy (ficha, ads, newsletter)",
            "Anotar aprendizaje operativo en §11 del protocolo",
          ]}
        />
        <Pista>Vídeos: [cliente]_[fecha]_[test]_[vista].mp4 → antxon_20260805_sentadilla_lateral.mp4</Pista>
      </Seccion>
    </div>
  );
}
