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
  const { tipoEvento, fechaAproximada, personas, momentos, notas, nombre, email, telefono, lang } = body;
  const isEu = lang === "eu";

  // 1. Guardar en Supabase
  const { error: dbError } = await supabase.from("belaustegi_consultas").insert({
    tipo_evento: tipoEvento,
    fecha_aproximada: fechaAproximada,
    personas,
    momentos,
    notas: notas || null,
    nombre,
    email,
    telefono,
    lang,
  });

  if (dbError) {
    console.error("Supabase error:", JSON.stringify(dbError));
    return NextResponse.json({ error: "Error al guardar los datos." }, { status: 500 });
  }

  // 2. Confirmación al usuario
  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    subject: isEu ? "Formularioa jasota" : "Formulario recibido",
    html: isEu ? `
      <p>Kaixo ${nombre},</p>
      <p>Zure eskaera jaso dut. Ahalik eta azkarren bidaliko dizut ekitaldira egokitutako proposamena.</p>
      <br />
      <p>Alain Zulaika</p>
    ` : `
      <p>Hola ${nombre},</p>
      <p>He recibido tu consulta. En cuanto pueda te haré llegar una propuesta adaptada a tu evento.</p>
      <br />
      <p>Alain Zulaika</p>
    `,
  });

  // 3. Notificación a Alain
  await resend.emails.send({
    from: "Web <contacto@niala.es>",
    to: "contacto@niala.es",
    subject: `Belaustegi — ${tipoEvento} · ${nombre}`,
    html: `
      <h2>Nueva consulta Belaustegi</h2>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono}</p>
      <p><strong>Tipo de evento:</strong> ${tipoEvento}</p>
      <p><strong>Fecha aproximada:</strong> ${fechaAproximada}</p>
      <p><strong>Personas:</strong> ${personas}</p>
      <p><strong>Momentos:</strong> ${Array.isArray(momentos) ? momentos.join(", ") : momentos}</p>
      ${notas ? `<p><strong>Notas:</strong> ${notas}</p>` : ""}
    `,
  });

  return NextResponse.json({ ok: true });
}
