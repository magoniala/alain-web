// Tipos y utilidades del PAR-Q+ que comparten la pestaña PAR-Q+ y la hoja
// de valoración.

import type { ResultadoParq } from "@/lib/parq";

export type RespuestaParq = { id: string; pregunta: string; respuesta: "si" | "no" };

export type ParqFila = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  resultado: ResultadoParq;
  respuestas: RespuestaParq[];
  enviado_en: string;
};

export type ParqCompleto = ParqFila & {
  consent_datos: boolean | null;
  consent_datos_en: string | null;
  consent_datos_texto: string | null;
  consentimientos_version: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  aviso_enviado: boolean | null;
  aviso_error: string | null;
  valoraciones: { id: string; cliente: string | null; fecha: string | null }[];
};

// Cómo se nombra cada resultado de cara a mí, en la pestaña y en el PDF.
export const RESULTADO_CORTO: Record<ResultadoParq, string> = {
  apto: "Apto",
  aptoTrasSeguimiento: "Apto tras seguimiento",
  consultar: "Consultar antes",
};

export const RESULTADO_COLOR: Record<ResultadoParq, { fondo: string; texto: string; borde: string }> = {
  apto: { fondo: "#E7F4EA", texto: "#1E7B3A", borde: "#BFE3C8" },
  aptoTrasSeguimiento: { fondo: "#FFF4DD", texto: "#9A6400", borde: "#F2DBA6" },
  consultar: { fondo: "#FDECEB", texto: "#B3261E", borde: "#F4C7C3" },
};

export const idsSi = (p: Pick<ParqFila, "respuestas">) => p.respuestas.filter((r) => r.respuesta === "si").map((r) => r.id);

// Lo que se guarda en una valoración al vincularle un PAR-Q+.
export function snapshotParq(p: ParqFila) {
  const si = p.respuestas.filter((r) => r.respuesta === "si");
  return {
    nombre: p.nombre,
    email: p.email,
    telefono: p.telefono,
    resultado: p.resultado,
    enviado_en: p.enviado_en,
    sis: si.map((r) => r.pregunta),
    sisIds: si.map((r) => r.id),
    respuestas: p.respuestas,
  };
}

export function limpiarNombre(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sin-nombre"
  );
}
