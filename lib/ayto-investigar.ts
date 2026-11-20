// Investigación web de los ayuntamientos (vía Ayuntamientos).
//
// Para cada ayuntamiento en estado 0-2 o 9 sin investigar (o investigado hace
// más de 120 días), de más a menos población:
//   1. Encuentra su web (la de la ficha o probando <pueblo>.eus, .net, .org…).
//   2. Lee la portada y las páginas que más prometen (corporación/udalbatza,
//      concejales/zinegotziak, educación/hezkuntza, cultura, juventud,
//      contacto…), solo del mismo dominio.
//   3. Una llamada corta a la IA (Haiku, sin el conocimiento) que saca de ese
//      texto el buzón general y quién lleva Educación, Cultura/Fiestas,
//      Juventud y Prevención. Solo vale lo que aparece en las páginas: un
//      correo que no esté en ellas se descarta.
//   4. Rellena la ficha (solo los campos vacíos), añade los contactos y deja
//      una línea en el Registro. No envía nada a nadie.
//
// Corre desde el cron fuera de las ventanas de IA, como el rastreo.

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { llamarClaude } from "./charlas-ia";
import { configAyto } from "./ayuntamientos";
import { BUZON_GENERAL } from "./ayto-flujo";

const MODELO = "claude-haiku-5-5";
const UA = "Mozilla/5.0 (compatible; AlainZulaikaBot/1.0; +https://alainzulaika.com)";
const DESCARTAR = /noreply|no-reply|example|sentry|wixpress|dpd|dbo|lopd|protecciondatos|datuenbabes|@(w3\.org|schema\.org|apple\.com|google\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com|euskadi\.eus|bizkaia\.eus|gipuzkoa\.eus|araba\.eus)$/i;

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const compacto = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");

async function bajar(url: string, ms = 7000): Promise<{ url: string; html: string } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA, "accept-language": "eu,es;q=0.9" } });
    clearTimeout(t);
    if (!r.ok) return null;
    if (!/text\/html|application\/xhtml/.test(r.headers.get("content-type") ?? "")) return null;
    return { url: r.url || url, html: (await r.text()).slice(0, 800_000) };
  } catch {
    return null;
  }
}

/** Dominios probables de la web municipal a partir del nombre del municipio. */
export function dominiosCandidatos(localidad: string): string[] {
  const partes = localidad.split(/\s*\/\s*/).filter(Boolean).slice(0, 2);
  const slugs = new Set<string>();
  for (const p of partes) {
    const base = norm(p).replace(/['’`]/g, "");
    slugs.add(base.replace(/[^a-z0-9]+/g, ""));
    if (/[\s-]/.test(base)) slugs.add(base.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  }
  const urls: string[] = [];
  for (const s of slugs) {
    if (!s) continue;
    for (const tld of ["eus", "net", "org", "es", "com"]) urls.push(`https://www.${s}.${tld}`, `https://${s}.${tld}`);
    urls.push(`https://www.${s}udala.eus`, `https://www.${s}ko-udala.eus`);
  }
  return urls.slice(0, 24);
}

function pareceAyuntamiento(html: string, localidad: string): boolean {
  const texto = norm(html.slice(0, 300_000));
  const comunes = new Set(["valle", "ribera", "villa", "puebla", "alta", "baja", "erriberagoitia", "erribera"]);
  const piezas = norm(localidad).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !comunes.has(p));
  const nombres = piezas.length ? piezas : [compacto(localidad)];
  return /udal|ayuntamiento|alkate|alcald|concejo|kontzeju|town hall|city council/.test(texto) && nombres.some((n) => texto.includes(n));
}

async function encontrarWeb(web: string | null, localidad: string): Promise<{ url: string; html: string } | null> {
  if (web) {
    const r = await bajar(web.startsWith("http") ? web : `https://${web}`);
    if (r) return r;
  }
  const candidatos = dominiosCandidatos(localidad);
  const respuestas = await Promise.all(candidatos.map((u) => bajar(u, 6000)));
  for (const r of respuestas) if (r && pareceAyuntamiento(r.html, localidad)) return r;
  return null;
}

const PESOS: [RegExp, number][] = [
  [/udalbatza|corporacion|zinegotzi|concejal|gobierno-?municipal|udal-?gobern|alkatetza|alcaldia|organigrama|kargu|cargos|hautetsi|electos|batzorde|comision|ordezkari/, 6],
  [/hezkuntza|educaci/, 5],
  [/kultur|cultura|jaiak|fiestas|festejos|gazteria|gazte|juventud|prebentzio|prevenci|adikzio/, 4],
  [/kontaktu|contacto|harremanetarako|direktorio|directorio|telefono|zerbitzu|servicio|saila|areas|departament|arloak/, 3],
];

/** Enlaces del mismo sitio ordenados por lo que prometen. */
export function enlacesPrometedores(html: string, base: string, maximo = 8): string[] {
  let host = "";
  try {
    host = new URL(base).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  const puntos = new Map<string, number>();
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, "") !== host) continue;
    if (/\.(pdf|jpe?g|png|gif|docx?|xlsx?|zip|mp4|mp3)$/i.test(u.pathname)) continue;
    const clave = norm(`${u.pathname} ${m[2].replace(/<[^>]+>/g, " ")}`);
    let p = 0;
    for (const [rx, w] of PESOS) if (rx.test(clave)) p = Math.max(p, w);
    if (!p) continue;
    u.hash = "";
    const k = u.toString();
    puntos.set(k, Math.max(puntos.get(k) ?? 0, p));
  }
  return [...puntos.entries()].sort((a, b) => b[1] - a[1]).slice(0, maximo).map(([k]) => k);
}

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", ordf: "ª", ordm: "º" };
export function textoDeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/li|\/tr|\/h\d|\/div|\/td|\/dd|\/dt)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (s, n) => ENTIDADES[n] ?? s)
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** Correos de una página: mailto, texto y las ofuscaciones típicas ([at], (arroba)…). */
export function correosDe(html: string): string[] {
  const t = textoDeHtml(html)
    .replace(/\s*(\[|\()\s*(at|arroba|a bildua)\s*(\]|\))\s*/gi, "@")
    .replace(/\s*(\[|\()\s*(dot|punto|puntua)\s*(\]|\))\s*/gi, ".");
  const crudo = `${html.replace(/%40/g, "@")}\n${t}`;
  const set = new Set<string>();
  for (const m of crudo.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const e = m[0].toLowerCase().replace(/^mailto:/, "").replace(/\.$/, "");
    if (!DESCARTAR.test(e) && !/\.(png|jpe?g|gif|webp|svg)$/.test(e)) set.add(e);
  }
  return [...set];
}

