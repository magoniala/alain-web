// Servidor de la plataforma de magia /magia-tailerrak: usuarios, accesos,
// sesiones (cookie) y códigos de acceso por email. Tablas en
// sql/magia_plataforma.sql. Catálogo en lib/magia-catalogo.ts.

import { createHash, randomBytes, randomInt } from "crypto";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { OPARIA, liburutxoaDa, type LiburutxoSlug } from "@/lib/magia-catalogo";

export const COOKIE_SAIOA = "magia_saioa";
export const COOKIE_LIBURUTXOA = "magia_liburutxoa";
const URTE_BAT_S = 365 * 24 * 60 * 60;
const KODEA_MIN = 15;
const KODEA_INTENTOS = 5;
const KODEA_ESPERA_S = 60;

let cliente: SupabaseClient | null = null;
export function db() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function emailGarbia(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200 ? v : null;
}

const cookieAukerak = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

// ---------- Sesión ----------

/** Abre una sesión para `email` y deja la cookie puesta (solo en Route Handlers). */
export async function saioaIreki(email: string, librillo?: string | null) {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + URTE_BAT_S * 1000).toISOString();
  const { error } = await db().from("magia_sesiones").insert({ token_hash: hash(token), email, expira });
  if (error) throw new Error(`magia: no se ha podido abrir la sesión: ${error.message}`);
  const c = await cookies();
  c.set(COOKIE_SAIOA, token, cookieAukerak(URTE_BAT_S));
  if (liburutxoaDa(librillo)) c.set(COOKIE_LIBURUTXOA, librillo, { ...cookieAukerak(URTE_BAT_S), httpOnly: false });
}

export async function saioaItxi() {
  const c = await cookies();
  const token = c.get(COOKIE_SAIOA)?.value;
  if (token) await db().from("magia_sesiones").delete().eq("token_hash", hash(token));
  c.delete(COOKIE_SAIOA);
}

export interface NireSaioa {
  email: string;
  librillo: LiburutxoSlug | null;
  accesos: string[];
}

/** La sesión de quien visita, o null. Se puede usar en Server Components. */
export async function nireSaioa(): Promise<NireSaioa | null> {
  const token = (await cookies()).get(COOKIE_SAIOA)?.value;
  if (!token) return null;
  const { data: s } = await db()
    .from("magia_sesiones")
    .select("email")
    .eq("token_hash", hash(token))
    .gt("expira", new Date().toISOString())
    .maybeSingle();
  if (!s) return null;
  const [{ data: u }, { data: a }] = await Promise.all([
    db().from("magia_usuarios").select("librillo").eq("email", s.email).maybeSingle(),
    db().from("magia_accesos").select("contenido").eq("email", s.email),
  ]);
  return {
    email: s.email,
    librillo: liburutxoaDa(u?.librillo) ? u!.librillo : null,
    accesos: (a ?? []).map((r: { contenido: string }) => r.contenido),
  };
}

/** Los librillos que son de quien visita: los de su cuenta o, sin cuenta, el que eligió. */
export async function nireLiburutxoak(saioa: NireSaioa | null): Promise<LiburutxoSlug[]> {
  if (saioa) {
    const erosiak = saioa.accesos
      .filter((a) => a.startsWith("liburutxoa:"))
      .map((a) => a.slice("liburutxoa:".length))
      .filter(liburutxoaDa);
    return [...new Set([...(saioa.librillo ? [saioa.librillo] : []), ...erosiak])];
  }
  const aukeratua = (await cookies()).get(COOKIE_LIBURUTXOA)?.value;
  return liburutxoaDa(aukeratua) ? [aukeratua] : [];
}

// ---------- Códigos por email ----------

export type KodeaEmaitza = "bidalita" | "itxaron";

export async function kodeaBidali(email: string): Promise<KodeaEmaitza> {
  const { data: azkena } = await db()
    .from("magia_codigos")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (azkena && Date.now() - new Date(azkena.created_at).getTime() < KODEA_ESPERA_S * 1000) return "itxaron";

  const kodea = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expira = new Date(Date.now() + KODEA_MIN * 60 * 1000).toISOString();
  const { error } = await db().from("magia_codigos").insert({ email, codigo_hash: hash(`${email}:${kodea}`), expira });
  if (error) throw new Error(`magia: no se ha podido guardar el código: ${error.message}`);

  await sendEmail(
    email,
    `Zure sarbide-kodea: ${kodea}`,
    wrap(`
      <p>Hona hemen zure magia-gunean sartzeko kodea:</p>
      <p style="font-size:2rem;letter-spacing:0.3em;font-weight:bold;margin:1.5rem 0;">${kodea}</p>
      <p>${KODEA_MIN} minutuz balio du. Zuk eskatu ez baduzu, ez egin ezer.</p>
    `),
    resolveNewsletterFrom(null),
    undefined,
    { campana: "magia-kodea", customId: email, idioma: "eu" }
  );
  return "bidalita";
}

export async function kodeaEgiaztatu(email: string, kodea: string): Promise<boolean> {
  if (!/^\d{6}$/.test(kodea)) return false;
  const { data: r } = await db()
    .from("magia_codigos")
    .select("id, codigo_hash, intentos")
    .eq("email", email)
    .eq("usado", false)
    .gt("expira", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!r || r.intentos >= KODEA_INTENTOS) return false;
  const ona = r.codigo_hash === hash(`${email}:${kodea}`);
  await db()
    .from("magia_codigos")
    .update(ona ? { usado: true, intentos: r.intentos + 1 } : { intentos: r.intentos + 1 })
    .eq("id", r.id);
  return ona;
}

// ---------- Correos ----------

const CONTACTO = "info@alainzulaika.com";

function wrap(content: string) {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2;color:#1a1a1a;">${content}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
        <p style="margin:0;">Alain Zulaika · Niala magoa · <a href="mailto:${CONTACTO}" style="color:#555;">${CONTACTO}</a></p>
      </div>
    </div>`;
}

export async function ongiEtorriaBidali(email: string, baseUrl: string) {
  const url = `${baseUrl}/magia-tailerrak`;
  await sendEmail(
    email,
    "Zure magia-gunea prest dago",
    wrap(`
      <p>Kaixo!</p>
      <p>Eskerrik asko zure emaila uzteagatik. «${OPARIA.izenburua}» desblokeatuta dago zure magia-gunean.</p>
      <p>Gunera itzultzeko: <a href="${url}" style="color:#1a1a1a;font-weight:bold;">alainzulaika.com/magia-tailerrak</a>.
      Beste gailu batetik sartzen bazara, sakatu «Sartu», idatzi zure emaila eta bidaliko dizudan kodea.</p>
      <p>Liburutxo hauek berri-berriak dira, eta zuek zarete lehenak. Jolas bakoitzaren bideoa astez aste igotzen ari naiz.</p>
      <p>Alain</p>
    `),
    resolveNewsletterFrom(null),
    undefined,
    { campana: "magia-ongietorria", customId: email, idioma: "eu" }
  );
}
