// Vía Ayuntamientos: el flujo escrito como reglas (sin IA, sin base de datos).
//
// Protocolo: vault, Vías/Ayuntamientos/00 Flujo ayuntamientos.md, y textos en
// «Ayuntamientos · Mails.md» (la IA los tiene como documentos ayto_flujo y
// ayto_mails). Lo usan el motor por fecha (lib/charlas-motor.ts, fichas
// tipo "ayuntamiento") y la cola diaria de Mail 1 (lib/ayuntamientos.ts).
//
// Resumen:
//   0-2 con correo directo   → ayto_mail_1_concejal (1 A) → 3, recordatorio a +10
//   0-2 solo buzón general   → ayto_mail_1_buzon (1 B: pide el contacto de Educación) → 3, +10
//   0-2 sin correo           → llamada / localizar (nivel C)
//   3                        → ayto_recordatorio (único, en el hilo) → 3.5, +10
//   3.5                      → aparcar (sin correo) → 9 hasta marzo o septiembre
//   4 + "persona nueva"      → ayto_mail_1_concejal a esa persona, en hilo nuevo
//   5                        → ayto_seguimiento_info (+7) → ayto_cierre (+7, con puerta a otros formatos) → aparcar
//   4 / 6 / "Esperar…"       → seguimiento de conversación (nivel C, Alain)
//   9                        → ayto_reactivacion (en el hilo) → 3

export interface FichaAyto {
  estado: string;
  responsable: string | null;
  responsable_email: string | null;
  responsable_cargo?: string | null;
  email_centro: string | null;
  proxima_accion: string | null;
  localidad?: string | null;
}

export interface DecisionAyto {
  tipo: string;
  nivel: "A" | "B" | "C";
  conCorreo: boolean;
  instrucciones: string;
  cambios: Record<string, unknown>;
  nota?: string;
  /** Primer correo a una persona: no se encadena al hilo anterior del ayuntamiento. */
  hiloNuevo?: boolean;
}

/** Tipos de mensaje de esta vía (los que cuentan para la racha y pueden pasar a automático). */
export const TIPOS_AYTO = ["ayto_mail_1_concejal", "ayto_mail_1_buzon", "ayto_recordatorio", "ayto_seguimiento_info", "ayto_cierre", "ayto_reactivacion"] as const;

/** Clasificaciones de respuesta propias de ayuntamientos (lib/charlas-ia.ts). */
export const CLASIFICACIONES_AYTO = ["ayto_lo_llevamos", "ayto_calendario_abierto", "ayto_subvenciona_centros", "ayto_no_es_nuestro", "ayto_no_interesa", "ayto_otros_formatos"] as const;

export const ETIQUETAS_AYTO: Record<string, string> = {
  ayto_mail_1_concejal: "Ayto · Mail 1 a Educación",
  ayto_mail_1_buzon: "Ayto · Mail 1 al buzón general",
  ayto_recordatorio: "Ayto · Recordatorio",
  ayto_seguimiento_info: "Ayto · Seguimiento de la información",
  ayto_cierre: "Ayto · Cierre (con otros formatos)",
  ayto_reactivacion: "Ayto · Reactivación",
  "respuesta:ayto_lo_llevamos": "Ayto · Respuesta «lo llevamos nosotros»",
  "respuesta:ayto_calendario_abierto": "Ayto · Respuesta «calendario abierto» (dossier)",
  "respuesta:ayto_subvenciona_centros": "Ayto · Respuesta «subvencionamos a los centros»",
  "respuesta:ayto_no_es_nuestro": "Ayto · Respuesta «no somos nosotros»",
  "respuesta:ayto_no_interesa": "Ayto · Respuesta «no» + otros formatos",
  "respuesta:ayto_otros_formatos": "Ayto · Interés en otros formatos",
};

// Buzones genéricos de un ayuntamiento: no son de una persona.
export const BUZON_GENERAL = /^(info|informazioa|informacion|pegora|udala|udaletxea|ayuntamiento|aytoa?|registro|erregistroa|general|harrera|sac|oac|bulegoa|idazkaritza|secretaria|alcaldia|alkatetza|contacto|kontaktua|herritarrak|ciudadania|atencion|arreta|zac|hab|herritarren)([0-9._-][a-z0-9]*)*@/i;

