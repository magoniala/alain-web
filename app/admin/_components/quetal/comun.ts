// Tipos y utilidades de /admin → Opiniones eventos.

import {
  ESTADO_CORTO,
  PERMISO_CORTO,
  REPETIR_CORTO,
  TIPO_CORTO,
  TIPO_FIRMA,
  VALORACIONES,
  VALORACION_CORTO,
  type Estado,
  type Idioma,
  type Permiso,
  type Repetir,
  type TipoEvento,
} from "@/lib/quetal";

export type Respuesta = {
  id: string;
  created_at: string;
  link_id: string | null;
  idioma: Idioma;
  tipo_evento: TipoEvento;
  nombre_evento: string;
  fecha_evento: string | null;
  nombre: string;
  cargo: string | null;
  entidad: string;
  email: string | null;
  nps: number;
  testimonio: string;
  momento: string | null;
  dudas_previas: string | null;
  respuestas_tipo: { id: string; pregunta: string; respuesta: string }[];
  val_comunicacion: number | null;
  val_promocional: number | null;
  val_puntualidad: number | null;
  val_adaptacion: number | null;
  comentario_trato: string | null;
  repetir: Repetir | null;
  referido_nombre: string | null;
  referido_contacto: string | null;
  referido_permiso_mencion: boolean;
  mejora_privada: string | null;
  permiso_publicacion: Permiso;
  permiso_logo: boolean;
  permiso_fotos: boolean;
  privacidad_aceptada: boolean;
  aviso_enviado: boolean | null;
  aviso_error: string | null;
  estado: Estado;
  destacado: boolean;
  testimonio_editado: string | null;
  notas_internas: string | null;
};

export type Enlace = {
  id: string;
  token: string;
  tipo_evento: TipoEvento;
  nombre_evento: string;
  fecha_evento: string | null;
  entidad: string;
  contacto_nombre: string;
  idioma: Idioma;
  created_at: string;
  usado: boolean;
  respondido_at: string | null;
};

export const tieneReferido = (r: Respuesta) => Boolean(r.referido_nombre || r.referido_contacto);
export const quiereRepetir = (r: Respuesta) => r.repetir === "proxima" || r.repetir === "otro_tipo";
export const publicable = (r: Respuesta) => r.permiso_publicacion !== "no";

// 0–6 rojo, 7–8 ámbar, 9–10 verde.
export function colorNps(n: number) {
  if (n >= 9) return { fondo: "#E7F4EA", texto: "#1E7B3A", borde: "#BFE3C8" };
  if (n >= 7) return { fondo: "#FFF4DD", texto: "#9A6400", borde: "#F0D9A8" };
  return { fondo: "#FDECEB", texto: "#B3261E", borde: "#F4C7C3" };
}

export function metricas(lista: Respuesta[]) {
  const n = lista.length;
  if (!n) return { n, media: null as number | null, neto: null as number | null, referidos: 0 };
  const media = lista.reduce((s, r) => s + r.nps, 0) / n;
  const promotores = lista.filter((r) => r.nps >= 9).length;
  const detractores = lista.filter((r) => r.nps <= 6).length;
  // «Pendiente» = trae referido y la respuesta aún está sin revisar.
  const referidos = lista.filter((r) => tieneReferido(r) && r.estado === "nuevo").length;
  return { n, media, neto: Math.round(((promotores - detractores) / n) * 100), referidos };
}

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

// El texto listo para pegar en la web o en redes, según lo que haya
// permitido. Usa mi versión pulida si la hay.
export function textoParaPublicar(r: Respuesta): string | null {
  const texto = (r.testimonio_editado?.trim() || r.testimonio).trim();
  switch (r.permiso_publicacion) {
    case "completo": {
      const quien = [r.nombre, r.cargo].filter(Boolean).join(", ");
      return `"${texto}" — ${quien} · ${r.entidad}`;
    }
    case "entidad":
      return `"${texto}" — ${r.entidad}`;
    case "anonimo":
      return `"${texto}" — Organizador/a de ${TIPO_FIRMA[r.tipo_evento]}`;
    default:
      return null;
  }
}

export function csvRespuestas(lista: Respuesta[]): string {
  const cab = [
    "Recibida",
    "Fecha evento",
    "Tipo",
    "Evento",
    "Entidad",
    "Nombre",
    "Cargo",
    "Email",
    "Idioma",
    "NPS",
    "Testimonio",
    "Testimonio editado",
    "Momento",
    "Dudas previas",
    "Preguntas del tipo",
    ...VALORACIONES.map((k) => VALORACION_CORTO[k]),
    "Comentario trato",
    "Repetir",
    "Referido",
    "Contacto referido",
    "Mencionar",
    "Mejora (privado)",
    "Permiso",
    "Logo",
    "Fotos",
    "Estado",
    "Destacado",
    "Notas internas",
  ];
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const si = (b: boolean) => (b ? "Sí" : "No");
  const filas = lista.map((r) =>
    [
      new Date(r.created_at).toLocaleString("es-ES"),
      r.fecha_evento ?? "",
      TIPO_CORTO[r.tipo_evento],
      r.nombre_evento,
      r.entidad,
      r.nombre,
      r.cargo ?? "",
      r.email ?? "",
      r.idioma,
      String(r.nps),
      r.testimonio,
      r.testimonio_editado ?? "",
      r.momento ?? "",
      r.dudas_previas ?? "",
      r.respuestas_tipo.map((x) => `${x.pregunta} ${x.respuesta}`).join(" | "),
      ...VALORACIONES.map((k) => (r[k] == null ? "N/A" : String(r[k]))),
      r.comentario_trato ?? "",
      r.repetir ? REPETIR_CORTO[r.repetir] : "",
      r.referido_nombre ?? "",
      r.referido_contacto ?? "",
      si(r.referido_permiso_mencion),
      r.mejora_privada ?? "",
      PERMISO_CORTO[r.permiso_publicacion],
      si(r.permiso_logo),
      si(r.permiso_fotos),
      ESTADO_CORTO[r.estado],
      si(r.destacado),
      r.notas_internas ?? "",
    ]
      .map(celda)
      .join(";")
  );
  // BOM para que Excel lea bien los acentos.
  return "﻿" + [cab.map(celda).join(";"), ...filas].join("\n");
}
