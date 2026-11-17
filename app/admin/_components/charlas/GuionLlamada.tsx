"use client";

// Guion de llamada dentro de la tarjeta de un centro (pestaña Charlas › CRM).
// Enseña lo que hay que decir según el estado de la ficha y el idioma del
// centro, los datos justos para no abrir la ficha, y al colgar un botón por
// resultado que deja escritos estado, próxima acción y Registro.
// Textos: vault › Vías/Charlas/Guiones (lib/charlas-guiones.ts).

import { useMemo, useState } from "react";
import {
  RESULTADOS,
  TITULOS_GUION,
  aplicarResultado,
  idiomaLlamada,
  type Bloque,
  type ClaveGuion,
  type DatosResultado,
  type Guion,
} from "@/lib/charlas-guiones";

export interface CentroGuion {
  id: string;
  nombre: string;
  estado: string;
  euskera: string | null;
  telefono: string | null;
  responsable: string | null;
  responsable_cargo?: string | null;
  intentos_llamada: number | null;
  fecha_ultimo_contacto: string | null;
}

interface Props {
  centro: CentroGuion;
  clave: ClaveGuion;
  guiones: Partial<Record<ClaveGuion, Guion>>;
  avisoGuiones: string;
  registro: { fecha: string | null; canal: string | null; texto: string }[] | null;
  onGuardar: (cambios: Record<string, unknown>, registro: string) => Promise<boolean>;
}

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};
const hace = (iso: string) => {
  const dias = Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400000);
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : dias < 14 ? `hace ${dias} días` : `hace ${Math.round(dias / 7)} semanas`;
};

