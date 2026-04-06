"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ContextKey = "publicos" | "intervenciones" | "propuestas";

interface Show {
  title: string;
  meta: string;
  description: string[];
  note?: string;
}

const contexts: Record<
  ContextKey,
  {
    eyebrow: string;
    title: string;
    preview: string;
    content: string[];
    note?: string;
    shows?: Show[];
    similar: string;
  }
> = {
  publicos: {
    eyebrow: "plazas · fiestas · teatros populares",
    title: "Públicos amplios",
    preview:
      "Cuando el objetivo es reunir a mucha gente, la magia funciona como un punto de encuentro.",
    content: [
      "La atención deja de estar dispersa: la gente se acerca, se queda, reacciona y se ríe al mismo tiempo.",
      "A partir de ahí empieza lo importante: leer cómo responde el público en cada momento y ajustar la intervención en directo.",
      "Durante un rato, todos están viviendo lo mismo al mismo tiempo.",
    ],
    note: "Este formato puede adaptarse a diferentes edades según el contexto de la programación.",
    similar:
      "fiestas de barrio · programaciones de verano · festivales familiares · programaciones abiertas",
  },
  intervenciones: {
    eyebrow: "galas · actos · centros educativos",
    title: "Intervenciones adaptadas",
    preview:
      "La magia como herramienta escénica: dar ritmo al evento, crear momentos de atención compartida o reforzar un mensaje.",
    content: [
      "A veces, como en la entrega de premios Urruzuno del Gobierno Vasco, la intervención articula el acto desde dentro, entre reconocimientos, charlas y entregas.",
      "Otras veces, como en la gala STEM Emakumeak, aparece en pequeñas escenas entre bloques para reactivar al público y conectar las distintas partes del evento.",
      "Y también —por ejemplo en un instituto de Vitoria— en formatos de charla o taller donde la escena ayuda a que una idea cale.",
      "No son números aislados: están al servicio de lo que tú estás programando.",
    ],
    similar:
      "entregas de premios · semanas culturales",
  },
  propuestas: {
    eyebrow: "salas · teatros · festivales · programación cultural",
    title: "Propuestas con identidad",
    preview:
      "En algunas programaciones un show de magia clásico no es suficiente. Actualmente presento dos creaciones dentro de esta línea.",
    content: [],
    shows: [
      {
        title: "Morir o no morir",
        meta: "+16 años · salas pequeñas · unipersonal",
        description: [
          "Cristales bajo los pies, una aguja atravesando la mano, presencias que alteran lo visible.",
          "Los espectadores que vinieron a las primeras sesiones —presentadas en una sala de Donostia— ya vieron lo que ocurre cuando dejamos de evitar la muerte y empezamos a mirarla de frente.",
          "Esta vez el asombro no es solo visual, también emocional.",
          "Por eso ha funcionado en festivales como Dimagia o Mirariak.",
        ],
      },
      {
        title: "Twobascos",
        meta: "+10 años · salas grandes y teatros · a dúo",
        description: [
          "Una bruja escoge a dos campesinos para recuperar la memoria de un pueblo olvidado.",
          "El público se convierte en ciudadanos que, a través de pruebas y pistas, ayudan a reconstruir ese lugar.",
          "Humor, aventura y emoción colectiva.",
        ],
        note: "Reconocido con el premio Katapulta 2025 entre más de 150 propuestas escénicas.",
      },
    ],
    similar:
      "",
  },
};

