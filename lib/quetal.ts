// Valoraciones de organizadores en alainzulaika.com/quetal.
//
// Aquí vive lo que comparten la página, el endpoint y /admin: los tipos de
// evento, qué preguntas lleva cada tipo, los valores internos de cada
// opción y los mensajes de WhatsApp. Los textos visibles están en
// quetal-textos.ts, en castellano y en euskera.

import { QUETAL_TEXTOS } from "./quetal-textos";

export type Idioma = "es" | "eu";
export const IDIOMAS: Idioma[] = ["eu", "es"];

// «jornadas» (fin de semana o jornadas con varias actividades, lo normal es
// que contrate un ayuntamiento) y «recurrente» (show periódico en un bar o
// sociedad) se añadieron el 19-11-2026: sql/opiniones_eventos.sql amplía el
// CHECK de las dos tablas.
export const TIPOS_EVENTO = ["familiar", "taller", "jornadas", "fiestas", "empresa", "feria", "externo", "hosteleria", "recurrente", "centro", "privado"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const REPETIR = ["proxima", "otro_tipo", "puede", "no"] as const;
export type Repetir = (typeof REPETIR)[number];

export const PERMISOS = ["completo", "entidad", "anonimo", "no"] as const;
export type Permiso = (typeof PERMISOS)[number];

export const ESTADOS = ["nuevo", "revisado", "aprobado_por_cliente", "publicado", "archivado"] as const;
export type Estado = (typeof ESTADOS)[number];

export const VALORACIONES = ["val_comunicacion", "val_promocional", "val_puntualidad", "val_adaptacion"] as const;
export type CampoValoracion = (typeof VALORACIONES)[number];

// Las claves de opción se comparten entre preguntas («si», «no»…). La
// etiqueta visible sale de QUETAL_TEXTOS[idioma].opciones.
export type Opcion = "si" | "no" | "nose" | "masomenos" | "bastante_mas" | "algo_mas" | "igual" | "nosabria" | "claramente" | "algo";

export type PreguntaTipo =
  | { id: string; tipo: "texto"; si?: { id: string; valor: Opcion } }
  | { id: string; tipo: "opcion"; opciones: Opcion[] };

const MAGIA_ANTES: PreguntaTipo[] = [
  { id: "magia_antes", tipo: "opcion", opciones: ["si", "no", "nose"] },
  { id: "magia_diferencia", tipo: "texto", si: { id: "magia_antes", valor: "si" } },
];

export const PREGUNTAS_TIPO: Record<TipoEvento, PreguntaTipo[]> = {
  familiar: [
    { id: "fam_ninos", tipo: "texto" },
    { id: "fam_adultos", tipo: "texto" },
    { id: "fam_familias", tipo: "texto" },
    ...MAGIA_ANTES,
  ],
  taller: [
    { id: "tal_vivencia", tipo: "texto" },
    { id: "tal_casa", tipo: "opcion", opciones: ["si", "masomenos", "no", "nose"] },
    { id: "tal_edades", tipo: "opcion", opciones: ["si", "masomenos", "no", "nose"] },
  ],
  // Fin de semana o jornadas (talleres + micromagia + shows): quien contrata
  // mira el programa entero, la organización (reservas, aforos) y si cumplió
  // lo que buscaba al programarlo.
  jornadas: [
    { id: "jor_mejor", tipo: "texto" },
    { id: "jor_publico", tipo: "texto" },
    { id: "jor_organizacion", tipo: "texto" },
    { id: "jor_objetivo", tipo: "opcion", opciones: ["claramente", "algo", "no", "nosabria"] },
    { id: "jor_ediciones", tipo: "texto" },
  ],
  fiestas: [{ id: "fie_grupos", tipo: "texto" }, ...MAGIA_ANTES],
  empresa: [{ id: "emp_ambiente", tipo: "texto" }],
  feria: [
    { id: "fer_stand", tipo: "opcion", opciones: ["bastante_mas", "algo_mas", "igual", "nosabria"] },
    { id: "fer_conversaciones", tipo: "texto" },
  ],
  externo: [
    { id: "ext_mensaje", tipo: "opcion", opciones: ["claramente", "algo", "no", "nosabria"] },
    { id: "ext_comentarios", tipo: "texto" },
  ],
  hosteleria: [{ id: "hos_local", tipo: "texto" }],
  // Show periódico: no se pregunta por una noche, sino por lo que ha
  // cambiado en el local desde que hay sesiones y por el formato.
  recurrente: [
    { id: "rec_local", tipo: "texto" },
    { id: "rec_clientes", tipo: "texto" },
    { id: "rec_formato", tipo: "texto" },
  ],
  centro: [
    { id: "cen_alumnado", tipo: "texto" },
    { id: "cen_profesorado", tipo: "texto" },
    { id: "cen_aula", tipo: "texto" },
  ],
  privado: [{ id: "pri_celebracion", tipo: "texto" }],
};

// A quién se imagina el organizador contándoselo, en la pregunta del
// testimonio.
export type Audiencia = "comision" | "institucion" | "empresa" | "centro" | "hosteleria" | "privado";
export const AUDIENCIA: Record<TipoEvento, Audiencia> = {
  familiar: "comision",
  taller: "comision",
  jornadas: "institucion",
  fiestas: "comision",
  empresa: "empresa",
  feria: "empresa",
  externo: "empresa",
  hosteleria: "hosteleria",
  recurrente: "hosteleria",
  centro: "centro",
  privado: "privado",
};

// Sin enlace, el organizador puede marcar varios tipos (23-11-2026): un
// evento puede ser a la vez «fiestas» y «taller», por ejemplo. El primero
// que marca es el principal (tipo_evento): de él salen la audiencia, los
// enunciados de porTipo y la firma anónima. Todos van en tipos_evento.
export function tiposDe(r: { tipo_evento: TipoEvento; tipos_evento?: TipoEvento[] | null }): TipoEvento[] {
  return r.tipos_evento?.length ? r.tipos_evento : [r.tipo_evento];
}

// Las preguntas de varios tipos juntas, en orden y sin repetir las comunes
// (familiar y fiestas comparten las de «magia antes»).
export function preguntasDe(tipos: TipoEvento[]): PreguntaTipo[] {
  const vistas = new Set<string>();
  return tipos.flatMap((t) => PREGUNTAS_TIPO[t]).filter((q) => !vistas.has(q.id) && (vistas.add(q.id), true));
}

export const tiposCorto = (tipos: TipoEvento[]) => tipos.map((t) => TIPO_CORTO[t]).join(" + ");

// Una pregunta condicionada solo cuenta si se cumple su condición.
export function preguntaVisible(p: PreguntaTipo, r: Record<string, string>): boolean {
  return p.tipo !== "texto" || !p.si || r[p.si.id] === p.si.valor;
}

export const LIMITES = {
  corto: 160, // nombre, cargo, entidad, evento
  email: 200,
  respuesta: 1000, // texto corto
  largo: 4000, // testimonio, mejora
} as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const esTipo = (v: unknown): v is TipoEvento => TIPOS_EVENTO.includes(v as TipoEvento);
export const esIdioma = (v: unknown): v is Idioma => v === "es" || v === "eu";

// --- Mensajes de WhatsApp ------------------------------------------------

export function urlQuetal(token: string) {
  return `https://alainzulaika.com/quetal?t=${token}`;
}

export function mensajeWhatsApp(l: { contacto_nombre: string; nombre_evento: string; idioma: Idioma; token: string }) {
  const nombre = l.contacto_nombre.trim().split(/\s+/)[0] || l.contacto_nombre;
  const enlace = urlQuetal(l.token);
  return l.idioma === "eu"
    ? `Kaixo ${nombre}! Eskerrik asko berriro ${l.nombre_evento}-n nirekin kontatzeagatik. Asko lagunduko lidake nola joan zen kontatzea, 3 minutu dira: ${enlace}`
    : `Kaixo ${nombre}! Gracias otra vez por contar conmigo en ${l.nombre_evento}. Me ayudaría mucho que me contases qué tal fue, son 3 minutos: ${enlace}`;
}

// --- Etiquetas en castellano para /admin y el aviso ------------------------

export const TIPO_CORTO: Record<TipoEvento, string> = Object.fromEntries(
  TIPOS_EVENTO.map((t) => [t, QUETAL_TEXTOS.es.tipos[t]])
) as Record<TipoEvento, string>;

export const REPETIR_CORTO: Record<Repetir, string> = QUETAL_TEXTOS.es.repetirOpciones;

export const PERMISO_CORTO: Record<Permiso, string> = {
  completo: "Nombre, cargo y entidad",
  entidad: "Solo entidad",
  anonimo: "Anónimo",
  no: "No publicable",
};

export const ESTADO_CORTO: Record<Estado, string> = {
  nuevo: "Nuevo",
  revisado: "Revisado",
  aprobado_por_cliente: "Aprobado por el cliente",
  publicado: "Publicado",
  archivado: "Archivado",
};

export const VALORACION_CORTO: Record<CampoValoracion, string> = {
  val_comunicacion: QUETAL_TEXTOS.es.valoraciones.val_comunicacion,
  val_promocional: QUETAL_TEXTOS.es.valoraciones.val_promocional,
  val_puntualidad: QUETAL_TEXTOS.es.valoraciones.val_puntualidad,
  val_adaptacion: QUETAL_TEXTOS.es.valoraciones.val_adaptacion,
};

// Para la firma anónima: «Organizador/a de un show familiar».
export const TIPO_FIRMA: Record<TipoEvento, string> = {
  familiar: "un show familiar",
  taller: "un taller",
  jornadas: "unas jornadas de magia",
  fiestas: "fiestas",
  empresa: "un evento de empresa",
  feria: "una feria",
  externo: "un evento de empresa",
  hosteleria: "un bar o restaurante",
  recurrente: "un ciclo de magia en un local",
  centro: "un centro educativo",
  privado: "una celebración privada",
};
