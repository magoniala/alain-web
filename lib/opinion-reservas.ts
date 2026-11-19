// A quién se le pide la opinión después de un evento con reservas.
//
// Regla: un correo por persona (por dirección de correo), aunque reservara
// varias cosas o rellenara el formulario varias veces. Solo entra quien vino
// o quien tenía plaza en un pase donde no se controló la entrada (ahí no se
// puede saber si vino). Fuera: reservas anuladas, lista de espera que no
// entró y quien tenía plaza en un pase con control de entrada y no aparece.
//
// Todo esto es cálculo puro sobre las filas de la reserva: no envía nada ni
// apunta a nadie a ninguna lista.

import { EMAIL_RE, type Idioma } from "./opinion";
import { ocupa, type FilaReserva, type Marcas } from "./mirariak";

export type Destinatario = {
  email: string;
  nombre: string;
  idioma: Idioma;
  formularios: number;
  actividades: ("taller" | "micromagia")[];
  // entrada = consta que entró (control de la puerta). sin_control = tenía
  // plaza en un pase donde no se marcó la entrada: no se sabe si vino.
  asistencia: "entrada" | "sin_control";
};

export type Excluido = { email: string; nombre: string; motivo: string };

type Participacion = { lista: "taller" | "micromagia"; pase: string; p: Marcas };

// En un pase «hubo control de entrada» si al menos la mitad de quienes tenían
// plaza están marcados como llegados. Con menos, la puerta no se marcó (o se
// marcó a medias) y la falta de marca no quiere decir que no vinieran.
const UMBRAL_CONTROL = 0.5;

export function destinatariosDeReservas(filas: FilaReserva[]): { destinatarios: Destinatario[]; excluidos: Excluido[]; pasesConControl: string[]; pasesSinControl: string[] } {
  const partes = (r: FilaReserva): Participacion[] => [
    ...(r.participantes_taller ?? []).map((p) => ({ lista: "taller" as const, pase: `taller · ${p.sesion_asignada ?? "?"}`, p })),
    ...(r.participantes_micromagia ?? []).map((p) => ({ lista: "micromagia" as const, pase: `micromagia · ${r.horario_micromagia ?? "?"}`, p })),
  ];

  // ¿En qué pases se controló la entrada?
  const porPase = new Map<string, { plazas: number; llegadas: number }>();
  for (const r of filas) {
    for (const x of partes(r)) {
      if (!ocupa(x.p) && !x.p.llegada) continue;
      const c = porPase.get(x.pase) ?? { plazas: 0, llegadas: 0 };
      c.plazas++;
      if (x.p.llegada) c.llegadas++;
      porPase.set(x.pase, c);
    }
  }
  const conControl = new Set([...porPase].filter(([, c]) => c.plazas > 0 && c.llegadas / c.plazas >= UMBRAL_CONTROL).map(([k]) => k));

  // Una persona = una dirección de correo.
  const porEmail = new Map<string, FilaReserva[]>();
  for (const r of filas) {
    const email = (r.email ?? "").trim().toLowerCase();
    porEmail.set(email, [...(porEmail.get(email) ?? []), r]);
  }

  const destinatarios: Destinatario[] = [];
  const excluidos: Excluido[] = [];
  for (const [email, suyas] of porEmail) {
    const orden = suyas.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const ultima = orden[orden.length - 1];
    const nombre = (ultima.nombre_contacto ?? "").trim();
    if (!EMAIL_RE.test(email)) {
      excluidos.push({ email, nombre, motivo: "el correo no es válido" });
      continue;
    }
    const todo = suyas.flatMap(partes);
    const entro = todo.filter((x) => x.p.llegada);
    const sinControl = todo.filter((x) => !x.p.llegada && ocupa(x.p) && !conControl.has(x.pase));
    if (!entro.length && !sinControl.length) {
      const motivo = todo.some((x) => ocupa(x.p))
        ? "tenía plaza y no entró (pase con control de entrada)"
        : todo.some((x) => x.p.espera)
          ? "lista de espera, no entró"
          : todo.some((x) => x.p.anulada)
            ? "reserva anulada"
            : "sin participantes";
      excluidos.push({ email, nombre, motivo });
      continue;
    }
    const cuentan = entro.length ? [...entro, ...sinControl] : sinControl;
    destinatarios.push({
      email,
      nombre,
      idioma: ultima.idioma === "es" ? "es" : "eu",
      formularios: suyas.length,
      actividades: [...new Set(cuentan.map((x) => x.lista))].sort() as Destinatario["actividades"],
      asistencia: entro.length ? "entrada" : "sin_control",
    });
  }
  destinatarios.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  excluidos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const pases = [...porPase.keys()].sort();
  return { destinatarios, excluidos, pasesConControl: pases.filter((k) => conControl.has(k)), pasesSinControl: pases.filter((k) => !conControl.has(k)) };
}
