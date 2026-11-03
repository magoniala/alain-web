import { createClient } from "@supabase/supabase-js";
import { sendEmail, ALAIN_FROM } from "@/lib/email-ses";
import { altaEmbudo } from "@/lib/embudos";
import { NextResponse } from "next/server";
import { contarOcupadas, PLAZAS_MM, PLAZAS_TALLER } from "@/lib/mirariak";

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
  const contactEmail = isEu ? "info@alainzulaika.com" : "contacto@alainzulaika.com";
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
    .select("participantes_taller, participantes_micromagia, horario_micromagia");

  // Las anuladas y las de lista de espera (marcadas desde el panel) no ocupan plaza.
  const { taller: tallerCounts, micromagia: micromagiaCounts } = contarOcupadas(existing ?? []);

  // Lo que no cabe no se rechaza: entra en lista de espera (el panel lo enseña
  // en su grupo u horario y Alain le da plaza si se libera o se abre otro pase).
  const desde = new Date().toISOString();
  const marcaEspera = { desde, origen: "formulario" };
  const tallerFinal = participantesTallerConSesion
    ? participantesTallerConSesion.map((p) => {
        const ocupadas = tallerCounts[p.sesion_asignada] || 0;
        if (ocupadas < PLAZAS_TALLER) {
          tallerCounts[p.sesion_asignada] = ocupadas + 1;
          return p;
        }
        return { ...p, espera: marcaEspera };
      })
    : null;
  const tallerEspera = (tallerFinal ?? []).filter((p) => "espera" in p);
  const tallerConfirmado = (tallerFinal ?? []).filter((p) => !("espera" in p));

  // Micromagia: la familia va junta. Si no caben todos en ese horario, todos a la lista de espera.
  const mmEspera =
    hasMicromagia && !!horarioMicromagia &&
    (micromagiaCounts[horarioMicromagia] || 0) + (participantesMicromagia as ParticipanteMicromagia[]).length > PLAZAS_MM;
  const mmFinal = hasMicromagia
    ? (participantesMicromagia as ParticipanteMicromagia[]).map((p) => (mmEspera ? { ...p, espera: marcaEspera } : p))
    : null;
  const algoConfirmado = tallerConfirmado.length > 0 || (hasMicromagia && !mmEspera);
  const algoEnEspera = tallerEspera.length > 0 || mmEspera;

  // Insert
  const { error: dbError } = await supabase.from("mirariak2026_reservas").insert({
    nombre_contacto: nombreContacto.trim(),
    email: email.trim().toLowerCase(),
    actividad,
    participantes_taller: tallerFinal ?? null,
    participantes_micromagia: mmFinal,
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
    // Según el embudo «mirariak2026» (lib/embudos.ts): hoy, solo la diaria.
    await altaEmbudo({
      origen: "mirariak2026",
      email: email.trim().toLowerCase(),
      nombre: nombreContacto.trim(),
      idioma: idioma || "eu",
    });
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

  const ESPERA_LABEL = isEu ? "ITXARON-ZERRENDA" : "LISTA DE ESPERA";
  const tablaTaller = (lista: { nombre: string; sesion_asignada: string }[]) => {
    const grouped: Record<string, string[]> = {};
    for (const p of lista) (grouped[p.sesion_asignada] ??= []).push(p.nombre.trim());
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([sesion, noms]) => `
        <tr>
          <td style="padding:0.5rem 0.75rem 0.5rem 0;font-size:0.9rem;color:#555;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${sesion}</td>
          <td style="padding:0.5rem 0;font-size:0.9rem;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${noms.join(", ")}</td>
        </tr>`
      )
      .join("");
  };

  if (hasTaller && tallerConfirmado.length) {
    actividadHtml += `
      <p style="${labelStyle}">${isEu ? "TAILERRA · LARUNBATA, AZAROAREN 14A" : "TALLER · SÁBADO 14 DE NOVIEMBRE"}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">${tablaTaller(tallerConfirmado)}</table>
    `;
  }
  if (hasTaller && tallerEspera.length) {
    actividadHtml += `
      <p style="${labelStyle}">${isEu ? "TAILERRA · LARUNBATA, AZAROAREN 14A" : "TALLER · SÁBADO 14 DE NOVIEMBRE"} · <span style="color:#c27b00;">${ESPERA_LABEL}</span></p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">${tablaTaller(tallerEspera)}</table>
    `;
  }

  if (hasMicromagia && participantesMicromagia) {
    const noms = (participantesMicromagia as ParticipanteMicromagia[]).map((p) => p.nombre.trim()).join(", ");
    actividadHtml += `
      <p style="${labelStyle}">${isEu ? "MIKROMAGIA · IGANDEA, AZAROAREN 15A" : "MICROMAGIA · DOMINGO 15 DE NOVIEMBRE"}${mmEspera ? ` · <span style="color:#c27b00;">${ESPERA_LABEL}</span>` : ""}</p>
      <p style="${pStyle}"><strong>${horarioMicromagia}</strong><br>${noms}</p>
    `;
  }

  const textoEspera = isEu
    ? "«Itxaron-zerrenda» jarrita duten saioak beteta daude, baina zerrendan zaudete. Plazak libratzen badira edo eskaera handiagatik saio berriak irekitzen badira, abisatuko dizuegu eta lekua gordeko dizuegu."
    : "Las sesiones marcadas como «lista de espera» están completas, pero estáis apuntados en la lista. Si se liberan plazas o se abren nuevos pases por la demanda, os avisaremos y os guardaremos el hueco.";
  const textoCabecera = !algoEnEspera
    ? (isEu ? "Zure erreserbak baieztatuta daude." : "Tu reserva está confirmada.")
    : algoConfirmado
      ? (isEu ? "Zure erreserba jaso dugu. Plaza batzuk baieztatuta daude eta beste batzuk itxaron-zerrendan." : "Hemos recibido tu reserva. Parte está confirmada y parte en lista de espera.")
      : (isEu ? "Itxaron-zerrendan zaudete." : "Estáis en la lista de espera.");

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
        ${textoCabecera}
      </p>
      ${algoEnEspera ? `<p style="font-size:0.95rem;color:#444;margin:0 0 2rem 0;line-height:1.75;">${textoEspera}</p>` : ""}
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
    !algoConfirmado
      ? (isEu ? "MIRARIAK 2026 — Itxaron-zerrendan zaude" : "MIRARIAK 2026 — Estás en la lista de espera")
      : isEu ? "MIRARIAK 2026 — Zure erreserbaren baieztapena" : "MIRARIAK 2026 — Confirmación de reserva",
    confirmHtml,
    ALAIN_FROM
  );

  // Notification to Alain
  const tallerNotifRows = tallerFinal
    ? tallerFinal
        .map(
          (p) => `<tr>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.nombre}</td>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.edad}</td>
            <td style="padding:0.3rem 0.6rem;border-bottom:1px solid #eee;">${p.sesion_asignada}${"espera" in p ? " · <b>ITXARON-ZERRENDA</b>" : ""}</td>
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
      ${algoEnEspera ? `<p style="margin:0 0 1rem;color:#b45309;"><strong>Itxaron-zerrenda:</strong> ez zegoen lekurik; panelean dago (Magia → Mirariak 2026 → Itxaron-zerrendak).</p>` : ""}
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
          ? `<p style="margin:0 0 0.4rem;"><strong>Mikromagia (${horarioMicromagia})${mmEspera ? " · ITXARON-ZERRENDA" : ""}:</strong></p>
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
    `MIRARIAK 2026 — ${algoConfirmado ? "Erreseba berria" : "Itxaron-zerrenda"}: ${nombreContacto.trim()}${algoConfirmado && algoEnEspera ? " (zati bat itxaron-zerrendan)" : ""}`,
    notifHtml,
    "Mirariak 2026 <alain@alainzulaika.com>"
  );

  return NextResponse.json({
    ok: true,
    espera: { taller: tallerEspera.map((p) => p.nombre.trim()), micromagia: mmEspera },
    confirmado: algoConfirmado,
  });
}
