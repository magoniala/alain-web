"use client";

import { useState } from "react";

// Calendario de mes compartido por las dos páginas de reserva: la Hoja de
// Ruta (entrenatzaile.alainzulaika.com) y la de creadores.
//
// Aquí no hay ninguna regla de disponibilidad. Este componente recibe la
// lista de días que tienen hueco y la pinta; quién decide esa lista es
// lib/entrenatzaile-huecos.ts, en el servidor. Si algún día hubiera que
// cambiar cuándo se puede reservar, no es aquí.
//
// Lo único que cambia entre las dos páginas es el aspecto, y viaja en
// `estilo`: la de Entrenatzaile es crema con azul y ámbar, y la de creadores
// es la del sitio principal, negra con cian. Por eso no hay ni un color
// escrito en este archivo.

export interface EstiloCalendario {
  /** Botones ‹ › de cambio de mes. */
  flecha: string;
  /** "septiembre 2026". */
  titulo: string;
  /** Iniciales de los días de la semana. */
  cabecera: string;
  /** Día con hueco, pulsable. */
  libre: string;
  /** Día elegido. */
  elegido: string;
  /** Día sin hueco. */
  ocupado: string;
  /** Pie de leyenda. */
  leyenda: string;
  /** Cuadradito de muestra de la leyenda. */
  muestra: string;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Lunes primero: aquí las semanas no empiezan en domingo.
const CABECERA_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// Día de la semana del 1 de ese mes, con el lunes como 0.
function primerDiaSemana(anio: number, mes: number) {
  const d = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  return d === 0 ? 6 : d - 1;
}

function diasEnMes(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function sumarMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08-27" -> "jue 27 ago" */
export function etiquetaDia(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** De la etiqueta completa ("jueves, 27 de agosto · 10:30") solo la hora. */
export function soloHora(etiqueta: string) {
  return etiqueta.split("·").pop()?.trim() ?? etiqueta;
}

/**
 * Calendario de mes, con los días sin hueco apagados y tachados. Las flechas
 * solo se mueven entre meses que tienen algo que enseñar: no tiene sentido
 * dejar navegar a diciembre si solo se reserva a 30 días vista.
 */
export default function Calendario({
  dias,
  elegido,
  onElegir,
  estilo,
  textoSinDisponibilidad,
  textoLeyenda,
}: {
  dias: string[];
  elegido: string;
  onElegir: (dia: string) => void;
  estilo: EstiloCalendario;
  textoSinDisponibilidad: string;
  textoLeyenda: string;
}) {
  const primerMes = dias[0].slice(0, 7);
  const ultimoMes = dias[dias.length - 1].slice(0, 7);
  const [mes, setMes] = useState(primerMes);

  const disponibles = new Set(dias);
  const [anio, numMes] = mes.split("-").map(Number);
  const huecosDelante = primerDiaSemana(anio, numMes);
  const total = diasEnMes(anio, numMes);

  const celdas: (string | null)[] = [
    ...Array.from({ length: huecosDelante }, () => null),
    ...Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];

  const puedeAtras = mes > primerMes;
  const puedeAlante = mes < ultimoMes;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMes(sumarMes(mes, -1))}
          disabled={!puedeAtras}
          aria-label="Mes anterior"
          className={estilo.flecha}
        >
          ‹
        </button>
        <p className={estilo.titulo}>
          <span className="capitalize">{MESES[numMes - 1]}</span> {anio}
        </p>
        <button
          type="button"
          onClick={() => setMes(sumarMes(mes, 1))}
          disabled={!puedeAlante}
          aria-label="Mes siguiente"
          className={estilo.flecha}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {CABECERA_SEMANA.map((d, i) => (
          <div key={i} className={estilo.cabecera}>
            {d}
          </div>
        ))}

        {celdas.map((dia, i) => {
          if (!dia) return <div key={`v${i}`} />;
          const numero = Number(dia.slice(-2));
          const libre = disponibles.has(dia);
          const activo = elegido === dia;

          if (!libre) {
            return (
              <div key={dia} title={textoSinDisponibilidad} aria-disabled="true" className={estilo.ocupado}>
                {numero}
              </div>
            );
          }

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onElegir(dia)}
              aria-pressed={activo}
              className={activo ? estilo.elegido : estilo.libre}
            >
              {numero}
            </button>
          );
        })}
      </div>

      <p className={estilo.leyenda}>
        <span aria-hidden className={estilo.muestra} />
        {textoLeyenda}
      </p>
    </div>
  );
}
