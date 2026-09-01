import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import { wrapNurture, normalizarEmail } from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom, NEWSLETTER_SENDERS } from "@/lib/email-ses";
import {
  cuerpoDelMail,
  marcadoresDeFecha,
  marcadoresDeMuestra,
  marcadoresDeNombre,
  sustituirMarcadores,
} from "@/lib/email-markdown";
import {
  CONDICIONES_DE_MUESTRA,
  SECUENCIAS,
  SECUENCIAS_BILINGUES,
  VALORES_DE_MUESTRA,
  type Secuencia,
} from "@/lib/secuencias";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Posiciones fuera de la progresión normal (0, 1, 2…): mails puntuales que se
// disparan por su propia regla y nunca por posicion_secuencia.
const POSICIONES_ESPECIALES = [-1, -2];

function esPosicionValida(p: unknown): p is number {
  return typeof p === "number" && Number.isInteger(p) && p >= -2 && p <= 99;
}

// La secuencia y el idioma llegan del panel. Cualquier valor que no esté en
// la lista se trata como nurture/castellano, que es lo que había antes.
function leerSecuencia(v: unknown): Secuencia {
  return SECUENCIAS.includes(v as Secuencia) ? (v as Secuencia) : "nurture";
}

function leerIdioma(secuencia: Secuencia, v: unknown): string {
  if (!SECUENCIAS_BILINGUES.includes(secuencia)) return "es";
  return v === "eu" ? "eu" : "es";
}

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const secuencia = leerSecuencia(url.searchParams.get("secuencia"));
  const idioma = leerIdioma(secuencia, url.searchParams.get("idioma"));

  const { data: mails, error } = await supabase
    .from("secuencia_mails")
    .select("posicion, asunto, cuerpo_html, remitente, activo, formato, preheader")
    .eq("secuencia", secuencia)
    .eq("idioma", idioma)
    .order("posicion", { ascending: true });

  if (error) {
    console.error("admin/nurture/mails GET:", error);
    return NextResponse.json({ error: "Error al cargar los mails." }, { status: 500 });
  }

  // Cuánta gente está parada ahora mismo en cada posición: editar (o desactivar)
  // un mail afecta justo a esas personas, así que se ve al lado de cada uno.
  // Solo nurture avanza por posicion_secuencia; en las otras el envío lo
  // programa una fecha en su propia tabla, así que no hay nadie "esperando"
  // en una posición.
  const { data: contactos } = secuencia !== "nurture" ? { data: [] } : await supabase
    .from("newsletter_contactos")
    .select("posicion_secuencia")
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false);

  const esperando: Record<string, number> = {};
  for (const c of contactos ?? []) {
    const k = String(c.posicion_secuencia);
    esperando[k] = (esperando[k] ?? 0) + 1;
  }

  return NextResponse.json(
    { mails: mails ?? [], esperando, remitentes: NEWSLETTER_SENDERS, secuencia, idioma, bilingue: SECUENCIAS_BILINGUES.includes(secuencia) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Crea o actualiza el mail de una posición.
export async function PUT(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { posicion, asunto, cuerpo_html, remitente, activo, formato, preheader } = body;
  const secuencia = leerSecuencia(body.secuencia);
  const idioma = leerIdioma(secuencia, body.idioma);

  if (!esPosicionValida(posicion)) {
    return NextResponse.json({ error: "Posición inválida." }, { status: 400 });
  }
  if (typeof asunto !== "string" || typeof cuerpo_html !== "string" || typeof activo !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  if (activo && (!asunto.trim() || !cuerpo_html.trim())) {
    return NextResponse.json({ error: "Un mail activo necesita asunto y cuerpo." }, { status: 400 });
  }

  const { error } = await supabase.from("secuencia_mails").upsert(
    {
      secuencia,
      idioma,
      posicion,
      asunto,
      cuerpo_html,
      // Solo dos formatos. Cualquier otra cosa se trata como HTML, que es el
      // comportamiento de siempre y el que no rompe nada.
      formato: formato === "texto" ? "texto" : "html",
      preheader: typeof preheader === "string" && preheader.trim() ? preheader.trim() : null,
      remitente: NEWSLETTER_SENDERS.includes(remitente) ? remitente : NEWSLETTER_SENDERS[0],
      activo,
    },
    { onConflict: "secuencia,posicion,idioma" }
  );

  if (error) {
    console.error("admin/nurture/mails PUT:", error);
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Envío de prueba: manda el mail tal cual saldría (mismo wrapper, mismo
// remitente) a las direcciones indicadas, sin tocar a nadie de la secuencia.
export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { asunto, cuerpo_html, remitente, idioma, formato, preheader } = body;
  // Pasa por leerSecuencia() como en el resto: decide qué valores de muestra
  // se usan, así que no puede ser lo que el navegador diga sin más.
  const secuencia = leerSecuencia(body.secuencia);
  const destinatarios: string[] = Array.isArray(body.test_emails)
    ? body.test_emails.map((e: unknown) => String(e).trim()).filter(Boolean)
    : [];

  if (destinatarios.length === 0) {
    return NextResponse.json({ error: "Falta el destinatario de la prueba." }, { status: 400 });
  }
  if (typeof asunto !== "string" || typeof cuerpo_html !== "string" || !cuerpo_html.trim()) {
    return NextResponse.json({ error: "Nada que enviar: falta asunto o cuerpo." }, { status: 400 });
  }

  const from = resolveNewsletterFrom(remitente);
  // Los marcadores hay que resolverlos también aquí: sin esto, al buzón le
  // llegaría un {{nombre}} en crudo y la prueba no valdría para ver cómo
  // queda la frase.
  //
  // Si el destinatario está en la lista, se usa SU nombre: así la prueba se
  // parece a lo que va a recibir de verdad. Si no está (un buzón cualquiera
  // para echar un ojo), se cae al nombre de muestra del preview.
  const fechas = marcadoresDeFecha();
  try {
    for (const email of destinatarios) {
      const { data: contacto } = await supabase
        .from("newsletter_contactos")
        .select("nombre")
        .eq("email", normalizarEmail(email))
        .maybeSingle();
      const valores = {
        ...(contacto ? { ...marcadoresDeNombre(contacto.nombre), ...fechas, fin_ventana: fechas.fecha_7 } : marcadoresDeMuestra()),
        // Los propios de esta secuencia ({{tutorial}}, {{hoja_ruta}}…). Sin
        // ellos, la prueba llegaba al buzón con el marcador en crudo, que es
        // justo lo que la prueba sirve para detectar.
        ...(VALORES_DE_MUESTRA[secuencia as Secuencia] ?? {}),
      };

      await sendEmail(
        email,
        `[PRUEBA] ${sustituirMarcadores(asunto, valores)}`,
        wrapNurture(
          // Y los bloques condicionales resueltos, o el correo de prueba
          // llegaría con los {{#si_ventana}} a la vista.
          cuerpoDelMail(cuerpo_html, formato, preheader, valores, CONDICIONES_DE_MUESTRA),
          email,
          idioma === "eu"
        ),
        from
      );
    }
  } catch (err) {
    console.error("admin/nurture/mails prueba:", err);
    return NextResponse.json({ error: "Error al enviar la prueba." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enviados: destinatarios.length });
}

// Solo se puede borrar una posición donde no haya nadie parado: si alguien
// está esperando ese mail, borrarlo lo dejaría atascado ahí para siempre.
export async function DELETE(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const cuerpoDelete = await req.json().catch(() => ({}));
  const { posicion } = cuerpoDelete;
  const secuencia = leerSecuencia(cuerpoDelete.secuencia);
  const idioma = leerIdioma(secuencia, cuerpoDelete.idioma);
  if (!esPosicionValida(posicion)) {
    return NextResponse.json({ error: "Posición inválida." }, { status: 400 });
  }

  // Ese bloqueo solo aplica a nurture: en las otras secuencias, borrar una
  // fila devuelve el control a la versión en código, que sigue enviando.
  if (secuencia === "nurture" && !POSICIONES_ESPECIALES.includes(posicion)) {
    const { count } = await supabase
      .from("newsletter_contactos")
      .select("id", { count: "exact", head: true })
      .eq("recibe_secuencia", true)
      .eq("secuencia_completada", false)
      .eq("unsubscribed", false)
      .eq("posicion_secuencia", posicion);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Hay ${count} contacto(s) esperando este mail. Desactívalo en vez de borrarlo.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("secuencia_mails").delete().eq("secuencia", secuencia).eq("posicion", posicion).eq("idioma", idioma);
  if (error) {
    console.error("admin/nurture/mails DELETE:", error);
    return NextResponse.json({ error: "Error al borrar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
