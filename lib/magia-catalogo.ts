// Catálogo de la plataforma de magia /magia-tailerrak: librillos, juegos y
// extras. Datos puros (sin servidor), se usan en páginas y APIs.
//
// Los textos de los juegos salen de los librillos impresos (build_librillos.py
// en el vault, Mirariak 2026 › Librillos 2026). Para publicar un vídeo, poner
// su id de YouTube en `bideoa`; mientras sea null sale el hueco «Laster».

export type LiburutxoSlug = "6-7" | "8-10" | "11";

export interface Jolasa {
  slug: string;
  etiketa: string;
  izenburua: string;
  sarrera: string;
  materiala: string;
  /** Id de YouTube del vídeo (emanaldia + azalpena). null = todavía no está. */
  bideoa: string | null;
}

export const JOLASAK: Record<string, Jolasa> = {
  estrella: { slug: "estrella", etiketa: "Fisika magikoa", izenburua: "Makiltxo-izarra", sarrera: "Hau ez da trikimailu bat: fisika magikoa da! Apustu bat egin: bost makiltxo izar bihurtzea, inork ezerekin bultzatu gabe.", materiala: "5 egurrezko makiltxo · ur-tanta bat (baso edo ontzi txiki batean)", bideoa: null },
  vaso: { slug: "vaso", etiketa: "Diruarekin magia", izenburua: "Txanpona desagertu", sarrera: "Magoak txanpon bat baso batekin estaltzean, desagertu egiten da. Basoa kentzean, berriz agertzen da.", materiala: "plastikozko baso bat · paper zuria · pegamentua · txanpon bat (edo marrazki bat) · orri zuri bat mahai gisa", bideoa: null },
  emakume: { slug: "emakume", etiketa: "Magia klasikoa", izenburua: "Emakume moztua", sarrera: "Magiaren klasiko bat, txikian: emakumea kutxa batean sartu eta erditik zeharkatzen dute... eta osorik ateratzen da! Hemen, billetea da emakumea, post-ita kutxa eta boligrafoa ezpata.", materiala: "billete bat edo, bestela, billete baten tamainako paper zati bat, laguntzaile eder bat marraztuta · post-it bat · boligrafo edo arkatz bat", bideoa: null },
  platos: { slug: "platos", etiketa: "Diruarekin magia", izenburua: "Txanponak platerekin", sarrera: "Txanpon bat plater batetik bestera pasatzen duzu eta, bigarren platerean, bi daude! Berriz egitean, hiru!", materiala: "2 plater · 3 txanpon · orri zuri bat · zeloa · guraizeak", bideoa: null },
  "goma-saltaria": { slug: "goma-saltaria", etiketa: "Magia gomekin", izenburua: "Goma saltaria", sarrera: "Objektuak hipnotizatzen ditugu! Goma hipnotizatzen duzu eta esaten diozuna egiten du, ezinezkoa izan arren: atzamar batzuetatik besteetara jauzi egiten du.", materiala: "2 goma (bata jolaserako, bestea hesirako)", bideoa: null },
  pulgar: { slug: "pulgar", etiketa: "Goma ezinezkoak · 1", izenburua: "Gomak erpurua zeharkatzen du", sarrera: "Goma bat erpuruaren inguruan dago eta, tira egitean, erpurua zeharkatzen du! Begiratu ondo eskuei eta argazkiei.", materiala: "goma bat", bideoa: null },
  billete: { slug: "billete", etiketa: "Goma ezinezkoak · 2", izenburua: "Billetea gomatik gomara", sarrera: "Ikusleak billete tolestu bat jartzen du goiko gomaren gainean eta, magiaz, billetea gomaz goma jaisten da behekoraino.", materiala: "2 goma · billete bat (edo billete baten tamainako paper zati bat)", bideoa: null },
  palillo: { slug: "palillo", etiketa: "Magia makiltxoekin", izenburua: "Makiltxoa desagertzen da", sarrera: "Makiltxo bat daukazu eskuan, keinu magiko bat eta... desagertu da! Berriz agertzen da, beste eskuarekin «hartzen» duzu eta berriz desagertzen da.", materiala: "makiltxo bat · zelo apur bat", bideoa: null },
  reloj: { slug: "reloj", etiketa: "Kartekin magia", izenburua: "Erlojua", sarrera: "Karta-sorta egutegi bat da (4 palo = 4 urtaro, 12 irudi = 12 hilabete...) eta erloju bat ere bai! Ikusle batek ordu bat pentsatzen du, zuk asmatzen duzu... eta haren karta aurrez iragarrita zeneukan.", materiala: "karta-sorta bat · errotulatzaile bat, dorsoaren kolore berekoa · paper txiki bat gezia marrazteko", bideoa: null },
  uno: { slug: "uno", etiketa: "Kartekin magia", izenburua: "Etorkizuna asmatu", sarrera: "Hiru gauza aurrez asmatuko dituzu: txanpon bat nola eroriko den, dadoek zer emango duten eta ikusleak zein karta aukeratuko duen. Amaieran, hiru paperek asmatu dute!", materiala: "karta-sorta bat · baso bat · 3 paper txiki · arkatz bat · txanpon bat · 2 dado", bideoa: null },
};

export interface Liburutxoa {
  slug: LiburutxoSlug;
  etiketa: string; // «6-7 urte»
  jolasak: string[];
}

export const LIBURUTXOAK: Record<LiburutxoSlug, Liburutxoa> = {
  "6-7": { slug: "6-7", etiketa: "6-7 urte", jolasak: ["estrella", "vaso", "emakume", "platos"] },
  "8-10": { slug: "8-10", etiketa: "8-10 urte", jolasak: ["goma-saltaria", "pulgar", "estrella", "platos", "palillo"] },
  "11": { slug: "11", etiketa: "+11 urte", jolasak: ["reloj", "pulgar", "billete", "uno"] },
};

/** Orden en pantalla (una clave numérica como "11" iría primero en Object.keys). */
export const LIBURUTXO_ORDENA: LiburutxoSlug[] = ["6-7", "8-10", "11"];

export const LIBURUTXO_IZENA = "Sekretu handiak mago txikientzat";

export function liburutxoaDa(s: unknown): s is LiburutxoSlug {
  return typeof s === "string" && s in LIBURUTXOAK;
}

/** El extra que se desbloquea dejando el email (mismo vídeo que /tumision/tutorial). */
export const OPARIA = {
  slug: "opari-basoa",
  izenburua: "Ustekabeko desagerpena",
  azpititulua: "Edalontzi bat. Aluminio papera. Hiru minutu.",
  bideoa: "YeVxIkatxlw",
} as const;

/** Todo lo que puede llevar vídeo: los juegos de los librillos y el extra. */
export function bideoSlugak(): string[] {
  return [...Object.keys(JOLASAK), OPARIA.slug];
}

/** Saca el id de YouTube de una URL (watch, youtu.be, shorts, embed) o de un id suelto. */
export function youtubeId(s: string): string | null {
  const v = s.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/**
 * Bloques secretos: se ven con candado y todavía no se pueden abrir (decisión
 * de Alain, 9-nov: por ahora ni venta de librillos ni forma de desbloquearlos).
 */
export const SEKRETUAK = [1, 2, 3];

