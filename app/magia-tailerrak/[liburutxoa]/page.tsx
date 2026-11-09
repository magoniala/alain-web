// Página de un librillo: sus juegos (abiertos), el extra a cambio del email y
// lo que está por desbloquear (otros librillos y cursillos: email + pago, más adelante).
import Link from "next/link";
import { notFound } from "next/navigation";
import { JOLASAK, LIBURUTXOAK, LIBURUTXO_IZENA, OPARIA, liburutxoaDa } from "@/lib/magia-catalogo";
import { nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";
import Bideoa from "../_components/Bideoa";
import Goiburua from "../_components/Goiburua";
import Gogoratu from "../_components/Gogoratu";
import HauDaNirea from "../_components/HauDaNirea";
import OpariForm from "../_components/OpariForm";
import Oina from "../_components/Oina";
import { K, contenedor, etiqueta, main, tarjeta } from "../_components/estiloa";

function Giltzarrapoa() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.muy} strokeWidth="1.8" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Laster() {
  return (
    <div style={{ aspectRatio: "16 / 9", border: `1px dashed ${K.borde}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.35rem", textAlign: "center", padding: "1rem" }}>
      <span style={{ ...etiqueta, fontSize: "0.7rem" }}>Laster: bideoa</span>
      <span style={{ fontSize: "0.85rem", color: K.muy }}>emanaldia + azalpena, pausoz pauso</span>
    </div>
  );
}

const h2 = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "0.75rem" } as const;

export default async function LiburutxoOrria({ params }: { params: Promise<{ liburutxoa: string }> }) {
  const { liburutxoa } = await params;
  if (!liburutxoaDa(liburutxoa)) notFound();
  const l = LIBURUTXOAK[liburutxoa];

  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa);
  const nirea = nireak.length === 0 || nireak.includes(liburutxoa);
  const opariaDu = !!saioa?.accesos.includes(OPARIA.slug);

  if (!nirea) {
    return (
      <main style={main}>
        <Goiburua email={saioa?.email ?? null} />
        <section style={{ ...contenedor, padding: "2rem 1.25rem 4rem" }}>
          <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA} · {l.etiketa}</p>
          <div style={{ marginBottom: "0.75rem" }}><Giltzarrapoa /></div>
          <h1 style={{ ...h2, fontSize: "2rem" }}>Liburutxo hau ez dago zure gunean</h1>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "2rem" }}>
            Laster, beste liburutxoetako jolasak ere desblokeatu ahal izango dituzu.
          </p>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {!saioa && <HauDaNirea librillo={liburutxoa} />}
            <Link href={`/magia-tailerrak/${nireak[0]}`} style={{ color: K.tenue, fontSize: "0.9rem", textAlign: "center" }}>
              Itzuli nire liburutxora ({LIBURUTXOAK[nireak[0]].etiketa})
            </Link>
          </div>
        </section>
        <Oina />
      </main>
    );
  }

  const besteak = Object.values(LIBURUTXOAK).filter((b) => !nireak.includes(b.slug) && b.slug !== liburutxoa);

  return (
    <main style={main}>
      {nireak.length === 0 && <Gogoratu librillo={liburutxoa} />}
      <Goiburua email={saioa?.email ?? null} />

      <section style={{ ...contenedor, padding: "1.5rem 1.25rem 0" }}>
        <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA} · {l.etiketa}</p>
        <h1 style={{ fontSize: "clamp(2.1rem, 6vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "1.5rem" }}>
          Zure magia-gunea
        </h1>
        <div style={{ borderLeft: `2px solid ${K.cyan}`, padding: "0.25rem 0 0.25rem 1rem", color: K.tenue, lineHeight: 1.7, fontSize: "0.98rem", marginBottom: "2.5rem" }}>
          Liburutxo hauek berri-berriak dira, eta zuek zarete lehenak. Jolas bakoitzaren bideoa (ikusleen aurrean nola egiten den eta sekretua, pausoz pauso) astez aste grabatzen eta igotzen ari naiz. Itzuli laster!
        </div>

      </section>

      <section style={{ ...contenedor, padding: "0 1.25rem 3rem" }}>
        <div style={{ ...tarjeta, borderColor: "rgba(46,211,230,0.45)" }}>
          <p style={{ ...etiqueta, marginBottom: "0.75rem" }}>Opari extra bat</p>
          <h2 style={h2}>{OPARIA.izenburua}</h2>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>{OPARIA.azpititulua}</p>
          {opariaDu ? (
            <Bideoa id={OPARIA.bideoa} izenburua={OPARIA.izenburua} />
          ) : (
            <>
              <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
                Utzi zure emaila eta desblokeatu bideoa. Heldu batek bete behar du: eskatu laguntza aitari edo amari.
              </p>
              <OpariForm librillo={liburutxoa} />
            </>
          )}
        </div>
      </section>

      <section style={{ ...contenedor, padding: "0 1.25rem" }}>
        <p style={{ ...etiqueta, marginBottom: "1.25rem" }}>Liburutxoko jolasak</p>
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {l.jolasak.map((slug) => {
            const j = JOLASAK[slug];
            return (
              <article key={slug} style={tarjeta}>
                <p style={{ ...etiqueta, fontSize: "0.7rem", marginBottom: "0.5rem" }}>{j.etiketa}</p>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 500, marginBottom: "0.6rem" }}>{j.izenburua}</h2>
                <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "0.6rem" }}>{j.sarrera}</p>
                <p style={{ color: K.muy, fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.1rem" }}><b>Behar duzuna:</b> {j.materiala}</p>
                {j.bideoa ? <Bideoa id={j.bideoa} izenburua={j.izenburua} /> : <Laster />}
              </article>
            );
          })}
        </div>
      </section>


      <section style={{ ...contenedor, padding: "3.5rem 1.25rem 4rem" }}>
        <p style={{ ...etiqueta, marginBottom: "0.75rem" }}>Laster</p>
        <h2 style={h2}>Desblokeatzeko gehiago</h2>
        <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>Beste liburutxoetako jolasak eta magia-ikastaroak, hemen bertan.</p>
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {besteak.map((b) => (
            <div key={b.slug} style={{ ...tarjeta, display: "flex", gap: "1rem", alignItems: "flex-start", opacity: 0.75 }}>
              <Giltzarrapoa />
              <div>
                <p style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.3rem" }}>{b.etiketa} · liburutxoa</p>
                <p style={{ fontSize: "0.85rem", color: K.muy, lineHeight: 1.6 }}>{b.jolasak.length} jolas bideoan · Laster</p>
              </div>
            </div>
          ))}
          <div style={{ ...tarjeta, display: "flex", gap: "1rem", alignItems: "flex-start", opacity: 0.75 }}>
            <Giltzarrapoa />
            <div>
              <p style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.3rem" }}>Magia-ikastaroak</p>
              <p style={{ fontSize: "0.85rem", color: K.muy, lineHeight: 1.6 }}>Kartomagia eta gehiago · Laster</p>
            </div>
          </div>
        </div>
        {!saioa && (
          <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: K.muy, textAlign: "center" }}>
            Ez da hau zure liburutxoa? <Link href="/magia-tailerrak?aldatu=1" style={{ color: K.tenue }}>Aldatu</Link>
          </p>
        )}
      </section>
      <Oina />
    </main>
  );
}
