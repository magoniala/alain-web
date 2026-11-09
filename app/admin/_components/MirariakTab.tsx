"use client";

import { useCallback, useEffect, useState } from "react";

// MIRARIAK 2026 de un vistazo: reservas del taller por grupo (ruedas por
// edades con el total dentro), quién repite del año pasado, micromagia por
// horario, ritmo de reservas y avisos (posibles duplicados). Los datos salen
// de /api/admin/mirariak (tabla mirariak2026_reservas).

// Paleta categórica en orden fijo (validada: daltonismo y visión normal OK en
// pares contiguos). El color sigue a la franja de edad en todas las ruedas.
const COLOR: Record<string, string> = {
  "6": "#2a78d6",
  "7": "#eb6834",
  "8": "#1baf7a",
  "9": "#eda100",
  "10": "#e87ba4",
  "11-12": "#008300",
  "13-17": "#6250d6",
  Adultos: "#e34948",
};
const ETIQUETA = (f: string) => (/^\d+$/.test(f) ? `${f} años` : f === "Adultos" ? "Adultos (18+)" : `${f} años`);
const AZUL = "#2a78d6";
const PISTA = "#ecebe7";

interface PT { nombre: string; edad: number; repite: boolean; contacto: string; email: string; fecha: string }
interface Grupo { sesion: string; nombre: string; edades: string; plazas: number; n: number; repiten: number; franjas: Record<string, number>; participantes: PT[] }
interface Horario { horario: string; plazas: number; n: number; participantes: { nombre: string; contacto: string; email: string; fecha: string }[] }
interface Datos {
  actualizado: string;
  resumen: { formularios: number; familias: number; personas_taller: number; plazas_taller: number; repiten_taller: number; personas_micromagia: number; plazas_micromagia: number; en_las_dos: number; con_newsletter: number; idioma: Record<string, number>; ultima: string | null };
  franjas: string[];
  taller: { total: Record<string, number>; grupos: Grupo[] };
  micromagia: { horarios: Horario[] };
  semanas: { semana: string; taller: number; micromagia: number }[];
  duplicados: { contacto: string; email: string; actividad: string; nombres: string[]; veces: number; fechas: string[]; ids: string[] }[];
  reservas: Reserva[];
  espera: DatosGestion["espera"];
  cambios: DatosGestion["cambios"];
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fecha = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ── Rueda (donut) con el total dentro. Al pasar por un color, el centro dice qué es.
function Rueda({ valores, orden, tam = 168, titulo }: { valores: Record<string, number>; orden: string[]; tam?: number; titulo: string }) {
  const [activo, setActivo] = useState<string | null>(null);
  const total = orden.reduce((a, k) => a + (valores[k] ?? 0), 0);
  const r = 60;
  const grosor = 20;
  const C = 2 * Math.PI * r;
  const hueco = total > 1 ? 2.5 : 0; // 2px de superficie entre colores
  let acumulado = 0;
  const trozos = orden
    .filter((k) => (valores[k] ?? 0) > 0)
    .map((k) => {
      const v = valores[k];
      const largo = (v / total) * C;
      const t = { k, v, inicio: acumulado, largo };
      acumulado += largo;
      return t;
    });
  const sel = activo ? trozos.find((t) => t.k === activo) : null;
  return (
    <svg viewBox="0 0 160 160" width={tam} height={tam} role="img" aria-label={`${titulo}: ${total} personas`} className="shrink-0">
      <circle cx={80} cy={80} r={r} fill="none" stroke={PISTA} strokeWidth={grosor} />
      {trozos.map((t) => (
        <circle
          key={t.k}
          cx={80}
          cy={80}
          r={r}
          fill="none"
          stroke={COLOR[t.k] ?? "#999"}
          strokeWidth={activo === t.k ? grosor + 4 : grosor}
          strokeDasharray={`${Math.max(t.largo - hueco, 0.5)} ${C}`}
          strokeDashoffset={-t.inicio}
          transform="rotate(-90 80 80)"
          style={{ cursor: "default", transition: "stroke-width 120ms" }}
          onMouseEnter={() => setActivo(t.k)}
          onMouseLeave={() => setActivo(null)}
          onClick={() => setActivo(activo === t.k ? null : t.k)}
        >
          <title>{`${ETIQUETA(t.k)}: ${t.v} (${pct(t.v, total)} %)`}</title>
        </circle>
      ))}
      {sel ? (
        <>
          <text x={80} y={76} textAnchor="middle" fontSize={26} fontWeight={600} fill="#1a1a1a">{sel.v}</text>
          <text x={80} y={96} textAnchor="middle" fontSize={11} fill="#52514e">{ETIQUETA(sel.k)} · {pct(sel.v, total)} %</text>
        </>
      ) : (
        <>
          <text x={80} y={82} textAnchor="middle" fontSize={34} fontWeight={600} fill="#1a1a1a">{total}</text>
          <text x={80} y={100} textAnchor="middle" fontSize={11} fill="#52514e">{total === 1 ? "persona" : "personas"}</text>
        </>
      )}
    </svg>
  );
}

function Leyenda({ valores, orden }: { valores: Record<string, number>; orden: string[] }) {
  const total = orden.reduce((a, k) => a + (valores[k] ?? 0), 0);
  const filas = orden.filter((k) => (valores[k] ?? 0) > 0);
  if (!filas.length) return <p className="text-[0.82rem] text-gray-400">Sin reservas todavía.</p>;
  return (
    <ul className="space-y-1 text-[0.85rem]">
      {filas.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: COLOR[k] }} />
          <span className="text-gray-800">{ETIQUETA(k)}</span>
          <span className="ml-auto tabular-nums text-gray-900">{valores[k]}</span>
          <span className="w-11 text-right tabular-nums text-gray-500">{pct(valores[k], total)} %</span>
        </li>
      ))}
    </ul>
  );
}

