import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  calcularAgenda,
  diaMadrid,
  esHuecoDeLaRejilla,
  formatearHueco,
  huecoISO,
  lunesDe,
  MAX_POR_DIA,
  MAX_POR_SEMANA,
  type Bloqueo,
  type ReservaOcupada,
  type TipoCita,
} from "@/lib/entrenatzaile-huecos";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error.";

interface ReservaCalendario {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  hueco: string;
  etiqueta: string;
  elegibilidad: string | null;
  dias_desde_alta: number | null;
  tipo: TipoCita;
}

// Calendario del panel: qué hay reservado, qué está bloqueado y qué días
// siguen abiertos. Sale del mismo cálculo que ve el lead, para que no puedan
// contar cosas distintas.
//
// Los días libres se calculan para la HOJA DE RUTA, que es la agenda que se
// gestiona desde aquí (mover, anular, bloquear). Las citas de infoproductos
// salen igual en su día, marcadas: no se gestionan desde este panel, pero
// tapan horas de la Hoja de Ruta y hay que verlas.
//
// Ojo al leer el calendario: un día puede aparecer con huecos libres y tener
// ya una cita de creadores. Es correcto — esas solo tapan tres horas.
export async function GET(req: Request) {
  if (!requireAdminAuth(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const [reservasRes, bloqueosRes] = await Promise.all([
    supabase
      .from("hoja_ruta_reservas")
      .select("id, nombre, email, telefono, hueco, elegibilidad, dias_desde_alta, tipo")
      .not("hueco", "is", null)
      .is("cancelada_en", null)
      .order("hueco", { ascending: true }),
    supabase.from("hoja_ruta_bloqueos").select("id, dia, hora_desde, hora_hasta, motivo").order("dia"),
  ]);

  if (reservasRes.error || bloqueosRes.error) {
    console.error("admin/hoja-de-ruta:", reservasRes.error ?? bloqueosRes.error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  const reservas = reservasRes.data ?? [];
  const bloqueos = (bloqueosRes.data ?? []) as Array<Bloqueo & { id: string; motivo: string | null }>;
  const ahora = new Date();

  const agenda = calcularAgenda({
    ahora,
    reservados: reservas.map((r) => ({ hueco: r.hueco as string, tipo: r.tipo as TipoCita })) as ReservaOcupada[],
    bloqueos,
    tipo: "hoja-de-ruta",
  });

  // Las reservas, indexadas por el día al que caen, para pintarlas junto a su
  // casilla del calendario.
  const reservasPorDia = new Map<string, ReservaCalendario[]>();
  for (const r of reservas) {
    const dia = diaMadrid(new Date(r.hueco as string));
    const lista = reservasPorDia.get(dia) ?? [];
    lista.push({
      id: r.id,
      nombre: r.nombre,
      email: r.email,
      telefono: r.telefono,
      hueco: r.hueco as string,
      etiqueta: formatearHueco(r.hueco as string),
      elegibilidad: r.elegibilidad,
      dias_desde_alta: r.dias_desde_alta,
      tipo: (r.tipo ?? "hoja-de-ruta") as TipoCita,
    });
    reservasPorDia.set(dia, lista);
  }

  // Cuántas llamadas lleva cada semana natural, para poder ver de un vistazo
  // por qué una semana entera aparece cerrada. Solo Hojas de Ruta: el tope
  // semanal que cierra la semana es el suyo, y contar aquí los infoproductos
  // enseñaría un 5/5 en una semana que sigue abierta.
  const porSemana = new Map<string, number>();
  for (const r of reservas) {
    if (r.tipo !== "hoja-de-ruta") continue;
    const lunes = lunesDe(diaMadrid(new Date(r.hueco as string)));
    porSemana.set(lunes, (porSemana.get(lunes) ?? 0) + 1);
  }

  const dias = agenda.map((d) => ({
    dia: d.dia,
    libres: d.huecos.length,
    primero: d.huecos[0]?.etiqueta ?? null,
    motivo: d.motivo,
    reservas: reservasPorDia.get(d.dia) ?? [],
    semana: lunesDe(d.dia),
  }));

  return NextResponse.json(
    {
      dias,
      bloqueos,
      semanas: Object.fromEntries(porSemana),
      limites: { porDia: MAX_POR_DIA, porSemana: MAX_POR_SEMANA },
      // Reservas ya pasadas, que no salen en el calendario pero interesan.
      historico: reservas
        .filter((r) => new Date(r.hueco as string) < ahora)
        .map((r) => ({ ...r, etiqueta: formatearHueco(r.hueco as string) })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Bloquear un día entero o una franja concreta.
export async function POST(req: Request) {
  if (!requireAdminAuth(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { dia, horaDesde, horaHasta, motivo } = body;

  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return NextResponse.json({ error: "Falta el día a bloquear." }, { status: 400 });
  }

  // O se bloquea el día entero (las dos horas vacías) o una franja con las
  // dos puestas. Media franja no significa nada.
  const hayDesde = typeof horaDesde === "string" && horaDesde.trim();
  const hayHasta = typeof horaHasta === "string" && horaHasta.trim();
  if (Boolean(hayDesde) !== Boolean(hayHasta)) {
    return NextResponse.json(
      { error: "Para bloquear una franja hace falta la hora de inicio y la de fin." },
      { status: 400 }
    );
  }
  if (hayDesde && hayHasta && String(horaDesde) >= String(horaHasta)) {
    return NextResponse.json({ error: "La hora de fin tiene que ser posterior a la de inicio." }, { status: 400 });
  }

  const { error } = await supabase.from("hoja_ruta_bloqueos").insert({
    dia,
    hora_desde: hayDesde ? horaDesde : null,
    hora_hasta: hayHasta ? horaHasta : null,
    motivo: typeof motivo === "string" && motivo.trim() ? motivo.trim() : null,
  });

  if (error) {
    console.error("admin/hoja-de-ruta bloqueo insert:", error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Mover una llamada de fecha/hora, o anularla.
export async function PATCH(req: Request) {
  if (!requireAdminAuth(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, accion, motivo } = body;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Falta la llamada." }, { status: 400 });
  }

  if (accion === "cancelar") {
    // No se borra la fila: se libera el hueco y queda constancia. La marca de
    // cancelación es además lo que impide que el cron le mande a esa persona
    // el correo de "te quedaste a medias".
    const { error } = await supabase
      .from("hoja_ruta_reservas")
      .update({
        hueco: null,
        hueco_en: null,
        cancelada_en: new Date().toISOString(),
        cancelacion_motivo: typeof motivo === "string" && motivo.trim() ? motivo.trim() : null,
      })
      .eq("id", id);

    if (error) {
      console.error("admin/hoja-de-ruta cancelar:", error);
      return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (accion === "mover") {
    // Llegan el día y la hora por separado y el identificador lo construye el
    // servidor: si lo armara el navegador, dependería de la zona horaria del
    // ordenador desde el que se entre al panel.
    const dia = typeof body.dia === "string" ? body.dia.trim() : "";
    const hora = typeof body.hora === "string" ? body.hora.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ error: "Falta el día o la hora." }, { status: 400 });
    }

    const [h, m] = hora.split(":").map(Number);
    const destino = huecoISO(dia, h, m);
    if (!esHuecoDeLaRejilla(destino)) {
      return NextResponse.json(
        { error: "Esa hora no encaja en la rejilla (9:00–20:00, en punto o y media)." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("hoja_ruta_reservas")
      .update({ hueco: destino, hueco_en: new Date().toISOString(), cancelada_en: null, cancelacion_motivo: null })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            // Desde que las dos landings comparten agenda, un 23505 aquí
            // puede venir del índice de "una Hoja de Ruta al día" o del
            // trigger de cruces (una cita de creadores cuya ventana tapa esa
            // hora). El mensaje tiene que valer para los dos.
            error: "Ese hueco choca con otra cita: el día ya tiene Hoja de Ruta, o hay una cita de creadores cerca.",
          },
          { status: 409 }
        );
      }
      console.error("admin/hoja-de-ruta mover:", error);
      return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}

// Quitar un bloqueo.
export async function DELETE(req: Request) {
  if (!requireAdminAuth(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Falta el bloqueo a quitar." }, { status: 400 });
  }

  const { error } = await supabase.from("hoja_ruta_bloqueos").delete().eq("id", id);
  if (error) {
    console.error("admin/hoja-de-ruta bloqueo delete:", error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
