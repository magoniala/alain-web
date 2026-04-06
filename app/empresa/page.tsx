"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ContextKey = "comerciales" | "marca" | "internos";

const contexts = {
  comerciales: {
    eyebrow: "Azokak eta aurkezpenak",
    title: "Ekitaldi komertzialak",
    preview:
      "Azoka batean milaka pertsona pasatzen dira stand guztien aurretik. Baina batzuen aurrean bakarrik gelditzen dira.",
    content: [
      "Jendea batzeko eta alboko postuetatik zer gertatzen den ikusteko burua biratzen has daitezen, mikro-interbentzio magikoak erabiltzen ditugu.",
      "Ez ikuskizun gisa. Imán gisa.",
      "Interbentzio bakoitza hurbiltzeko gonbidapen zehatz batekin amaitzen da.",
      "Horrela, bisitari gehiagok benetako elkarrizketak izaten dituzte talde komertzialarekin.",
      "Anekdota batekin joaten dira. Asko itzulli egiten dira. Eta beste pertsona batzuk erakartzen dituzte.",
    ],
    similar:
      "Sektore azokak · erakusketak · produktu aurkezpenak · marka aktibaketak · kongresuak",
  },
  marca: {
    eyebrow: "urteurrenak eta aurkezpenak",
    title: "Marka ekitaldiak",
    preview:
      "Aurkezpenaren erdialdean, areto osoa dagoeneko beste leku batean dago.",
    content: [
      "Mugikorrak, elkarrizketa paraleloak, hurrengo atsedenaldia itxaroten duen jendea.",
      "Zeremonia-maisu gisa jarduten dugu, trantsizioetan integratutako magiarekin. Ez jarduera artean: hauen barruan.",
      "Zuzendariak enpresa bisioa azaltzen duen bitartean, aipatzen dituen balioak ikusleen aurrean magikoki elkartzen dira. Produktu berria aurkezten den bitartean, logotipoa agertzen da.",
      "BIELEren 50. urteurrenean zerbait bitxia gertatu zen: jendea ez zen iritzi batekin irten ekitalditik.",
      "Kontatu zezaketen eszena batekin irten ziren.",
      "Eta kontatzerakoan, enpresak helarazi nahi zuen mezua sakabanatu zuten.",
    ],
    similar:
      "Enpresa urteurrenak · bezero ekitaldiak · hospitality · ate irekiak · marka aurkezpenak",
  },
  internos: {
    eyebrow: "taldea eta ospakizunak",
    title: "Barne ekitaldiak",
    preview:
      "Hamabi hilabete elkarrekin lanean. Eta enpresako afarian, elkarrizketa gutxitan joaten da dagoeneko dakizuena baino haratago.",
    content: [
      "Bakoitza nolakoa den agerrarazteko, itxurak egitea ezinezko bihurtzen duten egoerak behar dira.",
      "Magia trikimailu mozorroz jantzitako dinamikak diseinatzen ditugu.",
      "Hain sinpleak diren erronkatan ezin da nortasuna disimulatu, eta segituan ikusten da nor ausartzen den, nor animatzen den, akatsetan nor haserretzen den, nork proposatzen dituen irtenbideak...",
      "Zure burua behatzen ari direla ez dakizunean, benetan nolakoa zaren erakusten duzu.",
      "Astelehenean, CEOak ostiralean ez zekizkien gauzak dakizki.",
      "Eta lankide batzuk desberdin agurtzen dira beraien artean.",
      "Geminyseko urte amaierako bazkarietan hori gertatu zen.",
      "Minutu batzuetan, ekitaldiak ospakizun izateari utzi zion…",
      "eta talde gisa jokatzen hasi zen.",
    ],
    similar:
      "Enpresa afariak · barne ospakizunak · kick-off · talde topaketak · barne jardunaldiak",
  },
} satisfies Record<
  ContextKey,
  {
    eyebrow: string;
    title: string;
    preview: string;
    content: string[];
    similar: string;
  }
