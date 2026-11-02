#!/usr/bin/env node
// Importa una nota de plan de Entrenatzaile del vault (Clientes/…) en Supabase:
// cliente, plan, sesiones tipo y las semanas ya escritas en la nota (sesiones,
// ejercicios y avisos). Fase 7a del sistema (Arquitectura v3).
//
//   node scripts/entrenatzaile/importar-plan.mjs "<ruta a la nota del plan>" [--forzar]
//
// Idempotente: el cliente y el plan se actualizan; las semanas que ya existen
// no se tocan (pueden tener cambios hechos en el panel) salvo con --forzar,
// que las borra y las vuelve a crear desde la nota.
// Los avisos con hora ya pasada se importan como "omitido": esa semana ya la
// lleva Trainer Studio y no se debe enviar nada atrasado.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { leerPlan } from "./plan-lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const args = process.argv.slice(2);
const forzar = args.includes("--forzar");
const rutas = args.filter((a) => !a.startsWith("--"));
if (!URL_SB || !KEY || !rutas.length) {
  console.error('Uso: node scripts/entrenatzaile/importar-plan.mjs "<nota del plan>.md" [--forzar]  (con SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local)');
  process.exit(1);
}

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=representation", ...(opciones.headers ?? {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  return texto.trim() ? JSON.parse(texto) : null;
}

// Datos de cliente que no salen de la nota del plan (los pone Alain en el
// panel; aquí solo se siembran si el campo está vacío).
const SEMILLA = {
  Juanan: {
    zonas_riesgo: "espalda, clavícula, codos",
    reglas: [
      "La A (peso muerto) nunca al día siguiente de caserío duro: si toca, antes la B o la C.",
      "Fuera la búlgara: odia el tambaleo. Sustitutas: sentadilla a una pierna a banco con TRX, step-up, goblet.",
      "Remo con barra, nunca: carga la bisagra.",
      "Lo que más valora es cumplir: el indicador que se le enseña es la constancia; los números los lleva Alain.",
      "No quiere comparar el físico: las fotos son para Alain y el registro, no se le enseñan.",
      "Press inclinado con mancuernas, no con barra (clavícula). Si nota la clavícula, banco plano o flexión con pies elevados.",
      "Cuando un ejercicio sale fácil: más peso o más lento, no más repeticiones.",
    ],
    material: "Barra, ~54 kg en discos (discos de 20 kg pendientes), banco inclinable, TRX, barra de dominadas, gomas con anclaje de puerta, mancuernas, kettlebell, mochila y remo ergómetro.",
    ficha_vault: "Juanan",
  },
  Olatz: { ficha_vault: "Olatz — Ficha valoración y plan" },
};

