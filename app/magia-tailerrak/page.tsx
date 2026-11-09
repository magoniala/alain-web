// Portada de la plataforma de magia (QR de los librillos de los talleres).
// Si ya sabemos qué librillo tiene, va directo a él; ?aldatu=1 deja elegir otro.
import Link from "next/link";
import { redirect } from "next/navigation";
import { LIBURUTXO_IZENA } from "@/lib/magia-catalogo";
import { ikusgaiak, katalogoa, liburutxokoEdukiak } from "@/lib/magia-edukiak";
import { nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";
import Goiburua from "./_components/Goiburua";
import Oina from "./_components/Oina";
import { PALOAK, gorria } from "@/lib/magia-sarbidea";
import { K, contenedor, etiqueta, main } from "./_components/estiloa";
import css from "./_components/magia.module.css";

export const dynamic = "force-dynamic";

export default async function Portada({ searchParams }: { searchParams: Promise<{ aldatu?: string }> }) {
  const { aldatu } = await searchParams;
  const k = ikusgaiak(await katalogoa());
  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa, k.liburutxoak);
  if (nireak.length && !aldatu) redirect(`/magia-tailerrak/${nireak[0]}`);

  return (
    <main style={main}>
      <Goiburua email={saioa?.email ?? null} />
      <section style={{ ...contenedor, padding: "1.75rem 1.25rem 4rem", textAlign: "center" }}>
        <p style={{ ...etiqueta, marginBottom: "0.6rem" }}>{LIBURUTXO_IZENA}</p>
        <h1 style={{ fontSize: "clamp(2.1rem, 6vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "1rem" }}>
          Zein liburutxo duzu?
        </h1>
        <p style={{ fontSize: "1.02rem", color: K.tenue, lineHeight: 1.7, maxWidth: "30rem", margin: "0 auto 2.5rem" }}>
          Aukeratu zure adineko karta: liburutxoko jolasak bideoan ikusiko dituzu, eta opari bat ere badago!
        </p>
        <ul className={css.portada}>
          {k.liburutxoak.map((l, i) => {
            const jolasak = liburutxokoEdukiak(k, l.slug).filter((e) => e.egoera === "irekia");
            const paloa = PALOAK[i % PALOAK.length];
            const [adina, ...gainerakoa] = l.etiketa.split(" ");
            return (
              <li key={l.slug}>
                <Link href={`/magia-tailerrak/${l.slug}`} className={`${css.portadaKarta} ${gorria(paloa) ? css.gorria : ""}`} aria-label={`${l.etiketa}ko liburutxoa`}>
                  <span className={css.portadaIzkina} aria-hidden>{paloa}</span>
                  <span className={css.portadaAdina} style={{ color: "#0b0b0c" }}>{adina}</span>
                  <span className={css.portadaUrte}>{gainerakoa.join(" ") || " "}</span>
                  <span className={`${css.portadaIzkina} ${css.portadaIzkinaBehean}`} aria-hidden>{paloa}</span>
                </Link>
                <span className={css.portadaJolasak}>{jolasak.length} jolas</span>
              </li>
            );
          })}
        </ul>
      </section>
      <Oina />
    </main>
  );
}
