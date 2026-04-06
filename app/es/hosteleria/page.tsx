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
          <Link href="/es/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <nav className="flex items-center gap-6 md:gap-8">
            <Link href="/es/#como-trabajo" className="hidden md:block text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Cómo trabajo</Link>
            <Link href="/es/contacto" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Contacto</Link>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <a href="/hosteleria" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EU</a>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[290px] md:h-[360px]" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Hostelería</span>
            </p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Muchos bares intentan llenar un día.
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Los que destacan crean un día que la gente espera.
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
            <p>Pintxo-pote.</p>
            <p>Miércoles a un euro.</p>
            <p>Martes loco.</p>
          </div>

          <div
            style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Muchos bares buscan crear ese día en el que el local se llena casi solo.</p>
            <p>El día en el que, cuando alguien dice:</p>
            <p style={{ color: "rgba(242,242,240,0.95)" }}>¿Dónde quedamos hoy?</p>
            <p>Tu bar es la respuesta.</p>
            <p>Pero casi siempre se intenta igual: bajando precios.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.12] tracking-[-0.04em]">
            Los descuentos funcionan.<br />
            Pero solo mientras existen.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Cuando el precio vuelve a la normalidad,<br />la gente desaparece.</p>
            <p>Porque el hábito no nace del precio.</p>
            <p><span style={{ color: "rgba(242,242,240,0.95)" }}>Nace de tener un motivo para volver.</span></p>
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
            <p>Un <em>"no me jodas"</em> hace que una mesa se gire.</p>
            <p>Algunos que pasaban por delante<br />escuchan aplausos y se paran.</p>
            <p>Alguien llama por teléfono a un amigo:</p>
          </div>

          <p
            style={{ marginTop: "2.5rem", marginBottom: "2.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]"
          >
            "Ven ya, vas a flipar."
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p><span style={{ color: "rgba(242,242,240,0.95)" }}>Ese día ya no es un día cualquiera.</span></p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            Cuando eso ocurre de forma recurrente:
          </p>

          <div
            style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]"
          >
            <p>La gente lo recuerda.</p>
            <p>Lo cuenta.</p>
          </div>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>Y la semana siguiente vuelve esperando que vuelva a pasar.</p>
            <p>Los clientes empiezan a relacionar tu bar con emociones como fascinación y asombro.</p>
            <p>Ahí empieza a aparecer el hábito.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            Lo conseguimos con magia de cerca.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            <p>No es un show.</p>
            <p>Son intervenciones entre la gente.</p>
            <p>Las mesas y las manos de los clientes se convierten en el escenario.</p>
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
            <p>Sin música.</p>
            <p>Sin cartelería.</p>
            <p>Sin alterar el flujo de trabajo del bar.</p>
          </div>

          <p
            style={{ marginTop: "3rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72"
          >
            Para más de 15 bares,<br />
            un día normal<br />
            ya se transformó en algo que merece repetirse.
          </p>
        </div>
      </section>

      {/* CIERRE */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90">
            Si crees que tu bar podría tener un día así, lo vemos.
          </p>

          <div
            style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/58"
          >
            <p>Cada local es distinto.</p>
            <p>El tamaño del espacio, el tipo de cliente, el momento de la semana… todo influye.</p>
            <p>Por eso primero hablamos y vemos si tiene sentido.</p>
          </div>

          <div style={{ marginTop: "3rem" }}>
            <Link
              href="/es/contacto"
              className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
            >
              Hablemos
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Navegación</p>
            <div className="grid gap-y-3">
              <Link href="/es/" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Inicio<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Empresa<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Cultura<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/hosteleria" className="group relative w-fit text-[#2ED3E6]">Hostelería<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
              <Link href="/es/contacto" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Contacto<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
            </div>
          </div>
          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Identidad</p>
            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">Alain Zulaika</p>
            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">Intervenciones escénicas con magia para eventos corporativos y culturales.</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">Aviso legal</Link>
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Privacidad</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
