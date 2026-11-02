// Rastreo web de contactos: para centros sin correo del responsable, visita
// la web del centro (la de la ficha o la deducida del dominio de su correo)
// y busca direcciones de orientación, jefatura de estudios, dirección o
// secretaría. Lo encontrado va a charlas_contactos (origen 'web') y, si la
// ficha no tenía correo directo, se propone como responsable_email con una
// línea en el Registro. No llama a nadie ni envía nada.
//
// Corre desde el cron (fuera de las ventanas de IA, para repartir carga) a
// `rastreo_por_ejecucion` centros por pasada, y solo en los territorios o
// estados que tengan sentido: estado 0-2 o 9 sin responsable_email.

import { supabaseCharlas, faseDeEstado } from "./charlas";

const PISTAS: [RegExp, string, number][] = [
  [/prebentzio|prevenci|adikzio|adiccion|drogodep/i, "prevención de adicciones", 6],
  [/orienta|orientazio|orientatzail/i, "orientación", 5],
  [/jefatura|ikasketaburu|ikasketa|jefedeestudios|jestudios/i, "jefatura de estudios", 5],
  [/direcci|zuzendari|zuzendaritza|director/i, "dirección", 4],
  [/dbh|eso|secundaria|bigarren/i, "coordinación ESO", 4],
  [/extraescolar|eskolaz|actividades|jarduer/i, "actividades", 4],
  [/hezkuntza|educacion|gazteria|juventud|gaztedi/i, "educación / juventud", 4],
  [/gizarte|sociales|ongizate|bienestar|osasun|salud/i, "servicios sociales / salud", 3],
  [/secretar|idazkari|administra/i, "secretaría", 2],
  [/info|kontaktu|contacto|general|^[a-z0-9.]+@/i, "buzón general", 1],
];
const DESCARTAR = /noreply|no-reply|example|sentry|wixpress|@(w3\.org|schema\.org|apple\.com|google\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com)/i;
const PAGINAS_CANDIDATAS = ["", "/contacto", "/contacto/", "/kontaktua", "/harremana", "/contactar", "/contact", "/centro", "/ikastetxea", "/quienes-somos", "/organizacion", "/equipo", "/orientacion", "/orientazioa", "/secretaria", "/idazkaritza"];
// Para ayuntamientos: las páginas del servicio de prevención / servicios sociales / educación.
const PAGINAS_AYUNTAMIENTO = ["", "/es/servicios-sociales", "/eu/gizarte-zerbitzuak", "/es/prevencion", "/eu/prebentzioa", "/es/adicciones", "/eu/adikzioak", "/es/educacion", "/eu/hezkuntza", "/es/juventud", "/eu/gazteria", "/es/contacto", "/eu/kontaktua", "/contacto", "/kontaktua", "/es/ayuntamiento/areas", "/eu/udala/sailak", "/es/directorio", "/eu/direktorioa", "/es/telefonos", "/es/telefonos-de-interes"];

export interface EmailHallado {
  email: string;
  pista: string;
  peso: number;
  pagina: string;
}

export function dominioDe(url: string | null, email: string | null): string | null {
  if (url) {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch {
      /* sigue */
    }
  }
  if (email && email.includes("@")) {
    const d = email.split("@")[1].toLowerCase();
    if (!/hezkuntza\.net|ikastola\.eus|educacion\.navarra\.es|educantabria\.es|gmail|hotmail|outlook|yahoo/.test(d)) return d;
  }
  return null;
}

async function descargar(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; AlainZulaikaBot/1.0; +https://alainzulaika.com)" } });
    clearTimeout(t);
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/.test(tipo)) return null;
    const txt = await r.text();
    return txt.slice(0, 600_000);
  } catch {
    return null;
  }
}

/** Prueba la web de la ficha y el dominio con y sin www., por https y http. */
async function resolverBase(dominio: string, web: string | null): Promise<{ base: string; html: string } | null> {
  const candidatos: string[] = [];
  if (web) {
    try {
      const u = new URL(web.startsWith("http") ? web : `https://${web}`);
      candidatos.push(u.href);
    } catch {
      /* sigue */
    }
  }
  const sinWww = dominio.replace(/^www\./, "");
  candidatos.push(`https://${sinWww}`, `https://www.${sinWww}`, `http://www.${sinWww}`, `http://${sinWww}`);
  for (const url of [...new Set(candidatos)]) {
    const html = await descargar(url);
    if (html !== null) {
      const u = new URL(url);
      // Si la web de la ficha cuelga de una ruta (…/web/), las páginas candidatas se buscan desde ahí.
      const ruta = u.pathname.replace(/\/[^/]*\.[a-z]+$/i, "").replace(/\/$/, "");
      return { base: `${u.protocol}//${u.host}${ruta}`, html };
    }
  }
  return null;
}

