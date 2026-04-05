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
          <Link href="/es/" className="text-[0.96rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            <a href="/eguzkilore" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EU</a>
            <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
            <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15" style={{ height: "280px" }} />
          <div className="pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6] uppercase">
              Eguzkilore
            </p>
            <h1 className="hero-fade-2 max-w-[860px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Se rieron cuando saqué una baraja del bolsillo.
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Hasta que terminé el primer truco.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 1 — La escena */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#F2F2F0]/50 mb-10">
            "Alain hace magia, ¿lo sabíais?"
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Mi grupo de amigos aprovecha cualquier momento social para soltar esa frase.</p>
            <p>Alguien me mira con curiosidad.<br />Otro levanta una ceja, escéptico.<br />Siempre hay alguno que dice lo de siempre:</p>
            <p className="text-[#F2F2F0]/50 italic">"A ver, haz algo."</p>
            <p>Saco la baraja y, justo antes de abrirla, escucho la frase que he oído decenas de veces:</p>
            <p className="text-[#F2F2F0]/50 italic">"¿Siempre llevas una baraja encima?"</p>
            <p>El tono lo dice todo: un poco de burla, un poco de incredulidad.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 — La respuesta */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            "Sí. Soy un friki."
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Lo digo con la misma seguridad con la que un samurái desenfunda su katana.<br />Sé lo que está a punto de pasar.</p>
            <p>La adrenalina me golpea, noto mis pulsaciones, me tiemblan las manos.<br />Uno de ellos se ríe.</p>
            <p className="text-[#F2F2F0]/50 italic">"Te tiemblan las manos, jajaja."</p>
            <p>No falla. Siempre hay alguien que intenta ponerse por encima.</p>
            <p className="text-[#F2F2F0]/50 italic">"Es que me pones nervioso."</p>
            <p>Suelto con media sonrisa.</p>
            <p>Pero sé la verdad.<br />Sé lo que viene.<br />En diez segundos, su risa se va a convertir en asombro.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 3 — El truco */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Empiezo a mezclar.<br />Primero, alguna mirada de reojo.<br />Luego, un "ostias" en voz baja.</p>
            <p>Y cuando se quieren dar cuenta, hasta el más escéptico está con la boca abierta y sin saber qué decir.</p>
            <p>Lo más ingenioso que se le ocurre es un:</p>
            <p className="text-[#F2F2F0]/50 italic">"¿Cómo lo has hecho?"</p>
            <p>Pero ya es tarde.<br />Como si fuese a explicarlo, empiezo otro juego.<br />Sin darse cuenta, vuelven a estar atrapados.</p>
          </div>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Voy a por el final.</p>
            <p>Miro mis manos. Abro los dedos. Reviso mis mangas.</p>
            <p>Nada, solo una baraja mezclada.</p>
            <p>Chasqueo los dedos.</p>
            <p>Y sin que nadie entienda cómo…<br />Las cartas se ordenan sin que yo las toque.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 — El clímax */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            <p>Boom.</p>
            <p>Gritos.</p>
            <p>Incredulidad.</p>
            <p className="text-[#F2F2F0]/72">Los que antes dudaban, ahora aplauden.</p>
          </div>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p className="text-[#F2F2F0]/50 italic">"¡Tío, hazte otro! Espera, espera… que llamo a un colega para que vea esto."</p>
            <p>De repente, hay un corro.<br />La gente se acerca.<br />Se hace el silencio.</p>
            <p>Y lo curioso es que esa misma reacción, la puede conseguir cualquiera.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 — El secreto */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            Pero hay un secreto.<br />
            <span className="text-[#F2F2F0]/55">No tiene nada que ver con talento.</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Mucha gente intenta hacer un truco con la baraja roñosa de casa y fracasa.<br />No es su culpa.<br />Las cartas pegadas, las esquinas dobladas… imposible hacer algo decente con eso.</p>
            <p>Pero si tienes una buena baraja y conoces las técnicas adecuadas, en cuestión de minutos puedes estar fascinando a decenas de personas.<br />Ni siquiera necesitas aprender a mezclar.</p>
            <p>Por eso diseñé la baraja <strong className="text-[#F2F2F0]">EGUZKILORE</strong>.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 6 — La baraja */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Inspirada en la cultura vasca, con los eguzkilores en el dorso como símbolo de seguridad y detalles en las figuras que homenajean la cultura vasca.</p>
            <p>De calidad profesional, con equilibrio perfecto entre robustez y flexibilidad.</p>
            <p><span className="text-[#F2F2F0]/90">Las sacas de la caja y ya notas la diferencia:</span> desliza perfecta, no se engancha, parece que las cartas se colocan solas.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 7 — No es solo una baraja */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            Pero NO es solo una baraja.<br />
            <span className="text-[#F2F2F0]/55">Es una herramienta.</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Puedes usarla como excusa para romper el hielo.</p>
            <p>Como tu nuevo Fidget Toy para entretenerte mientras ves una peli o estudias.</p>
            <p>O simplemente para convertir cualquier tarde normal en una sesión de juegos de mesa.</p>
            <p>Pero aquí viene lo mejor:<br />Dentro de cada baraja hay una carta especial.</p>
            <p>Una llave de acceso a los primeros dos módulos del primer curso de cartomagia en euskera.<br />En minutos, estarás haciendo tu primer truco.<br />En menos de un mes, dominarás 13 juegos listos para dejar con la boca abierta a cualquiera.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 8 — El precio */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72 mb-8">
            Ahora, piénsalo un segundo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/50 mb-12">
            <p>Un juego de mesa sencillo cuesta 13,75 €</p>
            <p>Un curso de magia profesional, mínimo 50 € (y en euskera, ni existen)</p>
            <p>Las barajas de diseño empiezan en 12 € y algunas se revalorizan hasta más de 500 €</p>
            <p>Un kit de magia básico (que acaba olvidado en un cajón), 27,90 €</p>
            <p>Uno más decente, con trucos que valen la pena, lo podrías conseguir por 90 €</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            <p>Pero <strong>EGUZKILORE</strong> no te va a costar 90 €.</p>
            <p className="text-[#F2F2F0]/55">Tampoco 40 €.</p>
            <p className="text-[#F2F2F0]/55">Ni siquiera 20 €.</p>
          </div>
        </div>
      </section>

      {/* CIERRE — CTA */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] leading-[1.3] tracking-[-0.02em] text-[#F2F2F0]/90 mb-8">
            El precio de lanzamiento es de tan solo 12 €.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/58 mb-12">
            <p>Sí, menos de lo que cuesta un juego de mesa barato.</p>
            <p>Y lo mejor: el curso viene incluido de regalo.</p>
          </div>
          <a
            href="mailto:contacto@niala.es?subject=Quiero%20una%20baraja%20Eguzkilore"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
            style={{ textDecoration: "none" }}
          >
            Haz clic aquí y consigue la baraja ahora
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