const PISTAS_TEXTO = /zinegotzi|concejal|alkate|alcald|hezkuntza|educaci|kultur|cultura|jai|fiesta|gazte|juventud|prebentzio|prevenci|adikzio|t[eé]cnic|teknikari|arduradun|responsable|@|tel|\b\d{3} ?\d{2,3} ?\d{2,3}/i;

/** Texto de una página recortado a lo que importa (líneas con pistas y su entorno). */
function recortar(texto: string, maximo = 5000): string {
  if (texto.length <= maximo) return texto;
  const lineas = texto.split("\n");
  const marcadas = new Set<number>();
  lineas.forEach((l, i) => {
    if (PISTAS_TEXTO.test(l)) for (let k = Math.max(0, i - 2); k <= Math.min(lineas.length - 1, i + 2); k++) marcadas.add(k);
  });
  const sal = [...marcadas].sort((a, b) => a - b).map((i) => lineas[i]).join("\n");
  return (sal || texto).slice(0, maximo);
}

interface Persona {
  nombre?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefono?: string | null;
}
interface Hallazgos {
  email_general?: string | null;
  telefono_general?: string | null;
  educacion?: Persona | null;
  cultura?: Persona | null;
  juventud?: Persona | null;
  prevencion?: Persona | null;
  notas?: string | null;
}

const INSTRUCCIONES = `Lees el texto de varias páginas de la web de un ayuntamiento del País Vasco y sacas sus contactos. Devuelve SOLO este JSON:
{"email_general":null,"telefono_general":null,"educacion":null,"cultura":null,"juventud":null,"prevencion":null,"notas":null}
donde cada persona es {"nombre":…,"cargo":…,"email":…,"telefono":…} o null.

Reglas:
- Solo datos que aparecen tal cual en el texto. Un correo solo si está en la lista CORREOS. Nunca inventes ni deduzcas un correo por el patrón de los demás.
- educacion: el concejal o concejala (zinegotzia) de Educación (Hezkuntza), o el técnico/a de Educación si no hay concejal con correo. Vale una concejalía mixta que incluya Educación (p. ej. "Cultura y Educación", "Hezkuntza eta Gazteria").
- cultura: concejal/a o técnico/a de Cultura o Fiestas (Kultura, Jaiak). juventud: de Juventud (Gazteria, Gaztetxoak). prevencion: técnico/a de prevención de adicciones, drogodependencias o salud.
- Si una persona aparece con nombre pero sin correo propio, pon su nombre y cargo y email null.
- email_general: el buzón general del ayuntamiento (info@, udala@, registro@, harrera@, sac@…). telefono_general: el de la centralita.
- cargo: corto y en el idioma en que aparece ("Hezkuntza zinegotzia", "Concejala de Educación y Cultura").
- notas: una línea en castellano si hay algo útil (p. ej. "Educación y Cultura las lleva la misma concejala", "solo hay formulario de contacto"). null si nada.`;

