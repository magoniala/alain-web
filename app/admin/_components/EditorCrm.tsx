"use client";

import type { Dispatch, SetStateAction } from "react";

// Editor de «lo que se apunta en el CRM» dentro de una tarjeta de la bandeja
// (Charlas y Prospectos de magia). Va relleno con lo que propuso el sistema;
// Alain lo corrige a mano y pulsa «Solo actualizar la ficha» o «Enviar».
// Un campo vacío = no se apunta ese cambio.

export interface FormCrm {
  estado: string;
  proxima_accion: string;
  fecha_proxima_accion: string;
  nota: string;
  nombre: string;
  email: string;
  cargo: string;
  telefono: string;
  responsable: boolean;
}

// Lo único que Alain tiene que aportar en una tarjeta (el resto va prerrellenado).
export interface Pedido {
  titulo: string;
  ayuda: string;
  campo: "email" | "nota";
  obligatorio: boolean;
}

/** Qué se le pide a Alain según el tipo de tarea. Sin entrada = la tarjeta no pide nada concreto. */
export function pedidoDe(tipo: string | null | undefined): Pedido | null {
  if (tipo === "localizar_contacto")
    return {
      titulo: "Lo único que tienes que hacer: encontrar el email de la agencia",
      ayuda: "Búscalo en su web, Google Maps o Instagram y pégalo aquí. Al aplicar queda en la ficha y se apunta que toca mandarles el primer mail. Si no lo encuentras, usa «Aplazar».",
      campo: "email",
      obligatorio: true,
    };
  if (tipo === "llamada_alain")
    return {
      titulo: "Lo único que tienes que hacer: llamar y anotar cómo fue",
      ayuda: "Si conseguiste un email o teléfono, ponlo en «Contacto» al desplegar lo de abajo. Si no contestó, usa «Aplazar».",
      campo: "nota",
      obligatorio: false,
    };
  return null;
}

