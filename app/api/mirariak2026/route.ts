import { createClient } from "@supabase/supabase-js";
import { sendEmail, ALAIN_FROM } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ParticipanteTaller {
  nombre: string;
  edad: number;
  anio_pasado: boolean;
}

interface ParticipanteMicromagia {
  nombre: string;
}

function assignSession(edad: number): string {
  if (edad <= 7) return "10:00 – 10:55";
  if (edad <= 10) return "11:10 – 12:05";
  return "12:20 – 13:15";
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    actividad,
    participantesTaller,
    participantesMicromagia,
    horarioMicromagia,
    nombreContacto,
    email,
    newsletter,
    idioma,
  } = body;

  const isEu = idioma === "eu";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  const hasTaller = actividad === "taller" || actividad === "ambas";
  const hasMicromagia = actividad === "micromagia" || actividad === "ambas";

  // Validation
  if (!actividad || !nombreContacto?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: isEu ? "Eremu guztiak bete behar dira." : "Faltan campos obligatorios." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: isEu ? "Email helbidea ez da baliozkoa." : "El email no es válido." },
      { status: 400 }
    );
  }
  if (hasTaller) {
    if (!participantesTaller?.length) {
      return NextResponse.json(
        { error: isEu ? "Gehitu gutxienez parte-hartzaile bat." : "Añade al menos un participante." },
        { status: 400 }
      );
    }
    for (const p of participantesTaller as ParticipanteTaller[]) {
      if (!p.nombre?.trim()) {
        return NextResponse.json(
          { error: isEu ? "Bete parte-hartzaile guztien izena." : "Completa el nombre de todos los participantes." },
          { status: 400 }
        );
      }
      if (!p.edad || p.edad < 6) {
        return NextResponse.json(
          { error: isEu ? "Adina 6 urtetik gorakoa izan behar da." : "La edad debe ser de 6 años o más." },
          { status: 400 }
        );
      }
    }
  }
  if (hasMicromagia) {
    if (!participantesMicromagia?.length) {
      return NextResponse.json(
        { error: isEu ? "Gehitu gutxienez parte-hartzaile bat." : "Añade al menos un participante." },
        { status: 400 }
      );
    }
    if (!horarioMicromagia) {
      return NextResponse.json(
        { error: isEu ? "Aukeratu mikromagiako ordutegia." : "Elige un horario para la micromagia." },
        { status: 400 }
      );
    }
    for (const p of participantesMicromagia as ParticipanteMicromagia[]) {
      if (!p.nombre?.trim()) {
        return NextResponse.json(
          { error: isEu ? "Bete parte-hartzaile guztien izena." : "Completa el nombre de todos los participantes." },
          { status: 400 }
        );
      }
    }
  }

  // Assign taller sessions
  const participantesTallerConSesion = hasTaller
    ? (participantesTaller as ParticipanteTaller[]).map((p) => ({
        ...p,
        sesion_asignada: assignSession(p.edad),
      }))
    : null;

  // Capacity check (single query)
  const { data: existing } = await supabase
    .from("mirariak2026_reservas")
    .select("actividad, participantes_taller, participantes_micromagia, horario_micromagia");

  const tallerCounts: Record<string, number> = {};
  const micromagiaCounts: Record<string, number> = {};

  for (const row of existing ?? []) {
    if (row.actividad === "taller" || row.actividad === "ambas") {
      for (const p of row.participantes_taller ?? []) {
        if (p.sesion_asignada) {
          tallerCounts[p.sesion_asignada] = (tallerCounts[p.sesion_asignada] || 0) + 1;
        }
      }
    }
    if (row.actividad === "micromagia" || row.actividad === "ambas") {
      const h = row.horario_micromagia;
      if (h) {
        micromagiaCounts[h] = (micromagiaCounts[h] || 0) + (row.participantes_micromagia ?? []).length;
      }
    }
  }

  if (hasTaller && participantesTallerConSesion) {
    const demand: Record<string, number> = {};
    for (const p of participantesTallerConSesion) {
      demand[p.sesion_asignada] = (demand[p.sesion_asignada] || 0) + 1;
    }
    for (const [sesion, n] of Object.entries(demand)) {
      if ((tallerCounts[sesion] || 0) + n > 16) {
        return NextResponse.json(
          {
            error: isEu
              ? `${sesion} saioa beteta dago. Jarri harremanetan ${contactEmail} helbidean.`
              : `La sesión ${sesion} está completa. Escríbenos a ${contactEmail}.`,
          },
          { status: 409 }
        );
      }
    }
  }

  if (hasMicromagia && horarioMicromagia) {
    const existing_count = micromagiaCounts[horarioMicromagia] || 0;
    const demand = (participantesMicromagia as ParticipanteMicromagia[]).length;
    if (existing_count + demand > 20) {
      return NextResponse.json(
        {
          error: isEu
            ? `${horarioMicromagia} saioa beteta dago. Aukeratu beste ordutegia.`
            : `La sesión ${horarioMicromagia} está completa. Elige otro horario.`,
        },
        { status: 409 }
      );
    }
  }

  // Insert
  const { error: dbError } = await supabase.from("mirariak2026_reservas").insert({
    nombre_contacto: nombreContacto.trim(),
    email: email.trim().toLowerCase(),
    actividad,
    participantes_taller: participantesTallerConSesion ?? null,
    participantes_micromagia: hasMicromagia ? participantesMicromagia : null,
    horario_micromagia: hasMicromagia ? horarioMicromagia : null,
    newsletter: newsletter || false,
    idioma: idioma || "eu",
  });

  if (dbError) {
    console.error("mirariak2026 DB error:", dbError);
    return NextResponse.json(
      { error: isEu ? "Errore bat gertatu da. Saiatu berriro." : "Ha ocurrido un error. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  if (newsletter) {
    await supabase.from("newsletter_contactos").upsert(
      {
        email: email.trim().toLowerCase(),
        nombre: nombreContacto.trim(),
        idioma: idioma || "eu",
        origen: "mirariak2026",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );
  }

  const host = req.headers.get("host") || "alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  const bajaUrl = newsletter
    ? `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email.trim().toLowerCase())}`
    : null;

  const lugar = "Aita Agirre Kulturgunea · Areto Nagusia · Elgoibar";
  const labelStyle = "font-size:0.72rem;text-transform:uppercase;letter-spacing:0.15em;color:#999;margin:0 0 0.2rem 0;";
  const pStyle = "font-size:0.95rem;line-height:1.8;margin:0 0 1.25rem 0;";

  let actividadHtml = "";

  if (hasTaller && participantesTallerConSesion) {
    const grouped: Record<string, string[]> = {};
    for (const p of participantesTallerConSesion) {
      if (!grouped[p.sesion_asignada]) grouped[p.sesion_asignada] = [];
      grouped[p.sesion_asignada].push(p.nombre.trim());
    }
    const rows = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([sesion, noms]) => `
        <tr>
          <td style="padding:0.5rem 0.75rem 0.5rem 0;font-size:0.9rem;color:#555;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${sesion}</td>
          <td style="padding:0.5rem 0;font-size:0.9rem;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${noms.join(", ")}</td>
        </tr>`
      )
      .join("");
    actividadHtml += `
      <p style="${labelStyle}">${isEu ? "TAILERRA · LARUNBATA, AZAROAREN 14A" : "TALLER · SÁBADO 14 DE NOVIEMBRE"}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">${rows}</table>
    `;
  }

  if (hasMicromagia && participantesMicromagia) {
    const noms = (participantesMicromagia as ParticipanteMicromagia[]).map((p) => p.nombre.trim()).join(", ");
    actividadHtml += `
      <p style="${labelStyle}">${isEu ? "MIKROMAGIA · IGANDEA, AZAROAREN 15A" : "MICROMAGIA · DOMINGO 15 DE NOVIEMBRE"}</p>
      <p style="${pStyle}"><strong>${horarioMicromagia}</strong><br>${noms}</p>
    `;
  }

  const unsubBlock = bajaUrl
    ? `<p style="margin:0;"><a href="${bajaUrl}" style="color:#bbb;">${isEu ? "Utzi newsletter-a jasotzeari" : "Darse de baja de la newsletter"}</a></p>`
    : "";

  const confirmHtml = `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#fff;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.25em;color:#bbb;margin:0 0 2rem 0;">MIRARIAK 2026</p>
      <p style="font-size:1.25rem;font-weight:500;margin:0 0 0.4rem 0;">
        ${isEu ? `Kaixo, ${nombreContacto.trim().split(" ")[0]}` : `Hola, ${nombreContacto.trim().split(" ")[0]}`}
      </p>
      <p style="font-size:1rem;color:#444;margin:0 0 2rem 0;line-height:1.75;">
        ${isEu ? "Zure erreserbak baieztatuta daude." : "Tu reserva está confirmada."}
      </p>
      <div style="border-left:3px solid #2ED3E6;padding-left:1.25rem;margin-bottom:2rem;">
        ${actividadHtml}
        <p style="${labelStyle}">${isEu ? "NON" : "DÓNDE"}</p>
        <p style="${pStyle}">${lugar}</p>
        <p style="${labelStyle}">${isEu ? "PREZIOA" : "PRECIO"}</p>
        <p style="${pStyle}">${isEu ? "Doan" : "Gratuito"}</p>
      </div>
      <p style="font-size:0.95rem;color:#444;line-height:1.75;margin:0 0 2rem 0;">
        ${isEu ? `Zalantzarik? <a href="mailto:${contactEmail}" style="color:#2a9d8f;">${contactEmail}</a>` : `¿Dudas? <a href="mailto:${contactEmail}" style="color:#2a9d8f;">${contactEmail}</a>`}
      </p>
      <div style="padding-top:1.5rem;border-top:1px solid #eee;font-size:0.82rem;color:#bbb;line-height:1.9;">
        <p style="margin:0 0 0.2rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#bbb;">${contactEmail}</a></p>
        <p style="margin:0 0 0.2rem;"><a href="https://alainzulaika.com/mirariak2026" style="color:#bbb;">alainzulaika.com/mirariak2026</a></p>
        ${unsubBlock}
      </div>
    </div>
  `;

  await sendEmail(
    email.trim().toLowerCase(),
    isEu ? "MIRARIAK 2026 — Zure erreserbaren baieztapena" : "MIRARIAK 2026 — Confirmación de reserva",
    confirmHtml,
    ALAIN_FROM
  );

  // Notification to Alain
  const tallerNotifRows = participantesTallerConSesion
    ? participantesTallerConSesion
        .map(
          (p) => `<tr>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.nombre}</td>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.edad}</td>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.sesion_asignada}</td>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.anio_pasado ? "Bai" : "Ez"}</td>
          </tr>`
        )
        .join("")
    : "";

  const mmNotifRows =
    hasMicromagia && participantesMicromagia
      ? (participantesMicromagia as ParticipanteMicromagia[])
          .map(
            (p) => `<tr><td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.nombre}</td></tr>`
          )
          .join("")
      : "";

  const thStyle = "text-align:left;padding:0.3rem 0.6rem;background:#eee;font-size:0.8rem;";
  const notifHtml = `
    <div style="font-family:monospace;max-width:560px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">MIRARIAK 2026 · ERRESEBA BERRIA</p>
      <p style="margin:0 0 0.3rem;"><strong>Kontaktua:</strong> ${nombreContacto.trim()} · ${email.trim().toLowerCase()}</p>
      <p style="margin:0 0 0.3rem;"><strong>Jarduera:</strong> ${actividad}</p>
      <p style="margin:0 0 1rem;"><strong>Newsletter:</strong> ${newsletter ? "Bai" : "Ez"}</p>
      ${
        hasTaller && tallerNotifRows
          ? `<p style="margin:0 0 0.4rem;"><strong>Tailerrak:</strong></p>
             <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;">
               <thead><tr>
                 <th style="${thStyle}">Izena</th><th style="${thStyle}">Adina</th>
                 <th style="${thStyle}">Saioa</th><th style="${thStyle}">Iaz</th>
               </tr></thead>
               <tbody>${tallerNotifRows}</tbody>
             </table>`
          : ""
      }
      ${
        hasMicromagia && mmNotifRows
          ? `<p style="margin:0 0 0.4rem;"><strong>Mikromagia (${horarioMicromagia}):</strong></p>
             <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;">
               <thead><tr><th style="${thStyle}">Izena</th></tr></thead>
               <tbody>${mmNotifRows}</tbody>
             </table>`
          : ""
      }
    </div>
  `;

  await sendEmail(
    "contacto@alainzulaika.com",
    `MIRARIAK 2026 — Erreseba berria: ${nombreContacto.trim()}`,
    notifHtml,
    "Mirariak 2026 <alain@alainzulaika.com>"
  );

  return NextResponse.json({ ok: true });
}
