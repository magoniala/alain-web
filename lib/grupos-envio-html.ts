// Envíos a grupos · la parte que no toca la base de datos: el HTML del mail,
// el nombre corto del envío y los tipos. Vive aparte de lib/grupos-envio.ts
// para que el panel (cliente) pinte la vista previa con el MISMO código que
// sale al buzón.
//
// El cuerpo se escribe igual que en la newsletter (una línea = un párrafo,
// **negrita**, _cursiva_, [texto](url), imágenes ![](url)) y se pinta con el
// mismo estilo. Lo que cambia es el pie: aquí no está la baja de la
// newsletter (esta gente no está en esa lista), sino «No quiero recibir más
// correos como este», que los saca de todos los grupos.

import { processText } from "./newsletter-texto";

export type Idioma = "es" | "eu";

export interface Version { subject: string; preheader: string; body: string }
export type Campos = Record<Idioma, Version>;

export interface Destinatario {
  email: string;
  nombre: string;
  idioma: Idioma;
  /** Aviso para Alain (no excluye): «idiomas distintos en sus reservas», «se dio de baja de la newsletter»… */
  notas: string[];
}

export interface Excluido { email: string; nombre: string; motivo: string }

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Nombre corto del envío a partir de lo que escriba Alain: «Vídeos Mirariak» → «videos-mirariak». */
export function claveDe(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function versionCompleta(v: Version | undefined): boolean {
  return !!(v && v.subject.trim() && v.body.trim());
}

const PIE = {
  es: { contacto: "contacto@alainzulaika.com", baja: "No quiero recibir más correos como este" },
  eu: { contacto: "info@alainzulaika.com", baja: "Ez dut horrelako mezu gehiago jaso nahi" },
} as const;

/** HTML del mail. `enlaceBaja` es la página de baja firmada de esa persona (o «#» en la vista previa). */
export function htmlGrupo(v: Version, idioma: Idioma, enlaceBaja: string): string {
  const cuerpo = v.body
    .trim()
    .split(/\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return `<p style="margin:0 0 0.8rem 0;">&nbsp;</p>`;
      const img = t.match(IMG_RE);
      if (img) return `<img src="${img[2]}" alt="${esc(img[1])}" style="max-width:100%;height:auto;display:block;margin:1.2rem 0;">`;
      return `<p style="margin:0 0 1.2rem 0;">${processText(t)}</p>`;
    })
    .join("");
  const pre = v.preheader.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(v.preheader.trim())}</div>`
    : "";
  const p = PIE[idioma];
  return `
    ${pre}
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        ${cuerpo}
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${p.contacto}" style="color:#555;">${p.contacto}</a></p>
        <p style="margin:0;"><a href="${enlaceBaja}" style="color:#bbb;">${p.baja}</a></p>
      </div>
    </div>
  `;
}

/** Lo que Alain tiene que corregir antes de enviar según sus reglas de mails (no bloquea; avisa). */
export function avisosDeEstilo(v: Version): string[] {
  const t = `${v.subject}\n${v.preheader}\n${v.body}`;
  const a: string[] = [];
  if (/[«»]/.test(t)) a.push("lleva comillas «»: en los mails van \"así\"");
  if (/¿/.test(t)) a.push("lleva «¿»: las preguntas van sin abrir y con «??»");
  if (v.body.split("\n").some((l) => /^\s*p\.?\s?[ds]\.?\s*:/i.test(l) && !/^\s*Pd:/.test(l))) a.push("la postdata va como \"Pd:\"");
  if (/(^|\n)\s*(-{3,}|\*{3,}|_{3,})\s*(\n|$)/.test(v.body)) a.push("lleva un separador (---): se separa solo con líneas en blanco");
  return a;
}
