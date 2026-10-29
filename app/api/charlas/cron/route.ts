import { NextResponse } from "next/server";
import { supabaseCharlas } from "@/lib/charlas";
import { leerBuzon } from "@/lib/charlas-correo";
import { procesarPendientes } from "@/lib/charlas-proceso";

// Ciclo de la bandeja de charlas: lee el buzón y procesa lo nuevo.
//
// Lo llama cron-job.org cada 10 minutos con Authorization: Bearer <CRON_SECRET>,
// igual que el cron de la newsletter. También se puede lanzar desde el panel
// ("Leer buzón ahora"), que entra con la contraseña de admin.
//
// Nunca envía nada: solo crea tareas en estado 'revisar'.
//
// Leer el buzón no cuesta nada y se hace siempre. La IA cuesta, sobre todo
// la primera llamada de cada tanda (carga ~56k tokens de conocimiento en
// caché durante una hora). Por eso, desde el cron, la IA solo trabaja en
// las ventanas de `ventanas_ia` (hora de Madrid, cada una dura
// `ventana_minutos`, 20 por defecto). Van por parejas dentro de la misma
// hora (8:00 y 8:30, 10:00 y 10:30…) porque la caché del conocimiento dura
// una hora: la segunda ventana de cada pareja sale casi gratis y permite
// contestar en media hora a quien responde a una respuesta de la primera.
// Desde el panel, siempre.
//
// Presupuesto de tiempo: 60 s de función. La lectura se corta a los 20 s y
// el proceso no empieza una tanda de IA nueva pasados 30 s; lo que quede,
// lo recoge la siguiente ejecución.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function desdeCron(req: Request) {
  const auth = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
function desdePanel(req: Request) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

function minutosMadrid(): number {
  const [h, m] = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
}

const VENTANAS_DEFECTO = ["08:00", "08:30", "10:00", "10:30", "12:00", "12:30", "14:00", "14:30", "16:00", "16:30", "18:00", "18:30"];

async function enVentanaIA(): Promise<boolean> {
  const { data } = await supabaseCharlas().from("charlas_config").select("clave, valor").in("clave", ["ventanas_ia", "ventana_minutos"]);
  const cfg = Object.fromEntries((data ?? []).map((c) => [c.clave, c.valor]));
  const ventanas = (cfg.ventanas_ia as string[] | undefined) ?? VENTANAS_DEFECTO;
  const duracion = Number(cfg.ventana_minutos ?? 20);
  const ahora = minutosMadrid();
  return ventanas.some((v) => {
    const [h, m] = v.split(":").map(Number);
    const ini = h * 60 + m;
    return ahora >= ini && ahora < ini + duracion;
  });
}

async function ejecutar(req: Request) {
  const panel = desdePanel(req);
  if (!panel && !desdeCron(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const { data: activo } = await supabase.from("charlas_config").select("valor").eq("clave", "lector_activo").maybeSingle();
  if (activo && activo.valor === false) return NextResponse.json({ ok: true, pausado: true });

  let lectura = null;
  let errorLectura: string | null = null;
  try {
    lectura = await leerBuzon({ presupuestoMs: 20000 });
  } catch (e) {
    errorLectura = (e as Error).message;
  }

  // Solo se procesa con la lectura al día: si "Enviados" no está leído del
  // todo, el sistema no puede saber qué correos ya contestó Alain desde Mail.
  const toca = panel || (await enVentanaIA());
  const proceso =
    lectura?.al_dia && !errorLectura && toca
      ? await procesarPendientes({ presupuestoMs: Math.max(0, 30000 - (Date.now() - inicio)) })
      : {
          procesados: 0,
          ya_respondidos: 0,
          tareas: 0,
          errores: [] as string[],
          pendientes_restantes: null,
          esperando_lectura: !lectura?.al_dia,
          fuera_de_ventana: !toca,
        };

  return NextResponse.json({ ok: !errorLectura && proceso.errores.length === 0, lectura, error_lectura: errorLectura, proceso, ms: Date.now() - inicio });
}

export const GET = ejecutar;
export const POST = ejecutar;