function validar(h: Hallazgos, correos: Set<string>, texto: string): Hallazgos {
  const t = compacto(texto);
  const correo = (e?: string | null) => {
    const x = (e ?? "").trim().toLowerCase();
    return x && correos.has(x) ? x : null;
  };
  const tel = (s?: string | null) => {
    const d = (s ?? "").replace(/\D/g, "");
    return d.length >= 9 && t.includes(d.slice(-9)) ? (s ?? "").trim() : null;
  };
  const persona = (p?: Persona | null): Persona | null => {
    if (!p) return null;
    const nombre = p.nombre && p.nombre.trim().length >= 3 && t.includes(compacto(p.nombre)) ? p.nombre.trim() : null;
    const email = correo(p.email);
    const telefono = tel(p.telefono);
    if (!nombre && !email) return null;
    return { nombre, cargo: (p.cargo ?? "").trim() || null, email, telefono };
  };
  return {
    email_general: correo(h.email_general),
    telefono_general: tel(h.telefono_general),
    educacion: persona(h.educacion),
    cultura: persona(h.cultura),
    juventud: persona(h.juventud),
    prevencion: persona(h.prevencion),
    notas: (h.notas ?? "").trim().slice(0, 300) || null,
  };
}

export interface ResumenInvestigacion {
  activo: boolean;
  revisados: number;
  con_educacion: number;
  con_buzon: number;
  sin_web: number;
  errores: string[];
}

export async function investigarAyuntamientos(opciones: { presupuestoMs: number }): Promise<ResumenInvestigacion> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAyto();
  const res: ResumenInvestigacion = { activo: cfg.investigarActivo, revisados: 0, con_educacion: 0, con_buzon: 0, sin_web: 0, errores: [] };
  if (!cfg.investigarActivo || cfg.investigarPorPasada <= 0) return res;

  const [{ data: fichas }, { data: hechas }] = await Promise.all([
    sb.from("charlas_centros").select("id, nombre, estado, localidad, web, telefono, email_centro, responsable, responsable_email, responsable_cargo, responsable_tel, poblacion").eq("tipo", "ayuntamiento").order("poblacion", { ascending: false, nullsFirst: false }).limit(400),
    sb.from("charlas_investigacion").select("centro_id, investigado_en"),
  ]);
  const hace120 = Date.now() - 120 * 86400000;
  const recientes = new Set((hechas ?? []).filter((h) => new Date(h.investigado_en as string).getTime() > hace120).map((h) => h.centro_id as string));
  const cola = (fichas ?? []).filter((f) => {
    const fase = faseDeEstado(f.estado as string);
    return (fase <= 2 || fase === 9) && f.localidad && !recientes.has(f.id as string) && (cfg.poblacionMinima <= 0 || (f.poblacion ?? 0) >= cfg.poblacionMinima);
  });

  for (const f of cola.slice(0, cfg.investigarPorPasada)) {
    // Un ayuntamiento tarda 15-25 s (red + IA): no se empieza otro si no da tiempo.
    if (Date.now() - inicio > opciones.presupuestoMs * 0.45 && res.revisados > 0) break;
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    res.revisados++;
    try {
      const r = await investigarUno(f as FichaInv);
      if (r === "concejal") res.con_educacion++;
      else if (r === "buzon") res.con_buzon++;
      else if (r === "sin_web") res.sin_web++;
    } catch (e) {
      res.errores.push(`${f.nombre}: ${(e as Error).message}`);
      await sb.from("charlas_investigacion").upsert({ centro_id: f.id, resultado: "error", error: (e as Error).message.slice(0, 500), investigado_en: new Date().toISOString() });
    }
  }
  return res;
}

interface FichaInv {
  id: string;
  nombre: string;
  localidad: string;
  web: string | null;
  telefono: string | null;
  email_centro: string | null;
  responsable: string | null;
  responsable_email: string | null;
  responsable_cargo: string | null;
  responsable_tel: string | null;
}

