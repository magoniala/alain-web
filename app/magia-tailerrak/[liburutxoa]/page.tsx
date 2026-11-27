// Página de un librillo. Todo sale del catálogo (BD, editable en /admin):
//  - egoera «emaila»: el regalo, se abre dejando el email (adulto) → arriba.
//  - egoera «irekia»: los juegos del librillo, abiertos.
//  - egoera «ordainpekoa» y «sekretua»: candado; de momento no se pueden abrir
//    (decisión de Alain, 9-nov: por ahora no se vende nada).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ikusgaiak, katalogoa, liburutxoaDago, liburutxokoEdukiak, type Edukia } from "@/lib/magia-edukiak";
import { TESTUAK, katalogoaHizkuntzan } from "@/lib/magia-hizkuntza";
import { hizkuntza, nireLiburutxoak, nireSaioa } from "@/lib/magia-plataforma";
import Goiburua from "../_components/Goiburua";
import GiltzaForm from "../_components/GiltzaForm";
import Gogoratu from "../_components/Gogoratu";
import HauDaNirea from "../_components/HauDaNirea";
import OpariForm from "../_components/OpariForm";
import Oina from "../_components/Oina";
import { K, contenedor, etiqueta, main } from "../_components/estiloa";
import css from "../_components/magia.module.css";
import { PALOAK, gorria } from "@/lib/magia-sarbidea";

export const dynamic = "force-dynamic";

/** Una carta boca abajo con candado: el librillo aún no se ha abierto. */
function KartaItxia() {
  return (
    <div aria-hidden className={`${css.sekretua} ${css.atzea}`} style={{ width: 96, margin: "0 auto 1.5rem", transform: "rotate(-4deg)" }}>
      <span className={css.sekretuaGaldera}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    </div>
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
          <span key={e.slug} className={`${css.karta} ${e.youtube ? css.aurpegia : css.atzea} ${e.youtube && gorria(PALOAK[i % PALOAK.length]) ? css.gorria : ""}`} style={{ ["--angelua" as string]: `${angelua}deg`, zIndex: i }}>
            {e.youtube ? PALOAK[i % PALOAK.length] : ""}
          </span>
        );
      })}
    </div>
  );
}

