"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function HosteleriaPage() {
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
          <nav className="flex items-center gap-6 md:gap-8">
            <Link href="/#como-trabajo" className="hidden md:block text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Nola egiten dut lan</Link>
            <Link href="/contacto" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kontaktua</Link>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EUS</span>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <Link href="/es/hosteleria" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[373px] md:h-[355px]" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Ostalaritza</span>
            </p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Taberna asko egun bat betetzen saiatzen dira.
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Nabarmentzen direnek jendeak itxaroten duen egun bat sortzen dute.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 1 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]/50"
          >
            <p>Pintxo-potea.</p>
            <p>Asteazkena €1-era.</p>
            <p>Martes loco.</p>
          </div>

          <div
            style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Taberna askok egun berezi hori sortu nahi dute: lokala ia bakarrik betetzen den eguna.</p>
            <p>Norbaitek &ldquo;Non geratuko gara gaur?&rdquo; esaten duen eguna agertzean:</p>
            <p style={{ color: "rgba(242,242,240,0.95)" }}>Erantzuna zure taberna izatea.</p>
            <p>Baina gehienetan modu berean saiatzen dira: prezioak jaisten.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.12] tracking-[-0.04em]">
            Deskontuek funtzionatzen dute.<br />
            Baina existitzen diren bitartean bakarrik.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Prezioa ohikora itzultzen denean,<br />jendea desagertzen da.</p>
            <p>Ohitura ez da preziotik sortzen.</p>
            <p><span style={{ color: "rgba(242,242,240,0.95)" }}>Itzultzeko arrazoi bat izatetik sortzen da.</span></p>
          </div>
        </div>
      </section>

      {/* BLOQUE 3 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Ai ama! batek mahai bat biratzea eragiten du.</p>
            <p>Paseatzen ari zirenak<br />txaloak entzun eta gelditu egiten dira.</p>
            <p>Norbaitek lagun bati deitzen dio telefonoz:</p>
          </div>

          <p
            style={{ marginTop: "2.5rem", marginBottom: "2.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]"
          >
            "Etorri ointxe bertan, flipau ingo dezu."
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p><span style={{ color: "rgba(242,242,240,0.95)" }}>Egun hori ez da jada edozein egun.</span></p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            Hori modu errepikakorrean gertatzean:
          </p>

          <div
            style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]"
          >
            <p>Gogoratu egiten du.</p>
            <p>Kontatu egiten dute.</p>
          </div>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Eta hurrengo astean berriz gertako delakoan itzultzen dira.</p>
            <p>Bezeroek zure taberna lilura eta harridurazko emozioekin lotzen hasten dira.</p>
            <p>Hor hasten da ohitura agertzen.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            Hurbileko magiarekin lortzen dugu.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Ez da ikuskizun bat.</p>
            <p>Jenden arteko interbentzioak dira.</p>
            <p>Mahaiak eta bezeroen eskuak eszenatoki bihurtzen dira.</p>
          </div>

          <div
            style={{
              marginTop: "2.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/55"
          >
            <p>Musikarik gabe.</p>
            <p>Kartelgintzarik gabe.</p>
            <p>Tabernako lan fluxua aldatu gabe.</p>
          </div>

          <p
            style={{ marginTop: "3rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            15 taberna baino gehiagorentzat,<br />
            errepikatzea merezi duen zerbaitean bihurtu dira<br />
            egun normalak.
          </p>
        </div>
      </section>

      {/* CIERRE */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90">
            Zure tabernak horrelako egun bat izan dezakeela uste baduzu, ikusi dezagun.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/58"
          >
            <p>Lokal bakoitza ezberdina da.</p>
            <p>Espazioen tamaina, bezero mota, asteko momentua... guztiak eragiten du.</p>
            <p>Horregatik lehenik hitz egin eta zentzua duen ikusten dugu.</p>
          </div>

          <div style={{ marginTop: "3rem" }}>
            <Link
              href="/contacto"
              className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
            >
              Hitz egin dezagun
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Nabigazioa</p>
            <div className="grid gap-y-3">
              <Link href="/" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Hasiera<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Enpresa<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kultura / Euskara<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/hosteleria" className="group relative w-fit text-[#2ED3E6]">Ostalaritza<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
              <Link href="/contacto" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kontaktua<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
            </div>
          </div>
          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Identitatea</p>
            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">Alain Zulaika</p>
            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">Ekitaldi korporatiboetarako eta kulturaletarako interbentzio eszenikoak magiarekin.</p>
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
