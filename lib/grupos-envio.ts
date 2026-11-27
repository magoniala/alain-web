// Envíos a grupos de contactos (/admin → Newsletter → Grupos).
//
// Un GRUPO es una entrada de GRUPOS: nombre, explicación y una función que
// devuelve a quién le llegaría (un correo por persona, con su idioma) y a
// quién no y por qué. Para añadir un grupo nuevo (asistentes a un show,
// entrados por tumisión…) basta con añadir una entrada aquí: el panel y el
// endpoint los recorren solos.
//
// Nada de esto apunta a nadie a la newsletter ni a ninguna secuencia.

import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ocupa, type FilaReserva } from "./mirariak";
import { EMAIL_RE, type Destinatario, type Excluido, type Idioma } from "./grupos-envio-html";

export interface Grupo {
  clave: string;
  nombre: string;
  descripcion: string;
  cargar: (sb: SupabaseClient) => Promise<{ destinatarios: Destinatario[]; excluidos: Excluido[] }>;
}

const limpio = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const idiomaDe = (i: string | null | undefined): Idioma => (i === "es" ? "es" : "eu");

// --- Talleres de Mirariak -------------------------------------------------
// Familias con al menos un niño de taller que ocupe plaza (ni anulado ni en
// lista de espera: la misma regla que el aforo, `ocupa`). Una persona = un
// correo, aunque tenga varios niños o varias reservas. Idioma: el de su
// reserva de taller más reciente.
async function talleresMirariak(sb: SupabaseClient) {
  const { data, error } = await sb.from("mirariak2026_reservas").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const porEmail = new Map<string, FilaReserva[]>();
  for (const r of (data ?? []) as FilaReserva[]) {
    const e = limpio(r.email);
    porEmail.set(e, [...(porEmail.get(e) ?? []), r]);
  }
  const destinatarios: Destinatario[] = [];
  const excluidos: Excluido[] = [];
  for (const [email, filas] of porEmail) {
    const nombre = (filas[filas.length - 1].nombre_contacto ?? "").trim();
    const conTaller = filas.filter((r) => (r.participantes_taller ?? []).some(ocupa));
    if (!conTaller.length) {
      const todos = filas.flatMap((r) => r.participantes_taller ?? []);
      const motivo = !todos.length
        ? "sin taller (solo micromagia)"
        : todos.some((p) => p.espera) ? "taller en lista de espera" : "taller anulado";
      excluidos.push({ email, nombre, motivo });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      excluidos.push({ email, nombre, motivo: "el correo no es válido" });
      continue;
    }
    const ultima = conTaller[conTaller.length - 1];
    const notas: string[] = [];
    // Niños distintos por nombre: una reserva repetida no los cuenta dos veces.
    const ninos = new Set(conTaller.flatMap((r) => (r.participantes_taller ?? []).filter(ocupa).map((p) => p.nombre.trim().toLowerCase()))).size;
    if (ninos > 1) notas.push(`${ninos} niños`);
    if (filas.length > 1) notas.push(`${filas.length} reservas`);
    if (new Set(conTaller.map((r) => idiomaDe(r.idioma))).size > 1) notas.push("idiomas distintos en sus reservas: va el de la última");
    destinatarios.push({ email, nombre, idioma: idiomaDe(ultima.idioma), notas });
  }
  return { destinatarios, excluidos };
}

// --- Plataforma de magia --------------------------------------------------
async function plataformaMagia(sb: SupabaseClient) {
  const { data, error } = await sb.from("magia_usuarios").select("email, idioma, librillo, created_at").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const destinatarios: Destinatario[] = [];
  const excluidos: Excluido[] = [];
  const vistos = new Set<string>();
  for (const u of (data ?? []) as { email: string; idioma: string | null; librillo: string | null }[]) {
    const email = limpio(u.email);
    if (vistos.has(email)) continue;
    vistos.add(email);
    if (!EMAIL_RE.test(email)) { excluidos.push({ email, nombre: "", motivo: "el correo no es válido" }); continue; }
    destinatarios.push({ email, nombre: "", idioma: idiomaDe(u.idioma), notas: u.librillo ? [`librillo ${u.librillo}`] : [] });
  }
  return { destinatarios, excluidos };
}

export const GRUPOS: Grupo[] = [
  {
    clave: "talleres-mirariak",
    nombre: "Talleres de Mirariak",
    descripcion: "Familias con algún niño en el taller de Mirariak 2026 (sin anulados ni lista de espera). Un correo por familia.",
    cargar: talleresMirariak,
  },
  {
    clave: "plataforma-magia",
    nombre: "Apuntados a la plataforma",
    descripcion: "Quien ha entrado en magia-tailerrak con su correo (tabla magia_usuarios).",
    cargar: plataformaMagia,
  },
];

export const grupoDe = (clave: unknown) => GRUPOS.find((g) => g.clave === clave) ?? null;

// --- Baja -----------------------------------------------------------------
// El enlace del pie lleva el correo y una firma: sin la firma no se puede dar
// de baja a otra persona cambiando el correo de la URL.
export function firmaBaja(email: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_KEY || "grupos")
    .update(`grupos-baja:${limpio(email)}`)
    .digest("hex")
    .slice(0, 32);
}

export function enlaceBaja(base: string, email: string, idioma: Idioma, clave: string): string {
  const q = new URLSearchParams({ e: limpio(email), t: firmaBaja(email), h: idioma, m: clave });
  return `${base}/correos/baja?${q.toString()}`;
}
