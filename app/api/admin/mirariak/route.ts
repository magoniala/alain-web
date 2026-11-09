import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  contarOcupadas, GRUPOS, HORARIOS_MM, ocupa, PLAZAS_MM, PLAZAS_TALLER, TALLER_SESIONES,
  type Cambio, type FilaReserva, type Marcas, type ParticipanteMm, type ParticipanteTaller,
} from "@/lib/mirariak";

// MIRARIAK 2026 en el panel (Magia → Mirariak 2026).
// GET: estadísticas (taller por grupo, micromagia por horario, ritmo, idioma,
// newsletter, duplicados) + todo lo necesario para gestionar: los formularios
// con sus participantes, las listas de espera y los últimos cambios.
// POST: acciones de gestión (anular, reactivar, mover, corregir, lista de
// espera, dar plaza). Nada se borra: anular deja la marca en el participante.

export const dynamic = "force-dynamic";

const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Orden fijo de las franjas de edad: el color sigue a la franja en todas las ruedas.
const FRANJAS = ["6", "7", "8", "9", "10", "11-12", "13-17", "Adultos"] as const;
function franja(edad: number): string {
  if (edad <= 6) return "6";
  if (edad <= 10) return String(edad);
  if (edad <= 12) return "11-12";
  if (edad <= 17) return "13-17";
  return "Adultos";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const lunes = (iso: string) => {
  const d = new Date(iso);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};
const nombreGrupo = (sesion: string) => GRUPOS.find((g) => g.sesion === sesion)?.nombre ?? sesion;

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await sb().from("mirariak2026_reservas").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const filas = (data ?? []) as FilaReserva[];

  const contar = () => Object.fromEntries(FRANJAS.map((f) => [f, 0])) as Record<string, number>;

  const grupos = GRUPOS.map((g) => ({ ...g, plazas: PLAZAS_TALLER, n: 0, repiten: 0, franjas: contar(), participantes: [] as { nombre: string; edad: number; repite: boolean; contacto: string; email: string; fecha: string }[] }));
  const totalFranjas = contar();
  const horarios = HORARIOS_MM.map((h) => ({ horario: h, plazas: PLAZAS_MM, n: 0, participantes: [] as { nombre: string; contacto: string; email: string; fecha: string }[] }));
  const semanas: Record<string, { taller: number; micromagia: number }> = {};
  let enLasDos = 0;
  const idioma: Record<string, number> = {};
  let conNewsletter = 0;
  const activas = filas.filter((r) => [...(r.participantes_taller ?? []), ...(r.participantes_micromagia ?? [])].some(ocupa));

  for (const r of filas) {
    const sem = lunes(r.created_at);
    const pt = (r.participantes_taller ?? []).filter(ocupa);
    const pm = (r.participantes_micromagia ?? []).filter(ocupa);
    if (pt.length || pm.length) {
      semanas[sem] ??= { taller: 0, micromagia: 0 };
      idioma[r.idioma ?? "eu"] = (idioma[r.idioma ?? "eu"] ?? 0) + 1;
      if (r.newsletter) conNewsletter++;
    }
    for (const p of pt) {
      const g = grupos.find((x) => x.sesion === p.sesion_asignada);
      if (!g) continue;
      const f = franja(Number(p.edad));
      g.n++;
      g.franjas[f]++;
      totalFranjas[f]++;
      if (p.anio_pasado) g.repiten++;
      g.participantes.push({ nombre: p.nombre.trim(), edad: Number(p.edad), repite: !!p.anio_pasado, contacto: r.nombre_contacto, email: r.email, fecha: r.created_at });
      semanas[sem].taller++;
    }
    const h = horarios.find((x) => x.horario === r.horario_micromagia);
    for (const p of pm) {
      if (h) {
        h.n++;
        h.participantes.push({ nombre: p.nombre.trim(), contacto: r.nombre_contacto, email: r.email, fecha: r.created_at });
      }
      semanas[sem].micromagia++;
    }
    const nombresT = new Set(pt.map((p) => norm(p.nombre)));
    enLasDos += pm.filter((p) => nombresT.has(norm(p.nombre))).length;
  }

  // Posibles duplicados (solo entre lo que ocupa plaza): mismo email, mismo horario y mismos nombres.
  const huella = (r: FilaReserva) => {
    const t = (r.participantes_taller ?? []).filter(ocupa).map((p) => norm(p.nombre));
    const m = (r.participantes_micromagia ?? []).filter(ocupa).map((p) => norm(p.nombre));
    if (!t.length && !m.length) return null;
    return [r.email.toLowerCase(), m.length ? r.horario_micromagia ?? "" : "", [...t.sort(), "|", ...m.sort()].join(",")].join("·");
  };
  const porHuella = new Map<string, FilaReserva[]>();
  for (const r of filas) {
    const k = huella(r);
    if (k && r.email) porHuella.set(k, [...(porHuella.get(k) ?? []), r]);
  }
  const duplicados = [...porHuella.values()]
    .filter((v) => v.length > 1)
    .map((v) => ({
      contacto: v[0].nombre_contacto,
      email: v[0].email,
      actividad: v[0].actividad,
      nombres: [...new Set([...(v[0].participantes_taller ?? []), ...(v[0].participantes_micromagia ?? [])].filter(ocupa).map((p) => p.nombre.trim()))],
      veces: v.length,
      fechas: v.map((x) => x.created_at),
      ids: v.map((x) => x.id),
    }));

  const claves = Object.keys(semanas).sort();
  if (claves.length) {
    const fin = new Date(lunes(new Date().toISOString()));
    for (const d = new Date(claves[0]); d <= fin; d.setUTCDate(d.getUTCDate() + 7)) semanas[d.toISOString().slice(0, 10)] ??= { taller: 0, micromagia: 0 };
  }

  // ── Gestión: formularios, listas de espera y últimos cambios.
  type Entrada = { id: string; lista: "taller" | "micromagia"; idx: number; nombre: string; edad: number | null; contacto: string; email: string; idioma: string; telefono: string; nota: string; desde: string };
  const espera = {
    taller: Object.fromEntries(TALLER_SESIONES.map((s) => [s, [] as Entrada[]])) as Record<string, Entrada[]>,
    micromagia: Object.fromEntries(HORARIOS_MM.map((h) => [h, [] as Entrada[]])) as Record<string, Entrada[]>,
  };
  const cambios: { en: string; que: string; nombre: string; contacto: string; id: string }[] = [];
  const reservas = filas.map((r) => {
    const taller = (r.participantes_taller ?? []).map((p, idx) => {
      if (p.espera && p.sesion_asignada && espera.taller[p.sesion_asignada] && !p.anulada)
        espera.taller[p.sesion_asignada].push({ id: r.id, lista: "taller", idx, nombre: p.nombre.trim(), edad: Number(p.edad), contacto: r.nombre_contacto, email: r.email, idioma: r.idioma ?? "eu", telefono: p.espera.telefono ?? "", nota: p.espera.nota ?? "", desde: p.espera.desde });
      for (const c of p.cambios ?? []) cambios.push({ ...c, nombre: p.nombre.trim(), contacto: r.nombre_contacto, id: r.id });
      return { idx, nombre: p.nombre.trim(), edad: Number(p.edad), sesion: p.sesion_asignada ?? "", repite: !!p.anio_pasado, anulada: p.anulada ?? null, espera: p.espera ?? null };
    });
    const micromagia = (r.participantes_micromagia ?? []).map((p, idx) => {
      if (p.espera && r.horario_micromagia && espera.micromagia[r.horario_micromagia] && !p.anulada)
        espera.micromagia[r.horario_micromagia].push({ id: r.id, lista: "micromagia", idx, nombre: p.nombre.trim(), edad: null, contacto: r.nombre_contacto, email: r.email, idioma: r.idioma ?? "eu", telefono: p.espera.telefono ?? "", nota: p.espera.nota ?? "", desde: p.espera.desde });
      for (const c of p.cambios ?? []) cambios.push({ ...c, nombre: p.nombre.trim(), contacto: r.nombre_contacto, id: r.id });
      return { idx, nombre: p.nombre.trim(), anulada: p.anulada ?? null, espera: p.espera ?? null };
    });
    return { id: r.id, contacto: r.nombre_contacto, email: r.email, idioma: r.idioma ?? "eu", fecha: r.created_at, actividad: r.actividad, horario: r.horario_micromagia ?? "", taller, micromagia };
  });
  for (const l of [...Object.values(espera.taller), ...Object.values(espera.micromagia)]) l.sort((a, b) => a.desde.localeCompare(b.desde));
  cambios.sort((a, b) => b.en.localeCompare(a.en));

  const personasTaller = grupos.reduce((a, g) => a + g.n, 0);
  const repitenTaller = grupos.reduce((a, g) => a + g.repiten, 0);
  const personasMm = horarios.reduce((a, h) => a + h.n, 0);

  return NextResponse.json(
    {
      actualizado: new Date().toISOString(),
      resumen: {
        formularios: activas.length,
        familias: new Set(activas.map((r) => r.email.toLowerCase() || r.id)).size,
        personas_taller: personasTaller,
        plazas_taller: PLAZAS_TALLER * GRUPOS.length,
        repiten_taller: repitenTaller,
        personas_micromagia: personasMm,
        plazas_micromagia: PLAZAS_MM * HORARIOS_MM.length,
        en_las_dos: enLasDos,
        con_newsletter: conNewsletter,
        idioma,
        ultima: filas.length ? filas[filas.length - 1].created_at : null,
      },
      franjas: FRANJAS,
      taller: { total: totalFranjas, grupos },
      micromagia: { horarios },
      semanas: Object.entries(semanas)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([semana, v]) => ({ semana, ...v })),
      duplicados,
      reservas,
      espera,
      cambios: cambios.slice(0, 60),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// ─────────────────────────── Acciones ───────────────────────────

type Lista = "taller" | "micromagia";
interface Cuerpo {
  accion: "anular" | "reactivar" | "mover" | "editar" | "espera_alta" | "dar_plaza" | "quitar_espera";
  id?: string;
  lista?: Lista;
  idx?: number;
  nombre?: string; // nombre esperado (comprobación) o nombre nuevo en editar/espera_alta
  todos?: boolean; // anular/mover a todos los de esa lista en el formulario
  motivo?: string;
  destino?: string; // sesión de taller u horario de micromagia
  forzar?: boolean; // aceptar aunque el destino esté completo
  nuevo_nombre?: string;
  edad?: number;
  // espera_alta
  contacto?: string;
  email?: string;
  telefono?: string;
  idioma?: string;
  nota?: string;
}

const ahora = () => new Date().toISOString();
const apuntar = (p: Marcas, que: string) => {
  p.cambios = [...(p.cambios ?? []), { en: ahora(), que } as Cambio];
};
const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return err("No autorizado.", 401);
  const b = (await req.json().catch(() => null)) as Cuerpo | null;
  if (!b?.accion) return err("Falta la acción.");
  const db = sb();

  const todasLasFilas = async () => {
    const { data, error } = await db.from("mirariak2026_reservas").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as FilaReserva[];
  };
  const libres = (filas: FilaReserva[], lista: Lista, destino: string) => {
    const c = contarOcupadas(filas);
    return lista === "taller" ? PLAZAS_TALLER - (c.taller[destino] ?? 0) : PLAZAS_MM - (c.micromagia[destino] ?? 0);
  };
  const etiquetaDestino = (lista: Lista, d: string) => (lista === "taller" ? `${nombreGrupo(d)} (${d})` : `micromagia ${d}`);
  const completo = (lista: Lista, d: string, n: number) =>
    NextResponse.json({ error: `${etiquetaDestino(lista, d)} está completo (${n <= 0 ? "no quedan plazas" : `quedan ${n}`}).`, completo: true }, { status: 409 });

  try {
    // ── Alta en lista de espera (fila nueva, el participante marcado como en espera).
    if (b.accion === "espera_alta") {
      const lista = b.lista;
      const nombre = b.nombre?.trim();
      if (!lista || !nombre || !b.destino) return err("Faltan datos: actividad, grupo u horario y nombre.");
      if (lista === "taller" && !TALLER_SESIONES.includes(b.destino)) return err("Grupo desconocido.");
      if (lista === "micromagia" && !HORARIOS_MM.includes(b.destino)) return err("Horario desconocido.");
      if (lista === "taller" && !(Number(b.edad) > 0)) return err("Para el taller hace falta la edad.");
      const espera = { desde: ahora(), telefono: b.telefono?.trim() || undefined, nota: b.nota?.trim() || undefined };
      const cambios = [{ en: ahora(), que: `En lista de espera de ${etiquetaDestino(lista, b.destino)}` }];
      const fila = {
        nombre_contacto: b.contacto?.trim() || nombre,
        email: (b.email ?? "").trim().toLowerCase(),
        actividad: lista,
        participantes_taller: lista === "taller" ? [{ nombre, edad: Number(b.edad), anio_pasado: false, sesion_asignada: b.destino, espera, cambios }] : null,
        participantes_micromagia: lista === "micromagia" ? [{ nombre, espera, cambios }] : null,
        horario_micromagia: lista === "micromagia" ? b.destino : null,
        newsletter: false,
        idioma: b.idioma === "es" ? "es" : "eu",
      };
      const { error } = await db.from("mirariak2026_reservas").insert(fila);
      if (error) return err(error.message, 500);
      return NextResponse.json({ ok: true });
    }

    if (!b.id || !b.lista) return err("Falta la reserva.");
    const lista = b.lista;
    const filas = await todasLasFilas();
    const fila = filas.find((f) => f.id === b.id);
    if (!fila) return err("Esa reserva ya no existe. Actualiza el panel.", 404);
    const campo = lista === "taller" ? "participantes_taller" : "participantes_micromagia";
    const ps = [...((fila[campo] ?? []) as (ParticipanteTaller | ParticipanteMm)[])].map((p) => ({ ...p }));
    const indices = b.todos ? ps.map((_, i) => i) : [Number(b.idx)];
    for (const i of indices) {
      if (!ps[i]) return err("Ese participante ya no está en la reserva. Actualiza el panel.", 409);
    }
    if (!b.todos && b.nombre && norm(ps[indices[0]].nombre) !== norm(b.nombre)) return err("La reserva ha cambiado desde que la cargaste. Actualiza el panel.", 409);

    const guardar = async (cambio: Partial<FilaReserva>, id = fila.id) => {
      const { error } = await db.from("mirariak2026_reservas").update(cambio).eq("id", id);
      if (error) throw new Error(error.message);
    };

    if (b.accion === "anular") {
      const motivo = b.motivo?.trim() || "Sin motivo";
      for (const i of indices) {
        if (ps[i].anulada) continue;
        ps[i].anulada = { en: ahora(), motivo };
        apuntar(ps[i], `Anulada (${lista}${lista === "micromagia" ? ` ${fila.horario_micromagia}` : ` ${nombreGrupo((ps[i] as ParticipanteTaller).sesion_asignada ?? "")}`}): ${motivo}`);
      }
      await guardar({ [campo]: ps });
      return NextResponse.json({ ok: true });
    }

    if (b.accion === "reactivar" || b.accion === "dar_plaza") {
      // Vuelve a ocupar plaza: hay que comprobar el aforo del destino.
      const p = ps[indices[0]];
      const actual = lista === "taller" ? (p as ParticipanteTaller).sesion_asignada ?? "" : fila.horario_micromagia ?? "";
      // Taller: «Dar plaza en…» otro grupo desde la lista de espera (mover + dar plaza en un paso, sin correo).
      const otroGrupo = lista === "taller" && b.accion === "dar_plaza" && b.destino && b.destino !== actual;
      if (otroGrupo && !TALLER_SESIONES.includes(b.destino!)) return err("Grupo desconocido.");
      const destino = otroGrupo ? b.destino! : actual;
      const quedan = libres(filas, lista, destino);
      if (quedan < 1 && !b.forzar) return completo(lista, destino, quedan);
      const desde = b.accion === "reactivar" ? "Reactivada" : "Sale de la lista de espera: plaza dada";
      if (otroGrupo) {
        apuntar(p, `Movido de la lista de espera del ${nombreGrupo(actual)} al ${nombreGrupo(destino)}`);
        (p as ParticipanteTaller).sesion_asignada = destino;
      }
      p.anulada = null;
      p.espera = null;
      apuntar(p, `${desde} en ${etiquetaDestino(lista, destino)}${quedan < 1 ? " (por encima del aforo)" : ""}`);
      await guardar({ [campo]: ps });
      return NextResponse.json({ ok: true });
    }

    if (b.accion === "quitar_espera") {
      const p = ps[indices[0]];
      p.anulada = { en: ahora(), motivo: b.motivo?.trim() || "Quitado de la lista de espera" };
      apuntar(p, `Quitado de la lista de espera: ${p.anulada.motivo}`);
      await guardar({ [campo]: ps });
      return NextResponse.json({ ok: true });
    }

    if (b.accion === "editar") {
      const p = ps[indices[0]];
      const antes = `${p.nombre.trim()}${lista === "taller" ? ` (${(p as ParticipanteTaller).edad})` : ""}`;
      if (b.nuevo_nombre?.trim()) p.nombre = b.nuevo_nombre.trim();
      if (lista === "taller" && Number(b.edad) > 0) (p as ParticipanteTaller).edad = Number(b.edad);
      const despues = `${p.nombre.trim()}${lista === "taller" ? ` (${(p as ParticipanteTaller).edad})` : ""}`;
      if (antes === despues) return err("No has cambiado nada.");
      apuntar(p, `Corregido: ${antes} → ${despues}`);
      await guardar({ [campo]: ps });
      return NextResponse.json({ ok: true });
    }

    if (b.accion === "mover") {
      const destino = b.destino ?? "";
      if (lista === "taller" && !TALLER_SESIONES.includes(destino)) return err("Grupo desconocido.");
      if (lista === "micromagia" && !HORARIOS_MM.includes(destino)) return err("Horario desconocido.");
      const mover = indices.filter((i) => !ps[i].anulada);
      if (!mover.length) return err("No hay nadie activo que mover.");
      const ocupanAqui = mover.filter((i) => ocupa(ps[i])).length; // los de espera no consumen plaza al moverse
      const quedan = libres(filas, lista, destino);
      if (quedan < ocupanAqui && !b.forzar) return completo(lista, destino, quedan);
      const extra = quedan < ocupanAqui ? " (por encima del aforo)" : "";

      if (lista === "taller") {
        for (const i of mover) {
          const p = ps[i] as ParticipanteTaller;
          if (p.sesion_asignada === destino) continue;
          apuntar(p, `Movido del ${nombreGrupo(p.sesion_asignada ?? "")} al ${nombreGrupo(destino)}${extra}`);
          p.sesion_asignada = destino;
        }
        await guardar({ participantes_taller: ps as ParticipanteTaller[] });
        return NextResponse.json({ ok: true });
      }

      // Micromagia: el horario es de la fila. Si se mueven todos los activos, cambia la fila;
      // si no, los que se mueven pasan a una fila nueva (mismo contacto) con el otro horario.
      if (fila.horario_micromagia === destino) return err("Ya está en ese horario.");
      const activos = ps.map((p, i) => i).filter((i) => !ps[i].anulada);
      if (mover.length === activos.length) {
        for (const i of mover) apuntar(ps[i], `Movido de micromagia ${fila.horario_micromagia} a ${destino}${extra}`);
        // Los anulados se quedan con su horario original en una fila aparte para no falsear el historial.
        const anulados = ps.filter((p) => p.anulada);
        if (anulados.length) {
          await guardar({ participantes_micromagia: anulados as ParticipanteMm[] });
          const { error } = await db.from("mirariak2026_reservas").insert({ ...sinId(fila), participantes_taller: null, actividad: "micromagia", participantes_micromagia: mover.map((i) => ps[i]), horario_micromagia: destino, newsletter: false });
          if (error) throw new Error(error.message);
        } else {
          await guardar({ participantes_micromagia: ps as ParticipanteMm[], horario_micromagia: destino });
        }
        return NextResponse.json({ ok: true });
      }
      const movidos = mover.map((i) => {
        apuntar(ps[i], `Movido de micromagia ${fila.horario_micromagia} a ${destino}${extra}`);
        return ps[i];
      });
      const quedanAqui = ps.filter((_, i) => !mover.includes(i));
      const { error } = await db.from("mirariak2026_reservas").insert({ ...sinId(fila), participantes_taller: null, actividad: "micromagia", participantes_micromagia: movidos, horario_micromagia: destino, newsletter: false });
      if (error) throw new Error(error.message);
      await guardar({ participantes_micromagia: quedanAqui as ParticipanteMm[] });
      return NextResponse.json({ ok: true });
    }

    return err("Acción desconocida.");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Error", 500);
  }
}

// Copia de la fila sin el id (conserva la fecha original para que el ritmo de reservas no se falsee).
function sinId(f: FilaReserva) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...resto } = f;
  return resto;
}
