// Prompt de presupuesto para el chat de presupuestos de Claude (skill
// presupuestos-niala). Se compone SOLO con datos que ya existen: ficha,
// Registro, correos y catálogo de shows (crm_conocimiento). Sin IA: lo que no
// está se marca «FALTA: preguntar a Alain», nunca se rellena.
//
// Lo usa GET /api/admin/crm/presupuesto y el botón «Copiar prompt de
// presupuesto» de la tarjeta de magia y de la ficha.

import { supabaseCharlas } from "./charlas";
import { CARRIL_CATALOGO, CLAVE_NOTAS, TIPO_CATALOGO } from "./conocimiento-catalogo";

export const FALTA = "FALTA: preguntar a Alain";
const CLAVE_CONDICIONES = "condiciones_generales";

interface Doc { clave: string; titulo: string | null; tipo: string; texto: string }
interface Linea { fecha: string | null; canal: string | null; texto: string }
interface Msg { direccion: string; de: string | null; fecha: string | null; texto: string | null; resumen: string | null; datos_extraidos: Record<string, unknown> | null; idioma: string | null }

export interface ResultadoPrompt {
  prompt: string;
  shows: { clave: string; titulo: string }[];
  show: string | null;
  /** Cómo se eligió el show: lo pidió Alain, salió en el Registro/correos o no se sabe. */
  origen_show: "elegido" | "detectado" | "ninguno";
  faltan: number;
}

/** Secciones «## Título» de un documento del catálogo, con la clave en minúsculas. */
function secciones(texto: string): Record<string, string> {
  const out: Record<string, string> = {};
  let actual = "";
  for (const l of texto.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(l);
    if (h) { actual = h[1].toLowerCase(); out[actual] = ""; continue; }
    if (actual) out[actual] += `${l}\n`;
  }
  return out;
}
const seccion = (s: Record<string, string>, empieza: string) => Object.entries(s).find(([k]) => k.startsWith(empieza))?.[1] ?? "";

/** Limpia una sección: quita líneas vacías y cambia «SIN DATO» por FALTA (sin las instrucciones para la IA que lleven al lado). */
function limpiar(t: string): string {
  const lineas = t.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() && l.trim() !== "-");
  const out = lineas.map((l) => {
    if (!/SIN DATO/i.test(l)) return l;
    const etiqueta = l.split(":")[0].replace(/^\s*-\s*/, "").trim();
    return /SIN DATO/i.test(etiqueta) ? `- ${FALTA}` : `- ${etiqueta}: ${FALTA}`;
  });
  return out.join("\n");
}
const oFalta = (t: string) => (t.trim() ? t : `- ${FALTA}`);
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "s/f");

/** Quita lo citado de un correo (respuestas anteriores) y lo deja en un tamaño pegable. */
function cuerpoSinCitas(t: string): string {
  const lineas = t.replace(/\r/g, "").split("\n");
  const corte = lineas.findIndex((l) => /^(>|El .{3,120}(escribió|idatzi zuen)|On .{3,120}wrote|-{2,}\s*(Original|Mensaje original|Jatorrizko)|De:\s|From:\s|\d{4}\(e\)ko .{0,80}(idatzi|escribió))/i.test(l.trim()));
  const util = (corte > 0 ? lineas.slice(0, corte) : lineas).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return util.length > 2500 ? `${util.slice(0, 2500)}…` : util;
}

const IDIOMA: Record<string, string> = { eu: "euskera", es: "castellano", mixto: "euskera y castellano (mixto)" };
const nombreCorto = (titulo: string) => titulo.split(/\s+[—–-]\s+/)[0].trim();

