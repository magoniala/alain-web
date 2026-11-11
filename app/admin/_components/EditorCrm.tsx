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

export function formCrmInicial(cambios: Record<string, unknown> | null | undefined): FormCrm {
  const c = cambios ?? {};
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
    // Si hay un contacto nuevo con email, por defecto pasa a ser el responsable de la ficha.
    responsable: p.responsable ?? true,
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
}: {
  f: FormCrm;
  setF: Dispatch<SetStateAction<FormCrm>>;
  estados: readonly string[];
  estadoActual: string | null | undefined;
  responsableActual?: string | null;
  abierto: boolean;
  etiquetaFicha?: string;
}) {
  const set = <K extends keyof FormCrm>(k: K, v: FormCrm[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <details open={abierto} className="mt-3 bg-gray-50 px-3 py-2 text-[0.8rem] text-gray-700">
      <summary className="cursor-pointer font-medium text-gray-600">Qué se apunta en el CRM (editable)</summary>
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
  );
}