export default async function LiburutxoOrria({ params }: { params: Promise<{ liburutxoa: string }> }) {
  const { liburutxoa } = await params;
  const h = await hizkuntza();
  const t = TESTUAK[h];
  const k = katalogoaHizkuntzan(ikusgaiak(await katalogoa()), h);
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
        <Goiburua email={saioa?.email ?? null} h={h} />
        <section style={{ ...contenedor, maxWidth: "460px", padding: "1.5rem 1.25rem 4rem", textAlign: "center" }}>
          <KartaItxia />
          <p style={{ ...etiqueta, marginBottom: "0.5rem" }}>{t.liburutxoaDe(l.etiketa)}</p>
          <h1 style={{ ...h1, marginBottom: "1rem" }}>{t.hitzMagikoa}</h1>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "2rem" }}>
            {t.giltzaAzalpena}
          </p>
          <GiltzaForm librillo={liburutxoa} h={h} />
          <p style={{ marginTop: "2rem", fontSize: "0.9rem", color: K.muy }}>
            {nireak.length ? (
              <Link href={`/magia-tailerrak/${nireak[0]}`} style={{ color: K.tenue }}>{t.itzuliNirera(etiketaOf(nireak[0]))}</Link>
            ) : (
              <>{t.ezDaZureaGaldera} <Link href="/magia-tailerrak?aldatu=1" style={{ color: K.tenue }}>{t.aldatu}</Link></>
            )}
          </p>
        </section>
        <Oina h={h} />
      </main>
    );
  }

  // Librillo ajeno sin palabra mágica: no se ve. Sin cuenta se puede cambiar (se eligió el que no era).
  if (!nirea) {
    return (
      <main style={main}>
        <Goiburua email={saioa?.email ?? null} h={h} />
        <section style={{ ...contenedor, maxWidth: "460px", padding: "1.5rem 1.25rem 4rem", textAlign: "center" }}>
          <KartaItxia />
          <p style={{ ...etiqueta, marginBottom: "0.5rem" }}>{t.liburutxoaDe(l.etiketa)}</p>
          <h1 style={{ ...h2, fontSize: "2rem" }}>{t.ezDaZurea}</h1>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "2rem" }}>
            {saioa ? t.zureGuneanDuzu(etiketaOf(nireak[0])) : t.besteBatAukeratu}
          </p>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {!saioa && <HauDaNirea librillo={liburutxoa} h={h} />}
            <Link href={`/magia-tailerrak/${nireak[0]}`} style={{ color: K.tenue, fontSize: "0.9rem", textAlign: "center" }}>
              {t.itzuliNirera(etiketaOf(nireak[0]))}
            </Link>
          </div>
        </section>
        <Oina h={h} />
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
      <Goiburua email={saioa?.email ?? null} h={h} />

      <section style={{ ...contenedor, padding: "1.75rem 1.25rem 0", textAlign: "center" }}>
        <p style={{ color: K.cyan, fontSize: "0.9rem", marginBottom: "0.6rem" }}>{t.liburutxoIzena}</p>
        <h1 style={{ ...h1, marginBottom: "0.4rem" }}>{t.zureGunea}</h1>
        <p style={{ color: K.tenue, marginBottom: "1.75rem" }}>{t.liburutxoaDe(l.etiketa)}</p>
        {jolasak.length > 0 && <Abanikoa jolasak={jolasak} />}
        <p style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: "0.5rem" }}>
          {prest === 0 ? t.bideoakBidean(jolasak.length) : t.bideoPrest(prest, jolasak.length)}
        </p>
        <p style={{ color: K.tenue, lineHeight: 1.7, fontSize: "0.95rem", maxWidth: "34rem", margin: "0 auto 2.75rem" }}>
          {t.berriak}
        </p>
      </section>

      {opariak.length > 0 && (
        <section id="oparia" style={{ ...contenedor, padding: "0 1.25rem 3rem", scrollMarginTop: "1rem", display: "grid", gap: "1rem" }}>
          {opariak.map((e, i) => (
            <div key={e.slug} style={{ border: "1px solid rgba(46,211,230,0.5)", borderRadius: 14, background: "linear-gradient(160deg, rgba(46,211,230,0.10), rgba(46,211,230,0.02) 60%)", padding: "1.4rem 1.25rem" }}>
              <p style={{ color: K.cyan, fontSize: "0.9rem", marginBottom: "0.5rem" }}>{e.etiketa ?? t.opariExtra}</p>
              <h2 style={h2}>{e.izenburua}</h2>
              {e.sarrera && <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>{e.sarrera}</p>}
              {emailaUtzita ? (
                <Link href={orria(e.slug)} className={css.botoia}>
                  <span aria-hidden className={`${css.play} ${css.playIluna}`} />
                  {t.ikusiBideoa}
                </Link>
              ) : i === 0 ? (
                <>
                  <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
                    {t.utziEmaila}
                  </p>
                  <OpariForm librillo={liburutxoa} helburua={orria(e.slug)} h={h} />
                </>
              ) : (
                <p style={{ color: K.muy, fontSize: "0.9rem" }}>{t.goikoEmailarekin}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {jolasak.length > 0 && (
        <section style={{ ...contenedor, padding: "0 1.25rem" }}>
          <h2 style={{ ...h2, marginBottom: "0.35rem" }}>{t.liburutxokoJolasak}</h2>
          <p style={{ color: K.muy, fontSize: "0.9rem", marginBottom: "1.1rem" }}>{t.ordenaBerean}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.65rem" }}>
            {jolasak.map((e, i) => {
              const izkina = (
                <span className={css.izkina} aria-hidden>
                  <span className={css.izkinaZenb}>{i + 1}</span>
                  <span className={`${css.izkinaPaloa} ${e.youtube && gorria(PALOAK[i % PALOAK.length]) ? css.gorria : ""}`}>{PALOAK[i % PALOAK.length]}</span>
                </span>
              );
              return (
                <li key={e.slug}>
                  {e.youtube ? (
                    <Link href={orria(e.slug)} className={css.lerroa}>
                      {izkina}
                      <span className={css.izenburua}>{e.izenburua}</span>
                      <span className={css.play} aria-label={t.ikusiBideoa} />
                    </Link>
                  ) : (
                    <div className={css.lerroa} aria-label={t.bideoaGrabatzen(e.izenburua)}>
                      {izkina}
                      <span className={css.izenburua} style={{ color: K.tenue }}>{e.izenburua}</span>
                      <span className={css.egoera}><span className={css.rec} aria-hidden />{t.grabatzen}</span>
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
          <h2 style={{ ...h2, marginBottom: "0.35rem" }}>{t.sekretuak}</h2>
          <p style={{ color: K.tenue, lineHeight: 1.7, marginBottom: "1.25rem" }}>
            {t.sekretuakTestua}
          </p>
          <div className={css.sekretuak}>
            {itxiak.map((e) => (
              <div key={e.slug} className={`${css.sekretua} ${css.atzea}`} aria-label={e.egoera === "sekretua" ? t.sekretuItxia : t.itxita(e.izenburua)}>
                <span className={css.sekretuaGaldera} aria-hidden>?</span>
                {e.egoera === "ordainpekoa" && <span className={css.sekretuaIzena}>{e.izenburua}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!saioa && (
        <p style={{ ...contenedor, padding: "0 1.25rem 3rem", fontSize: "0.85rem", color: K.muy, textAlign: "center" }}>
          {t.ezDaZureaGaldera} <Link href="/magia-tailerrak?aldatu=1" style={{ color: K.tenue }}>{t.aldatu}</Link>
        </p>
      )}
      <Oina h={h} />
    </main>
  );
}
