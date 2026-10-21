"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { NIVEL_ETIQUETA, type Datos, type Nivel } from "@/lib/valoracion";

// Todos los campos de la hoja leen y escriben en el mismo objeto `datos` a
// través de este contexto. Cada cambio llega a setMany, que es quien guarda
// (navegador al instante, servidor con un pequeño retardo).
type Ctx = { d: Datos; setMany: (cambios: Datos) => void };
export const DatosCtx = createContext<Ctx>({ d: {}, setMany: () => {} });

export function useDatos() {
  const { d, setMany } = useContext(DatosCtx);
  return { d, set: (k: string, v: unknown) => setMany({ [k]: v }), setMany };
}

const etiqueta = "block text-[0.72rem] font-medium uppercase tracking-[0.12em] text-gray-500 mb-1.5";
const caja =
  "w-full border border-gray-300 bg-white px-3 py-2 text-[0.92rem] outline-none transition-colors focus:border-[#1a1a1a]";

export function Pista({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[0.8rem] italic leading-snug text-gray-400">{children}</p>;
}

export function Texto({
  k,
  label,
  ph,
  className = "",
}: {
  k: string;
  label: string;
  ph?: string;
  className?: string;
}) {
  const { d, set } = useDatos();
  return (
    <label className={`block ${className}`}>
      <span className={etiqueta}>{label}</span>
      <input
        value={typeof d[k] === "string" ? (d[k] as string) : ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
        className={caja}
      />
    </label>
  );
}

// Números como texto: así se puede escribir «72,5» o dejarlo a medias sin
// que el campo se coma lo escrito. lib/valoracion los interpreta al leer.
export function Num({
  k,
  label,
  unidad,
  className = "",
  ph,
}: {
  k: string;
  label: string;
  unidad?: string;
  className?: string;
  ph?: string;
}) {
  const { d, set } = useDatos();
  return (
    <label className={`block ${className}`}>
      <span className={etiqueta}>{label}</span>
      <div className="flex items-center">
        <input
          inputMode="decimal"
          value={typeof d[k] === "string" ? (d[k] as string) : ""}
          onChange={(e) => set(k, e.target.value.replace(/[^\d.,-]/g, ""))}
          placeholder={ph}
          className={`${caja} tabular-nums`}
        />
        {unidad && <span className="ml-2 shrink-0 text-[0.8rem] text-gray-400">{unidad}</span>}
      </div>
    </label>
  );
}

// Crece con el texto, para no tener que hacer scroll dentro de la caja.
export function Area({
  k,
  label,
  rows = 2,
  pista,
  className = "",
}: {
  k: string;
  label: string;
  rows?: number;
  pista?: string;
  className?: string;
}) {
  const { d, set } = useDatos();
  const ref = useRef<HTMLTextAreaElement>(null);
  const valor = typeof d[k] === "string" ? (d[k] as string) : "";
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [valor]);
  return (
    <label className={`block ${className}`}>
      <span className={etiqueta}>{label}</span>
      {pista && <Pista>{pista}</Pista>}
      <textarea
        ref={ref}
        rows={rows}
        value={valor}
        onChange={(e) => set(k, e.target.value)}
        className={`${caja} resize-none leading-relaxed`}
      />
    </label>
  );
}

// Opciones en botones. Una sola: volver a pulsar la elegida la quita.
// Varias (multi): cada botón se marca y desmarca; `exclusiva` es la opción
// que no puede ir con las demás («estable» frente a «bamboleo»).
export function Chips({
  k,
  label,
  opciones,
  multi = false,
  exclusiva,
  className = "",
  pista,
}: {
  k: string;
  label?: string;
  opciones: readonly string[];
  multi?: boolean;
  exclusiva?: string;
  className?: string;
  pista?: string;
}) {
  const { d, set } = useDatos();
  const actual = d[k];
  const marcadas = multi ? (Array.isArray(actual) ? (actual as string[]) : []) : [];
  const elegida = !multi && typeof actual === "string" ? actual : "";

  function pulsar(o: string) {
    if (!multi) return set(k, elegida === o ? "" : o);
    if (marcadas.includes(o)) return set(k, marcadas.filter((x) => x !== o));
    if (o === exclusiva) return set(k, [o]);
    set(k, [...marcadas.filter((x) => x !== exclusiva), o]);
  }

  return (
    <div className={className}>
      {label && <span className={etiqueta}>{label}</span>}
      {pista && <Pista>{pista}</Pista>}
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => {
          const activa = multi ? marcadas.includes(o) : elegida === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => pulsar(o)}
              aria-pressed={activa}
              className={`rounded-full border px-3.5 py-1.5 text-[0.85rem] transition-colors ${
                activa
                  ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
              }`}
            >
              {multi && <span className="mr-1.5 text-[0.75rem]">{activa ? "☑" : "☐"}</span>}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const COLOR: Record<Nivel, string> = {
  bien: "bg-[#E7F4EA] text-[#1E7B3A] border-[#BFE3C8]",
  regular: "bg-[#FFF4DD] text-[#9A6400] border-[#F2DBA6]",
  mal: "bg-[#FDECEB] text-[#B3261E] border-[#F4C7C3]",
};

export function Badge({ nivel, texto }: { nivel: Nivel | null; texto?: string }) {
  if (!nivel) return texto ? <span className="text-[0.8rem] text-gray-500">{texto}</span> : null;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium ${COLOR[nivel]}`}>
      {texto ?? NIVEL_ETIQUETA[nivel]}
    </span>
  );
}

// Lo que la plantilla puntuaría con lo marcado hasta ahora. Es una
// sugerencia: la puntuación que vale es la que se elige al lado.
export function Sugerido({ nivel, motivo }: { nivel: Nivel | null; motivo?: string }) {
  if (!nivel) return null;
  return (
    <p className="mt-2 flex items-center gap-2 text-[0.8rem] text-gray-500">
      Sugerido <Badge nivel={nivel} />
      {motivo && <span>{motivo}</span>}
    </p>
  );
}

export function Seccion({
  id,
  titulo,
  tiempo,
  nota,
  children,
}: {
  id: string;
  titulo: string;
  tiempo?: string;
  nota?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-seccion={id} className="scroll-mt-20 rounded-2xl border lg:scroll-mt-6 border-gray-200 bg-white p-5 md:p-7">
      <h2 className="mb-1 flex flex-wrap items-baseline gap-x-3 text-[1.05rem] font-semibold text-[#1a1a1a]">
        {titulo}
        {tiempo && <span className="text-[0.78rem] font-normal text-gray-400">{tiempo}</span>}
      </h2>
      {nota && <p className="mb-4 text-[0.82rem] italic leading-snug text-gray-500">{nota}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function Sub({ titulo, nota, children }: { titulo: string; nota?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-[0.95rem] font-semibold text-[#0F2240]">{titulo}</h3>
      {nota && <p className="mb-3 text-[0.8rem] italic leading-snug text-gray-400">{nota}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Fila({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[cols];
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}

export function Aviso({ children, tono = "ambar" }: { children: React.ReactNode; tono?: "ambar" | "rojo" }) {
  const t =
    tono === "rojo" ? "border-[#B3261E] bg-[#FDECEB] text-[#8c1d18]" : "border-[#D4860A] bg-[#FFF7E6] text-[#7a4e00]";
  return <p className={`rounded-lg border-l-[3px] px-3 py-2 text-[0.85rem] leading-snug ${t}`}>{children}</p>;
}

// Frase memorizable de la cheat sheet, en el punto de la sesión en que se
// dice. Se lee de un vistazo: cursiva, con la línea ámbar a la izquierda.
export function Guion({ children, titulo = "Guion" }: { children: React.ReactNode; titulo?: string }) {
  return (
    <div className="rounded-lg border-l-[3px] border-[#C47800] bg-[#FBF6EE] px-3.5 py-2.5">
      <p className="mb-0.5 text-[0.68rem] font-medium uppercase text-[#C47800]">{titulo}</p>
      <div className="text-[0.88rem] italic leading-relaxed text-[#433d36]">{children}</div>
    </div>
  );
}
