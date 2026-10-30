// Sistema automático · carril charlas. Tipos, constantes y utilidades
// compartidas por las rutas /api/admin/charlas/*, el panel y los crons.
//
// Esquema: charlas.sql. Diseño: 01 - PROYECTOS/🤖 Sistema automático/
// Sistema · Arquitectura v1 — carril charlas.md (en el vault).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;
export function supabaseCharlas() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

// ---------------------------------------------------------------------------
// Estados del CRM, tal cual se escriben en las fichas. El orden importa: es
// el del embudo. Los dos "3.x" son subestados que Alain añadió sobre la
// marcha; se respetan tal cual.
// ---------------------------------------------------------------------------
export const ESTADOS = [
  "0 Por llamar",
  "1 Llamando",
  "2 Contacto conseguido",
  "3 Mail inicial enviado",
  "3.5 recordatorio 1 enviado",
  "3.9 reenviado - pendiente",
  "4 Ha respondido",
  "5 Dossier enviado",
  "6 en conversación",
  "7 Ganado",
  "8 Perdido",
  "9 Aparcado (con fecha de reactivación)",
] as const;

/** Número de fase del embudo (0-9) a partir del texto del estado. */
export function faseDeEstado(estado: string | null | undefined): number {
  const m = /^(\d+(?:\.\d+)?)/.exec(estado ?? "");
  return m ? Math.floor(Number(m[1])) : -1;
}

/** Idioma en el que se escribe a un centro, según la regla del Flujo. */
export function idiomaDeCentro(euskera: string | null | undefined): "eu" | "eu+es" | "es" {
  if (euskera === "sí" || euskera === "si") return "eu";
  if (euskera === "parcial") return "eu+es";
  return "es";
}

export type NivelAutonomia = "A" | "B" | "C";

export interface Centro {
  id: string;
  nombre: string;
  codigo: string | null;
  territorio: string | null;
  localidad: string | null;
  tipo: string | null;
  tipo_centro: string | null;
  modelo_linguistico: string | null;
  euskera: string | null;
  etapas: string[];
  etapas_confirmadas: string | null;
  direccion: string | null;
  telefono: string | null;
  email_centro: string | null;
  web: string | null;
  prioridad: string | null;
  estado: string;
  origen: string | null;
  via: string | null;
  responsable: string | null;
  responsable_cargo: string | null;
  responsable_email: string | null;
  responsable_tel: string | null;
  ampa: string | null;
  ampa_contacto: string | null;
  ampa_email: string | null;
  calendario_abierto: string | null;
  intentos_llamada: number;
  mails_enviados: number;
  fecha_ultimo_contacto: string | null;
  proxima_accion: string | null;
  bloqueado_por: string | null;
  fecha_proxima_accion: string | null;
  fecha_creacion: string | null;
  ficha_cliente: string | null;
  notas: string | null;
  secciones_extra: Record<string, string>;
  nivel_autonomia: NivelAutonomia;
  creado_en: string;
  actualizado_en: string;
  actualizado_por: string;
}

export interface Interaccion {
  id: string;
  centro_id: string;
  fecha: string | null;
  canal: string | null;
  texto: string;
  raw: string | null;
  orden: number;
  origen: string;
  mensaje_id: string | null;
  creado_en: string;
}

// Campos del frontmatter que viajan tal cual entre la ficha y la fila.
// El orden es el de la ficha: el espejo lo usa para escribirlas igual.
export const CAMPOS_FRONTMATTER = [
  "codigo",
  "territorio",
  "localidad",
  "tipo",
  "tipo_centro",
  "modelo_linguistico",
  "euskera",
  "etapas",
  "etapas_confirmadas",
  "direccion",
  "telefono",
  "email_centro",
  "web",
  "prioridad",
  "estado",
  "origen",
  "via",
  "responsable",
  "responsable_cargo",
  "responsable_email",
  "responsable_tel",
  "ampa",
  "ampa_contacto",
  "ampa_email",
  "calendario_abierto",
  "intentos_llamada",
  "mails_enviados",
  "fecha_ultimo_contacto",
  "proxima_accion",
  "bloqueado_por",
  "fecha_proxima_accion",
  "fecha_creacion",
  "ficha_cliente",
] as const;

export type CampoFrontmatter = (typeof CAMPOS_FRONTMATTER)[number];