export default function CulturaEuskeraPage() {
  const [activeContext, setActiveContext] = useState<ContextKey | null>(null);
  const [hoveredNav, setHoveredNav] = useState<ContextKey | null>(null);
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());

  const toggleShow = (title: string) => {
    setExpandedShows((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

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

  const active = contexts[activeContext ?? "publicos"];

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
              <a href="/cultura" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EU</a>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[342px] md:h-[360px]" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Cultura</span>
            </p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.55rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Otra vez alguien pide<br />"un show de magia."
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Y muchas veces la magia es lo que hace falta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE INICIAL */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-24 md:px-16 md:pb-28">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
            Pero antes de pedir un espectáculo, hay una pregunta más importante:
          </p>

          <p style={{ marginTop: "3rem" }} className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]">
            ¿Qué necesitas que ocurra delante del público?
          </p>

          <ul style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1.4rem" }} className="text-[clamp(1.35rem,1.8vw,1.65rem)] font-medium leading-[1.08] tracking-[-0.02em] text-[#F2F2F0]/70">
            {([
              { label: "¿Reunir a mucha gente?", key: "publicos" },
              { label: "¿Transmitir un mensaje?", key: "intervenciones" },
              { label: "¿Ampliar la cultura?", key: "propuestas" },
            ] as { label: string; key: ContextKey }[]).map(({ label, key }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveContext(key);
                    const el = document.getElementById("selector");
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.scrollY - 96;
                      window.scrollTo({ top, behavior: "smooth" });
                    }
                  }}
                  style={{ background: "none", cursor: "pointer", textAlign: "left" }}
                  className="transition-colors duration-200 hover:text-[#2ED3E6]"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

        </div>
      </section>

      {/* SELECTOR + CONTENIDO */}
      <section id="selector" className="fade-in mx-auto max-w-[1400px] px-8 pt-16 pb-32 md:px-16 md:pt-20 md:pb-40">

        {/* Mobile selector */}
        <div className="md:hidden mb-8 space-y-2">
          {(Object.keys(contexts) as ContextKey[]).map((key) => {
            const item = contexts[key];
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
          <div className="hidden md:block md:w-[280px] md:shrink-0 md:mr-20">
            {(Object.keys(contexts) as ContextKey[]).map((key) => {
              const item = contexts[key];
              const isActive = (activeContext ?? "publicos") === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveContext(key)}
                  onMouseEnter={() => setHoveredNav(key)}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    borderLeft: isActive
                      ? "2px solid #2ED3E6"
                      : hoveredNav === key
                      ? "2px solid rgba(242,242,240,0.30)"
                      : "2px solid rgba(242,242,240,0.10)",
                    padding: "20px 0 20px 20px",
                    transition: "border-color 0.2s",
                    background: "none",
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
                        ? "rgba(242,242,240,0.72)"
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
                        : "rgba(242,242,240,0.25)",
                      transition: "color 0.2s",
                    }}
                  >
                    {item.eyebrow}
                  </p>
                </button>
              );
            })}
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

            {/* Párrafos de contenido */}
            {active.content.length > 0 && (
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
            )}

            {/* Shows — solo para Propuestas con identidad */}
            {active.shows && (
              <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
                {active.shows.map((show, i) => {
                  const isExpanded = expandedShows.has(show.title);
                  return (
                  <div
                    key={show.title}
                    style={{
                      paddingTop: i > 0 ? "40px" : "0",
                      borderTop: i > 0 ? "1px solid rgba(242,242,240,0.10)" : "none",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "clamp(1.35rem,1.8vw,1.65rem)",
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: "rgba(242,242,240,0.95)",
                        marginBottom: "8px",
                      }}
                    >
                      {show.title}
                    </p>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.16em",
                        color: "rgba(46,211,230,0.60)",
                        marginBottom: "16px",
                      }}
                    >
                      {show.meta}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleShow(show.title)}
                      style={{
                        background: "none",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        letterSpacing: "0.08em",
                        color: isExpanded ? "rgba(242,242,240,0.38)" : "rgba(242,242,240,0.45)",
                        transition: "color 0.2s",
                        padding: 0,
                      }}
                    >
                      {isExpanded ? "↑ cerrar" : "↓ ampliar"}
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        {show.description.map((line) => (
                          <p
                            key={line}
                            style={{
                              fontSize: "clamp(1.15rem,1.45vw,1.35rem)",
                              lineHeight: 1.7,
                              color: "rgba(242,242,240,0.70)",
                            }}
                          >
                            {line}
                          </p>
                        ))}
                        {show.note && (
                          <p
                            style={{
                              marginTop: "4px",
                              fontSize: "0.88rem",
                              color: "rgba(242,242,240,0.38)",
                            }}
                          >
                            {show.note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            )}

            {/* Nota */}
            {active.note && (
              <p
                style={{
                  marginTop: "32px",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "rgba(242,242,240,0.38)",
                }}
              >
                {active.note}
              </p>
            )}

            {/* CTA inline */}
            <div style={{ marginTop: "52px" }}>
              {activeContext === "propuestas" ? (
                <>
                  <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", lineHeight: 1.7, color: "rgba(242,242,240,0.70)", marginBottom: "16px" }}>
                    ¿Te interesa alguna de las dos?
                  </p>
                  <a
                    href="mailto:contacto@niala.es?subject=Dossier&body=Hola%20Alain%2C%0A%0AMe%20gustar%C3%ADa%20recibir%20el%20dossier%20completo%20de%20%5Bnombre%20de%20la%20propuesta%5D.%0A%0AUn%20saludo%2C"
                    style={{
                      fontSize: "0.9rem",
                      letterSpacing: "0.04em",
                      color: "rgba(46,211,230,0.75)",
                      transition: "color 0.2s",
                    }}
                    className="hover:text-[#2ED3E6]"
                  >
                    Dossier completo disponible bajo petición →
                  </a>
                </>
              ) : (
                <Link
                  href="/es/contacto"
                  style={{
                    fontSize: "0.9rem",
                    letterSpacing: "0.04em",
                    color: "rgba(46,211,230,0.75)",
                    transition: "color 0.2s",
                  }}
                  className="hover:text-[#2ED3E6]"
                >
                  ¿Encaja en tu programación? Hablemos →
                </Link>
              )}
            </div>

            {/* Eventos similares */}
            {active.similar && (
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
                  Eventos similares
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
            )}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="fade-in mx-auto max-w-[900px] px-8 pt-40 pb-40 text-center">
        <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90">
          Puedes pedir "un show de magia".
        </p>
        <p style={{ marginTop: "1.5rem" }} className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/70">
          O puedes decirme qué necesitas que ocurra.
        </p>
        <div className="mt-12">
          <Link
            href="/es/contacto"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
          >
            Hablemos
          </Link>
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
              <Link href="/es/cultura" className="group relative w-fit text-[#2ED3E6]">Cultura<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
              <Link href="/es/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Hostelería<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
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
