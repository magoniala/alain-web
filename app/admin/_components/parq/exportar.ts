// PDF y CSV de los PAR-Q+ recibidos.
//
// El PDF usa el mismo sistema que el de la valoración: un HTML para A4 que
// se abre en otra ventana y se imprime («Guardar como PDF»). Varios PAR-Q+
// van en un solo documento, uno por página.

import { CONDICIONES, ETIQUETA_CORTA, PREGUNTAS_GENERALES } from "@/lib/parq";
import { TESTS, criterioTests } from "@/lib/parq-criterio";
import { documento, esc } from "../valoracion/pdf";
import { RESULTADO_COLOR, RESULTADO_CORTO, idsSi, limpiarNombre, type ParqCompleto } from "./comun";

const fecha = (iso: string | null, conHora = false) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", conHora ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" })
    : "—";

const chip = (texto: string, rojo: boolean) =>
  `<span class="nivel" style="margin:0 4px 4px 0;${rojo ? "background:#FDECEB;color:#B3261E" : "background:#E7F4EA;color:#1E7B3A"}">${esc(texto)}</span>`;

function cuerpoFicha(p: ParqCompleto): string {
  const r = new Map(p.respuestas.map((x) => [x.id, x.respuesta]));
  const color = RESULTADO_COLOR[p.resultado];

  let h = `<p class="marca">Entrenatzaile · Cuestionario PAR-Q+</p>
    <h1>${esc(p.nombre)}</h1>
    <p class="sub">${esc([p.email, p.telefono].filter(Boolean).join(" · "))} · recibido el ${esc(fecha(p.enviado_en, true))}</p>
    <div class="caja" style="background:${color.fondo};border-color:${color.borde}">
      <b style="color:${color.texto};font-size:12pt">${esc(RESULTADO_CORTO[p.resultado])}</b>
    </div>`;

  // Banderas
  const generales = PREGUNTAS_GENERALES.filter((q) => r.get(q.id) === "si");
  h += `<h2>Banderas</h2><p style="margin:0 0 6px"><span class="suave">Preguntas generales:</span> ${
    generales.length ? generales.map((q) => chip(ETIQUETA_CORTA[q.id] ?? q.id, true)).join("") : chip("Todo «no»", false)
  }</p>`;
  const conds = CONDICIONES.filter((c) => r.get(c.id) === "si");
  if (conds.length) {
    h += `<table>${conds
      .map((c) => {
        const b = c.subpreguntas.filter((s) => r.get(s.id) === "si");
        return `<tr><td class="k"><b style="color:#24211d">${esc(ETIQUETA_CORTA[c.id] ?? c.id)}</b></td><td>${
          b.length
            ? b.map((s) => `<span style="color:#B3261E">⚑ ${esc(ETIQUETA_CORTA[s.id] ?? s.id)}</span>`).join("<br>")
            : `<span style="color:#1E7B3A">La tiene, sin banderas</span>`
        }</td></tr>`;
      })
      .join("")}</table>`;
  }

  // Qué se puede hacer en la valoración
  const crit = criterioTests(idsSi(p));
  const grupo = (n: string) => crit.filter((c) => c.nivel === n);
  h += `<h2>En la valoración online</h2>`;
  for (const [n, titulo, col] of [
    ["no", "No hacer", "#B3261E"],
    ["precaucion", "Con precaución", "#9A6400"],
  ] as const) {
    const g = grupo(n);
    if (!g.length) continue;
    h += `<p style="margin:6px 0 2px"><b style="color:${col}">${titulo}</b></p><table>${g
      .map((c) => `<tr><td class="k">${esc(TESTS[c.test])}</td><td class="suave">${c.motivos.map(esc).join("<br>")}</td></tr>`)
      .join("")}</table>`;
  }
  h += `<p style="margin:6px 0 0"><b style="color:#1E7B3A">Se puede:</b> ${esc(grupo("si").map((c) => TESTS[c.test]).join(" · "))}</p>
    <p class="nota" style="margin-top:4px">Criterio propuesto a partir de las banderas, no del PAR-Q+. Ante la duda, lo que diga su médico.</p>`;

  // Respuestas
  h += `<h2>Respuestas</h2><table>${p.respuestas
    .map((x) => {
      const sub = /^c\d+[a-z]$/.test(x.id);
      const si = x.respuesta === "si";
      return `<tr><td style="width:46px;${sub ? "padding-left:16px;" : ""}" class="suave">${esc(x.id.toUpperCase())}</td><td style="${
        sub ? "padding-left:16px;" : ""
      }${si ? "" : "color:#776f64"}">${esc(x.pregunta)}</td><td style="width:42px;text-align:right">${
        si ? `<b style="color:#B3261E">SÍ</b>` : `<span class="suave">no</span>`
      }</td></tr>`;
    })
    .join("")}</table>`;

  // Consentimiento y origen
  h += `<h2>Consentimiento</h2><table>
    <tr><td class="k">Aceptado</td><td>${p.consent_datos ? `Sí · ${esc(fecha(p.consent_datos_en, true))}` : "No consta"}</td></tr>
    ${p.consentimientos_version ? `<tr><td class="k">Versión del texto</td><td>${esc(p.consentimientos_version)}</td></tr>` : ""}
    ${p.consent_datos_texto ? `<tr><td class="k">Texto</td><td class="suave">${esc(p.consent_datos_texto)}</td></tr>` : ""}
  </table>`;
  const origen = (["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"] as const)
    .filter((k) => p[k])
    .map((k) => `<tr><td class="k">${k}</td><td>${esc(p[k]!)}</td></tr>`)
    .join("");
  if (origen) h += `<h2>Origen</h2><table>${origen}</table>`;

  h += `<p class="pie">Documento interno. Contiene datos de salud (art. 9 RGPD).</p>`;
  return h;
}

