// App de Entrenatzaile · fase 7a: lógica del lado de Alain.
//
// - generarAvisos(): crea la cola de avisos de una semana según el
//   "Protocolo de notificaciones y formularios" del vault (D-1 20:00, D 9:00,
//   formulario post-sesión, D 21:00 si no registra, recuperación D+1 14:00,
//   resumen del domingo 19:00). Respeta los avisos que Alain ya editó.
// - copiarSemana(): la semana siguiente a partir de una anterior (mismas
//   sesiones y ejercicios, +7 días), en borrador, para que Alain ajuste.
// - semanaMarkdown(): la semana en el mismo formato que las notas de plan del
//   vault (el importador lo vuelve a leer), con la tabla de avisos.
//
// Nada de esto envía nada: el envío llega con la fase 7b (ent_avisos_envio).

import { supabaseCharlas } from "./charlas";

export type TipoAviso = "aviso_dia_antes" | "recordatorio_dia" | "si_no_registra" | "formulario_post" | "formulario_recuperacion" | "resumen_domingo" | "manual";

export interface Ejercicio {
  id: string;
  sesion_id: string;
  orden: number;
  nombre: string;
  series: number | null;
  reps: string | null;
  carga: string | null;
  tempo: string | null;
  descanso: string | null;
  rir: string | null;
  notas: string | null;
  video: boolean;
  superserie: string | null;
  campos: string[];
}
export interface Sesion {
  id: string;
  semana_id: string;
  cliente_id: string;
  sesion_tipo_id: string | null;
  clave: string | null;
  nombre: string;
  fecha: string;
  duracion_min: number | null;
  foco: string | null;
  calentamiento: string | null;
  notas: string | null;
  estado: string;
  ejercicios?: Ejercicio[];
}
export interface Aviso {
  id: string;
  cliente_id: string;
  semana_id: string | null;
  sesion_id: string | null;
  tipo: TipoAviso;
  programado_para: string;
  canal: string;
  texto: string | null;
  estado: string;
  editado: boolean;
}

const DIA_LARGO = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIA_CORTO = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function sumarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diaSemana(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
}

/** Fecha + hora de Madrid → ISO UTC (con horario de verano). */
export function madridAUtc(fecha: string, hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const guess = new Date(`${fecha}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const enMadrid = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const enUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (enMadrid.getTime() - enUtc.getTime())).toISOString();
}
/** ISO UTC → { fecha, hora } en Madrid. */
export function utcAMadrid(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { fecha: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour").replace("24", "00")}:${g("minute")}` };
}

const HORAS_DEFECTO = { dia_antes: "20:00", recordatorio: "09:00", si_no_registra: "21:00", recuperacion: "14:00", resumen_domingo: "19:00" };

async function horas() {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", "ent_horas").maybeSingle();
  const v = data?.valor;
  const obj = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return {}; } })() : v ?? {};
  return { ...HORAS_DEFECTO, ...(obj as Partial<typeof HORAS_DEFECTO>) };
}

