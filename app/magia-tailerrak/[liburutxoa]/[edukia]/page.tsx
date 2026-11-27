// Página de un juego (o del regalo): vídeo, el texto del librillo, material y
// notas propias. Solo existe cuando el juego tiene vídeo en algún idioma (se
// pega en /admin); si solo lo tiene en el otro idioma, sale ese con un aviso.
// Sin ninguno, en el librillo sale como «Grabatzen» y no se puede abrir.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TESTUAK } from "@/lib/magia-hizkuntza";
import { hizkuntza } from "@/lib/magia-plataforma";
import { gorria, kartaOf, liburutxoSarbidea } from "@/lib/magia-sarbidea";
import Bideoa from "../../_components/Bideoa";
import Goiburua from "../../_components/Goiburua";
import Oharrak from "../../_components/Oharrak";
import Oina from "../../_components/Oina";
import { K, contenedor, main } from "../../_components/estiloa";
import css from "../../_components/magia.module.css";

export const dynamic = "force-dynamic";

export default async function EdukiOrria({
  params,
  searchParams,
}: {
  params: Promise<{ liburutxoa: string; edukia: string }>;
  searchParams: Promise<{ desblokeatuta?: string }>;
}) {
  const { liburutxoa, edukia } = await params;
  const { desblokeatuta } = await searchParams;
  const h = await hizkuntza();
  const t = TESTUAK[h];
  const s = await liburutxoSarbidea(liburutxoa, h);
  if (!s) notFound();
  const liburura = `/magia-tailerrak/${liburutxoa}`;
  if (!s.nirea) redirect(liburura);
  const e = s.edukiak.find((x) => x.slug === edukia);
  if (!e) notFound();
  const oparia = e.egoera === "emaila";
  if (oparia && !s.saioa) redirect(`${liburura}#oparia`);
  if (!oparia && (e.egoera !== "irekia" || !e.youtube)) redirect(liburura);

  const karta = oparia ? null : kartaOf(s.jolasak, e.slug);
  const prest = s.jolasak.filter((x) => x.youtube);
  const hurrengoa = karta ? prest.find((x) => kartaOf(s.jolasak, x.slug).zenbakia > karta.zenbakia) : prest[0];

  return (
    <main style={main}>
      <Goiburua email={s.saioa?.email ?? null} h={h} />
      <article style={{ ...contenedor, padding: "1.25rem 1.25rem 3.5rem" }}>
        <Link href={oparia ? `${liburura}#oparia` : liburura} style={{ color: K.tenue, fontSize: "0.9rem", textDecoration: "none", display: "inline-block", padding: "0.5rem 0", marginBottom: "1rem" }}>
          {t.nireGunea(s.l.etiketa)}
        </Link>

        <header style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
          <span className={css.izkina} aria-hidden style={{ background: K.fg, color: K.bg, borderColor: K.fg, width: "3.6rem", height: "4.3rem", flexShrink: 0 }}>
            {karta ? (
              <>
                <span className={css.izkinaZenb} style={{ fontSize: "1.4rem" }}>{karta.zenbakia}</span>
                <span className={`${css.izkinaPaloa} ${gorria(karta.paloa) ? css.gorria : ""}`} style={{ fontSize: "1.2rem" }}>{karta.paloa}</span>
              </>
            ) : (
              <span style={{ fontSize: "1.5rem" }}>★</span>
            )}
          </span>
          <div>
            <p style={{ color: K.cyan, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
              {oparia ? e.etiketa ?? t.opariExtra : `${t.jolasaN(karta!.zenbakia)}${e.etiketa ? ` · ${e.etiketa}` : ""}`}
            </p>
            <h1 style={{ fontSize: "clamp(1.7rem, 5.5vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{e.izenburua}</h1>
          </div>
        </header>

        {oparia && desblokeatuta && (
          <div role="status" style={{ background: "rgba(46,211,230,0.10)", border: "1px solid rgba(46,211,230,0.45)", borderRadius: 10, padding: "0.9rem 1rem", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            <p style={{ fontWeight: 600, color: K.cyan, marginBottom: "0.2rem" }}>{t.desblokeatuta}</p>
            <p style={{ fontSize: "0.9rem", color: K.tenue }}>{t.desblokeatutaTestua}</p>
          </div>
        )}

        {e.youtube && e.bideoHizkuntza && e.bideoHizkuntza !== h && (
          <p role="note" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", color: K.tenue, marginBottom: "0.6rem" }}>
            <span aria-hidden style={{ border: `1px solid ${K.borde}`, borderRadius: 999, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.04em" }}>{e.bideoHizkuntza.toUpperCase()}</span>
            {t.besteHizkuntzan}
          </p>
        )}
        <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: "2rem" }}>
          {e.youtube ? (
            <Bideoa id={e.youtube} izenburua={e.izenburua} etiketa={t.ikusiBideoaIzena(e.izenburua)} />
          ) : (
            <div style={{ aspectRatio: "16 / 9", border: `1px dashed ${K.borde}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: K.tenue }}>
              <span className={css.rec} aria-hidden /> {t.bideoaGrabatzenOrria}
            </div>
          )}
        </div>

        {e.sarrera && (
          <section style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 500, marginBottom: "0.5rem" }}>{oparia ? t.zerDa : t.liburutxoan}</h2>
            <p style={{ color: K.tenue, lineHeight: 1.75 }}>{e.sarrera}</p>
          </section>
        )}
        {e.materiala && (
          <section style={{ marginBottom: "2rem", borderLeft: `2px solid ${K.cyan}`, paddingLeft: "1rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 500, marginBottom: "0.35rem" }}>{t.beharDuzuna}</h2>
            <p style={{ color: K.tenue, lineHeight: 1.7 }}>{e.materiala}</p>
          </section>
        )}

        <Oharrak gakoa={`${liburutxoa}:${e.slug}`} h={h} />

        {hurrengoa && hurrengoa.slug !== e.slug && (
          <Link href={`${liburura}/${hurrengoa.slug}`} className={css.lerroa} style={{ marginTop: "2rem", gridTemplateColumns: "1fr auto" }}>
            <span>
              <span style={{ display: "block", fontSize: "0.85rem", color: K.tenue, marginBottom: "0.15rem" }}>{t.hurrengoJolasa}</span>
              <span className={css.izenburua}>{hurrengoa.izenburua}</span>
            </span>
            <span className={css.play} aria-hidden />
          </Link>
        )}
      </article>
      <Oina h={h} />
    </main>
  );
}
