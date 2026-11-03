import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

// Estadísticas de las reservas de MIRARIAK 2026 (panel → Magia → Mirariak 2026).
// Lee mirariak2026_reservas (lo que llega del formulario de /mirariak2026) y lo
// agrupa: taller por grupo (edades, plazas, quién repite del año pasado),
// micromagia por horario, ritmo semanal, idioma, newsletter y posibles
// duplicados (mismo email, misma actividad y mismos nombres). Solo lectura.

export const dynamic = "force-dynamic";

const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const GRUPOS = [
  { sesion: "10:00 – 10:55", nombre: "Grupo 1", edades: "6-7 años" },
  { sesion: "11:10 – 12:05", nombre: "Grupo 2", edades: "8-10 años" },
  { sesion: "12:20 – 13:15", nombre: "Grupo 3", edades: "11 años o más" },
];
const HORARIOS_MM = ["10:00 – 10:30", "11:00 – 11:30", "12:00 – 12:30", "17:30 – 18:00", "18:30 – 19:00"];
const PLAZAS_TALLER = 16;
const PLAZAS_MM = 20;

// Orden fijo de las franjas de edad: el color sigue a la franja en todas las ruedas.
const FRANJAS =["6", "7", "8", "9", "10", "11-12", "13-17", "Adultos"] as const;
function franja(edad: number): string {
  if (edad <= 6) return "6";
  if (edad <= 10) return String(edad);
  if (edad <= 12) return "11-12";
  if (edad <= 17) return "13-17";
  return "Adultos";
}

interface PT { nombre: string; edad: number; anio_pasado?: boolean; sesion_asignada?: string }
interface Fila {
  id: string;
  nombre_contacto: string;
  email: string;
  actividad: string;
  participantes_taller: PT[] | null;
  participantes_micromagia: { nombre: string }[] | null;
  horario_micromagia: string | null;
  newsletter: boolean | null;
  idioma: string | null;
  created_at: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const lunes = (iso: string) => {
  const d = new Date(iso);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await sb().from("mirariak2026_reservas").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const filas = (data ?? []) as Fila[];

  const contar = () => Object.fromEntries(FRANJAS.map((f) => [f, 0])) as Record<string, number>;

  const grupos = GRUPOS.map((g) => ({ ...g, plazas: PLAZAS_TALLER, n: 0, repiten: 0, franjas: contar(), participantes: [] as { nombre: string; edad: number; repite: boolean; contacto: string; email: string; fecha: string }[] }));
  const totalFranjas = contar();
  const horarios = HORARIOS_MM.map((h) => ({ horario: h, plazas: PLAZAS_MM, n: 0, participantes: [] as { nombre: string; contacto: string; email: string; fecha: string }[] }));
  const semanas: Record<string, { taller: number; micromagia: number }> = {};
  let enLasDos = 0;
  const idioma: Record<string, number> = {};
  let conNewsletter = 0;

  for (const r of filas) {
    const sem = lunes(r.created_at);
    semanas[sem] ??= { taller: 0, micromagia: 0 };
    idioma[r.idioma ?? "eu"] = (idioma[r.idioma ?? "eu"] ?? 0) + 1;
    if (r.newsletter) conNewsletter++;
    const pt = r.participantes_taller ?? [];
    const pm = r.participantes_micromagia ?? [];
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

  // Posibles duplicados: mismo email, misma actividad, mismo horario y mismos nombres.
  const huella = (r: Fila) =>
    [r.email.toLowerCase(), r.actividad, r.horario_micromagia ?? "", [...(r.participantes_taller ?? []).map((p) => norm(p.nombre)), "|", ...(r.participantes_micromagia ?? []).map((p) => norm(p.nombre))].sort().join(",")].join("·");
  const porHuella = new Map<string, Fila[]>();
  for (const r of filas) porHuella.set(huella(r), [...(porHuella.get(huella(r)) ?? []), r]);
  const duplicados = [...porHuella.values()]
    .filter((v) => v.length > 1)
    .map((v) => ({
      contacto: v[0].nombre_contacto,
      email: v[0].email,
      actividad: v[0].actividad,
      nombres: [...new Set([...(v[0].participantes_taller ?? []), ...(v[0].participantes_micromagia ?? [])].map((p) => p.nombre.trim()))],
      veces: v.length,
      fechas: v.map((x) => x.created_at),
    }));

  // Semanas sin reservas también salen (a cero), para ver los parones.
  const claves = Object.keys(semanas).sort();
  if (claves.length) {
    const fin = new Date(lunes(new Date().toISOString()));
    for (const d = new Date(claves[0]); d <= fin; d.setUTCDate(d.getUTCDate() + 7)) semanas[d.toISOString().slice(0, 10)] ??= { taller: 0, micromagia: 0 };
  }

  const personasTaller = grupos.reduce((a, g) => a + g.n, 0);
  const repitenTaller = grupos.reduce((a, g) => a + g.repiten, 0);
  const personasMm = horarios.reduce((a, h) => a + h.n, 0);

  return NextResponse.json(
    {
      actualizado: new Date().toISOString(),
      resumen: {
        formularios: filas.length,
        familias: new Set(filas.map((r) => r.email.toLowerCase())).size,
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