export function extraerEmails(html: string, pagina: string): EmailHallado[] {
  const texto = html
    .replace(/&#64;|&commat;/g, "@")
    .replace(/\s*\[(?:at|arroba)\]\s*/gi, "@")
    .replace(/\s*\((?:at|arroba)\)\s*/gi, "@")
    .replace(/\s*\[(?:dot|punto)\]\s*/gi, ".");
  const brutos = new Set<string>();
  for (const m of texto.matchAll(/mailto:([^"'?\s>]+)/gi)) brutos.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of texto.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) brutos.add(m[0].toLowerCase());
  const out: EmailHallado[] = [];
  for (const e of brutos) {
    if (DESCARTAR.test(e) || /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(e)) continue;
    const local = e.split("@")[0];
    let pista = "otro";
    let peso = 1;
    for (const [re, nombre, p] of PISTAS) {
      if (re.test(local)) {
        pista = nombre;
        peso = p;
        break;
      }
    }
    out.push({ email: e, pista, peso, pagina });
  }
  return out;
}

// Dominios que nunca son la web de un centro (directorios, redes, prensa).
const NO_ES_EL_CENTRO = /wikipedia|facebook|instagram|twitter|x\.com|youtube|linkedin|tiktok|google\.|paginasamarillas|infoisinfo|empresite|micole|scholarum|colegiosyescuelas|educaweb|colegios\.|guiainfantil|emagister|yelp|tripadvisor|cylex|hotfrog|habitissimo|idealista|eldiario|elcorreo|deia|diariovasco|noticiasdegipuzkoa|naiz\.eus|20minutos|abc\.es|elpais|elmundo|europapress|\.gob\.es|educantabria\.es|educacion\.navarra\.es\/?$|hezkuntza\.net|ikasgunea|euskadi\.eus|navarra\.es\/?$|cantabria\.es|registro|boe\.es|datos\.gob/i;

/**
 * Busca la web oficial de un centro con Brave Search (clave en BRAVE_SEARCH_KEY,
 * plan gratuito). Devuelve la URL del primer resultado que parezca la web del
 * propio centro, o null.
 */
export async function buscarWeb(nombre: string, localidad: string | null): Promise<string | null> {
  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key) return null;
  const q = `${nombre} ${(localidad ?? "").split(/[\/(]/)[0].trim()} instituto web`.replace(/\s+/g, " ").trim();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=8&country=ES&search_lang=es`, {
    signal: ctrl.signal,
    headers: { accept: "application/json", "X-Subscription-Token": key },
  });
  clearTimeout(t);
  if (!r.ok) throw new Error(`Brave ${r.status}`);
  const j = (await r.json()) as { web?: { results?: { url: string; title?: string }[] } };
  const palabras = norm(nombre).split(" ").filter((w) => w.length > 3 && !/^(ies|ieso|colegio|instituto|centro|privado|publico|educacion|secundaria|bhi|ikastola|ikastetxea)$/.test(w));
  for (const res of j.web?.results ?? []) {
    if (NO_ES_EL_CENTRO.test(res.url)) continue;
    const host = (() => { try { return new URL(res.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    if (!host) continue;
    // Debe compartir alguna palabra del nombre con el dominio o el título.
    const texto = norm(`${host} ${res.title ?? ""}`);
    if (palabras.length === 0 || palabras.some((w) => texto.includes(w))) return `https://${host}`;
  }
  return null;
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface ResumenRastreo {
  revisados: number;
  con_emails: number;
  propuestos: number;
  errores: string[];
}

export async function rastrearContactos(opciones: { presupuestoMs: number; limite?: number }): Promise<ResumenRastreo> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const res: ResumenRastreo = { revisados: 0, con_emails: 0, propuestos: 0, errores: [] };
  const { data: cfgs } = await supabase.from("charlas_config").select("clave, valor").in("clave", ["rastreo_activo", "rastreo_por_ejecucion"]);
  const cfg = Object.fromEntries((cfgs ?? []).map((c) => [c.clave, c.valor]));
  if (cfg.rastreo_activo === false) return res;
  const limite = opciones.limite ?? Number(cfg.rastreo_por_ejecucion ?? 6);

  // Candidatos: sin correo del responsable, en estados donde el nombre importa, y no rastreados aún.
  const { data: hechos } = await supabase.from("charlas_rastreo").select("centro_id, resultado");
  // Con clave de búsqueda, los "sin_web" de antes se vuelven a intentar una vez (resultado pasa a sin_web_buscado).
  const buscador = !!process.env.BRAVE_SEARCH_KEY;
  const ya = new Set((hechos ?? []).filter((h) => !(buscador && h.resultado === "sin_web")).map((h) => h.centro_id as string));
  const { data: centros } = await supabase
    .from("charlas_centros")
    .select("id, nombre, web, email_centro, responsable_email, estado, territorio, tipo, localidad")
    .is("responsable_email", null)
    .order("territorio")
    .order("nombre")
    .range(0, 1999);
  // Fases donde el correo directo cambia algo: antes del Mail 1 (0-2), con el
  // Mail 1 genérico en marcha (3) y aparcados a reactivar (9). Ganados,
  // perdidos y los que ya conversan (4-6) no hacen falta.
  // Primero los territorios donde el Mail 1 depende de este correo (Navarra, y los ayuntamientos), luego el resto.
  const prioridad = (c: { territorio: string | null; tipo: string | null }) => (c.tipo === "ayuntamiento" ? 0 : c.territorio === "Navarra" ? 1 : c.territorio === "Cantabria" ? 3 : 2);
  const cola = (centros ?? [])
    .filter((c) => !ya.has(c.id) && [0, 1, 2, 3, 9].includes(faseDeEstado(c.estado)))
    .sort((a, b) => prioridad(a) - prioridad(b));

  for (const c of cola.slice(0, limite)) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    res.revisados++;
    let dominio = dominioDe(c.web, c.email_centro);
    if (!dominio && buscador) {
      // Sin web ni dominio propio (Cantabria, p. ej.): se busca la web del centro y se guarda en la ficha.
      const web = await buscarWeb(c.nombre, c.localidad).catch(() => null);
      if (web) {
        dominio = dominioDe(web, null);
        await supabase.from("charlas_centros").update({ web, actualizado_por: "sistema" }).eq("id", c.id);
        await supabase.from("charlas_interacciones").insert({ centro_id: c.id, fecha: new Date().toISOString().slice(0, 10), canal: "Sistema", texto: `Web del centro localizada con el buscador: ${web}`, orden: 690, origen: "sistema" });
      }
    }
    if (!dominio) {
      await supabase.from("charlas_rastreo").upsert({ centro_id: c.id, web: null, resultado: buscador ? "sin_web_buscado" : "sin_web", rastreado_en: new Date().toISOString() });
      continue;
    }
    // Muchas webs solo responden con www. o solo por http: se prueba la portada
    // en sus variantes y se usa la primera que conteste.
    const portada = await resolverBase(dominio, c.web);
    const base = portada?.base ?? `https://${dominio}`;
    const hallados = new Map<string, EmailHallado>();
    let vistas = 0;
    const esAyto = c.tipo === "ayuntamiento";
    for (const p of esAyto ? PAGINAS_AYUNTAMIENTO : PAGINAS_CANDIDATAS) {
      if (Date.now() - inicio > opciones.presupuestoMs) break;
      if (!portada) break;
      const html = p === "" ? portada.html : await descargar(base + p);
      if (html === null) continue;
      vistas++;
      for (const e of extraerEmails(html, base + p)) {
        const prev = hallados.get(e.email);
        if (!prev || prev.peso < e.peso) hallados.set(e.email, e);
      }
      // Con la portada y una página de contacto suele bastar; si ya hay algo bueno, parar.
      if (vistas >= 2 && [...hallados.values()].some((e) => e.peso >= (esAyto ? 6 : 4))) break;
      if (vistas >= (esAyto ? 8 : 5)) break;
    }
    const lista = [...hallados.values()].filter((e) => !c.email_centro || e.email !== c.email_centro.toLowerCase()).sort((a, b) => b.peso - a.peso);
    await supabase.from("charlas_rastreo").upsert({
      centro_id: c.id,
      web: base,
      paginas_vistas: vistas,
      emails_encontrados: lista,
      resultado: vistas === 0 ? "error" : lista.length ? "ok" : "sin_emails",
      rastreado_en: new Date().toISOString(),
    });
    if (!lista.length) continue;
    res.con_emails++;

    // Guardar como contactos (origen web); el mejor, si es de orientación/jefatura/dirección, se propone como responsable_email.
    for (const e of lista.slice(0, 6)) {
      await supabase
        .from("charlas_contactos")
        .insert({ centro_id: c.id, email: e.email, cargo: e.pista, rol: e.pista === "secretaría" ? "secretaria" : e.pista === "dirección" ? "direccion" : "otro", origen: "web" })
        .then(() => null, () => null);
    }
    const mejor = lista[0];
    if (mejor.peso >= 4 && !(esAyto && mejor.pista === "dirección")) {
      // Solo se escribe en la ficha si aún no hay hilo abierto (fases 0-2):
      // con un Mail 1 genérico en marcha o aparcado, cambiar el destinatario
      // rompería la regla "lo que va dentro de un hilo responde al hilo".
      // En esos casos queda en contactos y en el Registro para que Alain lo
      // pase a la ficha si quiere.
      const sinHilo = faseDeEstado(c.estado) <= 2;
      if (sinHilo) await supabase.from("charlas_centros").update({ responsable_email: mejor.email, responsable_cargo: mejor.pista, actualizado_por: "sistema" }).eq("id", c.id);
      await supabase.from("charlas_interacciones").insert({
        centro_id: c.id,
        fecha: new Date().toISOString().slice(0, 10),
        canal: "Sistema",
        texto: sinHilo
          ? `Rastreo web (${base}): correo de ${mejor.pista} encontrado, ${mejor.email}. Puesto como correo del responsable; falta el nombre.`
          : `Rastreo web (${base}): correo de ${mejor.pista} encontrado, ${mejor.email}. Guardado en contactos (no se cambia el destinatario del hilo abierto).`,
        orden: 700,
        origen: "sistema",
      });
      res.propuestos++;
    }
  }
  return res;
}