// "2026-11-03" + "20:00" en hora de Madrid → ISO UTC.
function madridAUtc(fecha, hora) {
  const [h, m] = hora.split(":").map(Number);
  const guess = new Date(`${fecha}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const enMadrid = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const enUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (enMadrid.getTime() - enUtc.getTime())).toISOString();
}

for (const ruta of rutas) {
  const nombreNota = basename(ruta).replace(/\.md$/, "");
  const plan = leerPlan(readFileSync(ruta, "utf8"), nombreNota);
  if (!plan.cliente || !plan.inicio) {
    console.error(`${nombreNota}: falta "cliente" o "inicio" en el frontmatter; no se importa.`);
    continue;
  }

  // Cliente
  let [cliente] = await rest(`ent_clientes?nombre=eq.${encodeURIComponent(plan.cliente)}&select=*`);
  const semilla = SEMILLA[plan.cliente] ?? {};
  if (!cliente) {
    [cliente] = await rest("ent_clientes", { method: "POST", body: JSON.stringify({ nombre: plan.cliente, ...semilla }) });
    console.log(`Cliente creado: ${plan.cliente}`);
  } else {
    const faltan = Object.fromEntries(Object.entries(semilla).filter(([k]) => cliente[k] === null || (Array.isArray(cliente[k]) && cliente[k].length === 0)));
    if (Object.keys(faltan).length) await rest(`ent_clientes?id=eq.${cliente.id}`, { method: "PATCH", body: JSON.stringify(faltan), prefer: "return=minimal" });
  }

  // Plan (los demás planes del cliente dejan de estar activos)
  const filaPlan = { cliente_id: cliente.id, nombre: plan.nombre, inicio: plan.inicio, fin: plan.fin, frecuencia: plan.frecuencia, activo: true, metas: plan.metas, fases: plan.fases, reglas_carga: plan.reglas_carga, markdown: plan.markdown, nota_vault: plan.nota_vault };
  const [p] = await rest("ent_planes?on_conflict=cliente_id,nombre", { method: "POST", body: JSON.stringify(filaPlan), prefer: "return=representation,resolution=merge-duplicates" });
  await rest(`ent_planes?cliente_id=eq.${cliente.id}&id=neq.${p.id}`, { method: "PATCH", body: JSON.stringify({ activo: false }), prefer: "return=minimal" });

  // Sesiones tipo
  const tipos = {};
  if (plan.sesiones_tipo.length) {
    const filas = plan.sesiones_tipo.map((t) => ({ plan_id: p.id, clave: t.clave, nombre: t.nombre, dia_habitual: t.dia_habitual, duracion_min: t.duracion_min ?? null, orden: t.orden }));
    for (const t of await rest("ent_sesiones_tipo?on_conflict=plan_id,clave", { method: "POST", body: JSON.stringify(filas), prefer: "return=representation,resolution=merge-duplicates" })) tipos[t.clave] = t.id;
  }

  // Semanas
  const ahora = Date.now();
  let creadas = 0;
  let saltadas = 0;
  for (const w of plan.semanas) {
    const [ya] = await rest(`ent_semanas?plan_id=eq.${p.id}&numero=eq.${w.numero}&select=id`);
    if (ya && !forzar) {
      saltadas++;
      continue;
    }
    if (ya) await rest(`ent_semanas?id=eq.${ya.id}`, { method: "DELETE", prefer: "return=minimal" });
    const fase = plan.fases.find((f) => {
      const [a, b] = f.semanas.split("-").map(Number);
      return w.numero >= a && w.numero <= (b || a);
    });
    const [sem] = await rest("ent_semanas", {
      method: "POST",
      body: JSON.stringify({ plan_id: p.id, cliente_id: cliente.id, numero: w.numero, lunes: w.lunes, fase: fase?.fase ?? null, rir_objetivo: w.rir_objetivo, titulo: w.titulo, notas: w.notas, estado: w.avisos.length ? "programada" : "borrador", programada_en: w.avisos.length ? new Date().toISOString() : null }),
    });
    const porDia = {};
    for (const s of w.sesiones) {
      const [ses] = await rest("ent_sesiones", {
        method: "POST",
        body: JSON.stringify({ semana_id: sem.id, cliente_id: cliente.id, sesion_tipo_id: tipos[s.clave] ?? null, clave: s.clave, nombre: s.nombre, fecha: s.fecha, duracion_min: s.duracion_min, calentamiento: s.calentamiento }),
      });
      if (s.fecha) porDia[s.fecha] = ses.id;
      if (s.ejercicios.length)
        await rest("ent_ejercicios", {
          method: "POST",
          prefer: "return=minimal",
          body: JSON.stringify(s.ejercicios.map((e) => ({ sesion_id: ses.id, orden: e.orden, nombre: e.nombre, series: e.series, reps: e.reps, carga: e.carga, tempo: e.tempo, descanso: e.descanso, rir: e.rir, notas: e.notas, video: e.video, superserie: e.superserie, campos: e.campos }))),
        });
    }
    if (w.avisos.length) {
      const filas = w.avisos.map((a) => {
        const cuando = madridAUtc(a.fecha, a.hora);
        // Cada aviso cuelga de la sesión a la que se refiere: el del día antes y la recuperación, de la sesión del día siguiente / anterior.
        const ref = a.tipo === "aviso_dia_antes" ? sumar(a.fecha, 1) : a.tipo === "formulario_recuperacion" ? sumar(a.fecha, -1) : a.fecha;
        return {
          cliente_id: cliente.id,
          semana_id: sem.id,
          sesion_id: porDia[ref] ?? null,
          tipo: a.tipo,
          programado_para: cuando,
          canal: a.tipo.startsWith("formulario") ? "app" : cliente.aviso_canal === "ninguno" ? "push" : cliente.aviso_canal,
          texto: a.texto,
          estado: new Date(cuando).getTime() < ahora ? "omitido" : a.tipo === "resumen_domingo" ? "borrador" : "programado",
        };
      });
      await rest("ent_avisos", { method: "POST", prefer: "return=minimal", body: JSON.stringify(filas) });
    }
    creadas++;
  }
  console.log(`${nombreNota}: plan ${plan.nombre} (${plan.inicio} → ${plan.fin ?? "?"}), ${plan.metas.length} metas, ${plan.fases.length} fases, ${plan.sesiones_tipo.length} sesiones tipo; semanas nuevas ${creadas}, ya existentes ${saltadas}.`);
}

function sumar(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
