import Image from "next/image";
import Link from "next/link";
import { Header } from "../_ui";
import { EnlaceTrackeado, VistaKit } from "./_tracking";

/* ---------------------------------------------------------------------------
   Pack de recursos · Otra vez lumbago.

   Nació como copia de la tienda de Whop (entrenatzaile-kit.whop.site), pero
   el copy ya no es el de allí: aquello vendía "el KIT" como si fuera un
   ebook de 32 páginas, y lo que se compra son cinco recursos. Aquí se llaman
   por su nombre — pack de recursos — y el bloque de contenido enumera lo que
   entra, no las características sueltas.

   Lo único que sigue en Whop es el cobro, así que los botones de compra salen
   hacia allí.

   La página tiene una sola salida a propósito: leerla y comprar. Sin menú de
   navegación y sin enlace a la guía gratis — la guía sigue publicada, pero no
   se enlaza desde aquí para no abrir una vía que se lleva la venta. El test
   queda en el pie y en una pregunta frecuente, para quien aún dude.
   --------------------------------------------------------------------------- */

const CHECKOUT = "https://entrenatzaile-kit.whop.site/checkout/plan_PmEle1e4obHUF";
const TEST = "/otra-vez-lumbago/test";

const TITULAR = "font-[family-name:var(--font-fraunces)]";

function Flecha({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const BOTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0F2240] px-7 font-semibold text-[#F7F1E6] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47800]";

const CIFRAS = [
  { k: "69%", v: "de lumbagos vuelven en el mismo año. Siete de cada diez." },
  { k: "5", v: "recursos: dos ebooks, dos registros y una infografía." },
  { k: "73", v: "ilustraciones numeradas, una por postura y por ejercicio." },
];

// Lo que se compra, pieza a pieza. Primero qué es, luego para qué sirve.
const DENTRO = [
  {
    title: "Ebook «Alivia tu lumbago hoy»",
    meta: "3 páginas",
    body: "Los primeros días, paso a paso: cómo levantarte, sentarte y dormir, cómo aliviar el dolor sin quedarte parado, y los 5 errores que alargan el episodio.",
  },
  {
    title: "Ebook «Protocolo completo»",
    meta: "32 páginas · del día 1 al mes 3",
    body: "Sabes qué te toca cada día. Buscas tu momento —me acaba de dar, llevo diez días, ahora estoy bien— y vas directo a tu parte. Tres fases por escalones, desde no poder moverte hasta volver a levantar la garrafa, la maleta o a tu nieto sin pensarlo.",
  },
  {
    title: "Registro imprimible",
    meta: "en papel",
    body: "Lo cuelgas y apuntas cada día. Sabes dónde estás y ves tu progreso en una semana, no en tu memoria.",
  },
  {
    title: "Registro en Excel",
    meta: "automático",
    body: "El mismo registro, pero echando él las cuentas: metes los números y te dice si seguir igual, subir o bajar el peso o la dificultad. Se complementa con el de papel.",
  },
  {
    title: "Infografía para el armario",
    meta: "una hoja",
    body: "Todo el proceso de un vistazo. Te ubica en cualquier momento y, si dentro de un año te vuelve a dar, ya tienes el plan: no andas apagando fuegos.",
  },
];

// Las características que no son un archivo suelto, sino cómo está hecho todo.
const ADEMAS = [
  {
    title: "El filtro de 30 segundos",
    body: "En medio minuto sabes si tu lumbago es el de siempre o si lo tuyo toca consultarlo con un médico.",
  },
  {
    title: "El semáforo",
    body: "Dos números del 1 al 10 y sabes si repetir, subir o bajar el ritmo. Se acaba el «¿me estaré haciendo daño?».",
  },
  {
    title: "En casa, con lo que tienes",
    body: "Una silla y un palo de escoba. Si prefieres el gimnasio, viene también la versión para gimnasio.",
  },
  {
    title: "Basado en guías clínicas",
    body: "11 fuentes citadas, las más importantes de los últimos diez años. Puedes comprobarlas una a una.",
  },
];

const INCLUYE = [
  "Ebook «Alivia tu lumbago hoy» (3 páginas)",
  "Ebook «Protocolo completo» (32 páginas, del día 1 al mes 3)",
  "Registro imprimible en papel",
  "Registro en Excel, con los cálculos hechos",
  "Infografía resumen para el armario",
];

const PREGUNTAS = [
  {
    q: "¿Esto es una guía gratuita?",
    a: "No. Es el pack de pago: dos ebooks, los dos registros y la infografía. La guía gratis de tres páginas va dentro, así que si ya la tienes, el resto es lo nuevo.",
  },
  {
    q: "¿Es esto para mí?",
    a: "Si has tenido lumbago y no quieres que vuelva, sí. Si nunca lo has tenido, no te hace falta todavía. Hay un test de tres preguntas que te lo dice en medio minuto.",
    enlaceTest: true,
  },
  {
    q: "¿Y si no me sirve?",
    a: "Tienes 14 días de garantía para revisar el material. Si no te encaja, me escribes y te devuelvo el dinero.",
  },
  {
    q: "¿Sirve si ahora mismo estoy en un brote?",
    a: "Está escrito para eso. El filtro de 30 segundos te dice si puedes entrenar, y el ebook corto cubre los primeros días del episodio.",
  },
  {
    q: "¿Necesito gimnasio o material?",
    a: "No. Una silla y un palo de escoba. Y si prefieres hacerlo en el gimnasio, viene también esa versión.",
  },
  {
    q: "¿Cuánto tarda en llegar?",
    a: "Es digital. En cuanto pagas, tienes acceso a todo el pack.",
  },
  {
    q: "¿Cuánto tiempo necesito al día?",
    a: "Está escrito para agendas apretadas: sesiones cortas que caben en el hueco que te deja el trabajo, no entrenamientos de dos horas.",
  },
  {
    q: "¿Esto sustituye al médico o al fisio?",
    a: "No. Es material de entrenamiento. El filtro de 30 segundos está justo para eso: para que sepas cuándo lo tuyo toca consultarlo antes de ponerte a entrenar.",
  },
  {
    q: "¿Es un pago único o una suscripción?",
    a: "Pago único. Pagas una vez y el pack es tuyo, sin cuotas ni renovaciones.",
  },
];

export default function OtraVezLumbago() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F1E6] text-[#0F2240]">
      <VistaKit />
      <Cabecera />
      <main className="flex-1">
        <Hero />
        <Cifras />
        <Relato />
        <Cita />
        <Protocolo />
        <Ademas />
        <Autor />
        <Precio />
        <Faq />
        <CierreCta />
      </main>
      <Pie />
    </div>
  );
}

