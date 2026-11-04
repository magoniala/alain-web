// Normalización de las fichas de Centros/ (CRM de charlas) a filas de
// charlas_centros, charlas_interacciones y charlas_contactos.
//
// La LECTURA de la nota la hace scripts/charlas/exportar-vault.py: es el
// parser que se usó en la importación original (YAML de verdad, los dos
// formatos históricos de línea de Registro y el canal deducido por
// contenido). Aquí solo se convierte lo que sale de ahí en filas, para que el
// importador manual (importar-directo.mjs) y las altas del espejo
// (../crm/altas-vault.mjs) metan exactamente lo mismo.

import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

export const texto = (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
export const fecha = (v) => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ""));
  return m ? m[1] : null;
};
export const entero = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
export const numero = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
export const enlace = (v) => {
  if (typeof v !== "string") return null;
  const m = /^\[\[([^\]|]+)/.exec(v.trim());
  return m ? m[1].trim() : v.trim() || null;
};

export function normalizar(fm) {
  return {
    codigo: texto(fm.codigo), territorio: texto(fm.territorio), localidad: texto(fm.localidad),
    tipo: texto(fm.tipo), tipo_centro: texto(fm.tipo_centro), modelo_linguistico: texto(fm.modelo_linguistico),
    euskera: texto(fm.euskera),
    etapas: Array.isArray(fm.etapas) ? fm.etapas.map(String) : fm.etapas ? [String(fm.etapas)] : [],
    etapas_confirmadas: texto(fm.etapas_confirmadas), direccion: texto(fm.direccion), telefono: texto(fm.telefono),
    email_centro: texto(fm.email_centro), web: texto(fm.web), prioridad: texto(fm.prioridad),
    estado: texto(fm.estado) ?? "0 Por llamar", origen: texto(fm.origen), via: texto(fm.via),
    responsable: texto(fm.responsable), responsable_cargo: texto(fm.responsable_cargo),
    responsable_email: texto(fm.responsable_email), responsable_tel: texto(fm.responsable_tel),
    ampa: texto(fm.ampa), ampa_contacto: texto(fm.ampa_contacto), ampa_email: texto(fm.ampa_email),
    calendario_abierto: texto(fm.calendario_abierto), intentos_llamada: entero(fm.intentos_llamada),
    mails_enviados: entero(fm.mails_enviados), fecha_ultimo_contacto: fecha(fm.fecha_ultimo_contacto),
    proxima_accion: texto(fm.proxima_accion), bloqueado_por: texto(fm.bloqueado_por),
    fecha_proxima_accion: fecha(fm.fecha_proxima_accion), fecha_creacion: fecha(fm.fecha_creacion),
    ficha_cliente: texto(fm.ficha_cliente), otros_formatos: texto(fm.otros_formatos),
  };
}

/** Centro exportado (JSON de exportar-vault.py) → fila de charlas_centros. */
export function filaCentro(c) {
  return {
    nombre: c.nombre, ...normalizar(c.frontmatter ?? {}),
    notas: c.notas?.trim() || null, secciones_extra: c.secciones_extra ?? {}, actualizado_por: "vault",
  };
}

/** Su Registro → filas de charlas_interacciones (origen vault). */
export function interaccionesCentro(c, centroId) {
  const out = [];
  (c.registro ?? []).forEach((l, orden) => {
    if (!l.texto?.trim() && !l.raw?.trim()) return;
    out.push({ centro_id: centroId, fecha: fecha(l.fecha), canal: l.canal, texto: (l.texto ?? l.raw).trim(), raw: l.raw ?? null, orden, origen: "vault" });
  });
  return out;
}

/** Responsable y AMPA del frontmatter → filas de charlas_contactos. */
export function contactosCentro(c, centroId) {
  const fm = normalizar(c.frontmatter ?? {});
  const out = [];
  const vistos = new Set();
  const add = (k) => {
    if (k.email && vistos.has(k.email)) return;
    if (k.email) vistos.add(k.email);
    out.push({ centro_id: centroId, origen: "vault", ...k });
  };
  if (fm.responsable || fm.responsable_email)
    add({ nombre: fm.responsable, cargo: fm.responsable_cargo, email: fm.responsable_email?.toLowerCase() ?? null, telefono: fm.responsable_tel, rol: "responsable" });
  if (fm.ampa_contacto || fm.ampa_email)
    add({ nombre: fm.ampa_contacto, cargo: fm.ampa ? `AMPA · ${fm.ampa}` : "AMPA", email: fm.ampa_email?.toLowerCase() ?? null, telefono: null, rol: "ampa" });
  return out;
}

/**
 * Lee unas cuantas fichas de Centros/ con exportar-vault.py y devuelve los
 * centros en el mismo formato que vault-export.json. Copia las fichas a una
 * carpeta temporal porque el exportador trabaja sobre una carpeta "Charlas"
 * entera; así no hay que reimplementar su parser ni exportar las 553.
 *
 * `rutas`: rutas absolutas a ficheros .md.
 */
export function leerFichasCentro(rutas) {
  if (!rutas.length) return [];
  const tmp = mkdtempSync(join(tmpdir(), "altas-centros-"));
  try {
    mkdirSync(join(tmp, "Centros"));
    for (const r of rutas) copyFileSync(r, join(tmp, "Centros", r.split("/").pop()));
    const salida = join(tmp, "export.json");
    execFileSync("python3", [join(AQUI, "exportar-vault.py"), tmp, salida], { stdio: ["ignore", "ignore", "pipe"] });
    return JSON.parse(readFileSync(salida, "utf8")).centros ?? [];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
