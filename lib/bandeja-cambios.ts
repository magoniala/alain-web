// Cambios de CRM que Alain corrige a mano en una tarjeta de la bandeja
// (Charlas y Prospectos de magia) antes de aplicarlos o de enviar el correo.
//
// `actual` es lo que propuso el sistema (tarea.cambios_crm); `entrada` es lo que
// manda el panel. Un campo vacío en `entrada` quita ese cambio; si el campo no
// viene, se deja como estaba. Solo se admiten estas claves.

const SIMPLES = ["estado", "proxima_accion", "fecha_proxima_accion", "nota"] as const;

export interface PersonaCambio {
  nombre?: string;
  email?: string;
  cargo?: string;
  telefono?: string;
  /** Guardarla como responsable de la ficha (sustituye a la actual). */
  responsable?: boolean;
}

export function fusionarCambios(actual: unknown, entrada: unknown): Record<string, unknown> {
  const c: Record<string, unknown> = { ...((actual ?? {}) as Record<string, unknown>) };
  if (!entrada || typeof entrada !== "object") return c;
  const e = entrada as Record<string, unknown>;

  for (const k of SIMPLES) {
    if (!(k in e)) continue;
    const v = typeof e[k] === "string" ? (e[k] as string).trim() : "";
    if (k === "fecha_proxima_accion" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("La fecha de próxima acción no es válida (AAAA-MM-DD).");
    if (v) c[k] = v;
    else delete c[k];
  }

  if ("contacto_nuevo" in e) {
    const p = e.contacto_nuevo;
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const t = (x: unknown) => (typeof x === "string" ? x.trim() : "");
      const persona: PersonaCambio = { nombre: t(o.nombre), email: t(o.email).toLowerCase(), cargo: t(o.cargo), telefono: t(o.telefono), responsable: o.responsable === true };
      if (persona.email && !persona.email.includes("@")) throw new Error("El email del contacto no es válido.");
      for (const k of ["nombre", "email", "cargo", "telefono"] as const) if (!persona[k]) delete persona[k];
      if (persona.nombre || persona.email || persona.telefono) c.contacto_nuevo = persona;
      else delete c.contacto_nuevo;
    } else {
      delete c.contacto_nuevo;
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Campos extra que solo traen los botones «Al colgar» de las tarjetas de
// llamada de la bandeja de Charlas (el CRM los escribe directo en la ficha;
// aquí viajan en `cambios` y se aplican al pulsar «Aplicar cambios»).
// Aparte de fusionarCambios para no tocar lo que comparte Magia. Solo estas
// claves y valores; cualquier otra cosa se ignora.
// ---------------------------------------------------------------------------
export function fusionarExtrasLlamada(actual: Record<string, unknown>, entrada: unknown): Record<string, unknown> {
  if (!entrada || typeof entrada !== "object") return actual;
  const e = entrada as Record<string, unknown>;
  const c: Record<string, unknown> = { ...actual };

  if ("calendario_abierto" in e) {
    const v = e.calendario_abierto;
    if (v === "true" || v === "no") c.calendario_abierto = v;
    else delete c.calendario_abierto;
  }
  if ("via" in e) {
    const v = e.via;
    if (v === "generico" || v === "contacto") c.via = v;
    else delete c.via;
  }
  if ("intentos_llamada" in e) {
    const n = Number(e.intentos_llamada);
    if (Number.isInteger(n) && n >= 1 && n <= 20) c.intentos_llamada = n;
    else delete c.intentos_llamada;
  }
  if ("ampa_email" in e) {
    const v = typeof e.ampa_email === "string" ? e.ampa_email.trim().toLowerCase() : "";
    if (v.includes("@")) c.ampa_email = v;
    else delete c.ampa_email;
  }
  return c;
}