// Sin menú: sólo la marca, y la misma cabecera que el resto del subdominio.
// Cada enlace de navegación era una puerta de salida antes de llegar al precio.
function Cabecera() {
  return <Header current="es" showLangSwitch={false} />;
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-20 md:grid-cols-2 md:pt-16 md:pb-28">
      <div>
        <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
          Pack de recursos · Otra vez lumbago
        </p>
        <h1
          className={`${TITULAR} mt-4 text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl`}
        >
          7 de cada 10 lumbagos recaen. Rompe el ciclo hoy.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-pretty text-[#4A5C73]">
          Cinco recursos de Alain Zulaika: el protocolo del día 1 al mes 3, la guía para los
          primeros días, dos registros para ver tu progreso y la infografía que te dice qué hacer la
          próxima vez. Para quien ya ha pasado por esto y no puede permitirse otra recaída.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <EnlaceTrackeado href={CHECKOUT} evento="add_to_cart" conValor className={BOTON}>
            Comprar el pack · 24,19 €
            <Flecha />
          </EnlaceTrackeado>
          <a
            href="#protocolo"
            className="font-semibold underline decoration-[#E0D4C0] underline-offset-4 hover:decoration-[#0F2240]"
          >
            Ver qué incluye
          </a>
        </div>
        <p className="mt-8 text-sm text-[#4A5C73]">
          Pago único · Acceso inmediato · 14 días de garantía
        </p>
      </div>
      <Image
        src="/otra-vez-lumbago/alain.png"
        alt="Alain Zulaika, entrenador de Entrenatzaile"
        width={1254}
        height={1254}
        priority
        className="aspect-[4/5] w-full rounded-xl object-cover"
      />
    </section>
  );
}

