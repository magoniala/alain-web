import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const body = await req.json();
  const {
    nombre,
    email,
    nombreEvento,
    valoracion,
    comentariosPublico,
    mejora,
    cita,
    permisoCita,
    firmaCita,
    lang,
  } = body;
  const isEu = lang === "eu";

  // 1. Guardar en Supabase
  const { error: dbError } = await supabase.from("valoraciones").insert({
    nombre,
    email,
    nombre_evento: nombreEvento,
    valoracion,
    comentarios_publico: comentariosPublico || null,
    mejora: mejora || null,
    cita: cita || null,
    permiso_cita: permisoCita || null,
    firma_cita: firmaCita || null,
  });

  if (dbError) {
    console.error("Supabase error:", JSON.stringify(dbError));
    return NextResponse.json({ error: "Error al guardar los datos." }, { status: 500 });
  }

  // 2. Confirmación al usuario
  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    subject: isEu ? "Eskerrik asko zure balorazioagatik" : "Gracias por tu valoración",
    html: isEu ? `
      <p>Kaixo ${nombre},</p>
      <p>Zure balorazioa jaso dut. Eskerrik asko denbora hartzeagatik.</p>
      <br />
      <p>Alain Zulaika</p>
    ` : `
      <p>Hola ${nombre},</p>
      <p>Gracias por tomarte el tiempo de compartir tu experiencia. Tu opinión me ayuda a seguir mejorando.</p>
      <br />
      <p>Alain Zulaika</p>
    `,
  });

  // 3. Notificación a Alain
  const estrellas = "★".repeat(valoracion) + "☆".repeat(5 - valoracion);
  await resend.emails.send({
    from: "Web <contacto@niala.es>",
    to: "contacto@niala.es",
    subject: `Valoración: ${nombreEvento} — ${nombre}`,
    html: `
      <h2>Nueva valoración</h2>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Evento:</strong> ${nombreEvento}</p>
      <p><strong>Valoración:</strong> ${valoracion}/5 ${estrellas}</p>
      ${comentariosPublico ? `<p><strong>Reacción del público:</strong> ${comentariosPublico}</p>` : ""}
      ${mejora ? `<p><strong>Qué mejorar:</strong> ${mejora}</p>` : ""}
      ${cita ? `<p><strong>Testimonio:</strong> "${cita}"</p>` : ""}
      ${permisoCita ? `<p><strong>Permiso para usar testimonio:</strong> ${permisoCita}</p>` : ""}
      ${firmaCita ? `<p><strong>Firma:</strong> ${firmaCita}</p>` : ""}
    `,
  });

  return NextResponse.json({ ok: true });
}
