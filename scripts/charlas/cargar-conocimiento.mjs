#!/usr/bin/env node
// Carga en charlas_conocimiento el material con el que escribe el sistema:
// guiones, objeciones, dossier, canales institucionales y las bandejas
// reales (respuestas aprobadas por Alain) como ejemplos.
//
//   node scripts/charlas/cargar-conocimiento.mjs <carpeta con los .md>
//
// Upsert por clave: volver a ejecutarlo actualiza lo que haya cambiado.
// No toca 'reglas_aprendidas' si ya existe (eso lo escribe el aprendizaje).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const dir = process.argv[2];

// Archivo → (clave, tipo, orden). Lo que no está aquí no se carga
// (protocolos del día de charla, post-venta, sesiones de trabajo: no sirven para responder correos).
const MAPA = {
  "00 Flujo charlas.md": ["flujo", "guion", 10],
  "Mail 1 Calendario.md": ["mail_1", "guion", 20],
  "Mail 1 genérico.md": ["mail_1_generico", "guion", 21],
  "Mail 2 Dossier.md": ["mail_2", "guion", 22],
  "Mail 3 Recordatorios.md": ["mail_3", "guion", 23],
  "Mail 4 Cierre.md": ["mail_4", "guion", 24],
  "Mail AMPA.md": ["mail_ampa", "guion", 25],
  "Objeciones.md": ["objeciones", "guion", 30],
  "Llamada tras reenvío a orientación.md": ["llamada_reenvio", "guion", 35],
  "Charlas — Canales institucionales.md": ["canales_institucionales", "contexto", 40],
  "Dossier_ES (texto editable).md": ["dossier_es", "contexto", 50],
  "Dossier_EU.md": ["dossier_eu", "contexto", 51],
};

// Quita el frontmatter YAML y los enlaces de Obsidian ([[Nota|texto]] → texto).
function limpiar(t) {
  return t
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();
}

const filas = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".md")) continue;
  const texto = limpiar(readFileSync(join(dir, f), "utf8"));
  if (MAPA[f]) {
    const [clave, tipo, orden] = MAPA[f];
    filas.push({ clave, titulo: basename(f, ".md"), tipo, texto, orden });
  } else if (f.startsWith("Bandeja — respuestas")) {
    const fecha = f.match(/(\d{2}-\d{2}-\d{4})/)?.[1] ?? f;
    filas.push({ clave: `ejemplos_${fecha}`, titulo: `Respuestas reales aprobadas por Alain · ${fecha}`, tipo: "ejemplos", texto, orden: 80 });
  }
}

// Condiciones comerciales que Alain ha dejado dichas y que no están en los guiones.
filas.push({
  clave: "condiciones",
  titulo: "Condiciones comerciales y datos fijos",
  tipo: "contexto",
  orden: 45,
  texto: `- Tarifa en formato aula: 350 € + IVA por aula las tres primeras; 275 € + IVA a partir de la cuarta cuando todas se dan los mismos días. Se muestra el desglose para que se entienda como norma, no como descuento puntual.
- Auditorio (varios grupos juntos): 1.200 € + IVA. Por debajo de 1.200 no hay.
- Las facturas llevan IVA 21 % y retención de IRPF 15 %.
- Pago: 20 % de reserva al aceptar el presupuesto (bloquea la fecha) y el 80 % restante como muy tarde 15 días antes. La factura se emite al recibir el primer pago. Si el centro prefiere pagar después de la charla: se bloquea la fecha con contrato firmado y se rehace el presupuesto.
- Idioma: la charla se da íntegra en euskera o en castellano; puede mezclar grupos de los dos idiomas el mismo día.
- Consejo que da a los centros: decir a los alumnos solo que "viene un mago", sin explicar de qué va la charla.
- Además de la charla ofrece shows para celebraciones, semanas culturales y talleres de magia (ver la REGLA FIJA de Objeciones para cuándo mencionarlo).
- Kultura Eskola (catálogo de la Diputación de Gipuzkoa): solicitud de inclusión enviada en septiembre de 2026, sin respuesta. No decir que está dentro.
- Referencia que se puede citar: Mendebaldea BHI (Vitoria-Gasteiz), tres cursos seguidos con todo 2.º de la ESO. No citar a otros centros clientes sin permiso. No decir "primer cliente".
- Contacto de Alain: alain@alainzulaika.com · 688 821 488.`,
});

const { error } = await sb.from("charlas_conocimiento").upsert(
  filas.map((f) => ({ ...f, activo: true, actualizado_en: new Date().toISOString() })),
  { onConflict: "clave" }
);
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: reglas } = await sb.from("charlas_conocimiento").select("clave").eq("clave", "reglas_aprendidas").maybeSingle();
if (!reglas) {
  await sb.from("charlas_conocimiento").insert({
    clave: "reglas_aprendidas",
    titulo: "Reglas aprendidas de las correcciones de Alain",
    tipo: "reglas",
    orden: 5,
    texto: "(Aún no hay. Se irán añadiendo a partir de las correcciones que Alain haga en la bandeja.)",
  });
}

const total = filas.reduce((s, f) => s + f.texto.length, 0);
console.log(`${filas.length} documentos cargados · ${(total / 1024).toFixed(0)} KB (~${Math.round(total / 3.5 / 1000)}k tokens)`);
for (const f of filas) console.log(`  ${f.clave.padEnd(26)} ${f.tipo.padEnd(9)} ${(f.texto.length / 1024).toFixed(1)} KB`);