function Cifras() {
  return (
    <section className="border-y border-[#E0D4C0]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        {CIFRAS.map((c) => (
          <div key={c.k} className="border-t border-[#E0D4C0] pt-6 md:border-t-0 md:pt-0">
            <p className={`${TITULAR} text-4xl font-semibold text-[#C47800]`}>{c.k}</p>
            <p className="mt-2 text-[#4A5C73]">{c.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Relato() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1fr_1.3fr] md:py-28">
      <h2
        className={`${TITULAR} text-4xl leading-tight font-semibold tracking-tight text-balance md:text-5xl`}
      >
        El tirón se pasa. El ciclo no.
      </h2>
      <div className="max-w-prose space-y-5 text-lg leading-relaxed text-[#4A5C73]">
        <p>
          Si has tenido dolor lumbar, conoces el patrón: te da un tirón, lo pasas fatal una o dos
          semanas, mejora, vuelves a tu vida… y meses después, otra vez.
        </p>
        <p>No es mala suerte. Es lo normal.</p>
        <p>
          El problema nunca fue el brote de esta semana. Ese se pasa casi solo. El problema es el
          ciclo: tirón, mejora, debilidad, tirón. Y cada vuelta refuerza una idea peligrosa: “tengo
          la espalda mal, mejor no me muevo”.
        </p>
        <p>
          El pack no te vende un milagro. Te da el material para romper ese ciclo: recuperar
          confianza en el movimiento y construir fuerza de forma sostenida.
        </p>
      </div>
    </section>
  );
}

function Cita() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/otra-vez-lumbago/banda.png"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[#0F2240]/70" />
      <figure className="mx-auto max-w-4xl px-6 py-24 text-center text-[#F7F1E6] md:py-36">
        <blockquote
          className={`${TITULAR} text-3xl leading-snug font-medium text-balance md:text-5xl`}
        >
          “El 69% vuelve a tenerlo en un año. Este pack existe para que no seas uno de ellos.”
        </blockquote>
        <figcaption className="mt-8 text-sm tracking-wide text-[#F7F1E6]/80 uppercase">
          Alain Zulaika · Entrenatzaile
        </figcaption>
      </figure>
    </section>
  );
}

