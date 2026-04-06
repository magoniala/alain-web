"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [showHeaderName, setShowHeaderName] = useState(false);
  const [hoveredContext, setHoveredContext] = useState("empresa");

  const contextContent = {
    cultura: {
      href: "/es/cultura",
      label: "Cultura",
      preview:
        "Cuando lo simbólico no puede quedarse en los libros de historia.",
    },
    empresa: {
      href: "/es/empresa",
      label: "Empresa",
      preview: "Cuando lo impecable corre el riesgo de quedarse vacío.",
    },
    hosteleria: {
      href: "/es/hosteleria",
      label: "Hostelería",
      preview: "Donde el espacio pide carácter.",
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
              Contextos
            </a>

            <a
              href="/es/contacto"
              className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]"
            >
              Contacto
            </a>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <a href="/" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EU</a>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-6 md:-translate-y-8">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[248px] md:h-[435px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-s uppercase tracking-[0.35em] text-[#2ED3E6]">
              Alain Zulaika
            </p>

            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.55rem,5vw,4.8rem)] font-medium leading-[1.05] tracking-[-0.02em]">
              Un evento diseñado
              <br />
              para no molestar
              <br />
              se&nbsp;comporta&nbsp;como&nbsp;Mr.&nbsp;Bean
              <br />
              entrando en una sala
            </h1>

            <p className="hero-fade-3 mt-6 text-[clamp(1rem,1.2vw,1.2rem)] leading-relaxed text-[#F2F2F0]/75">
              Intervenciones escénicas con magia para eventos corporativos y
              culturales.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 py-4 md:px-16 md:py-6">
        <div className="max-w-[760px]">
          <p className="mb-5 text-[1.05rem] uppercase tracking-[0.18em] text-[#F2F2F0]/90 md:text-[1.1rem]">
            Mr. Bean entra así:
          </p>

          <ul className="space-y-5 text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]">
            <li>Con cuidado.</li>
            <li>Intentando caer bien.</li>
            <li>Ocupando poco espacio.</li>
            <li>Pidiendo perdón antes de empezar.</li>
            <li>Sin saber gestionar silencios ni pausas.</li>
          </ul>

          <p className="mt-14 max-w-[560px] text-[clamp(1.2rem,1.8vw,1.5rem)] leading-relaxed text-[#F2F2F0]/85">
            Así funcionan muchos eventos:
            <br />
            desde la ansiedad social.
          </p>
        </div>
      </section>

      {/* BLOQUE 3 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-20 pb-24 md:px-16 md:pt-28 md:pb-28">
        <div className="max-w-[760px]">
          <p className="mb-10 text-[clamp(2rem,2.7vw,2.5rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            Y eso se nota.
          </p>

          <div className="space-y-6 text-[clamp(1.35rem,1.8vw,1.7rem)] leading-relaxed text-[#F2F2F0]/84">
            <p>En los aplausos educados.</p>
            <p>En los &ldquo;salgo en nada&rdquo; por WhatsApp.</p>
            <p>En los bostezos nasales disimulados.</p>
          </div>

          <div className="mt-12 max-w-[760px] space-y-4 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>
              Y en el equipo organizador pendiente de la escaleta, de los
              tiempos, de que todo salga &ldquo;como toca&rdquo;.
            </p>
            <p>Más atento a no equivocarse que a leer la sala.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-24 pb-24 md:px-16 md:pt-28 md:pb-28">
        <div className="max-w-[760px]">
          <div className="space-y-4 text-[clamp(1.85rem,2.4vw,2.2rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            <p>El problema no es la producción.</p>
            <p>No es el contenido.</p>
            <p>Ni mucho menos la gente.</p>
          </div>

          <div className="mt-12 max-w-[760px] space-y-5 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/78">
            <p>
              El problema es el punto desde el que se diseña todo:
              <br />
              miedo a molestar, a incomodar, a salirse del guion.
            </p>

            <p>
              Cuando un evento nace desde ahí, se vuelve correcto y educado.
            </p>

            <p>
              Pero paga un precio alto:
              <br />
              renuncia a tener presencia.
            </p>

            <p>
              Y ya sabes
              <br />
              la cara que tiene alguien que vive así.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-28 pb-24 md:px-16 md:pt-36 md:pb-28">
        <div className="max-w-[760px]">
          <div className="space-y-6 text-[clamp(1.4rem,1.9vw,1.75rem)] leading-relaxed text-[#F2F2F0]/90">
            <p>
              Un evento deja de comportarse como Mr. Bean
              <br />
              cuando alguien se atreve a guiar emocionalmente la sala.
            </p>
          </div>

          <div className="mt-12 space-y-5 text-[clamp(1.25rem,1.6vw,1.5rem)] leading-relaxed text-[#F2F2F0]/82">
            <p>No porque haga un show.</p>
            <p>No porque meta ruido disfrazado de entretenimiento.</p>
            <p>Ni porque rellene silencios por puro nervio.</p>
          </div>

          <div className="mt-14 text-[clamp(1.5rem,2vw,1.9rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            <p>Sino porque asume un lugar</p>
            <p>que casi nadie quiere asumir:</p>

            <p className="mt-8 text-[clamp(1.9rem,2.4vw,2.3rem)] font-semibold tracking-[-0.025em] text-[#F2F2F0]">
              la responsabilidad escénica del conjunto.
            </p>
          </div>

          <div className="mt-20 space-y-4 text-[clamp(1.45rem,1.9vw,1.7rem)] leading-relaxed text-[#F2F2F0]/85 md:mt-24">
            <p>Decidir cuándo el evento respira.</p>
            <p>Cuándo aprieta.</p>
            <p>Cuándo se relaja.</p>
            <p>Cuándo puede permitirse jugar.</p>
          </div>

          <div className="mt-24 max-w-[720px] space-y-5 text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/75">
            <p>Eso es diseño escénico.</p>
            <p>Eso es gestión emocional.</p>

            <p className="mt-8">
              Y cuando ocurre,
              <br />
              todo lo demás empieza a ordenarse:
            </p>

            <p>
              lo que se siente mientras pasa
              <br />
              y lo que se recuerda cuando termina.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 6 */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-36 pb-32 md:px-16 md:pt-44 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.6rem)] leading-relaxed text-[#F2F2F0]/85">
            El evento deja de justificarse.
          </p>

          <div className="mt-12 space-y-6 text-[clamp(1.5rem,1.9vw,1.75rem)] leading-relaxed text-[#F2F2F0]/90">
            <p>Y entonces aparece lo demás:</p>

            <p>la atención se sostiene,</p>
            <p>la presencia colectiva se activa,</p>
            <p>
              y el evento se permite tener{" "}
              <span className="font-bold">personalidad</span>
            </p>
          </div>

          <div className="mt-28 space-y-6 text-[clamp(2rem,2.7vw,2.7rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]/85">
            <p>No de Mr. Bean.</p>

            <p className="text-[clamp(2.5rem,3.5vw,3.4rem)] font-semibold tracking-[-0.03em] text-[#F2F2F0]">
              De Jack Sparrow.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 7 — CONTEXTOS */}
      <section
        id="contextos"
        className="fade-in mx-auto max-w-[1400px] bg-[#101012] px-8 pt-44 pb-28 md:px-16 md:pt-52 md:pb-32"
      >
        <div className="max-w-[820px]">
          <div className="mb-12 h-px w-32 bg-white/15" />

          <p className="text-[clamp(1.9rem,2.6vw,2.5rem)] font-medium tracking-[-0.02em] text-[#F2F2F0]">
            Y ahí es donde entra la magia.
          </p>

          <p className="mt-8 max-w-[620px] text-[clamp(1.15rem,1.45vw,1.28rem)] leading-relaxed text-[#F2F2F0]/90">
            Elige el <span className="font-bold">contexto</span> que más se parece al tuyo.
            <br />
            Cada uno pide una forma distinta de intervenir.
          </p>

          <nav className="mt-25 hidden md:flex flex-wrap gap-x-8 gap-y-4">
            <a
              href={contextContent.empresa.href}
              onMouseEnter={() => setHoveredContext("empresa")}
              className={`group relative text-[clamp(1.35rem,1.65vw,1.55rem)] tracking-[-0.02em] transition-all duration-300 ease-out ${
                hoveredContext === "empresa"
                  ? "text-white"
                  : "text-[#F2F2F0]/58 hover:text-[#F2F2F0]"
              }`}
            >
              {contextContent.empresa.label}
              <span
                className={`absolute -bottom-1 left-0 h-px bg-[#2ED3E6] transition-all duration-300 ${
                  hoveredContext === "empresa" ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </a>

            <a
              href={contextContent.cultura.href}
              onMouseEnter={() => setHoveredContext("cultura")}
              className={`group relative text-[clamp(1.35rem,1.65vw,1.55rem)] tracking-[-0.02em] transition-all duration-300 ease-out ${
                hoveredContext === "cultura"
                  ? "text-white"
                  : "text-[#F2F2F0]/58 hover:text-[#F2F2F0]"
              }`}
            >
              {contextContent.cultura.label}
              <span
                className={`absolute -bottom-1 left-0 h-px bg-[#2ED3E6] transition-all duration-300 ${
                  hoveredContext === "cultura" ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </a>

            <a
              href={contextContent.hosteleria.href}
              onMouseEnter={() => setHoveredContext("hosteleria")}
              className={`group relative text-[clamp(1.35rem,1.65vw,1.55rem)] tracking-[-0.02em] transition-all duration-300 ease-out ${
                hoveredContext === "hosteleria"
                  ? "text-white"
                  : "text-[#F2F2F0]/58 hover:text-[#F2F2F0]"
              }`}
            >
              {contextContent.hosteleria.label}
              <span
                className={`absolute -bottom-1 left-0 h-px bg-[#2ED3E6] transition-all duration-300 ${
                  hoveredContext === "hosteleria"
                    ? "w-full"
                    : "w-0 group-hover:w-full"
                }`}
              />
            </a>
          </nav>

          <div className="hidden md:block mt-20 max-w-[640px] min-h-[8.5rem]">
            <div key={hoveredContext} className="context-fade-in">
              <p className="text-[clamp(2rem,2.6vw,2.4rem)] leading-[1.35] tracking-[-0.025em] text-[#F2F2F0]/94">
                {
                  contextContent[
                    hoveredContext as keyof typeof contextContent
                  ].preview
                }
              </p>
            </div>
          </div>

          {/* Mobile: stacked context links with preview */}
          <div className="md:hidden mt-10 space-y-3">
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

      {/* BLOQUE 8 — FASES DE TRABAJO */}
      <section
        id="como-trabajo"
        className="fade-in mx-auto max-w-[1400px] px-8 pt-36 pb-28 md:px-16 md:pt-44 md:pb-32"
      >
        <div className="max-w-[860px]">
          <div className="max-w-[720px]">
            <p className="text-[clamp(2rem,2.8vw,2.8rem)] font-medium tracking-[-0.025em] text-[#F2F2F0]">
              Mi trabajo no empieza actuando.
            </p>

            <p className="mt-8 text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/84">
              Empieza entendiendo.
            </p>
          </div>

          <div className="relative mt-20 pl-10 md:pl-12">
            <div className="absolute left-[11px] top-[0px] bottom-[0px] w-px bg-gradient-to-b from-white/1 via-white/14 to-white/1" />

            <div className="space-y-20">
              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  FASE 1 — Lectura del contexto
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Lo que se quiere decir, lo que se evita
                  <br />
                  y lo que realmente está en juego.
                </p>
              </div>

              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  FASE 2 — Arquitectura emocional del evento
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Ritmo, tensiones, silencios
                  <br />
                  y recursos al servicio del mensaje.
                </p>
              </div>

              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  FASE 3 — Alineación creativa
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  La idea no se impone:
                  <br />
                  se afina hasta que se vuelve compartida.
                </p>
              </div>

              <div className="relative max-w-[760px]">
                <div className="absolute left-[-39px] top-[12px] h-[5px] w-[5px] rounded-full bg-[#2ED3E6]" />
                <p className="text-[clamp(1.22rem,1.45vw,1.32rem)] font-medium uppercase tracking-[0.12em] text-[#F2F2F0]/92">
                  FASE 4 — Ejecución escénica
                </p>
                <p className="mt-5 text-[clamp(1.22rem,1.45vw,1.4rem)] leading-relaxed tracking-[-0.02em] text-[#F2F2F0]/86">
                  Magia, cuerpo y escena sostienen el diseño.
                  <br />
                  Siempre con la flexibilidad que exige el directo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 9 — CTA FINAL */}
      <section className="fade-in mx-auto max-w-[900px] px-8 pt-40 pb-40 text-center">
        <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-tight text-[#F2F2F0]">
          Si has llegado hasta aquí,
          <br />
          no ha sido casualidad.
        </p>

        <p className="mt-6 text-[clamp(1.6rem,2vw,2rem)] text-[#F2F2F0]/80">
          Ha sido diseño.
        </p>

        <div className="mt-12">
          <a
            href="/es/contacto"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/3 hover:text-[#2ED3E6]"
          >
            Hablemos
          </a>
        </div>

        <p className="mt-6 text-[1rem] text-[#F2F2F0]/55">
          Solo si quieres un evento Jack Sparrow.
        </p>
      </section>

      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">
              Navegación
            </p>

            <div className="grid gap-y-3">
              <a href="#top" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Inicio
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/es/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Empresa
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/es/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Cultura
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/es/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Hostelería
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="/es/contacto" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">
                Contacto
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" />
              </a>
            </div>
          </div>

          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">
              Identidad
            </p>

            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">
              Alain Zulaika
            </p>

            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">
              Intervenciones escénicas con magia para eventos corporativos y culturales.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">
                Aviso legal
              </a>
              <a href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">
                Privacidad
              </a>
              <a href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
