// Portada de la plataforma de magia (QR de los librillos de los talleres).
// Si ya sabemos qué librillo tiene, va directo a él; ?aldatu=1 deja elegir otro.
import Link from "next/link";
import { redirect } from "next/navigation";
import { JOLASAK, LIBURUTXOAK, LIBURUTXO_IZENA } from "@/lib/magia-catalogo";
import { nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";
import Goiburua from "./_components/Goiburua";
import Oina from "./_components/Oina";
import { K, contenedor, etiqueta, main, tarjeta } from "./_components/estiloa";

export default async function Portada({ searchParams }: { searchParams: Promise<{ aldatu?: string }> }) {
  const { aldatu } = await searchParams;
  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa);
  if (nireak.length && !aldatu) redirect(`/magia-tailerrak/${nireak[0]}`);

  return (
    <main style={main}>
      <Goiburua email={saioa?.email ?? null} />
      <section style={{ ...contenedor, padding: "2rem 1.25rem 4rem" }}>
        <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA}</p>
        <h1 style={{ fontSize: "clamp(2.1rem, 6vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "1.25rem" }}>
          Zein liburutxo duzu?
        </h1>
        <p style={{ fontSize: "1.05rem", color: K.tenue, lineHeight: 1.7, marginBottom: "2.5rem" }}>
          Aukeratu zurea eta ikusi bere jolasak bideoan. Eta opari bat ere badago!
        </p>
        <div style={{ display: "grid", gap: "1rem" }}>
          {Object.values(LIBURUTXOAK).map((l) => (
            <Link key={l.slug} href={`/magia-tailerrak/${l.slug}`} style={{ ...tarjeta, display: "block", textDecoration: "none", color: K.fg }}>
              <p style={{ fontSize: "1.6rem", fontWeight: 500, marginBottom: "0.4rem" }}>{l.etiketa}</p>
              <p style={{ fontSize: "0.9rem", color: K.muy, lineHeight: 1.6 }}>
                {l.jolasak.map((j) => JOLASAK[j].izenburua).join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <Oina />
    </main>
  );
}