function Protocolo() {
  return (
    <section id="protocolo" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20 md:py-28">
      <div className="grid items-end gap-8 md:grid-cols-[1.2fr_1fr]">
        <h2 className={`${TITULAR} text-4xl font-semibold tracking-tight md:text-5xl`}>
          Qué hay dentro del pack
        </h2>
        <Image
          src="/otra-vez-lumbago/kit.png"
          alt="Pack de recursos Otra vez lumbago"
          width={1536}
          height={864}
          className="mt-6 w-full rounded-xl object-cover md:mt-0"
        />
      </div>
      <ol className="mt-12 grid gap-x-12 md:grid-cols-2">
        {DENTRO.map((item, i) => (
          <li key={item.title} className="flex gap-6 border-t border-[#E0D4C0] py-7">
            <span className={`${TITULAR} text-2xl text-[#C47800] tabular-nums`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-0.5 text-sm tracking-wide text-[#C47800]">{item.meta}</p>
              <p className="mt-2 text-[#4A5C73]">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Bloque corto a propósito: son las cuatro cosas que atraviesan todo el
// material, y si se alargan se comen el bloque de arriba, que es el que
// cuenta qué compras.
function Ademas() {
  return (
    <section className="border-y border-[#E0D4C0] bg-[#EFE6D4]">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className={`${TITULAR} text-3xl font-semibold tracking-tight`}>Y además</h2>
        <ul className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-2">
          {ADEMAS.map((item) => (
            <li key={item.title} className="flex gap-3">
              <Check className="mt-1 size-5 shrink-0 text-[#C47800]" />
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-[#4A5C73]">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Autor() {
  return (
    <section>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[0.8fr_1fr] md:py-28">
        <Image
          src="/otra-vez-lumbago/alain.png"
          alt="Alain Zulaika"
          width={1254}
          height={1254}
          className="aspect-[4/5] w-full max-w-sm rounded-xl object-cover"
        />
        <div>
          <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
            Quién lo escribe
          </p>
          <h2 className={`${TITULAR} mt-3 text-4xl font-semibold tracking-tight md:text-5xl`}>
            Alain Zulaika
          </h2>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-[#4A5C73]">
            Entrenador personal titulado. Llevo entrenando desde los 14 y más de 6 años como
            entrenador. Ayudo a personas de 45 a 65 a mantener fuerza, movilidad y autonomía. Sin
            humo, sin promesas milagro: solo el material y alguien que lo ha escrito para que se
            pueda cumplir.
          </p>
        </div>
      </div>
    </section>
  );
}

function Precio() {
  return (
    <section id="kit" className="mx-auto max-w-6xl px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-lg rounded-xl border border-[#E0D4C0] bg-[#EFE6D4] p-8 md:p-10">
        <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
          Pago único
        </p>
        <h2 className={`${TITULAR} mt-3 text-3xl font-semibold tracking-tight`}>
          Pack de recursos · Otra vez lumbago
        </h2>
        <p className="mt-6 flex flex-wrap items-baseline gap-3">
          <span className={`${TITULAR} text-6xl font-semibold whitespace-nowrap`}>24,19 €</span>
          <span className="text-[#4A5C73]">IVA incluido</span>
        </p>
        <p className="mt-2 text-sm text-[#4A5C73]">19,99 € + IVA · acceso inmediato</p>
        <ul className="mt-8 space-y-3">
          {INCLUYE.map((linea) => (
            <li key={linea} className="flex gap-3">
              <Check className="mt-0.5 size-5 shrink-0 text-[#C47800]" />
              {linea}
            </li>
          ))}
        </ul>
        <div className="mt-9">
          <EnlaceTrackeado
            href={CHECKOUT}
            evento="add_to_cart"
            conValor
            className={`${BOTON} w-full`}
          >
            Comprar el pack ahora
            <Flecha />
          </EnlaceTrackeado>
        </div>
        <p className="mt-4 text-center text-sm text-[#4A5C73]">
          14 días de garantía. Si el material no te encaja, te devuelvo el dinero.
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 pb-20 md:pb-28">
      <h2 className={`${TITULAR} text-4xl font-semibold tracking-tight`}>Preguntas</h2>
      <div className="mt-8 divide-y divide-[#E0D4C0] border-y border-[#E0D4C0]">
        {PREGUNTAS.map((p) => (
          <details key={p.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
              {p.q}
              <span className="text-2xl text-[#4A5C73] transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 max-w-prose text-[#4A5C73]">
              {p.a}
              {p.enlaceTest && (
                <>
                  {" "}
                  <EnlaceTrackeado
                    href={TEST}
                    evento="quiz_start"
                    className="font-semibold text-[#0F2240] underline decoration-[#E0D4C0] underline-offset-4 hover:decoration-[#0F2240]"
                  >
                    Hacer el test
                  </EnlaceTrackeado>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CierreCta() {
  return (
    <section className="bg-[#0F2240] text-[#F7F1E6]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-20 md:flex-row md:items-center md:justify-between">
        <h2
          className={`${TITULAR} max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl`}
        >
          Rompe el ciclo del lumbago hoy
        </h2>
        <EnlaceTrackeado
          href={CHECKOUT}
          evento="add_to_cart"
          conValor
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C47800] px-7 font-semibold text-[#0F2240]"
        >
          Quiero el pack · 24,19 €
          <Flecha />
        </EnlaceTrackeado>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="mt-auto border-t border-[#E0D4C0] bg-[#F7F1E6]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[#4A5C73]">
        <p>© {new Date().getFullYear()} Entrenatzaile · Alain Zulaika</p>
        <nav className="flex flex-wrap gap-5">
          <EnlaceTrackeado href={TEST} evento="quiz_start" className="hover:text-[#0F2240]">
            Haz el test
          </EnlaceTrackeado>
          <EnlaceTrackeado
            href={CHECKOUT}
            evento="add_to_cart"
            conValor
            className="hover:text-[#0F2240]"
          >
            Comprar el pack
          </EnlaceTrackeado>
          <Link href="/privacidad" className="hover:text-[#0F2240]">
            Privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
