// MIRARIAK 2026 · reglas comunes de las reservas (formulario público, aforo y panel).
//
// Cada fila de mirariak2026_reservas es un formulario. Los participantes viven
// en dos listas jsonb (taller y micromagia) y cada participante puede llevar,
// además de lo que manda el formulario, estas marcas que pone el panel:
//   anulada  → ya no ocupa plaza (queda en la fila para el historial; se puede reactivar)
//   espera   → está en lista de espera de ese grupo/horario: no ocupa plaza
//   cambios  → historial de lo que se le ha hecho desde el panel
//   llegada  → ha entrado el día del evento (control de entrada en la puerta)
// Así no hace falta tocar el esquema de la tabla.

export const GRUPOS = [
  { sesion: "10:00 – 10:55", nombre: "Grupo 1", edades: "6-7 años" },
  { sesion: "11:10 – 12:05", nombre: "Grupo 2", edades: "8-10 años" },
  { sesion: "12:20 – 13:15", nombre: "Grupo 3", edades: "11 años o más" },
] as const;
export const TALLER_SESIONES = GRUPOS.map((g) => g.sesion) as string[];
export const HORARIOS_MM = ["10:00 – 10:30", "11:00 – 11:30", "12:00 – 12:30", "17:30 – 18:00", "18:30 – 19:00"];
export const PLAZAS_TALLER = 16;
export const PLAZAS_MM = 20;

export interface Cambio { en: string; que: string }
export interface Marcas {
  anulada?: { en: string; motivo: string } | null;
  espera?: { desde: string; telefono?: string; nota?: string } | null;
  cambios?: Cambio[];
  llegada?: { en: string } | null;
}
export interface ParticipanteTaller extends Marcas { nombre: string; edad: number; anio_pasado?: boolean; sesion_asignada?: string }
export interface ParticipanteMm extends Marcas { nombre: string }
export interface FilaReserva {
  id: string;
  nombre_contacto: string;
  email: string;
  actividad: string;
  participantes_taller: ParticipanteTaller[] | null;
  participantes_micromagia: ParticipanteMm[] | null;
  horario_micromagia: string | null;
  newsletter: boolean | null;
  idioma: string | null;
  created_at: string;
}

/** ¿Ocupa plaza? Ni las anuladas ni las de lista de espera. */
export const ocupa = (p: Marcas | null | undefined) => !!p && !p.anulada && !p.espera;

/** Plazas ocupadas por sesión de taller y por horario de micromagia. */
export function contarOcupadas(filas: Pick<FilaReserva, "participantes_taller" | "participantes_micromagia" | "horario_micromagia">[]) {
  const taller: Record<string, number> = Object.fromEntries(TALLER_SESIONES.map((s) => [s, 0]));
  const micromagia: Record<string, number> = Object.fromEntries(HORARIOS_MM.map((h) => [h, 0]));
  for (const r of filas) {
    for (const p of r.participantes_taller ?? []) {
      if (ocupa(p) && p.sesion_asignada && p.sesion_asignada in taller) taller[p.sesion_asignada]++;
    }
    const h = r.horario_micromagia;
    if (h && h in micromagia) micromagia[h] += (r.participantes_micromagia ?? []).filter(ocupa).length;
  }
  return { taller, micromagia };
}