// ── Barra contra un límite (plazas, repetidores).
function Medidor({ valor, max, etiqueta, detalle, color = AZUL, plazas = false }: { valor: number; max: number; etiqueta: string; detalle?: string; color?: string; plazas?: boolean }) {
  const p = Math.min(100, max ? (valor / max) * 100 : 0);
  const lleno = plazas && valor >= max;
  return (
    <div title={`${etiqueta}: ${valor} de ${max}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.8rem]">
        <span className="text-gray-600">{etiqueta}</span>
        <span className="tabular-nums text-gray-900">
          <b>{valor}</b> / {max}
          {detalle ? <span className="text-gray-500"> · {detalle}</span> : null}
          {lleno ? <span className="ml-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-[0.68rem] text-white">completo</span> : null}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: PISTA }}>
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function Cifra({ valor, etiqueta, detalle }: { valor: string | number; etiqueta: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">{etiqueta}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tabular-nums text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-[0.78rem] text-gray-500">{detalle}</p>}
    </div>
  );
}

// ── Ritmo: personas nuevas por semana (taller y micromagia, lado a lado).
function Ritmo({ semanas }: { semanas: Datos["semanas"] }) {
  const [activa, setActiva] = useState<number | null>(null);
  if (!semanas.length) return null;
  const max = Math.max(...semanas.map((s) => Math.max(s.taller, s.micromagia)), 1);
  const alto = 150;
  const ancho = 900;
  const paso = ancho / semanas.length;
  const barra = Math.min(26, paso / 3);
  const s = activa !== null ? semanas[activa] : null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[0.8rem] text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR["6"] }} />Taller</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR["7"] }} />Micromagia</span>
        <span className="ml-auto hidden text-gray-500 sm:inline">{s ? `Semana del ${new Date(s.semana).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}: ${s.taller} al taller · ${s.micromagia} a micromagia` : "Pasa por una semana para ver el detalle"}</span>
      </div>
      <ul className="space-y-2 sm:hidden">
        {semanas.map((w) => (
          <li key={w.semana} className="grid grid-cols-[4.2rem_1fr] items-center gap-x-2 text-[0.75rem] text-gray-600">
            <span className="row-span-2">{new Date(w.semana).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 rounded-full" style={{ width: `${(w.taller / max) * 80}%`, minWidth: w.taller ? 4 : 0, background: COLOR["6"] }} /><span className="tabular-nums">{w.taller}</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 rounded-full" style={{ width: `${(w.micromagia / max) * 80}%`, minWidth: w.micromagia ? 4 : 0, background: COLOR["7"] }} /><span className="tabular-nums">{w.micromagia}</span></span>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <svg viewBox={`0 0 ${ancho} ${alto + 22}`} width="100%" style={{ minWidth: 520 }} role="img" aria-label="Personas apuntadas por semana">
          <line x1={0} x2={ancho} y1={alto} y2={alto} stroke="#d6d5d0" strokeWidth={1} />
          {semanas.map((w, i) => {
            const x = i * paso + paso / 2;
            const hT = (w.taller / max) * (alto - 18);
            const hM = (w.micromagia / max) * (alto - 18);
            return (
              <g key={w.semana} onMouseEnter={() => setActiva(i)} onMouseLeave={() => setActiva(null)} onClick={() => setActiva(activa === i ? null : i)}>
                <rect x={i * paso} y={0} width={paso} height={alto + 22} fill={activa === i ? "#f3f2ee" : "transparent"} />
                {w.taller > 0 && <rect x={x - barra - 1} y={alto - hT} width={barra} height={hT} rx={3} fill={COLOR["6"]} />}
                {w.micromagia > 0 && <rect x={x + 1} y={alto - hM} width={barra} height={hM} rx={3} fill={COLOR["7"]} />}
                {w.taller > 0 && <text x={x - barra / 2 - 1} y={alto - hT - 4} textAnchor="middle" fontSize={10} fill="#52514e">{w.taller}</text>}
                {w.micromagia > 0 && <text x={x + barra / 2 + 1} y={alto - hM - 4} textAnchor="middle" fontSize={10} fill="#52514e">{w.micromagia}</text>}
                <text x={x} y={alto + 15} textAnchor="middle" fontSize={10} fill="#52514e">{new Date(w.semana).toLocaleDateString("es-ES", { day: "numeric", month: "numeric" })}</text>
                <title>{`Semana del ${w.semana}: ${w.taller} taller · ${w.micromagia} micromagia`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────── Gestión de reservas ───────────────────────────
// Buscar una reserva, anularla (con motivo, reversible), moverla de grupo u
// horario, corregir nombre o edad, y llevar las listas de espera. Las plazas
// que se liberan vuelven a salir en el formulario público.

interface Marca { en?: string; motivo?: string; desde?: string; telefono?: string; nota?: string }
interface PTg { idx: number; nombre: string; edad: number; sesion: string; repite: boolean; anulada: Marca | null; espera: Marca | null }
interface PMg { idx: number; nombre: string; anulada: Marca | null; espera: Marca | null }
interface Reserva { id: string; contacto: string; email: string; idioma: string; fecha: string; actividad: string; horario: string; taller: PTg[]; micromagia: PMg[] }
interface EnEspera { id: string; lista: "taller" | "micromagia"; idx: number; nombre: string; edad: number | null; contacto: string; email: string; idioma: string; telefono: string; nota: string; desde: string }
interface DatosGestion {
  reservas: Reserva[];
  espera: { taller: Record<string, EnEspera[]>; micromagia: Record<string, EnEspera[]> };
  cambios: { en: string; que: string; nombre: string; contacto: string; id: string }[];
}
type Lista = "taller" | "micromagia";
type Accion = Record<string, unknown> & { accion: string };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const NOMBRE_GRUPO: Record<string, string> = { "10:00 – 10:55": "Grupo 1 · 6-7", "11:10 – 12:05": "Grupo 2 · 8-10", "12:20 – 13:15": "Grupo 3 · 11+" };
const GRUPO_CORTO: Record<string, string> = { "10:00 – 10:55": "Grupo 1", "11:10 – 12:05": "Grupo 2", "12:20 – 13:15": "Grupo 3" };
const MOTIVOS = ["Lo ha pedido la familia", "No pueden venir", "Reserva repetida", "Se cambian de horario"];

function telWa(t: string) {
  const d = t.replace(/\D/g, "");
  return d.length === 9 ? `34${d}` : d;
}
function enlaceAviso(p: { email: string; telefono?: string; idioma: string }, asunto: string, cuerpo: string) {
  if (p.telefono) return { href: `https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(cuerpo)}`, via: "WhatsApp" };
  if (p.email) return { href: `mailto:${p.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`, via: "correo" };
  return null;
}
function textoPlaza(lista: Lista, destino: string, nombre: string, contacto: string, idioma: string) {
  const pila = contacto.trim().split(" ")[0];
  if (idioma === "es") {
    const cuando = lista === "taller" ? `el taller del sábado 14 de noviembre, a las ${destino.split(" ")[0]} (${NOMBRE_GRUPO[destino] ?? destino} años)` : `la micromagia del domingo 15 de noviembre, de ${destino.replace(" – ", " a ")}`;
    return { asunto: "MIRARIAK 2026 — Ya tienes plaza", cuerpo: `Hola, ${pila}:\n\nSe ha liberado una plaza y ${nombre} ya está apuntado/a en ${cuando}, en el Aita Agirre Kulturgunea (Areto Nagusia) de Elgoibar.\n\nSi al final no podéis venir, avísame, por favor, para que la aproveche otra familia.\n\n¡Hasta pronto!\nAlain` };
  }
  const noiz = lista === "taller" ? `larunbateko tailerrean (azaroaren 14a, ${destino.split(" ")[0]}etan, ${GRUPO_CORTO[destino] ?? destino})` : `igandeko mikromagian (azaroaren 15a, ${destino})`;
  return { asunto: "MIRARIAK 2026 — Plaza baduzu", cuerpo: `Kaixo, ${pila}!\n\nPlaza bat libratu da eta ${nombre} apuntatuta dago ${noiz}, Elgoibarko Aita Agirre Kulturguneko Areto Nagusian.\n\nAzkenean ezin bazarete etorri, abisatu, mesedez, beste familia batek aprobetxa dezan.\n\nLaster arte!\nAlain` };
}
function textoAnulada(nombres: string[], contacto: string, idioma: string) {
  const pila = contacto.trim().split(" ")[0];
  const quien = nombres.join(idioma === "es" ? " y " : " eta ");
  if (idioma === "es") return { asunto: "MIRARIAK 2026 — Reserva anulada", cuerpo: `Hola, ${pila}:\n\nHecho: he anulado la reserva de ${quien}. Gracias por avisar, así la plaza la puede aprovechar otra familia.\n\nUn saludo,\nAlain` };
  return { asunto: "MIRARIAK 2026 — Erreserba ezeztatuta", cuerpo: `Kaixo, ${pila}!\n\nEginda: ${quien}-(r)en erreserba ezeztatu dut. Eskerrik asko abisatzeagatik, horrela beste familia batek erabili ahal izango du plaza.\n\nOndo izan!\nAlain` };
}

function useAccion(recargar: () => Promise<void> | void) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; enlace?: { href: string; via: string } | null; error?: boolean } | null>(null);
  const lanzar = async (cuerpo: Accion, hecho: string, enlace?: { href: string; via: string } | null) => {
    setOcupado(true);
    try {
      const llamar = (extra: Record<string, unknown> = {}) =>
        fetch("/api/admin/mirariak", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" },
          body: JSON.stringify({ ...cuerpo, ...extra }),
        });
      let r = await llamar();
      let j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.completo) {
        if (!window.confirm(`${j.error}\n\n¿Meterlo igualmente, por encima del aforo?`)) {
          setAviso({ texto: "No se ha hecho nada: el destino está completo.", error: true });
          return false;
        }
        r = await llamar({ forzar: true });
        j = await r.json().catch(() => ({}));
      }
      if (!r.ok) {
        setAviso({ texto: j.error ?? "Error", error: true });
        return false;
      }
      setAviso({ texto: hecho, enlace });
      await recargar();
      return true;
    } catch {
      setAviso({ texto: "Sin conexión.", error: true });
      return false;
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, aviso, setAviso, lanzar };
}

const btn = "px-2 py-1 text-[0.75rem] ring-1 ring-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40";
const btnFuerte = "px-2.5 py-1 text-[0.75rem] bg-gray-900 text-white disabled:opacity-40";

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: "rojo" | "ambar" | "azul" | "gris" }) {
  const c = { rojo: "bg-red-50 text-red-700", ambar: "bg-amber-50 text-amber-800", azul: "bg-[#1C3A5E]/10 text-[#1C3A5E]", gris: "bg-gray-100 text-gray-600" }[tono];
  return <span className={`rounded-full px-1.5 py-0.5 text-[0.7rem] ${c}`}>{children}</span>;
}

// Una línea de participante con sus acciones (anular · mover · corregir · reactivar / dar plaza).
function LineaParticipante({ r, lista, p, libres, lanzar, ocupado }: {
  r: Reserva; lista: Lista; p: PTg | PMg; libres: { taller: Record<string, number>; micromagia: Record<string, number> };
  lanzar: ReturnType<typeof useAccion>["lanzar"]; ocupado: boolean;
}) {
  const [modo, setModo] = useState<null | "anular" | "mover" | "editar">(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const destinoActual = lista === "taller" ? (p as PTg).sesion : r.horario;
  const opciones = lista === "taller" ? Object.keys(NOMBRE_GRUPO) : Object.keys(libres.micromagia);
  const [destino, setDestino] = useState(opciones.find((o) => o !== destinoActual) ?? opciones[0]);
  const [nombre, setNombre] = useState(p.nombre);
  const [edad, setEdad] = useState(lista === "taller" ? String((p as PTg).edad) : "");
  const base = { id: r.id, lista, idx: p.idx, nombre: p.nombre };
  const etiquetaDestino = lista === "taller" ? NOMBRE_GRUPO[destinoActual] ?? destinoActual : destinoActual;
  const cerrar = () => setModo(null);

  return (
    <li className={`py-1.5 ${p.anulada ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`text-gray-900 ${p.anulada ? "line-through" : ""}`}>{p.nombre}</span>
        {lista === "taller" && <span className="tabular-nums text-gray-500">{(p as PTg).edad} años</span>}
        <span className="text-gray-500">· {lista === "taller" ? "Taller" : "Micromagia"} {etiquetaDestino}</span>
        {lista === "taller" && (p as PTg).repite && <Etiqueta tono="azul">repite</Etiqueta>}
        {p.anulada && <Etiqueta tono="rojo">anulada · {p.anulada.motivo}</Etiqueta>}
        {p.espera && !p.anulada && <Etiqueta tono="ambar">en lista de espera</Etiqueta>}
        <span className="ml-auto flex flex-wrap gap-1">
          {p.anulada ? (
            <button className={btn} disabled={ocupado} onClick={() => lanzar({ accion: "reactivar", ...base }, `${p.nombre}: reserva reactivada.`)}>Reactivar</button>
          ) : (
            <>
              {p.espera && <button className={btnFuerte} disabled={ocupado} onClick={() => { const t = textoPlaza(lista, destinoActual, p.nombre, r.contacto, r.idioma); lanzar({ accion: "dar_plaza", ...base }, `${p.nombre} ya tiene plaza en ${etiquetaDestino}. Avisa a la familia:`, enlaceAviso({ email: r.email, telefono: p.espera?.telefono, idioma: r.idioma }, t.asunto, t.cuerpo)); }}>Dar plaza</button>}
              <button className={btn} disabled={ocupado} onClick={() => setModo(modo === "mover" ? null : "mover")}>Mover</button>
              <button className={btn} disabled={ocupado} onClick={() => setModo(modo === "editar" ? null : "editar")}>Corregir</button>
              <button className={btn} disabled={ocupado} onClick={() => setModo(modo === "anular" ? null : "anular")}>{p.espera ? "Quitar" : "Anular"}</button>
            </>
          )}
        </span>
      </div>

      {modo === "anular" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
          <span className="text-[0.78rem] text-gray-600">Motivo:</span>
          {MOTIVOS.map((m) => (
            <button key={m} onClick={() => setMotivo(m)} className={`rounded-full px-2 py-0.5 text-[0.72rem] ring-1 ${motivo === m ? "bg-gray-900 text-white ring-gray-900" : "text-gray-700 ring-gray-300"}`}>{m}</button>
          ))}
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-w-[12rem] flex-1 border border-gray-300 px-2 py-1 text-[0.8rem]" />
          <button className={btnFuerte} disabled={ocupado} onClick={async () => {
            const t = textoAnulada([p.nombre], r.contacto, r.idioma);
            if (await lanzar({ accion: p.espera ? "quitar_espera" : "anular", ...base, motivo }, `${p.nombre}: ${p.espera ? "quitado de la lista de espera" : "anulada; la plaza vuelve a estar libre"}.`, p.espera ? null : enlaceAviso({ email: r.email, idioma: r.idioma }, t.asunto, t.cuerpo))) cerrar();
          }}>{p.espera ? "Quitar de la lista" : "Anular"}</button>
          <button className={btn} onClick={cerrar}>Cancelar</button>
        </div>
      )}

      {modo === "mover" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
          <span className="text-[0.78rem] text-gray-600">A:</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="border border-gray-300 px-2 py-1 text-[0.8rem]">
            {opciones.filter((o) => o !== destinoActual).map((o) => {
              const quedan = lista === "taller" ? libres.taller[o] : libres.micromagia[o];
              return <option key={o} value={o}>{lista === "taller" ? NOMBRE_GRUPO[o] : o} · {quedan > 0 ? `${quedan} libres` : "completo"}</option>;
            })}
          </select>
          {lista === "micromagia" && r.micromagia.filter((x) => !x.anulada).length > 1 && <span className="text-[0.72rem] text-gray-500">Solo se mueve {p.nombre}; para mover a todo el grupo, usa «Mover todo» arriba.</span>}
          <button className={btnFuerte} disabled={ocupado} onClick={async () => {
            if (await lanzar({ accion: "mover", ...base, destino }, `${p.nombre} movido a ${lista === "taller" ? NOMBRE_GRUPO[destino] : destino}.`)) cerrar();
          }}>Mover</button>
          <button className={btn} onClick={cerrar}>Cancelar</button>
        </div>
      )}

      {modo === "editar" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="min-w-[12rem] flex-1 border border-gray-300 px-2 py-1 text-[0.8rem]" aria-label="Nombre" />
          {lista === "taller" && <input value={edad} onChange={(e) => setEdad(e.target.value.replace(/\D/g, ""))} className="w-16 border border-gray-300 px-2 py-1 text-[0.8rem]" aria-label="Edad" inputMode="numeric" />}
          <button className={btnFuerte} disabled={ocupado} onClick={async () => {
            if (await lanzar({ accion: "editar", ...base, nuevo_nombre: nombre, edad: edad ? Number(edad) : undefined }, "Corregido.")) cerrar();
          }}>Guardar</button>
          <button className={btn} onClick={cerrar}>Cancelar</button>
          {lista === "taller" && <span className="w-full text-[0.72rem] text-gray-500">Cambiar la edad no le cambia de grupo: para eso, «Mover».</span>}
        </div>
      )}
    </li>
  );
}