export async function promptPresupuesto(fichaId: string, showPedido?: string | null): Promise<ResultadoPrompt> {
  const sb = supabaseCharlas();
  const [fichaR, regR, msgR, docsR] = await Promise.all([
    sb.from("crm_fichas").select("*").eq("id", fichaId).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", fichaId).order("fecha", { ascending: false, nullsFirst: false }).order("orden", { ascending: false }),
    sb.from("crm_mensajes").select("direccion, de, fecha, texto, resumen, datos_extraidos, idioma").eq("ficha_id", fichaId).order("fecha", { ascending: false }).limit(30),
    sb.from("crm_conocimiento").select("clave, titulo, tipo, texto").eq("carril", CARRIL_CATALOGO).eq("activo", true).order("orden").order("clave"),
  ]);
  if (fichaR.error || !fichaR.data) throw new Error(fichaR.error?.message ?? "Ficha no encontrada");
  const f = fichaR.data as Record<string, string | null>;
  const registro = (regR.data ?? []) as Linea[]; // más reciente primero
  const mensajes = (msgR.data ?? []) as Msg[];
  const docs = (docsR.data ?? []) as Doc[];
  const catalogo = docs.filter((d) => d.tipo === TIPO_CATALOGO);
  const shows = catalogo.filter((d) => d.clave !== CLAVE_CONDICIONES && d.clave !== CLAVE_NOTAS).map((d) => ({ clave: d.clave, titulo: d.titulo ?? d.clave }));

  // Show: el que pida Alain; si no, el último que se nombre en el Registro o en los correos.
  let show = showPedido && shows.some((s) => s.clave === showPedido) ? showPedido : null;
  let origen_show: ResultadoPrompt["origen_show"] = show ? "elegido" : "ninguno";
  if (!show) {
    const textos = [
      ...registro.map((r) => ({ fecha: r.fecha ?? "", t: r.texto })),
      ...mensajes.map((m) => ({ fecha: (m.fecha ?? "").slice(0, 10), t: `${m.texto ?? ""}\n${m.resumen ?? ""}` })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (const { t } of textos) {
      const bajo = t.toLowerCase();
      const hit = shows.map((s) => ({ s, i: bajo.indexOf(nombreCorto(s.titulo).toLowerCase()) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];
      if (hit) { show = hit.s.clave; origen_show = "detectado"; break; }
    }
  }
  const docShow = catalogo.find((d) => d.clave === show) ?? null;

  const entrantes = mensajes.filter((m) => m.direccion === "entrante" && (m.texto ?? "").trim());
  const ultimo = entrantes[0] ?? null;
  const fechaEvento = entrantes.map((m) => m.datos_extraidos?.fecha_evento).find((v) => typeof v === "string" && v.trim()) as string | undefined;

  const contactosNuevos = registro.filter((r) => /contacto nuevo/i.test(r.texto)).slice(0, 1);
  const peticion = registro.find((r) => (r.canal ?? "").toLowerCase().startsWith("recib") || /^recibido/i.test(r.texto));
  const preciosDados = registro.filter((r) => /€/.test(r.texto) && /(propuesta|precio|presupuesto|cachet|coste)/i.test(r.texto) && !/(gaztelek|último evento)/i.test(r.texto)).slice(0, 2);
  const RE_FACT = /e-?faktura|ticketbai|\bface\b|factura electr|orden de (compra|pedido)|n[uú]mero de pedido|expediente|contrato/i;
  const facturacion: string[] = [
    ...registro.filter((r) => RE_FACT.test(r.texto)).slice(0, 3).map((r) => `- Registro ${fmt(r.fecha)}: ${r.texto}`),
    ...entrantes.flatMap((m) => (m.texto ?? "").split(/(?<=[.!?\n])\s+/).filter((fr) => RE_FACT.test(fr)).slice(0, 2).map((fr) => `- Su correo del ${fmt(m.fecha)}: «${fr.trim().slice(0, 240)}»`)).slice(0, 2),
  ];

  const idioma = IDIOMA[f.idioma ?? ""] ?? IDIOMA[ultimo?.idioma ?? ""] ?? FALTA;
  const email = f.responsable_email || f.email;
  const tel = [f.responsable_tel, f.telefono].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" / ");

  const sShow = docShow ? secciones(docShow.texto) : {};
  const condiciones = catalogo.find((d) => d.clave === CLAVE_CONDICIONES);
  const formaPago = condiciones ? limpiar(seccion(secciones(condiciones.texto), "forma de pago")) : "";
  const niveles = docs.map((d) => limpiar(seccion(secciones(d.texto), "niveles de cobro"))).find((t) => t.trim()) ?? "";

  const b: string[] = [];
  b.push(`Monta el presupuesto para ${f.nombre}. Usa SOLO estos datos (salen del panel /admin). Donde ponga «${FALTA}», pregúntamelo todo en una sola tanda antes de montar el PDF; no lo rellenes tú.`);
  b.push("", "CLIENTE Y CONTACTO",
    `- Entidad: ${f.nombre}`,
    `- Tipo de entidad: ${f.tipo_entidad || FALTA}`,
    `- Contacto: ${f.responsable || FALTA}${f.responsable_cargo ? ` · ${f.responsable_cargo}` : " · cargo: " + FALTA}`,
    `- Email: ${email || FALTA}`,
    `- Teléfono: ${tel || FALTA}`,
    `- Idioma del presupuesto: ${idioma}`);
  for (const c of contactosNuevos) b.push(`- Ojo, contacto nuevo apuntado en el Registro (${fmt(c.fecha)}): ${c.texto.replace(/^[\s\S]*?contacto nuevo:\s*/i, "")} (¿es a quien va el presupuesto?)`);

  b.push("", "EVENTO",
    `- Tipo de evento: ${FALTA} (si su último mensaje lo dice, tómalo de ahí y dímelo)`,
    `- Fecha: ${fechaEvento ? `${fechaEvento} (sacada de su correo; confirmar si es fecha cerrada o aproximada)` : FALTA}`,
    `- Lugar: ${FALTA}${f.localidad ? ` (la ficha es de ${f.localidad})` : ""}`);
  if (peticion) b.push(`- Lo último apuntado en el Registro sobre su petición (${fmt(peticion.fecha)}): ${peticion.texto}`);

  if (docShow) {
    b.push("", `FORMATO: ${docShow.titulo} (catálogo de shows del panel${origen_show === "detectado" ? "; elegido porque es el que sale en el Registro o en los correos con este cliente" : ""})`,
      "Qué es:", oFalta(limpiar(seccion(sShow, "qué es"))),
      "Formato y espacio:", oFalta(limpiar(seccion(sShow, "formato"))),
      "Duración:", oFalta(limpiar(seccion(sShow, "duración"))),
      "Aforo:", oFalta(limpiar(seccion(sShow, "aforo"))),
      "Necesidades técnicas:", oFalta(limpiar(seccion(sShow, "necesidades"))),
      "", "PRECIO DE REFERENCIA (+ IVA, del catálogo)", oFalta(limpiar(seccion(sShow, "precio")).split("\n").filter((l) => !/^\s*-\s*fuente:/i.test(l)).join("\n")));
    const incluye = limpiar(seccion(sShow, "qué incluye"));
    if (incluye) b.push("Qué incluye:", incluye);
  } else {
    b.push("", `FORMATO: ${FALTA} (no se ha podido saber qué show; elígelo en el panel antes de copiar)`, "", "PRECIO DE REFERENCIA (+ IVA)", `- ${FALTA}`);
  }
  for (const p of preciosDados) b.push(`- Ya comunicado a este cliente (Registro ${fmt(p.fecha)}): ${p.texto}`);

  b.push("", "CONDICIONES DE COBRO HABITUALES",
    formaPago ? `Forma de pago (catálogo, condiciones generales):\n${formaPago}` : `- Forma de pago: ${FALTA}`);
  if (niveles) b.push(`Niveles de cobro (Guía comercial; tipo de entidad: ${f.tipo_entidad || "sin dato"}):\n${niveles}`);

  b.push("", "HISTÓRICO CON EL CLIENTE",
    `- Último evento: ${f.ultimo_evento ? `${f.ultimo_evento}${f.fecha_ultimo_evento ? ` (${fmt(f.fecha_ultimo_evento)})` : ""}` : FALTA}`);

  b.push("", "FACTURACIÓN", ...(facturacion.length ? facturacion : [`- Cómo factura: ${FALTA}`]));

  b.push("", ultimo ? `ÚLTIMO MENSAJE DEL CLIENTE (${fmt(ultimo.fecha)}${ultimo.de ? `, ${ultimo.de}` : ""})` : "ÚLTIMO MENSAJE DEL CLIENTE");
  b.push(ultimo ? `"""\n${cuerpoSinCitas(ultimo.texto ?? "")}\n"""` : `- No hay correo suyo en el panel (si fue por WhatsApp o teléfono: ${FALTA})`);

  b.push("", "Después prepárame el mail corto en el idioma del cliente para enviarlo");
  const prompt = b.join("\n");
  return { prompt, shows, show, origen_show, faltan: prompt.split(FALTA).length - 1 };
}
