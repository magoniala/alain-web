"use client";

import { generarInforme } from "@/lib/valoracion";
import { Area, Badge, useDatos } from "./campos";

// El informe que sale solo de lo apuntado. Está pensado para poder enseñarlo
// en pantalla compartida en el cierre: no muestra notas internas (clima,
// frases para copy, rapport…), solo resultados y lo que la persona ha dicho
// que quiere.
export default function Informe({ grande = false }: { grande?: boolean }) {
  const { d } = useDatos();
  const inf = generarInforme(d);
  const cliente = typeof d.cliente === "string" && d.cliente.trim() ? d.cliente.trim() : "Sin nombre";
  const vacio = !inf.bloques.length && !inf.objetivos.length;

  return (
    <div className={grande ? "text-[1.02rem]" : ""}>
      <div className="mb-5">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">Valoración inicial</p>
        <p className={`${grande ? "text-[1.7rem]" : "text-[1.25rem]"} font-semibold`}>{cliente}</p>
        {typeof d.fecha === "string" && d.fecha && <p className="text-[0.85rem] text-gray-500">{d.fecha}</p>}
      </div>

      {inf.alertas.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {inf.alertas.map((a, i) => (
            <p key={i} className="border-l-[3px] border-[#B3261E] bg-[#FDECEB] px-3 py-2 text-[0.88rem] text-[#8c1d18]">
              {a}
            </p>
          ))}
        </div>
      )}

      {vacio && <p className="text-[0.9rem] text-gray-400">Aún no hay resultados. Se va rellenando según apuntas los tests.</p>}

      {(inf.fuertes.length > 0 || inf.trabajar.length > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border border-[#BFE3C8] bg-[#F3FAF5] p-4">
            <p className="mb-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#1E7B3A]">Puntos fuertes</p>
            {inf.fuertes.length ? (
              <ul className="space-y-1 text-[0.92rem]">
                {inf.fuertes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.85rem] text-gray-400">—</p>
            )}
          </div>
          <div className="border border-[#F2DBA6] bg-[#FFFAF0] p-4">
            <p className="mb-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#9A6400]">A trabajar</p>
            {inf.trabajar.length ? (
              <ul className="space-y-1 text-[0.92rem]">
                {inf.trabajar.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.85rem] text-gray-400">—</p>
            )}
          </div>
        </div>
      )}

      {inf.bloques.map((b) => (
        <div key={b.titulo} className="mb-5">
          <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-[#2B4C7E]">{b.titulo}</p>
          <div className="divide-y divide-gray-100 border border-gray-200 bg-white">
            {b.items.map((it) => (
              <div key={it.titulo} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-3 py-2.5">
                <p className="font-medium">{it.titulo}</p>
                <p className="text-right tabular-nums">{it.valor}</p>
                <p className="text-[0.85rem] text-gray-500">{it.lectura}</p>
                <div className="text-right">
                  <Badge nivel={it.nivel} />
                </div>
                {it.nota && <p className="col-span-2 text-[0.8rem] italic text-gray-400">{it.nota}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {inf.objetivos.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-[#2B4C7E]">Lo que me has contado</p>
          <div className="space-y-2 border border-gray-200 bg-white p-3">
            {inf.objetivos.map((o) => (
              <p key={o.etiqueta} className="text-[0.92rem]">
                <span className="mr-2 text-[0.72rem] uppercase tracking-[0.12em] text-gray-400">{o.etiqueta}</span>
                «{o.texto}»
              </p>
            ))}
          </div>
        </div>
      )}

      <Area
        k="informeNotas"
        label="Mi lectura / feedback para la persona"
        rows={4}
        pista="Lo que le cuentas en el cierre. Se guarda con la valoración y sirve de base para la ficha."
      />
    </div>
  );
}
