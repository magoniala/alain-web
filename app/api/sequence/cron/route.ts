import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia, type Secuencia } from "@/lib/secuencia-mails";
import {
  wrapComodin,
  wrapMision,
  comodinMail2,
  comodinMail3,
  misionMail2,
  misionMail3,
} from "@/lib/secuencias-legacy";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);


type Envoltorio = (contenido: string, email: string, isEu: boolean) => string;
type EnCodigo = (email: string, isEu: boolean) => { subject: string; html: string };

interface FilaProgramada {
  email: string;
  idioma: string | null;
  mail2_id: string | null;
  mail3_id: string | null;
}

// Cada mail programado de una secuencia. El contenido se busca primero en
// secuencia_mails (editable desde /admin) y, si no hay fila activa, se usa la
// versión que vive en este archivo. Esa reserva es lo que permite desplegar
// esto sin haber migrado todavía el contenido: si la tabla está vacía, sale
// exactamente lo mismo que salía antes.
interface Programado {
  secuencia: Secuencia;
  tabla: string;
  columna: "mail2_id" | "mail3_id";
  posicion: number;
  envoltorio: Envoltorio;
  enCodigo: EnCodigo;
}

const PROGRAMADOS: Programado[] = [
  { secuencia: "comodin", tabla: "comodin_contactos", columna: "mail2_id", posicion: 2, envoltorio: wrapComodin, enCodigo: comodinMail2 },
  { secuencia: "comodin", tabla: "comodin_contactos", columna: "mail3_id", posicion: 3, envoltorio: wrapComodin, enCodigo: comodinMail3 },
  { secuencia: "mision", tabla: "mision_contactos", columna: "mail2_id", posicion: 2, envoltorio: wrapMision, enCodigo: misionMail2 },
  { secuencia: "mision", tabla: "mision_contactos", columna: "mail3_id", posicion: 3, envoltorio: wrapMision, enCodigo: misionMail3 },
];

async function procesar(cfg: Programado, ahora: Date): Promise<{ enviados: number; fallos: number }> {
  // Select fijo (las dos tablas tienen las mismas columnas) en vez de armarlo
  // con la columna variable: así el cliente de Supabase puede tiparlo.
  const { data } = await supabase
    .from(cfg.tabla)
    .select("email, idioma, mail2_id, mail3_id")
    .not(cfg.columna, "is", null)
    .eq("unsubscribed", false);

  let enviados = 0;
  let fallos = 0;

  for (const row of (data ?? []) as unknown as FilaProgramada[]) {
    const programadoPara = row[cfg.columna];
    if (!programadoPara) continue;
    const cuando = new Date(programadoPara);
    if (isNaN(cuando.getTime()) || cuando > ahora) continue;

    const isEu = row.idioma === "eu";
    const deLaTabla = await cargarMailSecuencia(cfg.secuencia, cfg.posicion, isEu ? "eu" : "es");
    const { subject, html } = deLaTabla
      ? { subject: deLaTabla.asunto, html: cfg.envoltorio(deLaTabla.cuerpo, row.email, isEu) }
      : cfg.enCodigo(row.email, isEu);

    try {
      await sendEmail(row.email, subject, html, resolveNewsletterFrom(deLaTabla?.remitente));
    } catch (err) {
      // Antes, un fallo aquí abortaba el cron entero y dejaba sin correo a
      // todos los que venían detrás. Ahora se anota y se sigue: la marca de
      // programado no se borra, así que se reintenta en la próxima pasada.
      console.error(`sequence/cron: fallo enviando ${cfg.secuencia} ${cfg.posicion} a ${row.email}:`, err);
      fallos++;
      continue;
    }

    await supabase.from(cfg.tabla).update({ [cfg.columna]: null }).eq("email", row.email);
    enviados++;
  }

  return { enviados, fallos };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const ahora = new Date();
  let enviados = 0;
  let fallos = 0;

  for (const cfg of PROGRAMADOS) {
    const r = await procesar(cfg, ahora);
    enviados += r.enviados;
    fallos += r.fallos;
  }

  return NextResponse.json({ ok: true, enviados, fallos });
}