/** true si falta lo que la tarjeta pide y no se puede aplicar todavía. */
export function faltaPedido(p: Pedido | null, f: FormCrm): boolean {
  if (!p || !p.obligatorio) return false;
  if (p.campo === "email") return !/.+@.+\..+/.test(f.email.trim());
  return !f.nota.trim();
}

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
function siguienteLaborable(): string {
  const d = new Date(hoyMadrid() + "T00:00:00Z");
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export function formCrmInicial(cambios: Record<string, unknown> | null | undefined, tipo?: string | null): FormCrm {
  const c = { ...(cambios ?? {}) } as Record<string, unknown>;
  // Tareas «de buscar»: lo que el sistema dejó en `nota` es una instrucción para Alain, no algo que apuntar.
  if (tipo === "localizar_contacto" || tipo === "llamada_alain") c.nota = "";
  // Al encontrar el email de una agencia, lo siguiente es mandarle el primer mail (por defecto, el siguiente día laborable).
  if (tipo === "localizar_contacto") {
    c.proxima_accion = "Enviar el primer mail a la agencia";
    c.fecha_proxima_accion = siguienteLaborable();
  }
  const p = (c.contacto_nuevo ?? {}) as { nombre?: string; email?: string; cargo?: string; telefono?: string; responsable?: boolean };
  return {
    estado: String(c.estado ?? ""),
    proxima_accion: String(c.proxima_accion ?? ""),
    fecha_proxima_accion: String(c.fecha_proxima_accion ?? ""),
    nota: String(c.nota ?? ""),
    nombre: p.nombre ?? "",
    email: p.email ?? "",
    cargo: p.cargo ?? "",
    telefono: p.telefono ?? "",
    // Si hay un contacto nuevo con email, por defecto pasa a ser el responsable de la ficha
    // (salvo el email general de una agencia: solo se guarda como email de la ficha).
    responsable: tipo === "localizar_contacto" ? false : (p.responsable ?? true),
  };
}

/** Lo que se manda al servidor en `cambios`. */
export function cambiosDeForm(f: FormCrm) {
  const hayPersona = !!(f.nombre.trim() || f.email.trim() || f.telefono.trim());
  return {
    estado: f.estado,
    proxima_accion: f.proxima_accion,
    fecha_proxima_accion: f.fecha_proxima_accion,
    nota: f.nota,
    contacto_nuevo: hayPersona ? { nombre: f.nombre, email: f.email, cargo: f.cargo, telefono: f.telefono, responsable: f.responsable } : null,
  };
}

const campo = "mt-0.5 w-full border border-gray-300 bg-white px-2 py-1 text-[0.85rem] text-gray-900";

export default function EditorCrm({
  f,
  setF,
  estados,
  estadoActual,
  responsableActual,
  abierto,
  etiquetaFicha = "centro",
  tipo,
}: {
  f: FormCrm;
  setF: Dispatch<SetStateAction<FormCrm>>;
  estados: readonly string[];
  estadoActual: string | null | undefined;
  responsableActual?: string | null;
  abierto: boolean;
  etiquetaFicha?: string;
  tipo?: string | null;
}) {
  const pedido = pedidoDe(tipo);
  const resumen = [
    f.email.trim() && `email → ${f.email.trim()}`,
    f.estado && `estado → ${f.estado}`,
    (f.proxima_accion || f.fecha_proxima_accion) && `siguiente: ${f.proxima_accion || "acción"}${f.fecha_proxima_accion ? ` el ${f.fecha_proxima_accion}` : ""}`,
    f.nota.trim() && "nota",
  ].filter(Boolean);
  const set = <K extends keyof FormCrm>(k: K, v: FormCrm[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
    {pedido && (
      <div className="mt-3 border-l-4 border-[#0F2240] bg-blue-50 px-3 py-2">
        <p className="text-[0.82rem] font-semibold text-[#0F2240]">{pedido.titulo}</p>
        <p className="mt-0.5 text-[0.75rem] text-gray-600">{pedido.ayuda}</p>
        {pedido.campo === "email" ? (
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="email@agencia.com" className={campo + " mt-2"} />
        ) : (
          <textarea value={f.nota} onChange={(e) => set("nota", e.target.value)} rows={2} placeholder="Cómo fue la llamada (opcional)" className={campo + " mt-2"} />
        )}
        <p className="mt-2 text-[0.75rem] text-gray-600">
          <span className="font-medium">Se apuntará:</span> {resumen.length ? resumen.join(" · ") : "nada todavía"}
        </p>
      </div>
    )}
    <details open={pedido ? false : abierto} className="mt-3 bg-gray-50 px-3 py-2 text-[0.8rem] text-gray-700">
      <summary className="cursor-pointer font-medium text-gray-600">{pedido ? "Lo demás se rellena solo (ver o cambiar)" : "Qué se apunta en el CRM (editable)"}</summary>
      <p className="mt-1 text-[0.75rem] text-gray-500">Va relleno con lo que propone el sistema. Corrígelo o rellénalo a mano; lo que dejes vacío no se toca en la ficha.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-[0.75rem] text-gray-500">
          Estado
          <select value={f.estado} onChange={(e) => set("estado", e.target.value)} className={campo}>
            <option value="">(no cambiar{estadoActual ? ` · ${estadoActual}` : ""})</option>
            {f.estado && !estados.includes(f.estado) && <option value={f.estado}>{f.estado}</option>}
            {estados.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block text-[0.75rem] text-gray-500">
          Fecha de la próxima acción
          <input type="date" value={f.fecha_proxima_accion} onChange={(e) => set("fecha_proxima_accion", e.target.value)} className={campo} />
        </label>
      </div>
      <label className="mt-2 block text-[0.75rem] text-gray-500">
        Próxima acción (qué hay que hacer ese día)
        <input value={f.proxima_accion} onChange={(e) => set("proxima_accion", e.target.value)} placeholder="p. ej. Escribirle en mayo, cuando organizan las actividades" className={campo} />
      </label>

      <p className="mt-3 text-[0.75rem] font-medium text-gray-500">Contacto que te ha escrito (otra persona u otro email)</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <label className="block text-[0.75rem] text-gray-500">
          Nombre
          <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className={campo} />
        </label>
        <label className="block text-[0.75rem] text-gray-500">
          Email
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={campo} />
        </label>
        <label className="block text-[0.75rem] text-gray-500">
          Cargo
          <input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="p. ej. subdirectora" className={campo} />
        </label>
        <label className="block text-[0.75rem] text-gray-500">
          Teléfono
          <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} className={campo} />
        </label>
      </div>
      {(f.nombre.trim() || f.email.trim() || f.telefono.trim()) && (
        <label className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-gray-700">
          <input type="checkbox" checked={f.responsable} onChange={(e) => set("responsable", e.target.checked)} className="mt-0.5" />
          <span>Guardarla como responsable de la ficha del {etiquetaFicha}{responsableActual ? ` (sustituye a ${responsableActual})` : ""}. Si no, solo se añade como contacto.</span>
        </label>
      )}

      <label className="mt-3 block text-[0.75rem] text-gray-500">
        Nota para el Registro (opcional)
        <textarea value={f.nota} onChange={(e) => set("nota", e.target.value)} rows={2} placeholder="p. ej. La subdirectora dice que le escriba en mayo, cuando organizan las actividades" className={campo} />
      </label>
    </details>
    </>
  );
}
