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
  const { nombre, email, telefono, contexto, contextoOtro, tipoEvento, descripcion, preferencia, lang } = body;
  const isEu = lang === "eu";

  // 1. Guardar en Supabase
  const { error: dbError } = await supabase.from("contactos").insert({
    nombre,
    email,
    telefono,
    contexto,
    contexto_otro: contextoOtro || null,
    tipo_evento: tipoEvento || null,
    descripcion: descripcion || null,
    preferencia,
  });

  if (dbError) {
    console.error("Supabase error:", JSON.stringify(dbError), "message:", dbError.message, "code:", dbError.code, "details:", dbError.details, "hint:", dbError.hint);
    return NextResponse.json({ error: "Error al guardar los datos." }, { status: 500 });
  }

  // 2. Email de confirmación al usuario
  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    subject: isEu ? "Zure mezua jaso dut" : "He recibido tu mensaje",
    html: isEu ? `
      <p>Kaixo ${nombre},</p>
      <p>Zure informazioa jaso dut. Laster deituko dizut testuingurua ondo ulertzeko eta elkarrekin lan egiteak zentzua duen ikusteko.</p>
      <p>Lehenago harremanetan jarri nahi baduzu, idatz iezadazu <a href="mailto:contacto@niala.es">contacto@niala.es</a> helbidera.</p>
      <br />
      <p>Alain Zulaika</p>
    ` : `
      <p>Hola ${nombre},</p>
      <p>He recibido tu información. Te llamaré en breve para entender bien el contexto y ver si tiene sentido trabajar juntos.</p>
      <p>Si necesitas contactarme antes, puedes escribirme a <a href="mailto:contacto@niala.es">contacto@niala.es</a>.</p>
      <br />
      <p>Alain Zulaika</p>
    `,
  });

  // 3. Notificación a Alain
  await resend.emails.send({
    from: "Web <contacto@niala.es>",
    to: "contacto@niala.es",
    subject: isEu ? `Kontaktu berria: ${nombre}` : `Nuevo contacto: ${nombre}`,
    html: isEu ? `
      <h2>Kontaktu formulario berria</h2>
      <p><strong>Izena:</strong> ${nombre}</p>
      <p><strong>Emaila:</strong> ${email}</p>
      <p><strong>Telefonoa:</strong> ${telefono}</p>
      <p><strong>Testuingurua:</strong> ${contexto}${contextoOtro ? ` — ${contextoOtro}` : ""}</p>
      ${tipoEvento ? `<p><strong>Ekitaldi mota:</strong> ${tipoEvento}</p>` : ""}
      ${descripcion ? `<p><strong>Deskribapena:</strong> ${descripcion}</p>` : ""}
      <p><strong>Dei-lehentasuna:</strong> ${preferencia}</p>
    ` : `
      <h2>Nuevo formulario de contacto</h2>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono}</p>
      <p><strong>Contexto:</strong> ${contexto}${contextoOtro ? ` — ${contextoOtro}` : ""}</p>
      ${tipoEvento ? `<p><strong>Tipo de evento:</strong> ${tipoEvento}</p>` : ""}
      ${descripcion ? `<p><strong>Descripción:</strong> ${descripcion}</p>` : ""}
      <p><strong>Preferencia de llamada:</strong> ${preferencia}</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
