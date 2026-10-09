import Image from "next/image";
import Link from "next/link";
import { Header } from "../_ui";
import { ALIVIO_TEXTOS } from "@/lib/alivio";
import BotonGuia from "./BotonGuia";

/* ---------------------------------------------------------------------------
   Landing del lead magnet "Alivia tu lumbago hoy".

   Misma estética que el pack de /otra-vez-lumbago, pero aquí no se vende: la
   guía es gratis y todos los botones van al mismo sitio, el checkout de Whop,
   que es quien la entrega. No hay sección de "qué hay dentro" — en una guía de
   tres páginas, enumerar lo que lleva ocupa más que la guía.
   --------------------------------------------------------------------------- */

const T = ALIVIO_TEXTOS;
const TITULAR = "font-[family-name:var(--font-fraunces)]";

function Flecha() {
  return (
    <svg
      className="size-4"
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

function Check() {
  return (
    <svg
      className="mt-0.5 size-5 shrink-0 text-[#C47800]"
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

export default function Alivio() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F1E6] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />
      <main className="flex-1">
        <Hero />
        <Cifras />
        <Relato />
        <Cita />
        <Autor />
        <Descarga />
        <Faq />
        <CierreCta />
      </main>
      <Pie />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-20 md:grid-cols-2 md:pt-16 md:pb-28">
      <div>
        <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
          {T.hero.eyebrow}
        </p>
        <h1
          className={`${TITULAR} mt-4 text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl`}
        >
          {T.hero.titular}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-pretty text-[#4A5C73]">
          {T.hero.entrada}
        </p>
        <div className="mt-9">
          <BotonGuia className={BOTON}>
            {T.hero.cta}
            <Flecha />
          </BotonGuia>
        </div>
        <p className="mt-8 text-sm text-[#4A5C73]">{T.hero.pie}</p>
      </div>
      <Image
        src="/alivio/portada.png"
        alt={`Portada de ${T.titulo}, guía gratuita de 3 páginas`}
        width={1024}
        height={1536}
        priority
        className="w-full rounded-xl object-cover"
      />
    </section>
  );
}

function Cifras() {
  return (
    <section className="border-y border-[#E0D4C0]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        {T.cifras.map((c) => (
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
        {T.relato.titular}
      </h2>
      <div className="max-w-prose space-y-5 text-lg leading-relaxed text-[#4A5C73]">
        {T.relato.parrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
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
          {T.cita}
        </blockquote>
        <figcaption className="mt-8 text-sm tracking-wide text-[#F7F1E6]/80 uppercase">
          Alain Zulaika · Entrenatzaile
        </figcaption>
      </figure>
    </section>
  );
}

function Autor() {
  return (
    <section className="bg-[#EFE6D4]">
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
            {T.autor.eyebrow}
          </p>
          <h2 className={`${TITULAR} mt-3 text-4xl font-semibold tracking-tight md:text-5xl`}>
            {T.autor.nombre}
          </h2>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-[#4A5C73]">{T.autor.texto}</p>
        </div>
      </div>
    </section>
  );
}

function Descarga() {
  return (
    <section id="descarga" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-lg rounded-xl border border-[#E0D4C0] bg-[#EFE6D4] p-8 md:p-10">
        <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
          {T.descarga.eyebrow}
        </p>
        <h2 className={`${TITULAR} mt-3 text-3xl font-semibold tracking-tight`}>{T.titulo}</h2>
        <p className="mt-6 flex flex-wrap items-baseline gap-3">
          <span className={`${TITULAR} text-6xl font-semibold whitespace-nowrap`}>
            {T.descarga.precio}
          </span>
          <span className="text-[#4A5C73]">{T.descarga.precioNota}</span>
        </p>
        <p className="mt-2 text-sm text-[#4A5C73]">{T.descarga.subtitulo}</p>
        <ul className="mt-8 space-y-3">
          {T.descarga.incluye.map((linea) => (
            <li key={linea} className="flex gap-3">
              <Check />
              {linea}
            </li>
          ))}
        </ul>
        <div className="mt-9">
          <BotonGuia className={`${BOTON} w-full`}>
            {T.descarga.boton}
            <Flecha />
          </BotonGuia>
        </div>
        <p className="mt-4 text-center text-sm text-[#4A5C73]">{T.descarga.letraPequena}</p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 pb-20 md:pb-28">
      <h2 className={`${TITULAR} text-4xl font-semibold tracking-tight`}>Preguntas</h2>
      <div className="mt-8 divide-y divide-[#E0D4C0] border-y border-[#E0D4C0]">
        {T.preguntas.map((p) => (
          <details key={p.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
              {p.q}
              <span className="text-2xl text-[#4A5C73] transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 max-w-prose text-[#4A5C73]">{p.a}</p>
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
          {T.cierre}
        </h2>
        <BotonGuia className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C47800] px-7 font-semibold text-[#0F2240]">
          {T.hero.cta}
          <Flecha />
        </BotonGuia>
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
          <Link href="/otra-vez-lumbago" className="hover:text-[#0F2240]">
            El pack
          </Link>
          <Link href="/privacidad" className="hover:text-[#0F2240]">
            Privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