function lista(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`;
}
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Texto por defecto de cada aviso (Alain lo puede reescribir en el panel). */
export function textoAviso(tipo: TipoAviso, s: Sesion | null, ejercicios: Ejercicio[]): string | null {
  if (!s) return null;
  const nombre = s.nombre.replace(/^([A-Z])\s*·\s*/, "$1, la de ").replace(/, la de (.+)$/, (_m, x: string) => `, la de ${minus(x)}`);
  const videos = ejercicios.filter((e) => e.video).map((e) => minus(e.nombre.split(/[,(]/)[0].trim()));
  switch (tipo) {
    case "aviso_dia_antes":
      return `Mañana ${DIA_LARGO[diaSemana(s.fecha)]} toca la ${nombre}${s.duracion_min ? `, unos ${s.duracion_min} min` : ""}.${videos.length ? ` Graba ${lista(videos)}.` : ""}`;
    case "recordatorio_dia":
      return `Hoy toca la ${nombre}.${s.foco ? ` ${s.foco}` : ""}`;
    case "si_no_registra":
      return "¿Al final hoy no ha podido ser? ¿Cuándo la metes?";
    default:
      return null;
  }
}

/**
 * Crea o actualiza los avisos de una semana según el protocolo. Los avisos
 * editados a mano o ya enviados no se tocan; los que sobran (una sesión
 * borrada o movida) se cancelan.
 */
export async function generarAvisos(semanaId: string) {
  const sb = supabaseCharlas();
  const { data: semana, error } = await sb.from("ent_semanas").select("id, cliente_id, numero, lunes").eq("id", semanaId).single();
  if (error || !semana) throw new Error(error?.message ?? "Semana no encontrada");
  const [{ data: cliente }, { data: sesiones }, { data: existentes }, h] = await Promise.all([
    sb.from("ent_clientes").select("aviso_canal").eq("id", semana.cliente_id).single(),
    sb.from("ent_sesiones").select("*, ejercicios:ent_ejercicios(*)").eq("semana_id", semanaId).neq("estado", "saltada").order("fecha"),
    sb.from("ent_avisos").select("*").eq("semana_id", semanaId),
    horas(),
  ]);
  const canal = cliente?.aviso_canal && cliente.aviso_canal !== "ninguno" ? cliente.aviso_canal : "push";
  const ahora = Date.now();
  type Deseado = { tipo: TipoAviso; sesion_id: string | null; programado_para: string; canal: string; texto: string | null; borrador?: boolean };
  const deseados: Deseado[] = [];
  for (const s of (sesiones ?? []) as Sesion[]) {
    const ej = (s.ejercicios ?? []) as Ejercicio[];
    const dow = diaSemana(s.fecha);
    // El aviso del día antes de un lunes va dentro del resumen del domingo.
    if (dow !== 1) deseados.push({ tipo: "aviso_dia_antes", sesion_id: s.id, programado_para: madridAUtc(sumarDias(s.fecha, -1), h.dia_antes), canal, texto: textoAviso("aviso_dia_antes", s, ej) });
    deseados.push({ tipo: "recordatorio_dia", sesion_id: s.id, programado_para: madridAUtc(s.fecha, h.recordatorio), canal, texto: textoAviso("recordatorio_dia", s, ej) });
    deseados.push({ tipo: "formulario_post", sesion_id: s.id, programado_para: madridAUtc(s.fecha, h.recordatorio), canal: "app", texto: null });
    deseados.push({ tipo: "si_no_registra", sesion_id: s.id, programado_para: madridAUtc(s.fecha, h.si_no_registra), canal, texto: textoAviso("si_no_registra", s, ej) });
    deseados.push({ tipo: "formulario_recuperacion", sesion_id: s.id, programado_para: madridAUtc(sumarDias(s.fecha, 1), h.recuperacion), canal: "app", texto: null });
  }
  // Resumen del domingo (se escribe ese día con lo que haya pasado: queda en borrador).
  deseados.push({ tipo: "resumen_domingo", sesion_id: null, programado_para: madridAUtc(sumarDias(semana.lunes, 6), h.resumen_domingo), canal, texto: null, borrador: true });

  const clave = (a: { tipo: string; sesion_id: string | null }) => `${a.tipo}|${a.sesion_id ?? ""}`;
  const previos = new Map((existentes ?? []).map((a) => [clave(a), a as Aviso]));
  const res = { creados: 0, actualizados: 0, respetados: 0, cancelados: 0 };
  const nuevos: Record<string, unknown>[] = [];
  for (const d of deseados) {
    const pasado = new Date(d.programado_para).getTime() < ahora;
    const prev = previos.get(clave(d));
    previos.delete(clave(d));
    if (!prev) {
      nuevos.push({ cliente_id: semana.cliente_id, semana_id: semanaId, sesion_id: d.sesion_id, tipo: d.tipo, programado_para: d.programado_para, canal: d.canal, texto: d.texto, estado: pasado ? "omitido" : d.borrador ? "borrador" : "programado" });
      continue;
    }
    if (prev.editado || prev.estado === "enviado") {
      // Se respeta el texto; si la sesión cambió de día, se mueve la hora.
      if (prev.estado !== "enviado" && prev.programado_para !== d.programado_para) await sb.from("ent_avisos").update({ programado_para: d.programado_para }).eq("id", prev.id);
      res.respetados++;
      continue;
    }
    await sb.from("ent_avisos").update({ programado_para: d.programado_para, canal: d.canal, texto: d.texto ?? prev.texto, estado: pasado ? "omitido" : d.borrador ? (prev.texto ? "programado" : "borrador") : "programado" }).eq("id", prev.id);
    res.actualizados++;
  }
  if (nuevos.length) {
    const { error: e2 } = await sb.from("ent_avisos").insert(nuevos);
    if (e2) throw new Error(e2.message);
    res.creados = nuevos.length;
  }
  // Lo que sobra (sesión borrada o saltada): cancelado, salvo lo ya enviado o los manuales.
  const sobran = [...previos.values()].filter((a) => a.estado !== "enviado" && a.tipo !== "manual").map((a) => a.id);
  if (sobran.length) {
    await sb.from("ent_avisos").update({ estado: "cancelado" }).in("id", sobran);
    res.cancelados = sobran.length;
  }
  return res;
}

/** Copia una semana a la siguiente (número +1, fechas +7), en borrador y sin avisos. */
export async function copiarSemana(semanaId: string) {
  const sb = supabaseCharlas();
  const { data: s, error } = await sb.from("ent_semanas").select("*").eq("id", semanaId).single();
  if (error || !s) throw new Error(error?.message ?? "Semana no encontrada");
  const { data: ultima } = await sb.from("ent_semanas").select("numero, lunes").eq("plan_id", s.plan_id).order("numero", { ascending: false }).limit(1).single();
  const numero = (ultima?.numero ?? s.numero) + 1;
  const lunes = sumarDias(ultima?.lunes ?? s.lunes, 7);
  const salto = Math.round((new Date(`${lunes}T12:00:00Z`).getTime() - new Date(`${s.lunes}T12:00:00Z`).getTime()) / 86400000);
  const { data: plan } = await sb.from("ent_planes").select("fases").eq("id", s.plan_id).single();
  const fase = ((plan?.fases ?? []) as { semanas: string; fase: string }[]).find((f) => {
    const [a, b] = String(f.semanas).split("-").map(Number);
    return numero >= a && numero <= (b || a);
  });
  const { data: nueva, error: e1 } = await sb
    .from("ent_semanas")
    .insert({ plan_id: s.plan_id, cliente_id: s.cliente_id, numero, lunes, fase: fase?.fase ?? s.fase, rir_objetivo: s.rir_objetivo, titulo: null, notas: null, estado: "borrador" })
    .select()
    .single();
  if (e1 || !nueva) throw new Error(e1?.message ?? "No se pudo crear la semana");
  const { data: sesiones } = await sb.from("ent_sesiones").select("*, ejercicios:ent_ejercicios(*)").eq("semana_id", semanaId).order("fecha");
  for (const ses of (sesiones ?? []) as Sesion[]) {
    const { data: nses } = await sb
      .from("ent_sesiones")
      .insert({ semana_id: nueva.id, cliente_id: ses.cliente_id, sesion_tipo_id: ses.sesion_tipo_id, clave: ses.clave, nombre: ses.nombre, fecha: sumarDias(ses.fecha, salto), duracion_min: ses.duracion_min, foco: null, calentamiento: ses.calentamiento, notas: null })
      .select("id")
      .single();
    const ej = (ses.ejercicios ?? []).sort((a, b) => a.orden - b.orden);
    if (nses && ej.length)
      await sb.from("ent_ejercicios").insert(
        ej.map((e) => ({ sesion_id: nses.id, orden: e.orden, nombre: e.nombre, series: e.series, reps: e.reps, carga: e.carga, tempo: e.tempo, descanso: e.descanso, rir: e.rir, notas: e.notas, video: false, superserie: e.superserie, campos: (e.campos ?? []).filter((c) => c !== "video") })),
      );
  }
  return nueva;
}

const TIPO_TXT: Record<TipoAviso, string> = {
  aviso_dia_antes: "Aviso: mañana toca",
  recordatorio_dia: "Recordatorio: hoy toca",
  formulario_post: "Formulario post-sesión",
  si_no_registra: "Solo si no ha registrado",
  formulario_recuperacion: "Formulario de recuperación",
  resumen_domingo: "Resumen + aviso del lunes",
  manual: "Aviso",
};

function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MES[m - 1]}`;
}

