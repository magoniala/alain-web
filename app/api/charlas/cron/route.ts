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
// Presupuesto de tiempo: 60 s de función. La lectura se corta a los 25 s y
// el proceso no empieza una llamada a la IA nueva pasados 38 s; lo que
// quede, lo recoge la siguiente ejecución.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function autorizado(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

async function ejecutar(req: Request) {
  if (!(await autorizado(req))) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const { data: activo } = await supabase.from("charlas_config").select("valor").eq("clave", "lector_activo").maybeSingle();
  if (activo && activo.valor === false) return NextResponse.json({ ok: true, pausado: true });

  let lectura = null;
  let errorLectura: string | null = null;
  try {
    lectura = await leerBuzon({ presupuestoMs: 25000 });
  } catch (e) {
    errorLectura = (e as Error).message;
  }

  // Solo se procesa con la lectura al día: si "Enviados" no está leído del
  // todo, el sistema no puede saber qué correos ya contestó Alain desde Mail.
  const proceso =
    lectura?.al_dia && !errorLectura
      ? await procesarPendientes({ presupuestoMs: Math.max(0, 38000 - (Date.now() - inicio)) })
      : { procesados: 0, ya_respondidos: 0, tareas: 0, errores: [] as string[], esperando_lectura: true };

  return NextResponse.json({ ok: !errorLectura && proceso.errores.length === 0, lectura, error_lectura: errorLectura, proceso, ms: Date.now() - inicio });
}

export const GET = ejecutar;
export const POST = ejecutar;