const sumar = (iso: string, dias: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Primer correo válido de un campo que puede traer varios ("a@x / b@y"). */
export function primerCorreo(s: string | null | undefined): string | null {
  return (s ?? "").split(/[\/;,\s]+/).find((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))?.toLowerCase() ?? null;
}

/** A quién se escribe y si es una persona (1 A) o el buzón general (1 B). */
export function correoAyto(c: FichaAyto): { correo: string | null; directo: boolean } {
  const persona = primerCorreo(c.responsable_email);
  if (persona && !BUZON_GENERAL.test(persona)) return { correo: persona, directo: true };
  const buzon = persona ?? primerCorreo(c.email_centro);
  return { correo: buzon, directo: false };
}

/** Reactivación por defecto de un ayuntamiento aparcado: primeros de marzo o mediados de septiembre, al menos a 60 días. */
export function proximaReactivacionAyto(hoy: string): string {
  const minimo = sumar(hoy, 60);
  const y = Number(hoy.slice(0, 4));
  const candidatas = [`${y}-03-02`, `${y}-09-14`, `${y + 1}-03-02`, `${y + 1}-09-14`, `${y + 2}-03-02`];
  return candidatas.find((f) => f >= minimo) ?? sumar(hoy, 120);
}

/** Mail 1 (A o B). Lo usan el motor por fecha y la cola diaria. */
export function decisionMail1(c: FichaAyto, hoy: string, personaNueva = false): DecisionAyto | null {
  const { correo, directo } = correoAyto(c);
  if (!correo) return null;
  const cargo = c.responsable_cargo ? ` (${c.responsable_cargo})` : "";
  if (directo) {
    return {
      tipo: "ayto_mail_1_concejal",
      nivel: "B",
      conCorreo: true,
      hiloNuevo: true,
      instrucciones: `Primer correo a ${c.responsable ? c.responsable + cargo : "la persona de Educación del ayuntamiento"}. Redacta el Mail 1 A de «Ayuntamientos · Mails» (documento ayto_mails), en euskera (regla de Alain: a todos los ayuntamientos en euskera; solo en castellano si el hilo muestra que ellos escriben en castellano). Usa el nombre del municipio de la ficha (localidad) con su forma natural en ese idioma y la declinación correcta en euskera. Si la persona no es de Educación (p. ej. prevención, juventud, cultura), adapta solo la frase de la pregunta a su área. ${personaNueva ? "Nos han pasado su contacto desde el propio ayuntamiento: dilo en media línea al principio (\"Me ha pasado tu contacto el ayuntamiento\" / \"Udaletik pasatu didate zure kontaktua\"). " : ""}Una sola pregunta. Sin dossier. Presentación y firma completas. Nueva conversación: el asunto es el del guion, sin "Re:".`,
      cambios: { estado: "3 Mail inicial enviado", via: "institucional", proxima_accion: "Recordatorio único si no contestan (1A)", fecha_proxima_accion: sumar(hoy, 10) },
      nota: personaNueva ? "Persona nueva que nos ha pasado el ayuntamiento: va en un hilo nuevo." : undefined,
    };
  }
  return {
    tipo: "ayto_mail_1_buzon",
    nivel: "B",
    conCorreo: true,
    hiloNuevo: true,
    instrucciones: `Primer contacto por el buzón general del ayuntamiento. Redacta el Mail 1 B de «Ayuntamientos · Mails» (documento ayto_mails): pide el correo de quien lleva Educación (concejal/a o técnico/a) y explica en un párrafo para qué, por si lo reenvían. En euskera (regla de Alain: a todos los ayuntamientos en euskera; solo en castellano si el hilo muestra que ellos escriben en castellano). Usa el nombre del municipio de la ficha (localidad) con su forma natural en ese idioma. Una sola petición. Sin dossier. Firma completa. Nueva conversación: el asunto es el del guion, sin "Re:".`,
    cambios: { estado: "3 Mail inicial enviado", via: "institucional", proxima_accion: "Recordatorio único si no contestan (1B)", fecha_proxima_accion: sumar(hoy, 10) },
  };
}

/** Lo que toca por fecha a una ficha de ayuntamiento (motor diario). */
export function decidirAyuntamiento(c: FichaAyto, fase: number, hoy: string): DecisionAyto | null {
  const pa = (c.proxima_accion ?? "").toLowerCase();
  const { correo, directo } = correoAyto(c);

  if (fase === 7 || fase === 8) return null;

  if (fase <= 2) {
    const d = decisionMail1(c, hoy);
    if (d) return d;
    return {
      tipo: "llamada_alain",
      nivel: "C",
      conCorreo: false,
      instrucciones: "",
      cambios: { fecha_proxima_accion: sumar(hoy, 14) },
      nota: "Ayuntamiento sin correo. La investigación web no lo ha encontrado: o lo pegas tú en «Contacto» (con la web del ayuntamiento basta para empezar) o una llamada pidiendo el correo de quien lleva Educación. Al aplicar, la fecha pasa a +14.",
    };
  }

  if (pa.startsWith("esperar") || pa.startsWith("espera ")) {
    return {
      tipo: "seguimiento_conversacion",
      nivel: "C",
      conCorreo: true,
      instrucciones: `La ficha dice: "${c.proxima_accion}". Ha llegado la fecha. Si procede un recordatorio suave, redáctalo en dos frases dentro del hilo; si no, responder = false y propón mover la fecha.`,
      cambios: { fecha_proxima_accion: sumar(hoy, 14) },
      nota: `Estabas esperando: ${c.proxima_accion}`,
    };
  }

  if (c.estado.startsWith("3.5")) {
    const fecha = proximaReactivacionAyto(hoy);
    return {
      tipo: "aparcar",
      nivel: "A",
      conCorreo: false,
      instrucciones: "",
      cambios: { estado: "9 Aparcado (con fecha de reactivación)", fecha_proxima_accion: fecha, proxima_accion: "Reactivar (ayuntamientos)" },
      nota: "Mail 1 y recordatorio sin respuesta: se aparca sin más correos hasta la siguiente época de programación (marzo o septiembre).",
    };
  }

  if (fase === 3) {
    const b = pa.includes("(1b)");
    return {
      tipo: "ayto_recordatorio",
      nivel: "B",
      conCorreo: true,
      instrucciones: `Recordatorio único de «Ayuntamientos · Mails», variante ${b ? "tras el 1 B (pide solo el correo de quien lleva Educación)" : "tras el 1 A"}, como respuesta en el mismo hilo: una o dos frases, sin saludo ni firma, en el idioma del primer correo. Sin dossier.`,
      cambios: { estado: "3.5 recordatorio 1 enviado", proxima_accion: "Aparcar si no contestan", fecha_proxima_accion: sumar(hoy, 10) },
    };
  }

  if (fase === 4 && pa.includes("persona nueva")) {
    const d = decisionMail1(c, hoy, true);
    if (d && d.tipo === "ayto_mail_1_concejal") return d;
  }

  if (fase === 5) {
    if (pa.includes("aparcar")) {
      const fecha = proximaReactivacionAyto(hoy);
      return { tipo: "aparcar", nivel: "A", conCorreo: false, instrucciones: "", cambios: { estado: "9 Aparcado (con fecha de reactivación)", fecha_proxima_accion: fecha, proxima_accion: "Reactivar (ayuntamientos)" }, nota: "Sin respuesta al cierre: se aparca hasta la siguiente época de programación, sin más correos." };
    }
    if (pa.includes("cierre")) {
      return {
        tipo: "ayto_cierre",
        nivel: "B",
        conCorreo: true,
        instrucciones: "Redacta el Cierre de «Ayuntamientos · Mails» como respuesta al hilo de la información: las tres respuestas rápidas y, al final, la línea sobre otros formatos (sin precios). Sin dossier. Si la ficha tiene `otros_formatos` con algo ya ofrecido, quita esa línea.",
        cambios: { proxima_accion: "Aparcar si no hay respuesta (cierre enviado)", fecha_proxima_accion: sumar(hoy, 7), otros_formatos: "puerta abierta a otros formatos en el cierre" },
      };
    }
    return {
      tipo: "ayto_seguimiento_info",
      nivel: "B",
      conCorreo: true,
      instrucciones: "Redacta el Seguimiento de la información de «Ayuntamientos · Mails», como respuesta al hilo: una o dos frases, sin saludo ni firma. Sin dossier.",
      cambios: { proxima_accion: "Cierre si no contesta", fecha_proxima_accion: sumar(hoy, 7) },
    };
  }

  if (fase === 4 || fase === 6) {
    return {
      tipo: "seguimiento_conversacion",
      nivel: "C",
      conCorreo: true,
      instrucciones: "Conversación abierta con un ayuntamiento que se ha enfriado. Redacta un seguimiento corto dentro del hilo con UNA sola petición, la que toque según lo último hablado (cuándo deciden la programación, a quién mandar la información, si quieren el dossier o la propuesta del formato que salió). Sin saludo ni firma.",
      cambios: { fecha_proxima_accion: sumar(hoy, 14) },
    };
  }

  if (fase === 9) {
    if (!correo) return null;
    return {
      tipo: "ayto_reactivacion",
      nivel: "B",
      conCorreo: true,
      instrucciones: "Reactivación de «Ayuntamientos · Mails», en el hilo anterior: recuerda en media línea cuándo hablasteis (está en el Registro) y haz la única pregunta del guion, o la que indique la ficha en proxima_accion. Sin dossier.",
      cambios: { estado: "3 Mail inicial enviado", proxima_accion: `Recordatorio único si no contestan (${directo ? "1A" : "1B"})`, fecha_proxima_accion: sumar(hoy, 10) },
    };
  }
  return null;
}