export default function GuionLlamada({ centro, clave, guiones, avisoGuiones, registro, onGuardar }: Props) {
  const inicial = idiomaLlamada(centro.euskera);
  const [idioma, setIdioma] = useState<"es" | "eu">(inicial.idioma);
  const guion = guiones[clave];
  const objeciones = clave !== "objeciones" ? guiones.objeciones : undefined;

  // Lo que hay que saber antes de marcar, sacado del Registro.
  const datos = useMemo(() => {
    const d: string[] = [];
    if (centro.responsable) d.push(`${centro.responsable}${centro.responsable_cargo ? ` (${centro.responsable_cargo})` : ""}`);
    else if (centro.responsable_cargo) d.push(centro.responsable_cargo);
    if (clave === "conserjeria") d.push(`intento ${(centro.intentos_llamada ?? 0) + 1}/3`);
    if (registro) {
      const mails = registro.filter((r) => r.fecha && /^mail/i.test(r.canal ?? ""));
      const primero = mails[0];
      const dossier = [...mails].reverse().find((r) => /dossier|mail 2/i.test(r.texto));
      if (primero?.fecha && clave !== "conserjeria") d.push(`primer mail ${fmt(primero.fecha)} (${hace(primero.fecha)})`);
      if (dossier?.fecha && (clave === "seguimiento-dossier" || clave === "cerrar-fecha")) d.push(`dossier ${fmt(dossier.fecha)} (${hace(dossier.fecha)})`);
      const franja = [...registro].reverse().find((r) => /franja|a partir de las|sobre las \d|mejor (a|por) la/i.test(r.texto));
      if (franja) d.push(`ojo: «${franja.texto.slice(0, 90)}»`);
    } else if (centro.fecha_ultimo_contacto) {
      d.push(`último contacto ${fmt(centro.fecha_ultimo_contacto)}`);
    }
    return d;
  }, [centro, clave, registro]);

  const bloques = guion ? (idioma === "eu" && guion.eu.length ? guion.eu : guion.es) : [];
  const sinEuskera = idioma === "eu" && guion && !guion.eu.length;
  const [apertura, ...resto] = bloques;

  return (
    <div className="border-t border-dashed border-gray-200 bg-[#fbf9f5] px-4 py-3 text-[0.86rem]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#0F2240]">📞 {TITULOS_GUION[clave]}</span>
        {centro.telefono && (
          <a href={`tel:${centro.telefono.replace(/[^\d+]/g, "")}`} className="rounded-full bg-[#0F2240] px-2.5 py-0.5 text-[0.8rem] text-white">
            {centro.telefono}
          </a>
        )}
        <span className="ml-auto flex overflow-hidden rounded-full ring-1 ring-gray-300">
          {(["eu", "es"] as const).map((i) => (
            <button key={i} onClick={() => setIdioma(i)} className={`px-2 py-0.5 text-[0.75rem] ${idioma === i ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}>
              {i.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      {datos.length > 0 && <p className="mb-2 text-[0.78rem] text-gray-600">{datos.join(" · ")}</p>}

      {!guion && <p className="text-[0.8rem] text-amber-700">{avisoGuiones || "Este guion aún no se ha subido desde el vault."}</p>}
      {sinEuskera && <p className="mb-1 text-[0.75rem] text-amber-700">Este guion no tiene versión en euskera: va en castellano.</p>}

      {apertura && (
        <div className="mb-2 rounded-xl bg-white p-3 ring-1 ring-gray-200">
          <p className="mb-1 text-[0.72rem] uppercase tracking-wide text-gray-500">{apertura.titulo}</p>
          <Lineas lineas={apertura.lineas} grande />
        </div>
      )}
      <div className="space-y-1">
        {resto.map((b, i) => (
          <Plegable key={i} bloque={b} />
        ))}
      </div>

      {objeciones && (objeciones.es.length > 0 || objeciones.eu.length > 0) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.8rem] font-medium text-gray-700">Objeciones</summary>
          <div className="mt-1 space-y-1 pl-2">
            {(idioma === "eu" ? objeciones.eu : objeciones.es).map((b, i) => (
              <Plegable key={i} bloque={b} />
            ))}
            {idioma === "eu" && (
              <details>
                <summary className="cursor-pointer text-[0.78rem] text-gray-500">Resto, solo en castellano</summary>
                <div className="mt-1 space-y-1 pl-2">
                  {objeciones.es.map((b, i) => (
                    <Plegable key={i} bloque={b} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </details>
      )}

      {guion && guion.notas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.78rem] text-gray-500">Para qué es esta llamada</summary>
          <div className="mt-1 space-y-1 pl-2 text-[0.8rem] text-gray-600">
            {guion.notas.map((b, i) => (
              <p key={i}>
                <span className="font-medium">{b.titulo}</span> {b.lineas.join(" ")}
              </p>
            ))}
          </div>
        </details>
      )}

      <AlColgar centro={centro} clave={clave} onGuardar={onGuardar} />
    </div>
  );
}

function Plegable({ bloque }: { bloque: Bloque }) {
  return (
    <details className="rounded-lg bg-white/70 px-2.5 py-1.5 ring-1 ring-gray-100">
      <summary className="cursor-pointer text-[0.82rem] text-gray-800">{bloque.titulo}</summary>
      <div className="mt-1">
        <Lineas lineas={bloque.lineas} />
      </div>
    </details>
  );
}

// Lo que va entre comillas es lo que se dice (oscuro); el resto, instrucciones (gris).
function Lineas({ lineas, grande }: { lineas: string[]; grande?: boolean }) {
  return (
    <div className="space-y-1">
      {lineas.map((l, i) => {
        const [dicho, ...nota] = l.split(" → ");
        const esDicho = /^(\d+\.\s*)?["“«]/.test(dicho);
        return (
          <p key={i} className={esDicho ? (grande ? "text-[1rem] leading-snug text-gray-900" : "text-gray-900") : "text-[0.8rem] text-gray-600"}>
            {dicho}
            {nota.length > 0 && <span className="text-[0.78rem] text-gray-500"> → {nota.join(" → ")}</span>}
          </p>
        );
      })}
    </div>
  );
}

function AlColgar({ centro, clave, onGuardar }: { centro: CentroGuion; clave: ClaveGuion; onGuardar: Props["onGuardar"] }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [d, setD] = useState<DatosResultado>({});
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState("");
  const hoy = new Date().toISOString().slice(0, 10);
  const resultado = RESULTADOS[clave].find((r) => r.id === elegido);
  const aplicacion = elegido ? aplicarResultado(clave, elegido, centro, d, hoy) : null;
  const fechaDefecto = resultado?.fechaPorDefecto?.(hoy) ?? "";

  async function guardar() {
    if (!aplicacion || "error" in aplicacion) return;
    setGuardando(true);
    const ok = await onGuardar(aplicacion.cambios, aplicacion.registro);
    setGuardando(false);
    if (ok) {
      setHecho(aplicacion.resumen || "Guardado");
      setElegido(null);
      setD({});
    }
  }

  const campo = "w-full border border-gray-300 bg-white px-2 py-1 text-[0.82rem]";
  return (
    <div className="mt-3 border-t border-gray-200 pt-2">
      <p className="mb-1.5 text-[0.75rem] uppercase tracking-wide text-gray-500">Al colgar</p>
      <div className="flex flex-wrap gap-1.5">
        {RESULTADOS[clave].map((r) => (
          <button
            key={r.id}
            onClick={() => { setElegido(elegido === r.id ? null : r.id); setD({}); setHecho(""); }}
            className={`rounded-full px-2.5 py-1 text-[0.78rem] ring-1 ${elegido === r.id ? "bg-[#0F2240] text-white ring-[#0F2240]" : "bg-white text-gray-700 ring-gray-300"}`}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>
      {hecho && <p className="mt-2 text-[0.8rem] text-green-700">✓ Guardado · {hecho}</p>}

      {resultado && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-white p-2.5 ring-1 ring-gray-200">
          {resultado.campos.includes("contacto") && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              <input className={campo} placeholder="Nombre" value={d.nombre ?? ""} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
              <input className={campo} placeholder="Cargo (jefatura, orientación…)" value={d.cargo ?? ""} onChange={(e) => setD({ ...d, cargo: e.target.value })} />
              {resultado.id !== "solo-cargo" && <input className={campo} type="email" placeholder="Correo" value={d.email ?? ""} onChange={(e) => setD({ ...d, email: e.target.value })} />}
              {clave === "conserjeria" && <input className={campo} type="email" placeholder="Correo del AMPA (si lo dan)" value={d.ampa_email ?? ""} onChange={(e) => setD({ ...d, ampa_email: e.target.value })} />}
            </div>
          )}
          {resultado.campos.includes("fecha") && (
            <label className="flex items-center gap-2 text-[0.8rem] text-gray-700">
              {resultado.fechaEtiqueta ?? "Fecha"}
              <input type="date" className="border border-gray-300 px-2 py-1 text-[0.82rem]" value={d.fecha ?? fechaDefecto} onChange={(e) => setD({ ...d, fecha: e.target.value })} />
            </label>
          )}
          {resultado.campos.includes("nota") && (
            <input
              className={campo}
              placeholder={resultado.notaObligatoria ?? (resultado.id === "no-esta" ? "Franja o recado (opcional): «mejor a partir de las 11»…" : "Nota para el Registro (opcional)")}
              value={d.nota ?? ""}
              onChange={(e) => setD({ ...d, nota: e.target.value })}
            />
          )}
          {aplicacion && "error" in aplicacion ? (
            <p className="text-[0.78rem] text-amber-700">{aplicacion.error}</p>
          ) : (
            aplicacion && (
              <p className="text-[0.78rem] text-gray-600">
                {aplicacion.resumen}
                <br />
                <span className="text-gray-500">Registro: «{aplicacion.registro}»</span>
              </p>
            )
          )}
          <button
            onClick={guardar}
            disabled={guardando || !aplicacion || "error" in aplicacion}
            className="bg-[#0F2240] px-3 py-1.5 text-[0.82rem] text-white disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar en la ficha"}
          </button>
        </div>
      )}
    </div>
  );
}