>;

export default function EmpresaPage() {
  const [activeContext, setActiveContext] = useState<ContextKey | null>(null);
  const [hoveredNav, setHoveredNav] = useState<ContextKey | null>(null);

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

  const active = contexts[activeContext ?? "comerciales"];

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link
            href="/"
            className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]"
          >
            Alain Zulaika
          </Link>
          <nav className="flex items-center gap-6 md:gap-8">
            <Link href="/#como-trabajo" className="hidden md:block text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Nola egiten dut lan</Link>
            <Link href="/contacto" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kontaktua</Link>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EUS</span>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <Link href="/es/empresa" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[151px] md:h-[180px] xl:h-[240px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Enpresa</span> ekitaldiak
            </p>

            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.9rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              "Ondo egon zen."
            </h1>

            <div className="hero-fade-3 mt-8 max-w-[600px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Hori da arazoa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE INICIAL */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-24 md:px-16 md:pb-28">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }} className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/68">
            <p>Aurrekontua onartuta,</p>
            <p>ekoizpena, kontrolatuta,</p>
            <p>eta programa, bi aste lehenago bidalita...</p>
          </div>

          <ul className="mt-16 space-y-3 text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]">
            <li>Beharrezkoa da.</li>
            <li>Baina ez da nahikoa.</li>
          </ul>

          <div className="mt-16 max-w-[700px] space-y-5 text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/85">
            <p>Norbaitek hartu behar du ekitaldiaren ardura eszeniko eta emozionala.</p>
            <p>Ez animatzaile gisa.</p>
            <p>Ez betegarri gisa.</p>
            <p>Gainerako guztiak pisua izateko elementu gisa.</p>
          </div>

          <p style={{ marginTop: "9rem" }} className="max-w-[700px] text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
            Ekitaldiaren arabera: saltzeko, komunikatzeko edo kohesionatzeko.
          </p>
        </div>
      </section>

      {/* SELECTOR + CONTENIDO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-16 pb-32 md:px-16 md:pt-20 md:pb-40">
        {/* Mobile selector */}
        <div className="md:hidden mb-8 space-y-2">
          {(Object.entries(contexts) as [ContextKey, (typeof contexts)[ContextKey]][]).map(([key, item]) => {
            const isActive = activeContext === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveContext(activeContext === key ? null : key)}
                className={`w-full text-left px-4 py-4 border transition-colors ${
                  isActive
                    ? "border-[#2ED3E6]/40 bg-white/[0.05]"
                    : "border-white/[0.10] active:border-white/25 active:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-[1.05rem] font-medium tracking-[-0.01em] ${isActive ? "text-[#F2F2F0]" : "text-[#F2F2F0]/55"}`}>
                      {item.title}
                    </p>
                    <p className={`text-[0.82rem] mt-0.5 ${isActive ? "text-[#2ED3E6]/70" : "text-[#F2F2F0]/28"}`}>
                      {item.eyebrow}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[1rem] ${isActive ? "text-[#2ED3E6]" : "text-[#F2F2F0]/20"}`}>
                    {isActive ? "→" : "·"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-start">

          {/* Sidebar */}
          <div className="sidebar-nav hidden md:block md:w-[280px] md:shrink-0 md:mr-20">
            {(Object.entries(contexts) as [ContextKey, (typeof contexts)[ContextKey]][]).map(
              ([key, item]) => {
                const isActive = (activeContext ?? "comerciales") === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveContext(key)}
                    onMouseEnter={() => setHoveredNav(key)}
                    onMouseLeave={() => setHoveredNav(null)}
                    onTouchStart={() => setHoveredNav(key)}
                    onTouchEnd={() => setHoveredNav(null)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      borderLeft: isActive
                        ? "2px solid #2ED3E6"
                        : hoveredNav === key
                        ? "2px solid rgba(242,242,240,0.65)"
                        : "2px solid rgba(242,242,240,0.10)",
                      padding: "20px 0 20px 20px",
                      transition: "border-color 0.2s, background 0.2s",
                      background: hoveredNav === key && !isActive ? "rgba(46,211,230,0.02)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "1.32rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        lineHeight: 1.15,
                        marginBottom: "8px",
                        color: isActive
                          ? "rgba(242,242,240,1)"
                          : hoveredNav === key
                          ? "rgba(242,242,240,0.92)"
                          : "rgba(242,242,240,0.52)",
                        fontWeight: isActive ? 500 : 400,
                        transition: "color 0.2s",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        fontSize: "1rem",
                        textTransform: "lowercase",
                        letterSpacing: "0.01em",
                        color: isActive
                          ? "rgba(242,242,240,0.45)"
                          : hoveredNav === key
                          ? "rgba(242,242,240,0.40)"
                          : "rgba(242,242,240,0.25)",
                        transition: "color 0.2s",
                      }}
                    >
                      {item.eyebrow}
                    </p>
                  </button>
                );
              }
            )}
          </div>

          {/* Contenido activo */}
          <div
            key={activeContext}
            className={`context-fade-in flex-1 min-w-0${activeContext === null ? " hidden md:block" : ""}`}
          >
            <p
              style={{
                fontSize: "clamp(1.35rem,1.8vw,1.65rem)",
                lineHeight: 1.45,
                letterSpacing: "-0.02em",
                color: "rgba(242,242,240,0.88)",
                marginBottom: "40px",
              }}
            >
              {active.preview}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {active.content.map((paragraph) => (
                <p
                  key={paragraph}
                  style={{
                    fontSize: "clamp(1.15rem,1.45vw,1.35rem)",
                    lineHeight: 1.7,
                    color: "rgba(242,242,240,0.70)",
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div style={{ marginTop: "52px" }}>
              <Link
                href="/contacto"
                style={{
                  fontSize: "0.9rem",
                  letterSpacing: "0.04em",
                  color: "rgba(46,211,230,0.75)",
                  transition: "color 0.2s",
                }}
                className="hover:text-[#2ED3E6]"
              >
                Zure kasua da? Hitz egin dezagun →
              </Link>
            </div>

            <div
              style={{
                marginTop: "52px",
                borderTop: "1px solid rgba(242,242,240,0.08)",
                paddingTop: "28px",
              }}
            >
              <p
                style={{
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "rgba(242,242,240,0.42)",
                  marginBottom: "12px",
                }}
              >
                Antzeko ekitaldiak
              </p>
              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.65,
                  color: "rgba(242,242,240,0.62)",
                }}
              >
                {active.similar}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="fade-in mx-auto max-w-[900px] px-8 pt-40 pb-40 text-center">
        <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90">
          Zure ekitaldiak &ldquo;ondo egon zen&rdquo; baino gehiago merezi badu:
        </p>
        <p className="mt-5 text-[clamp(1rem,1.2vw,1.2rem)] leading-relaxed text-[#F2F2F0]/45">
          —San Mamés VIP Areako denboraldi amaierako ekitaldiak bezala—
        </p>

        <p className="mt-14 text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/70">
          Batzuetan hau da falta dena.
        </p>
        <div className="mt-12">
          <Link
            href="/contacto"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
          >
            Hitz egin dezagun
          </Link>
        </div>
        <p className="mt-5 text-[1rem] text-[#F2F2F0]/38">eta zalantzak argitzen dituzu.</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Nabigazioa</p>
            <div className="grid gap-y-3">
              <Link href="/" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Hasiera<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/empresa" className="group relative w-fit text-[#2ED3E6]">Enpresa<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
              <Link href="/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kultura / Euskara<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Ostalaritza<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/contacto" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kontaktua<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
            </div>
          </div>
          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Identitatea</p>
            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">Alain Zulaika</p>
            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">Ekitaldi korporatibo eta kulturaletarako interbentzio eszenikoak magiarekin.</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">Lege oharra</Link>
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Pribatutasuna</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookieak</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
