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
// las ventanas de `ventanas_ia` (por defecto 9:30, 13:30 y 17:30, hora de
// Madrid, durante 50 minutos): los correos se juntan y se procesan en
// tanda. Desde el panel, siempre.
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

async function enVentanaIA(): Promise<boolean> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", "ventanas_ia").maybeSingle();
  const ventanas = (data?.valor as string[] | undefined) ?? ["09:30", "13:30", "17:30"];
  const ahora = minutosMadrid();
  return ventanas.some((v) => {
    const [h, m] = v.split(":").map(Number);
    const ini = h * 60 + m;
    return ahora >= ini && ahora < ini + 50;
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
