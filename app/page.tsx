"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [showHeaderName, setShowHeaderName] = useState(false);
  const [hoveredContext, setHoveredContext] = useState("empresa");

  const contextContent = {
    cultura: {
      href: "/cultura",
      label: "Kultura / Euskara",
      preview:
        "Sinbolikoa historia liburuetan gera ez dadin.",
    },
    empresa: {
      href: "/empresa",
      label: "Enpresa",
      preview: "Egokia izan behar dena hutsik geratzeko arriskua duenean.",
    },
    hosteleria: {
      href: "/hosteleria",
      label: "Ostalaritza",
      preview: "Espazioak identitatea eskatzen duenean.",
    },
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowHeaderName(window.scrollY > 430);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main id="top" className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      <header
        className={`sticky top-0 z-50 border-b bg-[#0B0B0C]/70 backdrop-blur-md transition-all duration-300 ${
          showHeaderName ? "border-white/10" : "border-white/6"
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <div className="pl-0 md:pl-[42px]">
            <a
              href="#top"
              className={`inline-block text-[0.72rem] md:text-[0.96rem] uppercase tracking-[0.05em] md:tracking-[0.35em] text-[#2ED3E6] transition-all duration-300 ${
                showHeaderName
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              Alain Zulaika
            </a>
          </div>

          <nav className="flex items-center gap-6 md:gap-8">
            <a
              href="#contextos"
              className="hidden md:block text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]"
            >
              Testuinguruak
            </a>
            <a
              href="/contacto"
              className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]"
            >
              Kontaktua
            </a>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EU</span>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <a href="/es/" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</a>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-6 md:-translate-y-8">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[255px] md:h-[400px] xl:h-[520px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-s uppercase tracking-[0.35em] text-[#2ED3E6]">
              Alain Zulaika
            </p>

            <h1 className="hero-fade-2 text-[clamp(1.38rem,5vw,4.8rem)] font-medium leading-[1.05] tracking-[-0.02em]">
              Molestatzeko beldurrez
              <br />
              diseinatutako ekitaldi batek
              <br />
              Mr.&nbsp;Bean gela batean
              <br />
              sartzen denean bezala
              <br />
              jokatzen du
            </h1>

            <p className="hero-fade-3 mt-6 text-[clamp(1rem,1.2vw,1.2rem)] leading-relaxed text-[#F2F2F0]/75">
              Ekitaldi korporatibo eta kulturaletarako interbentzio eszenikoak magiarekin.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 py-4 md:px-16 md:py-6">
        <div className="max-w-[760px]">
          <p className="mb-5 text-[1.05rem] uppercase tracking-[0.18em] text-[#F2F2F0]/90 md:text-[1.1rem]">
            Mr. Bean horrela sartzen da:
          </p>

          <ul className="space-y-5 text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]">
            <li>Kontu handiz.</li>
            <li>Gustukoa izaten saiatuz.</li>
            <li>Leku gutxi hartuz.</li>
            <li>Hasi aurretik barkamena eskatuz.</li>
            <li>Isiluneak kudeatzen jakin gabe.</li>
          </ul>

          <p className="mt-14 max-w-[560px] text-[clamp(1.2rem,1.8vw,1.5rem)] leading-relaxed text-[#F2F2F0]/85">
            Horrela funtzionatzen dute ekitaldi askok:
            <br />
            antsietate sozialetik.
          </p>
        </div>
      </section>

      {/* BLOQUE 3 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-20 pb-24 md:px-16 md:pt-28 md:pb-28">
        <div className="max-w-[760px]">
          <p className="mb-10 text-[clamp(2rem,2.7vw,2.5rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            Eta hori nabaritu egiten da.
          </p>

          <div className="space-y-6 text-[clamp(1.35rem,1.8vw,1.7rem)] leading-relaxed text-[#F2F2F0]/84">
            <p>Txalo adeitsuetan.</p>
            <p>WhatsApp bidezko &ldquo;oraintxe noa&rdquo; mezuetan.</p>
            <p>Ahozabalkada disimulatuetan.</p>
          </div>

          <div className="mt-12 max-w-[760px] space-y-4 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>Antolatzaileak eskaletatari, denborei eta dena &ldquo;dagokion bezala&rdquo; ateratzeari begira.</p>
            <p>Aretoa irakurtzeari baino hutsik ez egiteari arreta gehiago jarriz.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-24 pb-24 md:px-16 md:pt-28 md:pb-28">
        <div className="max-w-[760px]">
          <div className="space-y-4 text-[clamp(1.85rem,2.4vw,2.2rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            <p>Arazoa ez da ekoizpena.</p>
            <p>Ez da edukia.</p>
            <p>Are gutxiago jendea.</p>
          </div>

          <div className="mt-12 max-w-[760px] space-y-5 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/78">
            <p>Arazoa diseinuaren abiapuntua da: oztopatzeari, deserosotasunari eta gidoitik irtetzeari beldurra.</p>

            <p>
              Ekitaldi bat hortik sortzen denean, zuzena eta aproposa bihurtzen da.
            </p>

            <p>
              Baina prezio handia ordaintzen du:
              <br />
              presentzi izateari uko egiten dio.
            </p>

            <p>Eta badakizu horrela bizi den norbaiten itxura.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-28 pb-24 md:px-16 md:pt-36 md:pb-28">
        <div className="max-w-[760px]">
          <div className="space-y-6 text-[clamp(1.4rem,1.9vw,1.75rem)] leading-relaxed text-[#F2F2F0]/90">
            <p>
              Ekitaldi batek Mr.&nbsp;Bean bezala jokatzeari uzteko
              <br />
              norbaitek aretoa emozionalki gidatzeko ausardia izan behar du.
            </p>
          </div>

          <div className="mt-12 space-y-5 text-[clamp(1.25rem,1.6vw,1.5rem)] leading-relaxed text-[#F2F2F0]/82">
            <p>Ez show bat egiten duelako.</p>
            <p>Ez entretenimenduz mozorrotutako zarata sartzen duelako.</p>
            <p>Ez isiluneak urduritasun hutsarengatik betetzen dituelako.</p>
          </div>

          <div className="mt-14 text-[clamp(1.5rem,2vw,1.9rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            <p>Baizik eta ia inork hartu nahi ez duen lekua</p>
            <p>hartzen duelako:</p>

            <p className="mt-8 text-[clamp(1.9rem,2.4vw,2.3rem)] font-semibold tracking-[-0.025em] text-[#F2F2F0]">
              osotasunaren erantzukizun eszenikoa.
            </p>
          </div>

          <div className="mt-20 space-y-4 text-[clamp(1.45rem,1.9vw,1.7rem)] leading-relaxed text-[#F2F2F0]/85 md:mt-24">
            <p>Ekitaldiak noiz arnastuko duen erabakitzea.</p>
            <p>Noiz estutu.</p>
            <p>Noiz erlaxatu.</p>
            <p>Noiz jolas dezakeen.</p>
          </div>

          <div className="mt-24 max-w-[720px] space-y-5 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/75">
            <p>Hori da diseinu eszenikoa.</p>
            <p>Hori da kudeaketa emozionala.</p>

            <p className="mt-8">
              Eta hori gertatzen denean,
              <br />
              gainerako guztia ordenatzen hasten da:
            </p>

            <p>
              gertatzen den bitartean sentitzen dena
              <br />
              eta bukatzen denean gogoratzen dena.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 6 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-36 pb-32 md:px-16 md:pt-44 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.6rem)] leading-relaxed text-[#F2F2F0]/85">
            Ekitaldiak justifikatzeari uzten dio.
          </p>

          <div className="mt-12 space-y-6 text-[clamp(1.5rem,1.9vw,1.75rem)] leading-relaxed text-[#F2F2F0]/90">
            <p>Eta orduan gainerakoa agertzen da:</p>

            <p>arreta eusten da,</p>
            <p>presentzia kolektiboa aktibatzen da,</p>
            <p>
              eta ekitaldiak{" "}
              <span className="font-bold">nortasuna</span>{" "}
              izatera baimentzen da.
            </p>
          </div>

          <div className="mt-28 space-y-6 text-[clamp(2rem,2.7vw,2.7rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]/85">
            <p>Ez Mr. Bean-ena.</p>

            <p className="text-[clamp(2.5rem,3.5vw,3.4rem)] font-semibold tracking-[-0.03em] text-[#F2F2F0]">
              Jack Sparrow-rena.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 7 — TESTUINGURUAK */}
      <section
        id="contextos"
        className="fade-in mx-auto max-w-[1400px] bg-[#101012] px-8 pt-44 pb-28 md:px-16 md:pt-52 md:pb-32"
      >
        <div className="max-w-[820px]">
          <div className="mb-12 h-px w-32 bg-white/15" />

          <p className="text-[clamp(1.9rem,2.6vw,2.5rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            Eta hor sartzen da magia.
          </p>

          <p className="mt-8 max-w-[620px] text-[clamp(1.15rem,1.45vw,1.28rem)] leading-relaxed text-[#F2F2F0]/90">
            Aukeratu zure kasura gehien hurbiltzen den <span className="font-bold">testuingurua</span>.
            <br />
            Bakoitzak esku-hartzeko modu ezberdin bat eskatzen du.
          </p>

          <nav className="mt-25 hidden xl:flex gap-3">
            {(["empresa", "cultura", "hosteleria"] as const).map((key) => (
              <a
                key={key}
                href={contextContent[key].href}
                onMouseEnter={() => setHoveredContext(key)}
                className={`flex-1 flex items-center justify-between gap-4 px-5 py-4 border transition-all duration-300 ${
                  hoveredContext === key
                    ? "border-[#2ED3E6]/50 bg-white/[0.03] text-[#F2F2F0]"
                    : "border-white/[0.10] text-[#F2F2F0]/60 hover:border-white/22 hover:text-[#F2F2F0]/85"
                }`}
              >
                <span className="text-[clamp(1.05rem,1.3vw,1.25rem)] tracking-[-0.02em]">
                  {contextContent[key].label}
                </span>
                <span className={`shrink-0 transition-colors duration-300 ${hoveredContext === key ? "text-[#2ED3E6]" : "text-[#2ED3E6]/35"}`}>→</span>
              </a>
            ))}
          </nav>

          <div className="hidden xl:block mt-20 max-w-[640px] min-h-[8.5rem]">
            <div key={hoveredContext} className="context-fade-in">
              <p className="text-[clamp(2rem,2.6vw,2.4rem)] leading-[1.35] tracking-[-0.025em] text-[#F2F2F0]/94">
                {contextContent[hoveredContext as keyof typeof contextContent].preview}
              </p>
              <a
                href={contextContent[hoveredContext as keyof typeof contextContent].href}
                className="mt-6 inline-flex items-center gap-2 text-[0.78rem] uppercase tracking-[0.18em] text-[#2ED3E6]/60 hover:text-[#2ED3E6] transition-colors duration-200"
              >
                <span>→</span>
                <span>{contextContent[hoveredContext as keyof typeof contextContent].label}</span>
              </a>
            </div>
          </div>

          {/* Mobile: stacked context links with preview */}
          <div className="xl:hidden mt-10 space-y-3">
            {(["empresa", "cultura", "hosteleria"] as const).map((key) => (
              <a
                key={key}
                href={contextContent[key].href}
                className="flex items-start justify-between gap-4 py-4 px-4 border border-white/12 active:border-[#2ED3E6]/50 active:bg-white/[0.03] transition-colors"
              >
                <div>
                  <p className="text-[1.1rem] tracking-[-0.02em] text-[#F2F2F0]/85">
                    {contextContent[key].label}
                  </p>
                  <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[#F2F2F0]/48">
                    {contextContent[key].preview}
                  </p>
                </div>
                <span className="shrink-0 mt-0.5 text-[#2ED3E6]/55 text-[1.1rem]">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* BLOQUE 8 — NOLA LAN EGITEN DUDAN */}
      <section
        id="como-trabajo"
        className="fade-in mx-auto max-w-[1400px] px-8 pt-36 pb-28 md:px-16 md:pt-44 md:pb-32"
      >
        <div className="max-w-[860px]">
          <div className="max-w-[720px]">
            <p className="text-[clamp(2rem,2.8vw,2.8rem)] font-medium tracking-[-0.025em] text-[#F2F2F0]">
              Nire lana ez da antzeztuz hasten.
            </p>

            <p className="mt-8 text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/84">
              Ulertuz hasten da.
            </p>
          </div>

          <div className="relative mt-20 pl-10 md:pl-12">
            <div className="absolute left-[11px] top-[0px] bottom-[0px] w-px bg-gradient-to-b from-white/1 via-white/14 to-white/1" />

            <div className="space-y-20">
              {/* Fase 1 */}
              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  1. FASEA — Testuinguruaren irakurketa
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Esan nahi dena, saihesten dena
                  <br />
                  eta benetan jokoan dagoena kontuan izateko.
                </p>
              </div>

              {/* Fase 2 */}
              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  2. FASEA — Ekitaldiaren arkitektura emozionala
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Erritmoa, tentsionak, isiluneak
                  <br />
                  eta mezuaren zerbitzuko baliabideen diseinua.
                </p>
              </div>

              {/* Fase 3 */}
              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  3. FASEA — Sorkuntza lerrokatzea
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Ideia ez da inposatzen:
                  <br />
                  partekatua bihurtu arte fintzen da.
                </p>
              </div>

              {/* Fase 4 */}
              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  4. FASEA — Exekuzio eszenikoa
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Magiak, gorputzak eta eszenak diseinua eusten dute.
                  <br />
                  Beti zuzenekoak eskatzen duen malgutasunarekin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 9 — CTA FINAL */}
      <section className="fade-in mx-auto max-w-[900px] px-8 pt-40 pb-40 text-center">
        <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-tight text-[#F2F2F0]">
          Onaino iritsi bazara,
          <br />
          ez da kasualitatea izan.
        </p>

        <p className="mt-6 text-[clamp(1.6rem,2vw,2rem)] text-[#F2F2F0]/80">
          Diseinua izan da.
        </p>

        <div className="mt-12">
          <a
            href="/contacto"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/3 hover:text-[#2ED3E6]"
          >
            Hitz egin dezagun
          </a>
        </div>

        <p className="mt-6 text-[1rem] text-[#F2F2F0]/55">
          Jack Sparrow ekitaldi bat nahi baduzu bakarrik.
        </p>
      </section>

      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">
              Nabigazioa
            </p>

            <div className="grid gap-y-3">
              <a href="#top" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Hasiera
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Enpresa
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Kultura / Euskara
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Ostalaritza
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/contacto" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Kontaktua
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
            </div>
          </div>

          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">
              Identitatea
            </p>

            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">
              Alain Zulaika
            </p>

            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">
              Ekitaldi korporatibo eta kulturaletarako interbentzio eszenikoak magiarekin.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">
                Lege oharra
              </a>
              <a href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">
                Pribatutasuna
              </a>
              <a href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">
                Cookieak
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