// Campos que solo se escriben en la ficha si tienen valor (en el vault no
// aparecen en las fichas que no los usan).
export const CAMPOS_OPCIONALES: ReadonlySet<string> = new Set(["via", "bloqueado_por", "ficha_cliente"]);

/** Normaliza lo que llega del YAML del vault a lo que guarda la tabla. */
export function normalizarFrontmatter(fm: Record<string, unknown>): Partial<Centro> {
  const texto = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  const entero = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };
  const fecha = (v: unknown): string | null => {
    const s = texto(v);
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  const etapas = Array.isArray(fm.etapas) ? fm.etapas.map((e) => String(e)) : fm.etapas ? [String(fm.etapas)] : [];

  return {
    codigo: texto(fm.codigo),
    territorio: texto(fm.territorio),
    localidad: texto(fm.localidad),
    tipo: texto(fm.tipo),
    tipo_centro: texto(fm.tipo_centro),
    modelo_linguistico: texto(fm.modelo_linguistico),
    euskera: texto(fm.euskera),
    etapas,
    etapas_confirmadas: texto(fm.etapas_confirmadas),
    direccion: texto(fm.direccion),
    telefono: texto(fm.telefono),
    email_centro: texto(fm.email_centro),
    web: texto(fm.web),
    prioridad: texto(fm.prioridad),
    estado: texto(fm.estado) ?? "0 Por llamar",
    origen: texto(fm.origen),
    via: texto(fm.via),
    responsable: texto(fm.responsable),
    responsable_cargo: texto(fm.responsable_cargo),
    responsable_email: texto(fm.responsable_email),
    responsable_tel: texto(fm.responsable_tel),
    ampa: texto(fm.ampa),
    ampa_contacto: texto(fm.ampa_contacto),
    ampa_email: texto(fm.ampa_email),
    calendario_abierto: texto(fm.calendario_abierto),
    intentos_llamada: entero(fm.intentos_llamada),
    mails_enviados: entero(fm.mails_enviados),
    fecha_ultimo_contacto: fecha(fm.fecha_ultimo_contacto),
    proxima_accion: texto(fm.proxima_accion),
    bloqueado_por: texto(fm.bloqueado_por),
    fecha_proxima_accion: fecha(fm.fecha_proxima_accion),
    fecha_creacion: fecha(fm.fecha_creacion),
    ficha_cliente: texto(fm.ficha_cliente),
  };
}

// ---------------------------------------------------------------------------
// Urgencia de una tarea: 3 = ahora (rojo), 2 = hoy (naranja), 1 = cuando puedas (verde).
// Reglas fijas, no IA: lo que más vale es contestar rápido a quien quiere
// cerrar; lo que menos, un recordatorio que el Flujo ya tiene programado.
// ---------------------------------------------------------------------------
export function puntuarUrgencia(t: {
  tipo: string;
  nivel: "A" | "B" | "C";
  clasificacion?: string | null;
  estadoCentro?: string | null;
  adjuntarDossier?: boolean;
  necesitaAlain?: boolean;
}): { urgencia: 1 | 2 | 3; motivo: string } {
  const c = t.clasificacion ?? "";
  const fase = faseDeEstado(t.estadoCentro);

  if (c === "interesado_fechas") return { urgencia: 3, motivo: "Quiere hablar de fechas: lead caliente" };
  if (fase === 6 && t.tipo === "respuesta") return { urgencia: 3, motivo: "Responde un centro en conversación" };
  if (c === "pregunta_precio") return { urgencia: 3, motivo: "Pregunta precio: está decidiendo" };
  if (c === "pide_contacto_ayuntamiento") return { urgencia: 2, motivo: "Vía ayuntamiento: abre un canal nuevo" };
  if (c === "pide_info" || c === "calendario_abierto" || t.tipo === "dossier") return { urgencia: 2, motivo: "Pide el dossier: cuanto antes llegue, mejor" };
  if (c === "lo_decide_otro" || c === "reenviado_a") return { urgencia: 2, motivo: "Hay una persona nueva en el hilo" };
  if (t.tipo === "seguimiento_conversacion") return { urgencia: 2, motivo: "Conversación que se enfría" };
  if (t.tipo === "llamada_alain") return { urgencia: 2, motivo: "Llamada pendiente" };
  if (c === "no_interesa") return { urgencia: 1, motivo: "Un no: cerrar con calma y anotar el motivo" };
  if (t.tipo === "respuesta") return { urgencia: 2, motivo: "Han respondido" };
  return { urgencia: 1, motivo: "Paso programado del Flujo" };
}
