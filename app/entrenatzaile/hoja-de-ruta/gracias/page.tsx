import type { Metadata } from "next";
import { Header, Footer, cardStyle } from "../../_ui";

// A donde vuelve Stripe después de un pago. NO confirma nada.
//
// Esto es importante y por eso está escrito aquí: quien decide que un pago
// existe es el webhook (/api/stripe/webhook), que llega firmado por Stripe.
// Esta página es solo el sitio donde aterriza el navegador, y a ella se llega
// escribiendo la URL a mano igual que pagando. Si confirmara algo —marcar la
// reserva, mandar un correo, avanzar un estado—, bastaría con visitarla para
// cobrarse una llamada gratis.
//
// Tampoco lee el session_id: no se le pasa a propósito. Un dato que no se usa
// para nada es una tentación de usarlo mal más adelante.
//
// De ahí el matiz del texto: dice que el pago ha entrado —a esta página solo
// se llega si Stripe cobró y devolvió al navegador— pero no dice que esté
// verificado, porque esta página no ha verificado nada. Lo que confirma es el
// correo, y ese sale del webhook.

const TITULO = "Gracias — Hoja de Ruta";

export const metadata: Metadata = {
  title: TITULO,
  description: "Pago recibido.",
  // Es una página de paso a la que solo se llega volviendo de Stripe: no
  // tiene nada que hacer en Google.
  robots: { index: false, follow: false },
};

const tituloClase = "font-[family-name:var(--font-lora)] font-medium tracking-[-0.02em]";
const cuerpoClase = "text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]";

export default function GraciasHojaDeRutaPage() {
  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="px-6 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[680px]">
          <h1 className={`text-[clamp(1.8rem,5.5vw,2.6rem)] leading-[1.15] text-[#1C3A5E] ${tituloClase}`}>
            Gracias. Pago recibido.
          </h1>

          <div className="mt-10 space-y-6 p-6 md:p-10" style={cardStyle}>
            <p className={cuerpoClase}>
              Tu pago ha entrado. En cuanto termine de registrarse —suele ser cuestión de segundos— te
              llega un correo con tu hueco ya confirmado.
            </p>
            <p className={cuerpoClase}>
              Después te escribo por WhatsApp para presentarme y mandarte el enlace de la videollamada. No
              tienes que hacer nada más.
            </p>
            <p className={cuerpoClase}>
              Si en un rato no te ha llegado el correo, mira en spam y, si tampoco está, escríbeme a{" "}
              <a
                href="mailto:contacto@alainzulaika.com"
                className="underline underline-offset-4 transition-colors hover:text-[#0F2240]"
              >
                contacto@alainzulaika.com
              </a>{" "}
              y lo miro yo.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