function TarjetaReserva({ r, libres, accion }: { r: Reserva; libres: { taller: Record<string, number>; micromagia: Record<string, number> }; accion: ReturnType<typeof useAccion> }) {
  const [moverTodo, setMoverTodo] = useState(false);
  const mmActivos = r.micromagia.filter((p) => !p.anulada);
  const [destinoMm, setDestinoMm] = useState(Object.keys(libres.micromagia).find((h) => h !== r.horario) ?? "");
  const activos = [...r.taller, ...r.micromagia].filter((p) => !p.anulada && !p.espera);
  const anularTodo = async () => {
    const motivo = window.prompt(`Anular todo el formulario de ${r.contacto} (${activos.map((p) => p.nombre).join(", ")}). Motivo:`, MOTIVOS[0]);
    if (motivo === null) return;
    const t = textoAnulada([...new Set(activos.map((p) => p.nombre))], r.contacto, r.idioma);
    let ok = true;
    if (r.taller.some((p) => !p.anulada)) ok = await accion.lanzar({ accion: "anular", id: r.id, lista: "taller", todos: true, motivo }, "Formulario anulado entero.", enlaceAviso({ email: r.email, idioma: r.idioma }, t.asunto, t.cuerpo));
    if (ok && r.micromagia.some((p) => !p.anulada)) await accion.lanzar({ accion: "anular", id: r.id, lista: "micromagia", todos: true, motivo }, "Formulario anulado entero; las plazas vuelven a estar libres.", enlaceAviso({ email: r.email, idioma: r.idioma }, t.asunto, t.cuerpo));
  };
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 text-[0.84rem]">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <b className="text-gray-900">{r.contacto}</b>
        {r.email ? <a href={`mailto:${r.email}`} className="text-[#2a9d8f]">{r.email}</a> : <span className="text-gray-400">sin correo</span>}
        <span className="text-gray-400">· {r.idioma === "es" ? "castellano" : "euskera"} · {fecha(r.fecha)}</span>
        <span className="ml-auto flex gap-1">
          {mmActivos.length > 1 && <button className={btn} disabled={accion.ocupado} onClick={() => setMoverTodo(!moverTodo)}>Mover todo</button>}
          {activos.length > 1 && <button className={btn} disabled={accion.ocupado} onClick={anularTodo}>Anular todo</button>}
        </span>
      </header>
      {moverTodo && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
          <span className="text-[0.78rem] text-gray-600">Micromagia de {mmActivos.map((p) => p.nombre).join(", ")} a:</span>
          <select value={destinoMm} onChange={(e) => setDestinoMm(e.target.value)} className="border border-gray-300 px-2 py-1 text-[0.8rem]">
            {Object.keys(libres.micromagia).filter((h) => h !== r.horario).map((h) => <option key={h} value={h}>{h} · {libres.micromagia[h] > 0 ? `${libres.micromagia[h]} libres` : "completo"}</option>)}
          </select>
          <button className={btnFuerte} disabled={accion.ocupado} onClick={async () => {
            if (await accion.lanzar({ accion: "mover", id: r.id, lista: "micromagia", todos: true, destino: destinoMm }, `Micromagia movida a ${destinoMm}.`)) setMoverTodo(false);
          }}>Mover</button>
          <button className={btn} onClick={() => setMoverTodo(false)}>Cancelar</button>
        </div>
      )}
      <ul className="mt-1 divide-y divide-gray-100">
        {r.taller.map((p) => <LineaParticipante key={`t${p.idx}`} r={r} lista="taller" p={p} libres={libres} lanzar={accion.lanzar} ocupado={accion.ocupado} />)}
        {r.micromagia.map((p) => <LineaParticipante key={`m${p.idx}`} r={r} lista="micromagia" p={p} libres={libres} lanzar={accion.lanzar} ocupado={accion.ocupado} />)}
      </ul>
    </article>
  );
}