export function htmlFichaParq(p: ParqCompleto): string {
  return documento(`parq_${limpiarNombre(p.nombre)}_${p.enviado_en.slice(0, 10)}`, cuerpoFicha(p));
}

export function htmlVariosParq(lista: ParqCompleto[]): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return documento(`parq_${lista.length}-cuestionarios_${hoy}`, lista.map(cuerpoFicha).join('<div class="salto"></div>'));
}

// CSV para Excel: separador «;», BOM para que respete las tildes, una
// columna por pregunta (vacía si no se le hizo).
export function csvParq(lista: ParqCompleto[]): string {
  const ids = [
    ...PREGUNTAS_GENERALES.map((q) => q.id),
    ...CONDICIONES.flatMap((c) => [c.id, ...c.subpreguntas.map((s) => s.id)]),
  ];
  const cab = ["Fecha", "Nombre", "Email", "Teléfono", "Resultado", "Banderas", "Consentimiento", "Origen", ...ids.map((i) => i.toUpperCase())];
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const filas = lista.map((p) => {
    const r = new Map(p.respuestas.map((x) => [x.id, x.respuesta]));
    const banderas = idsSi(p)
      .map((i) => ETIQUETA_CORTA[i] ?? i)
      .join(" | ");
    return [
      new Date(p.enviado_en).toLocaleString("es-ES"),
      p.nombre,
      p.email,
      p.telefono,
      RESULTADO_CORTO[p.resultado],
      banderas,
      p.consent_datos ? "Sí" : "No",
      [p.utm_source, p.utm_campaign].filter(Boolean).join(" / "),
      ...ids.map((i) => (r.get(i) === "si" ? "Sí" : r.get(i) === "no" ? "No" : "")),
    ]
      .map((v) => celda(String(v ?? "")))
      .join(";");
  });
  return "﻿" + [cab.map(celda).join(";"), ...filas].join("\r\n");
}

export function descargarCsv(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
