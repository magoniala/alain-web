// Espejo Supabase → vault para las reservas de la Hoja de Ruta.
//
// Cuando Alain marca en el panel "Ya lo he enviado" (WhatsApp de confirmación)
// para una reserva, este paso apunta en la ficha del lead en Obsidian
// (Vías/Entrenatzaile/Leads/<nombre>.md, localizada por email): estado
// "5 Hoja de Ruta reservada", fecha_ultimo_contacto, proxima_accion con el día
// de la llamada, mensajes_enviados +1 y una línea en el Registro. Marca la
// reserva (espejo_vault_en) para no repetirlo. Lo llama espejo-vault.mjs.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ZONA = "Europe/Madrid";
function cuando(iso) {
  const f = new Date(iso);
  const dia = f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA }).replace(",", "");
  const hora = f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
  return `${dia} a las ${hora}`;
}

function setFm(texto, clave, valor) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(texto);
  if (!m) return texto;
  const re = new RegExp(`^${clave}:.*$`, "m");
  const linea = `${clave}: ${valor}`;
  const fm = re.test(m[1]) ? m[1].replace(re, linea) : `${m[1]}\n${linea}`;
  return texto.replace(m[0], `---\n${fm}\n---\n`);
}
function getFm(texto, clave) {
  const m = new RegExp(`^${clave}:\\s*(.*)$`, "m").exec(texto);
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

export async function espejoReservas({ dirLeads, url, key, comprobar = false }) {
  if (!url || !key || !dirLeads || !existsSync(dirLeads)) return { saltado: "sin credenciales o carpeta Leads" };
  const r = await fetch(`${url}/rest/v1/hoja_ruta_reservas?select=id,nombre,email,hueco,wa_confirmacion_en,pago_estado&wa_confirmacion_en=not.is.null&espejo_vault_en=is.null&order=wa_confirmacion_en`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`reservas: ${r.status} ${await r.text()}`);
  const reservas = await r.json();
  if (!reservas.length) return { reservas: 0, apuntadas: 0, sin_ficha: [] };

  const porEmail = new Map();
  for (const f of readdirSync(dirLeads).filter((x) => x.endsWith(".md"))) {
    const t = readFileSync(join(dirLeads, f), "utf8");
    const e = getFm(t, "email").toLowerCase();
    if (e) porEmail.set(e, f);
  }
  let apuntadas = 0;
  const sinFicha = [];
  for (const res of reservas) {
    const f = porEmail.get(String(res.email).toLowerCase());
    if (!f) {
      sinFicha.push(res.email);
      continue;
    }
    const ruta = join(dirLeads, f);
    let t = readFileSync(ruta, "utf8");
    const fechaWa = String(res.wa_confirmacion_en).slice(0, 10);
    const linea = `- ${fechaWa} · WhatsApp de confirmación enviado (desde el panel): Hoja de Ruta ${res.pago_estado ? "pagada" : "gratuita"} el ${cuando(res.hueco)}`;
    if (!t.includes(linea)) {
      const fase = Number(/^(\d)/.exec(getFm(t, "estado"))?.[1] ?? 0);
      if (fase < 5 || fase >= 8) t = setFm(t, "estado", "5 Hoja de Ruta reservada"); // 8 Perdido / 9 Aparcado: ha vuelto
      t = setFm(t, "fecha_ultimo_contacto", fechaWa);
      t = setFm(t, "mensajes_enviados", String((Number(getFm(t, "mensajes_enviados")) || 0) + 1));
      t = setFm(t, "proxima_accion", `"Hoja de Ruta el ${cuando(res.hueco)}; antes, PAR-Q+ y peso en ayunas por WhatsApp"`);
      t = setFm(t, "fecha_proxima_accion", String(res.hueco).slice(0, 10));
      t = setFm(t, "canal", "whatsapp");
      const i = t.indexOf("## Registro");
      if (i >= 0) {
        const j = t.indexOf("\n## ", i + 11);
        const bloque = j >= 0 ? t.slice(i, j) : t.slice(i);
        const nuevo = bloque.replace(/\s*$/, "") + "\n" + linea + "\n";
        t = j >= 0 ? t.slice(0, i) + nuevo + t.slice(j) : t.slice(0, i) + nuevo;
      } else t += `\n## Registro\n\n${linea}\n`;
      if (!comprobar) writeFileSync(ruta, t, "utf8");
    }
    if (!comprobar) {
      await fetch(`${url}/rest/v1/hoja_ruta_reservas?id=eq.${res.id}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ espejo_vault_en: new Date().toISOString() }) });
    }
    apuntadas++;
  }
  return { reservas: reservas.length, apuntadas, sin_ficha: sinFicha };
}