// Lista de espera del taller: dar plaza directamente en OTRO grupo con sitio
// (p. ej. un niño de 10 años del 8-10 completo al +11). No manda correo:
// deja preparado el aviso, como «Dar plaza».
function DarPlazaEnOtro({ e, actual, libres, nombre, accion }: { e: EnEspera; actual: string; libres: Record<string, number>; nombre: string; accion: ReturnType<typeof useAccion> }) {
  const opciones = Object.keys(NOMBRE_GRUPO).filter((s) => s !== actual && (libres[s] ?? 0) > 0);
  const [destino, setDestino] = useState("");
  if (!opciones.length) return null;
  return (
    <span className="flex items-center gap-1">
      <select value={destino} onChange={(ev) => setDestino(ev.target.value)} className="border border-gray-300 px-1 py-0.5 text-[0.75rem]" aria-label={`Dar plaza a ${e.nombre} en otro grupo`}>
        <option value="">Otro grupo…</option>
        {opciones.map((s) => <option key={s} value={s}>{NOMBRE_GRUPO[s]} · {libres[s]} libres</option>)}
      </select>
      {destino && (
        <button className={btnFuerte} disabled={accion.ocupado} onClick={async () => {
          const t = textoPlaza("taller", destino, e.nombre, e.contacto, e.idioma);
          if (await accion.lanzar({ accion: "dar_plaza", id: e.id, lista: "taller", idx: e.idx, nombre, destino }, `${e.nombre} ya tiene plaza en ${NOMBRE_GRUPO[destino]}. Avisa a la familia:`, enlaceAviso(e, t.asunto, t.cuerpo))) setDestino("");
        }}>Dar plaza ahí</button>
      )}
    </span>
  );
}

