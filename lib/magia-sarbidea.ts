// Quién puede ver qué librillo (lo usan la página del librillo y la de cada juego).
import { ikusgaiak, katalogoa, liburutxoaDago, liburutxokoEdukiak, type Edukia } from "@/lib/magia-edukiak";
import { nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";

export const PALOAK = ["♠", "♥", "♦", "♣"] as const;

export async function liburutxoSarbidea(liburutxoa: string) {
  const k = ikusgaiak(await katalogoa());
  if (!liburutxoaDago(k, liburutxoa)) return null;
  const l = k.liburutxoak.find((x) => x.slug === liburutxoa)!;
  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa, k.liburutxoak);
  // Con palabra mágica: solo si ya se abrió (cookie o cuenta). Sin ella: si no
  // tiene ninguno o es uno de los suyos.
  const nirea = l.giltza ? nireak.includes(liburutxoa) : nireak.length === 0 || nireak.includes(liburutxoa);
  const edukiak = liburutxokoEdukiak(k, liburutxoa);
  const jolasak = edukiak.filter((e) => e.egoera === "irekia");
  return { k, l, saioa, nireak, nirea, edukiak, jolasak };
}

/** El número y el palo de la carta de un juego: su orden dentro del librillo. */
export function kartaOf(jolasak: Edukia[], slug: string) {
  const i = jolasak.findIndex((e) => e.slug === slug);
  return { zenbakia: i + 1, paloa: PALOAK[Math.max(i, 0) % PALOAK.length] };
}