export async function investigarUno(f: FichaInv): Promise<string> {
  const sb = supabaseCharlas();
  const portada = await encontrarWeb(f.web, f.localidad);
  if (!portada) {
    await sb.from("charlas_investigacion").upsert({ centro_id: f.id, web: f.web, paginas: [], hallazgos: {}, resultado: "sin_web", error: null, investigado_en: new Date().toISOString() });
    await sb.from("charlas_interacciones").insert({ centro_id: f.id, fecha: hoy(), canal: "Sistema", texto: "Investigación web: no se ha encontrado la web del ayuntamiento. Si la conoces, pégala en la ficha y se volverá a mirar.", orden: 610, origen: "sistema" });
    return "sin_web";
  }

  const origen = new URL(portada.url).origin;
  const enlaces = enlacesPrometedores(portada.html, portada.url, 8);
  const paginas = [portada, ...(await Promise.all(enlaces.map((u) => bajar(u)))).filter((p): p is { url: string; html: string } => !!p)];

  const correos = new Set<string>();
  const bloques: string[] = [];
  let todo = "";
  for (const p of paginas) {
    for (const e of correosDe(p.html)) correos.add(e);
    const texto = textoDeHtml(p.html);
    todo += `\n${texto}`;
    bloques.push(`<pagina url="${p.url}">\n${recortar(texto)}\n</pagina>`);
  }

  let h: Hallazgos = {};
  if (correos.size || /zinegotzi|concejal/i.test(todo)) {
    const respuesta = await llamarClaude({
      system: [{ type: "text", text: INSTRUCCIONES }],
      usuario: `Municipio: ${f.localidad}\nWeb: ${origen}\n\nCORREOS encontrados en estas páginas:\n${[...correos].join("\n") || "(ninguno)"}\n\n${bloques.join("\n\n").slice(0, 40000)}`,
      proposito: "ayto_investigar",
      maxTokens: 900,
      modelo: MODELO,
    });
    const ini = respuesta.indexOf("{");
    const fin = respuesta.lastIndexOf("}");
    if (ini >= 0 && fin > ini) {
      try {
        h = validar(JSON.parse(respuesta.slice(ini, fin + 1)) as Hallazgos, correos, todo);
      } catch {
        h = {};
      }
    }
  }
  // Si la IA no ha visto buzón general pero hay uno evidente en la lista, se usa.
  if (!h.email_general) h.email_general = [...correos].find((e) => BUZON_GENERAL.test(e)) ?? null;

  // Ficha: solo campos vacíos. Nunca se pisa lo que ya había.
  const cambios: Record<string, unknown> = {};
  if (!f.web) cambios.web = origen;
  if (!f.telefono && h.telefono_general) cambios.telefono = h.telefono_general;
  if (!f.email_centro && h.email_general) cambios.email_centro = h.email_general;
  const edu = h.educacion;
  if (edu && !f.responsable_email) {
    if (edu.email) {
      cambios.responsable_email = edu.email;
      if (edu.nombre) cambios.responsable = edu.nombre;
      if (edu.cargo) cambios.responsable_cargo = edu.cargo;
      if (edu.telefono) cambios.responsable_tel = edu.telefono;
    } else if (!f.responsable && edu.nombre) {
      cambios.responsable = edu.nombre;
      if (edu.cargo) cambios.responsable_cargo = edu.cargo;
    }
  }
  if (Object.keys(cambios).length) await sb.from("charlas_centros").update({ ...cambios, actualizado_por: "sistema" }).eq("id", f.id);

  // Contactos (los que tienen correo; el índice único evita repetirlos).
  const personas: [Persona | null | undefined, "responsable" | "otro"][] = [
    [h.educacion, "responsable"],
    [h.cultura, "otro"],
    [h.juventud, "otro"],
    [h.prevencion, "otro"],
  ];
  for (const [p, rol] of personas) {
    if (!p?.email) continue;
    await sb.from("charlas_contactos").insert({ centro_id: f.id, nombre: p.nombre ?? null, cargo: p.cargo ?? null, email: p.email, telefono: p.telefono ?? null, rol, origen: "web" });
  }

  const describe = (etq: string, p?: Persona | null) => (p ? `${etq}: ${[p.nombre, p.cargo, p.email, p.telefono].filter(Boolean).join(" · ")}` : null);
  const resultado = edu?.email ? "concejal" : h.email_general || correos.size ? "buzon" : "sin_correo";
  const linea = [
    `Investigación web (${origen}, ${paginas.length} páginas)`,
    h.email_general ? `buzón general: ${h.email_general}` : null,
    describe("Educación", h.educacion),
    describe("Cultura/Fiestas", h.cultura),
    describe("Juventud", h.juventud),
    describe("Prevención", h.prevencion),
    resultado === "sin_correo" ? "sin ningún correo en la web" : null,
    h.notas,
  ]
    .filter(Boolean)
    .join(" · ");
  await sb.from("charlas_interacciones").insert({ centro_id: f.id, fecha: hoy(), canal: "Sistema", texto: linea, orden: 610, origen: "sistema" });
  await sb.from("charlas_investigacion").upsert({ centro_id: f.id, web: origen, paginas: paginas.map((p) => p.url), hallazgos: { ...h, correos: [...correos].slice(0, 30) }, resultado, error: null, investigado_en: new Date().toISOString() });
  return resultado;
}
