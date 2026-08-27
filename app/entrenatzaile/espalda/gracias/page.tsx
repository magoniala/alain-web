import type { Metadata } from "next";
import { Header, Footer } from "../../_ui";
import { ESPALDA_GRACIAS } from "../_content";
// Mismo bloque que el above the fold de /hoja-de-ruta: enseña el documento
// real justo donde se le propone reservarlo.
import PreviewHojaDeRuta from "../../PreviewHojaDeRuta";
import CtaHojaDeRuta from "./CtaHojaDeRuta";

// URL propia, no un estado de la landing anterior: se puede volver a ella,
// enlazarla y medirla por separado.
export const metadata: Metadata = {
  title: "Gracias — Entrenatzaile",
  robots: { index: false, follow: false },
};

const tituloClase = "font-[family-name:var(--font-lora)] font-medium tracking-[-0.02em] text-[#1C3A5E]";
const cuerpoClase = "whitespace-pre-line text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]";
const botonClase =
  "inline-block scale-100 px-10 py-4 text-[0.98rem] tracking-[0.08em] shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg";

export default function GraciasPage() {
  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="mx-auto max-w-[680px] px-6 py-16 md:px-8 md:py-24">
        <h1 className={`mb-7 text-[clamp(2rem,6.5vw,3.4rem)] leading-[1.12] ${tituloClase}`}>
          {ESPALDA_GRACIAS.titulo}
        </h1>

        <div className="space-y-5">
          {ESPALDA_GRACIAS.parrafos.map((p, i) => (
            <p key={i} className={cuerpoClase}>
              {p}
            </p>
          ))}
        </div>

        {/* Descarga directa: el PDF se sirve con Content-Disposition:
            attachment desde /api/nurture-pdf/espalda, el mismo archivo que
            va por correo. Sin pasos intermedios.
            Anchor normal a propósito, no <Link>: esto no es navegar a una
            página, es descargar un archivo. */}
        <a
          href="/api/nurture-pdf/espalda"
          download
          className={`${botonClase} mt-10 border border-[#1C3A5E]/25 bg-transparent text-[#1C3A5E] hover:border-[#1C3A5E]/50 hover:bg-[#1C3A5E]/[0.04]`}
        >
          {ESPALDA_GRACIAS.descargaBoton}
        </a>

        <div className="mt-20 border-t border-[#1C3A5E]/12 pt-14">
          <h2 className={`mb-6 text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] ${tituloClase}`}>
            {ESPALDA_GRACIAS.ctaTitulo}
          </h2>

          <div className="space-y-5">
            {ESPALDA_GRACIAS.ctaParrafos.map((p, i) => (
              <p key={i} className={cuerpoClase}>
                {p}
              </p>
            ))}
          </div>

          <PreviewHojaDeRuta className="mt-12" />

          {/* Acaba de entrar, así que está dentro de su ventana de 8 días:
              va a la versión "ventana" de la Hoja de Ruta. */}
          <CtaHojaDeRuta
            href="/hoja-de-ruta?ventana=1"
            className={`${botonClase} mt-10 bg-[#1C3A5E] text-[#FAF3E8] hover:bg-[#0F2240]`}
          >
            {ESPALDA_GRACIAS.ctaBoton}
          </CtaHojaDeRuta>
        </div>
      </section>

      <Footer />
    </main>
  );
}
