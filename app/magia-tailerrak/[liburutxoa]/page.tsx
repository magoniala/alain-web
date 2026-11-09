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
import Goiburua from "../_components/Goiburua";
import GiltzaForm from "../_components/GiltzaForm";
import Gogoratu from "../_components/Gogoratu";
import HauDaNirea from "../_components/HauDaNirea";
import OpariForm from "../_components/OpariForm";
import Oina from "../_components/Oina";
import { K, contenedor, etiqueta, main } from "../_components/estiloa";
import css from "../_components/magia.module.css";
import { PALOAK } from "@/lib/magia-sarbidea";

export const dynamic = "force-dynamic";

function Giltzarrapoa({ tamaina = 18 }: { tamaina?: number }) {
  return (
    <svg width={tamaina} height={tamaina} viewBox="0 0 24 24" fill="none" stroke={K.muy} strokeWidth="1.8" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const h1 = { fontSize: "clamp(2.1rem, 6vw, 3.2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05 } as const;
const h2 = { fontSize: "1.45rem", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "0.75rem" } as const;

/** La baraja del librillo: boca arriba los juegos con vídeo, boca abajo los que se están grabando. */
function Abanikoa({ jolasak }: { jolasak: Edukia[] }) {
  const n = jolasak.length;
  const zabalera = Math.min(64, n * 16);
  return (
    <div className={css.abanikoa} aria-hidden>
      {jolasak.map((e, i) => {
        const angelua = n === 1 ? 0 : -zabalera / 2 + (i * zabalera) / (n - 1);
        return (
          <span key={e.slug} className={`${css.karta} ${e.youtube ? css.aurpegia : css.atzea}`} style={{ ["--angelua" as string]: `${angelua}deg`, zIndex: i }}>
            {e.youtube ? PALOAK[i % PALOAK.length] : ""}
          </span>
        );
      })}
    </div>
  );
}

export default async function LiburutxoOrria({ params }: { params: Promise<{ liburutxoa: string }> }) {
  const { liburutxoa } = await params;
  const k = ikusgaiak(await katalogoa());
  if (!liburutxoaDago(k, liburutxoa)) notFound();
  const l = k.liburutxoak.find((x) => x.slug === liburutxoa)!;
  const etiketaOf = (slug: string) => k.liburutxoak.find((x) => x.slug === slug)?.etiketa ?? slug;

  const saioa = await nireSaioa();
  const nireak = await nireLiburutxoak(saioa, k.liburutxoak);
  const nirea = nireak.length === 0 || nireak.includes(liburutxoa);

  // Librillo con palabra mágica y aún sin abrir en este navegador ni en la
  // cuenta: se pide la palabra (escrita a mano en cada ejemplar). El QR es el
  // mismo en todos los librillos; esto es lo que impide abrir el que no tienes.
  if (l.giltza && !nireak.includes(liburutxoa)) {
    return (
      <main style={main}>
        <Goiburua email={saioa?.email ?? null} />
        <section style={{ ...contenedor, padding: "2rem 1.25rem 4rem" }}>
          <p style={{ ...etiqueta, marginBottom: "1rem" }}>{LIBURUTXO_IZENA} · {l.etiketa}</p>
          <div style={{ marginBottom: "0.75rem" }}><Giltzarrapoa tamaina={22} /></div>
          <h1 style={{ ...h1, marginBottom: "1.25rem" }}>Hitz magikoa</h1>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "2rem" }}>
            Zure liburutxoan hitz magiko bat dago, eskuz idatzita. Idatzi hemen eta zure magia-gunea irekiko da.
          </p>
          <GiltzaForm librillo={liburutxoa} />
          <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: K.muy, textAlign: "center" }}>
            {nireak.length ? (
              <Link href={`/magia-tailerrak/${nireak[0]}`} style={{ color: K.tenue }}>Itzuli nire liburutxora ({etiketaOf(nireak[0])})</Link>
            ) : (
              <>Ez da hau zure liburutxoa? <Link href="/magia-tailerrak?aldatu=1" style={{ color: K.tenue }}>Aldatu</Link></>
            )}
          </p>
        </section>
        <Oina />
      </main>
    );
  }

  // Librillo ajeno sin palabra mágica: no se ve. Sin cuenta se puede cambiar (se eligió el que no era).
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
  const prest = jolasak.filter((e) => e.youtube).length;
  // Con cuenta (ha dejado el email) se abren todos los contenidos «emaila».
  const emailaUtzita = !!saioa;
  const orria = (slug: string) => `/magia-tailerrak/${liburutxoa}/${slug}`;

  return (
    <main style={main}>
      {nireak.length === 0 && <Gogoratu librillo={liburutxoa} />}
      <Goiburua email={saioa?.email ?? null} />

      <section style={{ ...contenedor, padding: "1.75rem 1.25rem 0", textAlign: "center" }}>
        <p style={{ color: K.cyan, fontSize: "0.9rem", marginBottom: "0.6rem" }}>{LIBURUTXO_IZENA}</p>
        <h1 style={{ ...h1, marginBottom: "0.4rem" }}>Zure magia-gunea</h1>
        <p style={{ color: K.tenue, marginBottom: "1.75rem" }}>{l.etiketa}ko liburutxoa</p>
        {jolasak.length > 0 && <Abanikoa jolasak={jolasak} />}
        <p style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: "0.5rem" }}>
          {prest === 0 ? `${jolasak.length} jolas, bideoak bidean` : `${prest}/${jolasak.length} bideo prest`}
        </p>
        <p style={{ color: K.tenue, lineHeight: 1.7, fontSize: "0.95rem", maxWidth: "34rem", margin: "0 auto 2.75rem" }}>
          Liburutxo hauek berri-berriak dira, eta zuek zarete lehenak. Jolas bakoitza bideoan grabatzen ari naiz: ikusleen aurrean nola egiten den eta sekretua, pausoz pauso. Prest dagoen bakoitza hemen irekiko da.
        </p>
      </section>

      {opariak.length > 0 && (
        <section id="oparia" style={{ ...contenedor, padding: "0 1.25rem 3rem", scrollMarginTop: "1rem", display: "grid", gap: "1rem" }}>
          {opariak.map((e, i) => (
            <div key={e.slug} style={{ border: "1px solid rgba(46,211,230,0.5)", borderRadius: 14, background: "linear-gradient(160deg, rgba(46,211,230,0.10), rgba(46,211,230,0.02) 60%)", padding: "1.4rem 1.25rem" }}>
              <p style={{ color: K.cyan, fontSize: "0.9rem", marginBottom: "0.5rem" }}>{e.etiketa ?? "Opari extra bat"}</p>
              <h2 style={h2}>{e.izenburua}</h2>
              {e.sarrera && <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>{e.sarrera}</p>}
              {emailaUtzita ? (
                <Link href={orria(e.slug)} className={css.botoia}>
                  <span aria-hidden className={`${css.play} ${css.playIluna}`} />
                  Ikusi bideoa
                </Link>
              ) : i === 0 ? (
                <>
                  <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
                    Utzi zure emaila eta desblokeatu bideoa. Heldu batek bete behar du: eskatu laguntza aitari edo amari.
                  </p>
                  <OpariForm librillo={liburutxoa} helburua={orria(e.slug)} />
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
          <h2 style={{ ...h2, marginBottom: "0.35rem" }}>Liburutxoko jolasak</h2>
          <p style={{ color: K.muy, fontSize: "0.9rem", marginBottom: "1.1rem" }}>Liburutxoan duzun ordena berean.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.65rem" }}>
            {jolasak.map((e, i) => {
              const izkina = (
                <span className={css.izkina} aria-hidden>
                  <span className={css.izkinaZenb}>{i + 1}</span>
                  <span className={css.izkinaPaloa}>{PALOAK[i % PALOAK.length]}</span>
                </span>
              );
              return (
                <li key={e.slug}>
                  {e.youtube ? (
                    <Link href={orria(e.slug)} className={css.lerroa}>
                      {izkina}
                      <span className={css.izenburua}>{e.izenburua}</span>
                      <span className={css.play} aria-label="Ikusi bideoa" />
                    </Link>
                  ) : (
                    <div className={css.lerroa} aria-label={`${e.izenburua}: bideoa grabatzen`}>
                      {izkina}
                      <span className={css.izenburua} style={{ color: K.tenue }}>{e.izenburua}</span>
                      <span className={css.egoera}><span className={css.rec} aria-hidden />Grabatzen</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {itxiak.length > 0 && (
        <section style={{ ...contenedor, padding: "3.5rem 1.25rem 3.5rem" }}>
          <h2 style={{ ...h2, marginBottom: "0.35rem" }}>Sekretuak</h2>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
            Gune honetan sekretu gehiago daude gordeta. Oraindik ezin dira ireki… baina laster!
          </p>
          <div className={css.sekretuak}>
            {itxiak.map((e) => (
              <div key={e.slug} className={`${css.sekretua} ${css.atzea}`} aria-label={e.egoera === "sekretua" ? "Sekretu itxia" : `Itxita: ${e.izenburua}`}>
                <span className={css.sekretuaGaldera} aria-hidden>?</span>
                {e.egoera === "ordainpekoa" && <span className={css.sekretuaIzena}>{e.izenburua}</span>}
              </div>
            ))}
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