function NuevoEnEspera({ accion, onHecho }: { accion: ReturnType<typeof useAccion>; onHecho: () => void }) {
  const [lista, setLista] = useState<Lista>("taller");
  const [destino, setDestino] = useState("11:10 – 12:05");
  const [f, setF] = useState({ nombre: "", edad: "", contacto: "", email: "", telefono: "", idioma: "eu", nota: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const destinos = lista === "taller" ? Object.keys(NOMBRE_GRUPO) : ["10:00 – 10:30", "11:00 – 11:30", "12:00 – 12:30", "17:30 – 18:00", "18:30 – 19:00"];
  const campo = "border border-gray-300 px-2 py-1 text-[0.82rem]";
  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 text-[0.82rem] sm:grid-cols-2 lg:grid-cols-4">
      <select value={lista} onChange={(e) => { const l = e.target.value as Lista; setLista(l); setDestino(l === "taller" ? "11:10 – 12:05" : "11:00 – 11:30"); }} className={campo}>
        <option value="taller">Taller (sábado)</option>
        <option value="micromagia">Micromagia (domingo)</option>
      </select>
      <select value={destino} onChange={(e) => setDestino(e.target.value)} className={campo}>
        {destinos.map((d) => <option key={d} value={d}>{lista === "taller" ? NOMBRE_GRUPO[d] : d}</option>)}
      </select>
      <input placeholder="Nombre del niño/a" value={f.nombre} onChange={set("nombre")} className={campo} />
      {lista === "taller" ? <input placeholder="Edad" value={f.edad} onChange={(e) => setF({ ...f, edad: e.target.value.replace(/\D/g, "") })} className={campo} inputMode="numeric" /> : <span />}
      <input placeholder="Quién lo pide (madre, padre…)" value={f.contacto} onChange={set("contacto")} className={campo} />
      <input placeholder="Correo" value={f.email} onChange={set("email")} className={campo} />
      <input placeholder="Teléfono (si es por WhatsApp)" value={f.telefono} onChange={set("telefono")} className={campo} />
      <select value={f.idioma} onChange={set("idioma")} className={campo}>
        <option value="eu">Le escribo en euskera</option>
        <option value="es">Le escribo en castellano</option>
      </select>
      <input placeholder="Nota (p. ej. quiere ir con sus amigas)" value={f.nota} onChange={set("nota")} className={`${campo} sm:col-span-2 lg:col-span-3`} />
      <button className={btnFuerte} disabled={accion.ocupado || !f.nombre.trim() || (lista === "taller" && !f.edad)} onClick={async () => {
        const ok = await accion.lanzar({ accion: "espera_alta", lista, destino, nombre: f.nombre, edad: f.edad ? Number(f.edad) : undefined, contacto: f.contacto, email: f.email, telefono: f.telefono, idioma: f.idioma, nota: f.nota }, `${f.nombre} apuntado/a en la lista de espera.`);
        if (ok) { setF({ nombre: "", edad: "", contacto: "", email: "", telefono: "", idioma: f.idioma, nota: "" }); onHecho(); }
      }}>Añadir a la lista de espera</button>
    </div>
  );
}

function Gestion({ g, libres, recargar, inicial = "" }: { g: DatosGestion; libres: { taller: Record<string, number>; micromagia: Record<string, number> }; recargar: () => Promise<void>; inicial?: string }) {
  const accion = useAccion(recargar);
  const [q, setQ] = useState(inicial);
  const [filtro, setFiltro] = useState<string>("");
  const [nuevo, setNuevo] = useState(false);
  const [verCambios, setVerCambios] = useState(false);

  const listasEspera = [
    ...Object.entries(g.espera.taller).map(([d, l]) => ({ lista: "taller" as Lista, destino: d, titulo: `Taller · ${NOMBRE_GRUPO[d]}`, l, quedan: libres.taller[d] })),
    ...Object.entries(g.espera.micromagia).map(([d, l]) => ({ lista: "micromagia" as Lista, destino: d, titulo: `Micromagia · ${d}`, l, quedan: libres.micromagia[d] })),
  ].filter((x) => x.l.length);
  const porId = new Map(g.reservas.map((r) => [r.id, r]));

  const chips: { k: string; t: string }[] = [
    ...Object.keys(NOMBRE_GRUPO).map((s) => ({ k: `t:${s}`, t: GRUPO_CORTO[s] })),
    ...Object.keys(libres.micromagia).map((h) => ({ k: `m:${h}`, t: h.split(" ")[0] })),
    { k: "anuladas", t: "Anuladas" },
  ];
  const nq = normal(q);
  const resultados = g.reservas
    .filter((r) => {
      if (filtro === "anuladas") return [...r.taller, ...r.micromagia].some((p) => p.anulada);
      if (filtro.startsWith("t:")) return r.taller.some((p) => p.sesion === filtro.slice(2) && !p.anulada);
      if (filtro.startsWith("m:")) return r.horario === filtro.slice(2) && r.micromagia.some((p) => !p.anulada);
      return true;
    })
    .filter((r) => !nq || normal([r.contacto, r.email, ...r.taller.map((p) => p.nombre), ...r.micromagia.map((p) => p.nombre)].join(" ")).includes(nq))
    .filter((r) => [...r.taller, ...r.micromagia].some((p) => !p.espera || p.anulada)) // las de solo espera salen en su lista
    .slice()
    .reverse();
  const mostrar = nq || filtro ? resultados : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Gestionar reservas</p>
        <div className="flex gap-1">
          <button className={btn} onClick={() => setNuevo(!nuevo)}>{nuevo ? "Cerrar" : "+ Lista de espera"}</button>
          <button className={btn} onClick={() => setVerCambios(!verCambios)}>Últimos cambios ({g.cambios.length})</button>
        </div>
      </div>

      {accion.aviso && (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[0.84rem] ${accion.aviso.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
          <span>{accion.aviso.texto}</span>
          {accion.aviso.enlace && <a href={accion.aviso.enlace.href} target="_blank" rel="noreferrer" className={btnFuerte}>Escribir por {accion.aviso.enlace.via} (texto preparado)</a>}
          <button onClick={() => accion.setAviso(null)} className="ml-auto text-[0.75rem] opacity-60">cerrar</button>
        </div>
      )}

      {nuevo && <NuevoEnEspera accion={accion} onHecho={() => setNuevo(false)} />}

      {listasEspera.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-2 text-[0.85rem] font-semibold text-amber-950">Listas de espera · por orden de llegada</p>
          <div className="grid gap-3 md:grid-cols-2">
            {listasEspera.map((x) => (
              <div key={x.lista + x.destino} className="rounded-xl bg-white p-3 text-[0.83rem]">
                <p className="mb-1 flex items-baseline justify-between gap-2">
                  <b className="text-gray-900">{x.titulo}</b>
                  <span className={x.quedan > 0 ? "text-emerald-700" : "text-gray-500"}>{x.quedan > 0 ? `${x.quedan} ${x.quedan === 1 ? "plaza libre" : "plazas libres"}: dale plaza al primero` : "completo"}</span>
                </p>
                <ol className="space-y-1.5">
                  {x.l.map((e, i) => {
                    const r = porId.get(e.id);
                    const p = r ? (x.lista === "taller" ? r.taller[e.idx] : r.micromagia[e.idx]) : null;
                    const t = textoPlaza(x.lista, x.destino, e.nombre, e.contacto, e.idioma);
                    return (
                      <li key={e.id + e.idx} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="w-5 tabular-nums text-gray-400">{i + 1}.</span>
                        <span className="text-gray-900">{e.nombre}</span>
                        {e.edad ? <span className="text-gray-500">{e.edad} años</span> : null}
                        <span className="text-gray-500">· {e.contacto}{e.telefono ? ` · ${e.telefono}` : e.email ? ` · ${e.email}` : ""}</span>
                        {e.nota && <span className="w-full pl-7 text-[0.75rem] text-gray-500">{e.nota}</span>}
                        <span className="w-full pl-7 text-[0.72rem] text-gray-400">desde {fecha(e.desde)}</span>
                        <span className="flex w-full gap-1 pl-7">
                          <button className={btnFuerte} disabled={accion.ocupado} onClick={() => accion.lanzar({ accion: "dar_plaza", id: e.id, lista: x.lista, idx: e.idx, nombre: p?.nombre ?? e.nombre }, `${e.nombre} ya tiene plaza. Avisa a la familia:`, enlaceAviso(e, t.asunto, t.cuerpo))}>Dar plaza</button>
                          {x.lista === "taller" && <DarPlazaEnOtro e={e} actual={x.destino} libres={libres.taller} nombre={p?.nombre ?? e.nombre} accion={accion} />}
                          <button className={btn} disabled={accion.ocupado} onClick={() => { const m = window.prompt(`Quitar a ${e.nombre} de la lista de espera. Motivo:`, "Ya no lo necesita"); if (m !== null) accion.lanzar({ accion: "quitar_espera", id: e.id, lista: x.lista, idx: e.idx, nombre: e.nombre, motivo: m }, `${e.nombre} quitado de la lista de espera.`); }}>Quitar</button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por niño/a, contacto o correo (p. ej. «Goicoechea», «izaskun»)" className="w-full border border-gray-300 px-3 py-2 text-[0.88rem]" />
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <button key={c.k} onClick={() => setFiltro(filtro === c.k ? "" : c.k)} className={`rounded-full px-2 py-0.5 text-[0.75rem] ring-1 ${filtro === c.k ? "bg-gray-900 text-white ring-gray-900" : "text-gray-700 ring-gray-300"}`}>{c.t}</button>
          ))}
        </div>
        {(nq || filtro) && (
          <p className="mt-2 text-[0.78rem] text-gray-500">{mostrar.length} {mostrar.length === 1 ? "formulario" : "formularios"}{mostrar.length > 40 ? " · se ven los 40 más recientes" : ""}</p>
        )}
        <div className="mt-2 space-y-2">
          {mostrar.slice(0, 40).map((r) => <TarjetaReserva key={r.id} r={r} libres={libres} accion={accion} />)}
        </div>
        {!nq && !filtro && <p className="mt-2 text-[0.78rem] text-gray-400">Escribe un nombre o elige un grupo u horario para ver sus reservas y poder anular, mover o corregir.</p>}
      </div>

      {verCambios && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-[0.82rem]">
          {g.cambios.length === 0 ? <p className="text-gray-400">Todavía no se ha tocado nada desde el panel.</p> : (
            <ul className="space-y-1">
              {g.cambios.map((c, i) => (
                <li key={i} className="flex flex-wrap gap-x-2"><span className="tabular-nums text-gray-400">{fecha(c.en)}</span><b className="text-gray-900">{c.nombre}</b><span className="text-gray-500">({c.contacto})</span><span className="text-gray-700">{c.que}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function MirariakTab() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const filtroClave = filtro;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/mirariak", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Error");
      else {
        setD(j);
        setError("");
      }
    } catch {
      setError("Sin conexión.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 120000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!d) return <p className="text-sm text-gray-400">{error || "Cargando Mirariak…"}</p>;
  const R = d.resumen;
  const libres = {
    taller: Object.fromEntries(d.taller.grupos.map((g) => [g.sesion, g.plazas - g.n])),
    micromagia: Object.fromEntries(d.micromagia.horarios.map((h) => [h.horario, h.plazas - h.n])),
  };
  const dias = Math.ceil((new Date("2026-11-14T10:00:00+01:00").getTime() - Date.now()) / 86400000);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Aita Agirre Kulturgunea · Elgoibar</p>
          <h2 className="text-[1.4rem] font-semibold text-gray-900">Reservas de un vistazo</h2>
          <p className="text-[0.82rem] text-gray-500">
            Taller el sábado 14 · micromagia el domingo 15{dias > 0 ? ` · faltan ${dias} días` : ""}
            {R.ultima ? ` · última reserva ${fecha(R.ultima)}` : ""}
          </p>
        </div>
        <button onClick={cargar} disabled={cargando} className="px-3 py-1.5 text-[0.82rem] text-gray-700 ring-1 ring-gray-300 disabled:opacity-40">
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra valor={R.personas_taller} etiqueta="Taller (sábado)" detalle={`de ${R.plazas_taller} plazas · ${pct(R.personas_taller, R.plazas_taller)} %`} />
        <Cifra valor={R.personas_micromagia} etiqueta="Micromagia (domingo)" detalle={`de ${R.plazas_micromagia} plazas · ${pct(R.personas_micromagia, R.plazas_micromagia)} %`} />
        <Cifra valor={`${pct(R.repiten_taller, R.personas_taller)} %`} etiqueta="Repiten del año pasado" detalle={`${R.repiten_taller} de ${R.personas_taller} en el taller`} />
        <Cifra valor={R.familias} etiqueta="Familias" detalle={`${R.formularios} formularios · ${R.en_las_dos} van a las dos`} />
      </section>

      {d.duplicados.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[0.85rem] text-amber-950">
          <p className="font-semibold">Posible reserva repetida ({d.duplicados.length})</p>
          <p className="mb-2 text-[0.8rem]">Mismo correo, mismos nombres y mismo horario: cuenta doble en las plazas. Si la familia confirma que fue un error, anula la repetida (la más nueva) y la plaza se libera.</p>
          <ul className="space-y-2">
            {d.duplicados.map((x) => (
              <li key={x.ids.join()} className="flex flex-wrap items-center gap-2">
                <span><b>{x.nombres.join(", ")}</b> · {x.contacto} ({x.email}) · {x.veces} veces: {x.fechas.map(fecha).join(" y ")}</span>
                <button onClick={() => { setFiltro(x.email); document.getElementById("mirariak-gestion")?.scrollIntoView({ behavior: "smooth" }); }} className="px-2 py-1 text-[0.75rem] ring-1 ring-amber-400">Ver las dos</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="mirariak-gestion">
        <Gestion key={filtroClave} inicial={filtro} g={d} libres={libres} recargar={cargar} />
      </div>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Taller · edades de todos los apuntados</p>
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
          <Rueda valores={d.taller.total} orden={d.franjas} tam={200} titulo="Todo el taller" />
          <div className="w-full max-w-sm">
            <Leyenda valores={d.taller.total} orden={d.franjas} />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Taller · cada grupo</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {d.taller.grupos.map((g) => (
            <article key={g.sesion} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div>
                <p className="text-[1rem] font-semibold text-gray-900">{g.nombre} · {g.edades}</p>
                <p className="text-[0.8rem] text-gray-500">Sábado 14 · {g.sesion}</p>
              </div>
              <div className="flex items-center gap-4">
                <Rueda valores={g.franjas} orden={d.franjas} tam={132} titulo={g.nombre} />
                <div className="min-w-0 flex-1">
                  <Leyenda valores={g.franjas} orden={d.franjas} />
                </div>
              </div>
              <Medidor plazas valor={g.n} max={g.plazas} etiqueta="Plazas" detalle={`${Math.max(g.plazas - g.n, 0)} libres`} />
              <Medidor valor={g.repiten} max={g.n || 1} etiqueta="Estuvieron el año pasado" detalle={g.n ? `${pct(g.repiten, g.n)} % · ${g.n - g.repiten} nuevos` : "—"} color="#1C3A5E" />
              <details className="text-[0.82rem] text-gray-700">
                <summary className="cursor-pointer text-gray-500">Ver quién va ({g.participantes.length})</summary>
                <ul className="mt-2 space-y-1">
                  {g.participantes
                    .slice()
                    .sort((a, b) => a.edad - b.edad || a.nombre.localeCompare(b.nombre))
                    .map((p, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span className="text-gray-900">{p.nombre}</span>
                        <span className="tabular-nums text-gray-500">{p.edad} años</span>
                        {p.repite && <span className="rounded-full bg-[#1C3A5E]/10 px-1.5 text-[0.72rem] text-[#1C3A5E]">repite</span>}
                        <span className="text-gray-400">· {p.contacto}</span>
                      </li>
                    ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Micromagia · domingo 15, por horario</p>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          {d.micromagia.horarios.map((h) => (
            <div key={h.horario}>
              <Medidor plazas valor={h.n} max={h.plazas} etiqueta={h.horario} detalle={`${Math.max(h.plazas - h.n, 0)} libres`} color={COLOR["7"]} />
              {h.participantes.length > 0 && (
                <details className="mt-1 text-[0.8rem] text-gray-700">
                  <summary className="cursor-pointer text-gray-400">Ver quién va ({h.participantes.length})</summary>
                  <p className="mt-1">{h.participantes.map((p) => p.nombre).join(" · ")}</p>
                </details>
              )}
            </div>
          ))}
          <p className="text-[0.75rem] text-gray-400">En micromagia el formulario no pide edad ni si vinieron el año pasado: solo el nombre.</p>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Ritmo · personas apuntadas cada semana</p>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <Ritmo semanas={d.semanas} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Idioma del formulario</p>
          <Medidor valor={R.idioma.eu ?? 0} max={R.formularios || 1} etiqueta="En euskera" detalle={`${pct(R.idioma.eu ?? 0, R.formularios)} % · ${R.idioma.es ?? 0} en castellano`} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-gray-400">Newsletter</p>
          <Medidor valor={R.con_newsletter} max={R.formularios || 1} etiqueta="Se apuntaron a la newsletter" detalle={`${pct(R.con_newsletter, R.formularios)} % de los formularios`} />
        </div>
      </section>

      <p className="text-[0.72rem] text-gray-400">Se actualiza solo cada 2 minutos · {fecha(d.actualizado)}</p>
    </div>
  );
}
