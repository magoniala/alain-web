// Página de un librillo. Todo sale del catálogo (BD, editable en /admin):
//  - egoera «emaila»: el regalo, se abre dejando el email (adulto) → arriba.
//  - egoera «irekia»: los juegos del librillo, abiertos.
//  - egoera «ordainpekoa» y «sekretua»: candado; de momento no se pueden abrir
//    (decisión de Alain, 9-nov: por ahora no se vende nada).
import Link from "next/link";
import { notFound } from "next/navigation";
import { LIBURUTXO_IZENA } from "@/lib/magia-catalogo";
import { ikusgaiak, katalogoa, liburutxoaDago, liburutxokoEdukiak, type Edukia } from "@/lib/magia-edukiak";
import { nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";
import Bideoa from "../_components/Bideoa";
import Goiburua from "../_components/Goiburua";
import Gogoratu from "../_components/Gogoratu";
import HauDaNirea from "../_components/HauDaNirea";
import OpariForm from "../_components/OpariForm";
import Oina from "../_components/Oina";
import { K, contenedor, etiqueta, main, tarjeta } from "../_components/estiloa";

export const dynamic = "force-dynamic";

function Giltzarrapoa({ tamaina = 18 }: { tamaina?: number }) {
  return (
    <svg width={tamaina} height={tamaina} viewBox="0 0 24 24" fill="none" stroke={K.muy} strokeWidth="1.8" aria-hidden>
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

const h1 = { fontSize: "clamp(2.1rem, 6vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05 } as const;
const h2 = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "0.75rem" } as const;

function Jolasa({ e }: { e: Edukia }) {
  return (
    <article style={tarjeta}>
      {e.etiketa && <p style={{ ...etiqueta, fontSize: "0.7rem", marginBottom: "0.5rem" }}>{e.etiketa}</p>}
      <h2 style={{ fontSize: "1.35rem", fontWeight: 500, marginBottom: "0.6rem" }}>{e.izenburua}</h2>
      {e.sarrera && <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "0.6rem" }}>{e.sarrera}</p>}
      {e.materiala && <p style={{ color: K.muy, fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.1rem" }}><b>Behar duzuna:</b> {e.materiala}</p>}
      {e.youtube ? <Bideoa id={e.youtube} izenburua={e.izenburua} /> : <Laster />}
    </article>
  );
}

function Itxita({ e }: { e: Edukia }) {
  const sekretua = e.egoera === "sekretua";
  return (
    <div aria-label={sekretua ? `Sekretu blokeatua: ${e.izenburua}` : `Itxita: ${e.izenburua}`} style={{ ...tarjeta, padding: "1.25rem 0.75rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", textAlign: "center", opacity: 0.85 }}>
      <Giltzarrapoa tamaina={22} />
      {sekretua ? (
        <span style={{ fontSize: "1.4rem", letterSpacing: "0.2em", color: K.muy }}>???</span>
      ) : (
        <span style={{ fontSize: "1rem", fontWeight: 500, lineHeight: 1.3 }}>{e.izenburua}</span>
      )}
      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: K.muy, whiteSpace: "nowrap" }}>
        {sekretua ? `#${e.izenburua.replace(/\D/g, "") || "?"}` : "Laster"}
      </span>
    </div>
  );
}

export default async function LiburutxoOrria({
  params,
  searchParams,
}: {
  params: Promise<{ liburutxoa: string }>;
  searchParams: Promise<{ desblokeatuta?: string }>;
}) {
  const { liburutxoa } = await params;
  const k = ikusgaiak(await katalogoa());
  if (!liburutxoaDago(k, liburutxoa)) notFound();
  const { desblokeatuta } = await searchParams;
  const l = k.liburutxoak.find((x) => x.slug === liburutxoa)!;
  const etiketaOf = (slug: string) => k.liburutxoak.find((x) => x.slug === slug)?.etiketa ?? slug;

  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa, k.liburutxoak.map((x) => x.slug));
  const nirea = nireak.length === 0 || nireak.includes(liburutxoa);

  // Librillo ajeno: no se ve. Sin cuenta se puede cambiar (se eligió el que no era).
  if (!nirea) {
    return (
      <main style={main}>
        <Goiburua email={saioa?.email ?? null} />
        <section style={{ ...contenedor, padding: "2rem 1.25rem 4rem" }}>
          <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA} · {l.etiketa}</p>
          <div style={{ marginBottom: "0.75rem" }}><Giltzarrapoa /></div>
          <h1 style={{ ...h2, fontSize: "2rem" }}>Liburutxo hau ez da zurea</h1>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "2rem" }}>
            {saioa ? `Zure gunean ${etiketaOf(nireak[0])}ko liburutxoa duzu.` : "Liburutxo hau baduzu eta beste bat aukeratu bazenuen, sakatu behean."}
          </p>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {!saioa && <HauDaNirea librillo={liburutxoa} />}
            <Link href={`/magia-tailerrak/${nireak[0]}`} style={{ color: K.tenue, fontSize: "0.9rem", textAlign: "center" }}>
              Itzuli nire liburutxora ({etiketaOf(nireak[0])})
            </Link>
          </div>
        </section>
        <Oina />
      </main>
    );
  }

  const edukiak = liburutxokoEdukiak(k, liburutxoa);
  const opariak = edukiak.filter((e) => e.egoera === "emaila");
  const jolasak = edukiak.filter((e) => e.egoera === "irekia");
  const itxiak = edukiak.filter((e) => e.egoera === "ordainpekoa" || e.egoera === "sekretua");
  // Con cuenta (ha dejado el email) se abren todos los contenidos «emaila».
  const emailaUtzita = !!saioa;

  return (
    <main style={main}>
      {nireak.length === 0 && <Gogoratu librillo={liburutxoa} />}
      <Goiburua email={saioa?.email ?? null} />

      <section style={{ ...contenedor, padding: "1.5rem 1.25rem 0" }}>
        <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA} · {l.etiketa}</p>
        <h1 style={{ ...h1, marginBottom: "1.5rem" }}>Zure magia-gunea</h1>
        <div style={{ borderLeft: `2px solid ${K.cyan}`, padding: "0.25rem 0 0.25rem 1rem", color: K.tenue, lineHeight: 1.7, fontSize: "0.98rem", marginBottom: "2.5rem" }}>
          Liburutxo hauek berri-berriak dira, eta zuek zarete lehenak. Jolas bakoitzaren bideoa (ikusleen aurrean nola egiten den eta sekretua, pausoz pauso) astez aste grabatzen eta igotzen ari naiz. Itzuli laster!
        </div>
      </section>

      {opariak.length > 0 && (
        <section id="oparia" style={{ ...contenedor, padding: "0 1.25rem 3rem", scrollMarginTop: "1rem", display: "grid", gap: "1.25rem" }}>
          {opariak.map((e, i) => (
            <div key={e.slug} style={{ ...tarjeta, borderColor: "rgba(46,211,230,0.45)" }}>
              <p style={{ ...etiqueta, marginBottom: "0.75rem" }}>{e.etiketa ?? "Opari extra bat"}</p>
              <h2 style={h2}>{e.izenburua}</h2>
              {e.sarrera && <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>{e.sarrera}</p>}
              {emailaUtzita ? (
                <>
                  {desblokeatuta && i === 0 && (
                    <div role="status" style={{ background: "rgba(46,211,230,0.10)", border: "1px solid rgba(46,211,230,0.45)", padding: "0.9rem 1rem", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                      <p style={{ fontWeight: 600, color: K.cyan, marginBottom: "0.2rem" }}>Desblokeatuta!</p>
                      <p style={{ fontSize: "0.9rem", color: K.tenue }}>Bideoa zurea da. Begiratu zure posta ere: gunera itzultzeko esteka bidali dizugu.</p>
                    </div>
                  )}
                  {e.materiala && <p style={{ color: K.muy, fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.1rem" }}><b>Behar duzuna:</b> {e.materiala}</p>}
                  {e.youtube ? <Bideoa id={e.youtube} izenburua={e.izenburua} /> : <Laster />}
                </>
              ) : i === 0 ? (
                <>
                  <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
                    Utzi zure emaila eta desblokeatu bideoa. Heldu batek bete behar du: eskatu laguntza aitari edo amari.
                  </p>
                  <OpariForm librillo={liburutxoa} />
                </>
              ) : (
                <p style={{ color: K.muy, fontSize: "0.9rem" }}>Goiko emailarekin irekitzen da hau ere.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {jolasak.length > 0 && (
        <section style={{ ...contenedor, padding: "0 1.25rem" }}>
          <p style={{ ...etiqueta, marginBottom: "1.25rem" }}>Liburutxoko jolasak</p>
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {jolasak.map((e) => <Jolasa key={e.slug} e={e} />)}
          </div>
        </section>
      )}

      {itxiak.length > 0 && (
        <section style={{ ...contenedor, padding: "3.5rem 1.25rem 4rem" }}>
          <p style={{ ...etiqueta, marginBottom: "0.75rem" }}>Sekretuak</p>
          <h2 style={h2}>Oraindik itxita</h2>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Gune honetan sekretu gehiago daude gordeta. Oraindik ezin dira ireki… baina laster!
          </p>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, itxiak.length)}, minmax(0, 1fr))`, gap: "0.75rem" }}>
            {itxiak.map((e) => <Itxita key={e.slug} e={e} />)}
          </div>
        </section>
      )}

      {!saioa && (
        <p style={{ ...contenedor, padding: "0 1.25rem 3rem", fontSize: "0.85rem", color: K.muy, textAlign: "center" }}>
          Ez da hau zure liburutxoa? <Link href="/magia-tailerrak?aldatu=1" style={{ color: K.tenue }}>Aldatu</Link>
        </p>
      )}
      <Oina />
    </main>
  );
}
