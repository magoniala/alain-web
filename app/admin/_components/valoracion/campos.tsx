"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NIVEL_ETIQUETA, type Datos, type Nivel } from "@/lib/valoracion";

// Todos los campos de la hoja leen y escriben en el mismo objeto `datos` a
// través de este contexto. Cada cambio llega a setMany, que es quien guarda
// (navegador al instante, servidor con un pequeño retardo).
type Ctx = { d: Datos; setMany: (cambios: Datos) => void; id?: string };
export const DatosCtx = createContext<Ctx>({ d: {}, setMany: () => {} });

export function useDatos() {
  const { d, setMany, id } = useContext(DatosCtx);
  return { d, set: (k: string, v: unknown) => setMany({ [k]: v }), setMany, id };
}

/** Entorno de la valoración: presencial (delante de la persona) u online (videollamada, lo de siempre). */
export function usePresencial() {
  const { d } = useContext(DatosCtx);
  return d.entorno === "Presencial";
}

/** Texto distinto según el entorno. */
export function Segun({ presencial, online }: { presencial: React.ReactNode; online: React.ReactNode }) {
  return <>{usePresencial() ? presencial : online}</>;
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


// ---------- fotos y vídeos (valoración presencial) ----------
//
// Cada test puede llevar sus capturas: se hacen con la cámara del móvil y
// suben al bucket privado `valoraciones` (API /api/admin/valoraciones/capturas).
// En datos quedan solo las rutas, en `capturas[test]`, con su tipo y hora.

export type Captura = { ruta: string; tipo: "foto" | "video"; en: string; nota?: string };

function cabeceras() {
  return { "Content-Type": "application/json", "x-admin-password": sessionStorage.getItem("admin_pw") || "" };
}

export function Capturas({ test, label = "Fotos y vídeos", pista }: { test: string; label?: string; pista?: string }) {
  const { d, set, id } = useDatos();
  const todas = (d.capturas ?? {}) as Record<string, Captura[]>;
  const lista = todas[test] ?? [];
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const rutas = lista.map((c) => c.ruta).join(",");

  useEffect(() => {
    if (!rutas) return;
    const faltan = lista.filter((c) => !urls[c.ruta]);
    if (!faltan.length) return;
    fetch(`/api/admin/valoraciones/capturas?rutas=${encodeURIComponent(faltan.map((c) => c.ruta).join(","))}`, { headers: cabeceras() })
      .then((r) => r.json())
      .then((j) => setUrls((u) => ({ ...u, ...(j.urls ?? {}) })))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutas]);

  async function subir(f: File, tipo: "foto" | "video") {
    if (!id) return setError("Guarda la valoración antes de subir fotos.");
    setSubiendo(tipo);
    setError("");
    try {
      const ext = (f.name.split(".").pop() ?? (tipo === "foto" ? "jpg" : "mp4")).toLowerCase();
      const r = await fetch("/api/admin/valoraciones/capturas", { method: "POST", headers: cabeceras(), body: JSON.stringify({ id, test, ext, tipo }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error");
      const up = await fetch(j.url, { method: "PUT", headers: { "Content-Type": f.type || (tipo === "foto" ? "image/jpeg" : "video/mp4") }, body: f });
      if (!up.ok) throw new Error(`No se pudo subir (${up.status})`);
      const nueva: Captura = { ruta: j.ruta, tipo, en: new Date().toISOString() };
      set("capturas", { ...todas, [test]: [...lista, nueva] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(null);
    }
  }
  async function quitar(c: Captura) {
    if (!window.confirm("¿Quitar esta captura?")) return;
    await fetch(`/api/admin/valoraciones/capturas?ruta=${encodeURIComponent(c.ruta)}`, { method: "DELETE", headers: cabeceras() }).catch(() => null);
    set("capturas", { ...todas, [test]: lista.filter((x) => x.ruta !== c.ruta) });
  }
  function nota(c: Captura, v: string) {
    set("capturas", { ...todas, [test]: lista.map((x) => (x.ruta === c.ruta ? { ...x, nota: v || undefined } : x)) });
  }

  return (
    <div>
      <span className={etiqueta}>{label}</span>
      {pista && <Pista>{pista}</Pista>}
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, "foto"); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, "video"); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => fotoRef.current?.click()} disabled={!!subiendo} className="border border-[#1a1a1a] px-3 py-2 text-[0.85rem] hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40">
          {subiendo === "foto" ? "Subiendo…" : "📷 Foto"}
        </button>
        <button type="button" onClick={() => videoRef.current?.click()} disabled={!!subiendo} className="border border-[#1a1a1a] px-3 py-2 text-[0.85rem] hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40">
          {subiendo === "video" ? "Subiendo…" : "🎥 Vídeo"}
        </button>
        {lista.length > 0 && <span className="self-center text-[0.8rem] text-gray-500">{lista.length} guardada{lista.length > 1 ? "s" : ""}</span>}
      </div>
      {error && <p className="mt-1 text-[0.8rem] text-red-700">{error}</p>}
      {lista.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {lista.map((c) => (
            <div key={c.ruta} className="w-[7.5rem]">
              <a href={urls[c.ruta] ?? "#"} target="_blank" rel="noreferrer" className="block h-[7.5rem] overflow-hidden rounded-lg bg-gray-100">
                {urls[c.ruta] ? (
                  c.tipo === "foto" ? <img src={urls[c.ruta]} alt="" className="h-full w-full object-cover" /> : <video src={urls[c.ruta]} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <span className="flex h-full items-center justify-center text-[0.75rem] text-gray-400">{c.tipo === "foto" ? "📷" : "🎥"}</span>
                )}
              </a>
              <input value={c.nota ?? ""} onChange={(e) => nota(c, e.target.value)} placeholder="nota (lateral, 2.ª rep…)" className="mt-1 w-full border border-gray-200 px-1.5 py-1 text-[0.75rem]" />
              <button type="button" onClick={() => quitar(c)} className="mt-0.5 text-[0.72rem] text-gray-400 hover:text-red-600">quitar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
