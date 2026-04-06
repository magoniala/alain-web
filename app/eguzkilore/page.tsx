"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function EguzkilorePage() {
  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EU</span>
            <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
            <Link href="/es/eguzkilore" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[282px] md:h-[470px]" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6] uppercase">
              Eguzkilore
            </p>
            <h1 className="hero-fade-2 max-w-[860px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Baraja boltsikotik ateratzean barre egin zuten.
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                lehen trukoa amaitu nuen harte.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 1 — La escena */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]/50 mb-10">
            &ldquo;Alainek magia itxen du, ba al zenekiten?&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Nire lagun taldeak edozein gizarte unetan erabiltzen du esaldi hori botatzeko.</p>
            <p>Norbaitek jakin-minarekin begiratzen dit.<br />Beste batek bekaina altxatzen du, eszeptikoa.<br />Beti dago norbait beti esan ohi dena esaten duena:</p>
            <p className="text-[#F2F2F0]/50 italic">"Ea, egin zerbait."</p>
            <p>Sorta atera eta, ireki aurretik, hamaika aldiz entzun dudan esaldia entzuten dut:</p>
            <p className="text-[#F2F2F0]/50 italic">"Beti daramazu karta sortarekin gainean?"</p>
            <p>Tonuak dena esaten du: pixka bat iseka, pixka bat sinesgaiztasun.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 — La respuesta */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            "Bai. Friki bat naiz."
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Samurai batek katana ateratzen duen segurtasun berarekin esaten dut.<br />Badakit zer gertatzekotan dagoen.</p>
            <p>Adrenalinak jo egiten nau, nire taupadak nabari det, esukuak dardarka det.<br />Haietako batek barre egiten du.</p>
            <p className="text-[#F2F2F0]/50 italic">&ldquo;Esukuak dardarka dituzula, jajaja.&rdquo;</p>
            <p>Ez du huts egiten. Beti dago norbait goian jartzen saiatzen dena.</p>
            <p className="text-[#F2F2F0]/50 italic">"Zu zarenak urduri jartzen naizela da."</p>
            <p>Erdi irribarrearekin uzten dut.</p>
            <p>Baina egia dakikit.<br />Badakit zer datorren.<br />Hamar segundotan, bere barrea harriduran bihurtuko da.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 3 — El truco */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Nahastatzen hasten naiz.<br />Lehenik, begi zokoz begirada batzuk.<br />Gero, &ldquo;ostia&rdquo; bat ahoz behera.</p>
            <p>Eta konturatu nahi dutenean, eszeptikoenak ere ahoa zabalik du eta ez daki zer esan.</p>
            <p>Bururatzen zaion zentzudunena da:</p>
            <p className="text-[#F2F2F0]/50 italic">"Nola egin duzu?"</p>
            <p>Baina berandu da dagoeneko.<br />Azalduko banu bezala, beste joko bat hasten dut.<br />Konturatu gabe, berriro harrapatuta daude.</p>
          </div>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Amaierara noa.</p>
            <p>Nire eskuei begiratzen diet. Hatzak zabaldu. Mangarrak berrikusten ditut.</p>
            <p>Ezer ez, nahastutako sorta bat bakarrik.</p>
            <p>Hatzak kraskatzen ditut.</p>
            <p>Eta inork ulertzen ez duen moduan…<br />Kartak ordenatzen dira nik ukitu gabe.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 — El clímax */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            <p>Boom.</p>
            <p>Oihuak.</p>
            <p>Sinesgaiztasuna.</p>
            <p className="text-[#F2F2F0]/72">Lehen zalantzatuek orain txalo egiten dute.</p>
          </div>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Hasieran nitaz barre egiten hari zena, orain gehien gozatzen hari dena bihurtu da.</p>
            <p className="text-[#F2F2F0]/50 italic">&ldquo;In beste bat! Itxoin, itxoin... lagun bateri deitxuko diot hau ikusteko.&rdquo;</p>
            <p>Bapatian, jenda biltzen bat.<br />Jendea hurbiltzen da.<br />Isiltasuna egiten da.</p>
            <p>Eta bitxia dena da erreakzio bera edozeinek lor dezakeela.</p>
          </div>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p className="text-[#F2F2F0]/50 italic">&ldquo;Baina... nola ostias iten dezu hori?&rdquo;</p>
            <p className="text-[#F2F2F0]/50 italic">&ldquo;Ezer berezirik ez. Praktika besterik ez.&rdquo;</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 — El secreto */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            Baina sekretu bat dago.<br />
            <span className="text-[#F2F2F0]/55">Ez du zerikusirik talentuarekin.</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Jende askok etxeko baraja zaharkituarekin truko bat egiten saiatzen da eta porrot egiten du.<br />Ez da beren errua.<br />Itsatsi-itsatsi diren kartak, tolestutako ertzak… ezinezkoa da zerbaitetxo deko egitea horrekin.</p>
            <p>Baina baraja on bat baduzu eta teknika egokiak ezagutzen badituzu, minutu gutxiren buruan hamaika pertsona liluratu ditzakezu.<br />Ez duzu nahasten ikasi beharrik ere.</p>
            <p>Horregatik diseinatu nuen <strong className="text-[#F2F2F0]">EGUZKILORE</strong> baraja.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 6 — La baraja */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Euskal kulturan inspiratua, dortsoan eguzkiloreak segurtasun sinbolotzat eta figuretan euskal kultura omenaldia ematen duten xehetasunekin.</p>
            <p>Kalitate profesionalekoa, sondotasun eta malgutasunaren arteko oreka perfektua duela.</p>
            <p><span className="text-[#F2F2F0]/90">Kaxatik ateratzen dituzu eta dagoeneko aldea nabari duzu:</span> perfektu irristatzen du, ez da engantxatzen, kartak bakarrik kokatzen diren ematen du.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 7 — No es solo una baraja */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            Baina EZ da sorta bat bakarrik.<br />
            <span className="text-[#F2F2F0]/55">Tresna bat da.</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Izotz apurtzeko aitzakia gisa erabili dezakezu.</p>
            <p>Zure Fidget Toy berri gisa pelikula bat ikusten edo ikasten ari zaren bitartean entretenu zaitekezu.</p>
            <p>Edo soilik edozein arratsalde normal mahai jokoetako saio bihurtzeko.</p>
            <p>Baina hemen dator onena:<br />Baraja bakoitzaren barruan karta berezi bat dago.</p>
            <p>Euskarazko lehen kartomago ikastaroko lehenengo bi moduluetarako sarbide giltza.<br />Minutu gutxiren buruan, zure lehen trukua egiten egongo zara.<br />Hilabete bat baino gutxiagoan, edozeini ahoa zabalik uzteko prest 13 joko menderatuko dituzu.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 8 — El precio */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72 mb-8">
            Orain, pentsatu segundo batez.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/50 mb-12">
            <p>Mahai joko sinple batek 13,75 € balio du</p>
            <p>Magia kurtso profesional batek, gutxienez 50 € (eta euskaraz, ez dira existitzen)</p>
            <p>Diseinuko barajak 12 €-tik hasten dira eta batzuk 500 € baino gehiagora balioa irabazten dute</p>
            <p>Oinarrizko magia kit batek (tiradera batean ahaztua geratzen dena), 27,90 €</p>
            <p>Merezi duten trukoekin duinagoa den bat, 90 €-tan lor zenezake</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            <p>Baina <strong>EGUZKILORE</strong>-k ez dizu 90 € kostako.</p>
            <p className="text-[#F2F2F0]/55">Ezta 40 € ere.</p>
            <p className="text-[#F2F2F0]/55">Ezta 20 € ere.</p>
          </div>
        </div>
      </section>

      {/* CIERRE — CTA */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90 mb-8">
            Abiarazte-prezioa: 12€.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/58 mb-12">
            <p>Bai, mahai joko merke batek baino gutxiago.</p>
            <p>Eta onena: ikastaro hori opari gisa barne hartuta dago.</p>
          </div>
          <a
            href="mailto:contacto@niala.es?subject=Eguzkilore%20baraja%20nahi%20dut"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
            style={{ textDecoration: "none" }}
          >
            Egin klik hemen eta eskatu zure EGUZKILOREa orain.
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
          </div>
        </div>
      </footer>

    </main>
  );
}