export function lineaEjercicio(e: Ejercicio, i: number) {
  const partes: string[] = [];
  if (e.series && e.reps) partes.push(`${e.series} × ${e.reps}`);
  else if (e.reps) partes.push(e.reps);
  if (e.carga) partes.push(`**${e.carga}**`);
  if (e.tempo) partes.push(e.tempo);
  if (e.rir) partes.push(`RIR ${e.rir}`);
  if (e.descanso) partes.push(`descanso ${e.descanso}`);
  let txt = `${i}. **${e.nombre}:** ${partes.join(" · ")}`;
  if (e.notas) txt += `${partes.length ? " · " : ""}${e.notas}`;
  if (e.video && !/v[ií]deo/i.test(e.notas ?? "")) txt += ". **Vídeo.**";
  return txt.replace(/\.\.$/, ".");
}

/** La semana en el formato de las notas del vault (lo vuelve a leer el importador). */
export function semanaMarkdown(semana: { numero: number; lunes: string; titulo: string | null; notas: string | null; rir_objetivo: string | null; fase: string | null }, sesiones: Sesion[], avisos: Aviso[]) {
  const dom = sumarDias(semana.lunes, 6);
  const out: string[] = [];
  out.push(`## Semana ${semana.numero} (${fechaCorta(semana.lunes).split(" ")[0]}-${fechaCorta(dom)})${semana.titulo ? ` · ${semana.titulo}` : ""}`, "");
  if (semana.fase || semana.rir_objetivo) out.push(`*${[semana.fase, semana.rir_objetivo ? `RIR ${semana.rir_objetivo}` : null].filter(Boolean).join(" · ")}*`, "");
  if (semana.notas) out.push(semana.notas, "");
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semana.lunes, i));
  out.push(`| ${dias.map((d) => `${DIA_CORTO[diaSemana(d)]} ${Number(d.slice(8))}`).join(" | ")} |`, `|${dias.map(() => "---").join("|")}|`);
  out.push(`| ${dias.map((d) => sesiones.filter((s) => s.fecha === d).map((s) => `**${s.nombre}**`).join(" + ") || "descanso").join(" | ")} |`, "");
  const calent = [...new Set(sesiones.map((s) => s.calentamiento).filter(Boolean))];
  if (calent.length === 1) out.push(`**Calentamiento${sesiones.length > 1 ? " (todos los días)" : ""}:** ${calent[0]}`, "");
  for (const s of sesiones) {
    out.push(`**${s.nombre} (${DIA_LARGO[diaSemana(s.fecha)]})**${s.duracion_min ? ` — ~${s.duracion_min} min` : ""}`);
    if (s.foco) out.push(`*${s.foco}*`);
    if (calent.length > 1 && s.calentamiento) out.push(`Calentamiento: ${s.calentamiento}`);
    (s.ejercicios ?? []).sort((a, b) => a.orden - b.orden).forEach((e, i) => out.push(lineaEjercicio(e, i + 1)));
    if (s.notas) out.push("", s.notas);
    out.push("");
  }
  const vivos = avisos.filter((a) => a.estado !== "cancelado").sort((a, b) => a.programado_para.localeCompare(b.programado_para));
  if (vivos.length) {
    out.push(`### Avisos y formularios de la semana ${semana.numero}`, "", "| Cuándo | Qué | Texto |", "|---|---|---|");
    for (const a of vivos) {
      const { fecha, hora } = utcAMadrid(a.programado_para);
      const cuando = `${DIA_CORTO[diaSemana(fecha)]} ${Number(fecha.slice(8))} · ${a.tipo === "formulario_post" ? "al acabar" : hora}`;
      out.push(`| ${cuando} | ${TIPO_TXT[a.tipo]} | ${a.texto ? `"${a.texto.replace(/\|/g, "/")}"` : "—"} |`);
    }
    out.push("");
  }
  return out.join("\n");
}
