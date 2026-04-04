import Link from "next/link";

export default function EguzkilorePage() {
  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/" className="text-[0.96rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[760px] px-6 pt-24 pb-0 md:pt-32">
        <p className="mb-6 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">Eguzkilore</p>
        <h1
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3rem)",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "#F2F2F0",
            marginBottom: "3rem",
          }}
        >
          Se rieron cuando saqué una baraja del bolsillo.
          <br />
          <span style={{ color: "rgba(242,242,240,0.55)" }}>Hasta que terminé el primer truco.</span>
        </h1>
      </section>

      {/* Sales letter */}
      <article
        style={{
          maxWidth: "660px",
          margin: "0 auto",
          padding: "0 1.5rem 8rem",
          fontSize: "clamp(1.05rem, 1.3vw, 1.18rem)",
          lineHeight: 1.9,
          color: "rgba(242,242,240,0.72)",
        }}
        className="[&>p]:mb-8"
      >
        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic", marginBottom: "2rem" }}>
          "Alain hace magia, ¿lo sabíais?"
        </p>

        <p>Mi grupo de amigos aprovecha cualquier momento social para soltar esa frase.</p>
        <p>Alguien me mira con curiosidad.<br />Otro levanta una ceja, escéptico.<br />Siempre hay alguno que dice lo de siempre:</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"A ver, haz algo."</p>

        <p>Saco la baraja y, justo antes de abrirla, escucho la frase que he oído decenas de veces:</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"¿Siempre llevas una baraja encima?"</p>

        <p>El tono lo dice todo: un poco de burla, un poco de incredulidad.</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"Sí. Soy un friki."</p>

        <p>Lo digo con la misma seguridad con la que un samurái desenfunda su katana.<br />Sé lo que está a punto de pasar.</p>

        <p>La adrenalina me golpea, noto mis pulsaciones, me tiemblan las manos.<br />Uno de ellos se ríe.</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"Te tiemblan las manos, jajaja."</p>

        <p>No falla. Siempre hay alguien que intenta ponerse por encima.</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"Es que me pones nervioso."</p>

        <p>Suelto con media sonrisa.</p>

        <p>Pero sé la verdad.<br />Sé lo que viene.<br />En diez segundos, su risa se va a convertir en asombro.</p>

        <p>Empiezo a mezclar.<br />Primero, alguna mirada de reojo.<br />Luego, un "ostias" en voz baja.<br />Y cuando se quieren dar cuenta, hasta el más escéptico está con la boca abierta y sin saber qué decir.</p>

        <p>Lo más ingenioso que se le ocurre es un:</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"¿Cómo lo has hecho?"</p>

        <p>Pero ya es tarde.<br />Como si fuese a explicarlo, empiezo otro juego.<br />Sin darse cuenta, vuelven a estar atrapados.</p>

        <p>El que intentaba reírse de mí al principio ahora es el más emocionado.</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"¡Tío, hazte otro! Espera, espera… que llamo a un colega para que vea esto."</p>

        <p>De repente, hay un corro.<br />La gente se acerca.<br />Se hace el silencio.</p>

        <p>Voy a por el final.<br />Miro mis manos. Abro los dedos. Reviso mis mangas.<br />Nada, solo una baraja mezclada.</p>

        <p>Chasqueo los dedos.</p>

        <p>Y sin que nadie entienda cómo…<br />Las cartas se ordenan sin que yo las toque.</p>

        {/* Boom */}
        <div style={{ margin: "5rem 0" }}>
          <p
            style={{
              fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
              fontWeight: 500,
              color: "#F2F2F0",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Boom.<br />Gritos.<br />Incredulidad.<br />Los que antes dudaban, ahora aplauden.
          </p>
        </div>

        <p>Y lo curioso es que esa misma reacción, la puede conseguir cualquiera.</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"Si queréis más, sacad la cartera."</p>

        <p>Risas. Ambiente cargado de especulaciones.<br />Preguntas: ¿Dónde has aprendido eso? ¿Me puedes enseñar? ¿Te dedicas a esto, no?<br />Incluso alguna chica que me mira con otra cara.</p>

        <p>Y se repite la pregunta inevitable:</p>

        <p style={{ color: "rgba(242,242,240,0.45)", fontStyle: "italic" }}>"Pero... ¿cómo cojones haces eso?"</p>

        <p>Sonrío y me encojo de hombros.<br />"Nada especial. Solo práctica."</p>

        <p>Pero hay un secreto.<br />No tiene nada que ver con talento.</p>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(242,242,240,0.08)", margin: "5.5rem 0" }} />

        <p>Mucha gente intenta hacer un truco con la baraja roñosa de casa y fracasa.<br />No es su culpa.<br />Las cartas pegadas, las esquinas dobladas…<br />Imposible hacer algo decente con eso.</p>

        <p>Pero si tienes una buena baraja y conoces las técnicas adecuadas,<br />en cuestión de minutos puedes estar fascinando a decenas de personas.<br />Ni siquiera necesitas aprender a mezclar.</p>

        <p>
          Por eso diseñé la baraja{" "}
          <strong style={{ color: "#F2F2F0", fontWeight: 600, letterSpacing: "0.02em" }}>EGUZKILORE</strong>.
        </p>

        <p>Inspirada en la cultura vasca, con los eguzkilores en el dorso como símbolo de seguridad y detalles en las figuras que homenajean la cultura vasca.</p>

        <p>De calidad profesional, con equilibrio perfecto entre robustez y flexibilidad.<br />Las sacas de la caja y ya notas la diferencia: desliza perfecta, no se engancha, parece que las cartas se colocan solas.</p>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(242,242,240,0.08)", margin: "5.5rem 0" }} />

        <p
          style={{
            fontSize: "clamp(1.2rem, 1.6vw, 1.4rem)",
            color: "#F2F2F0",
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          Pero NO es solo una baraja.<br />Es una herramienta.
        </p>

        <p>Puedes usarla como excusa para romper el hielo.<br />Como tu nuevo Fidget Toy para entretenerte mientras ves una peli o estudias.<br />O simplemente para convertir cualquier tarde normal en una sesión de juegos de mesa.</p>

        <p>Pero aquí viene lo mejor:<br />Dentro de cada baraja hay una carta especial.</p>

        <p>Una llave de acceso a los primeros dos módulos del primer curso de cartomagia en euskera.<br />En minutos, estarás haciendo tu primer truco (te lo enseño en vídeo y audio).<br />En menos de un mes, dominarás 13 juegos listos para dejar con la boca abierta a cualquiera.</p>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(242,242,240,0.08)", margin: "5.5rem 0" }} />

        <p>Ahora, piénsalo un segundo.</p>

        <ul style={{ paddingLeft: "1.25rem", color: "rgba(242,242,240,0.55)", lineHeight: 2.1 }}>
          <li>Un juego de mesa sencillo cuesta 13,75 €</li>
          <li>Un curso de magia profesional, mínimo 50 € (y en euskera, ni existen)</li>
          <li>Las barajas de diseño empiezan en 12 € y algunas se revalorizan hasta más de 500 €</li>
          <li>Un kit de magia básico (que acaba olvidado en un cajón), 27,90 €</li>
          <li>Uno más decente, con trucos que valen la pena, lo podrías conseguir por 90 €</li>
        </ul>

        <p>
          Pero <strong style={{ color: "#F2F2F0" }}>EGUZKILORE</strong> no te va a costar 90 €.
          <br />Tampoco 40 €.
          <br />Ni siquiera 20 €.
        </p>

        {/* Price */}
        <div
          style={{
            margin: "5rem 0",
            padding: "2.5rem 2rem",
            border: "1px solid rgba(242,242,240,0.12)",
            background: "rgba(242,242,240,0.02)",
          }}
        >
          <p
            style={{
              fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
              fontWeight: 500,
              color: "#F2F2F0",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              margin: "0 0 1rem",
            }}
          >
            El precio de lanzamiento es de tan solo 12 €.
          </p>
          <p style={{ color: "rgba(242,242,240,0.55)", margin: 0, lineHeight: 1.8 }}>
            Sí, menos de lo que cuesta un juego de mesa barato.
            <br />Y lo mejor: el curso viene incluido de regalo.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <a
            href="mailto:contacto@niala.es?subject=Quiero%20una%20baraja%20Eguzkilore"
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.06em] text-[#F2F2F0] transition-all duration-300 hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6]"
            style={{ textDecoration: "none" }}
          >
            Haz clic aquí y consigue la baraja ahora
          </a>
        </div>
      </article>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "2rem", borderTop: "1px solid rgba(242,242,240,0.06)" }}>
        <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.25)" }}>© Alain Zulaika</p>
      </footer>
    </main>
  );
}
