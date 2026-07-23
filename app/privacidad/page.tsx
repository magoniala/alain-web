import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      <header className="border-b border-white/10 bg-[#0B0B0C]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <Link href="/" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/50 transition-colors hover:text-[#F2F2F0]/80">
            ← Inicio
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-8 pt-20 pb-40 md:px-16 md:pt-28">
        <div className="max-w-[680px]">

          <p className="mb-4 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Política de privacidad
          </p>

          <p className="mb-14 text-[0.85rem] text-[#F2F2F0]/38">
            Última actualización: 23 de julio de 2026
          </p>

          <div className="space-y-14">

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                1. Responsable del tratamiento
              </p>
              <div className="space-y-2 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/65">
                <p><span className="text-[#F2F2F0]/38 mr-4">Nombre</span>Alain Zulaika Fuente</p>
                <p><span className="text-[#F2F2F0]/38 mr-4">NIF</span>79187841Z</p>
                <p><span className="text-[#F2F2F0]/38 mr-4">Domicilio</span>Elgoibar, Gipuzkoa, 20870</p>
                <p><span className="text-[#F2F2F0]/38 mr-4">Contacto</span>info@alainzulaika.com</p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                2. Datos que recogemos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  A través del formulario de contacto recogemos los siguientes datos personales: nombre, correo electrónico, teléfono y la información que facilites voluntariamente sobre el evento que estás organizando.
                </p>
                <p>
                  A través de los formularios de captación de la web (guías gratuitas) recogemos tu correo electrónico y, si lo facilitas, tu nombre.
                </p>
                <p>
                  A través de los formularios instantáneos de Meta (Facebook/Instagram Ads) recogemos tu correo electrónico y tu tramo de edad.
                </p>
                <p>
                  Al reservar una cita de valoración mediante Calendly recogemos tu nombre, correo electrónico y la información que facilites voluntariamente sobre tu situación física.
                </p>
                <p>
                  Si respondes a nuestros correos, recogemos los datos que decidas incluir en tu respuesta.
                </p>
                <p>
                  No se recogen datos de menores de 14 años.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                3. Categorías especiales de datos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  En el marco del servicio de entrenamiento personal (Entrenatzaile) pueden tratarse datos relativos a la salud —como historial de lesiones, molestias o condición física—, aportados siempre de forma voluntaria por el interesado.
                </p>
                <p>
                  La base legal para este tratamiento es el consentimiento explícito del interesado (art. 9.2.a del Reglamento General de Protección de Datos).
                </p>
                <p>
                  Estos datos se tratan con estricta confidencialidad, únicamente para elaborar y ejecutar tu plan de entrenamiento, y no se ceden a terceros.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                4. Finalidad del tratamiento
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Los datos facilitados se utilizan exclusivamente para atender tu consulta, contactarte para entender mejor el contexto de tu evento y, si procede, elaborar y enviarte una propuesta de servicios.
                </p>
                <p>
                  Además, según el formulario a través del que nos hayas facilitado tus datos, los tratamos para: enviarte las guías gratuitas que hayas solicitado; enviarte una newsletter diaria con contenidos y ofertas propias, si has dado tu consentimiento para ello; y gestionar las citas de valoración reservadas mediante Calendly y la elaboración de tu plan de entrenamiento personal.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                5. Base legal
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  El tratamiento se basa en el consentimiento del interesado (art. 6.1.a del Reglamento General de Protección de Datos), prestado de forma libre e informada al enviar el formulario de contacto, los formularios de captación de la web, los formularios de Meta o al reservar cita mediante Calendly.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                6. Conservación de los datos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Los datos se conservan mientras la relación comercial esté activa o hasta que solicites su supresión. Una vez finalizada la relación, se bloquean durante los plazos legalmente establecidos antes de su eliminación definitiva.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                7. Destinatarios
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Los datos no se ceden a terceros salvo obligación legal. Para prestar el servicio, contamos con los siguientes proveedores, que actúan como encargados del tratamiento:
                </p>
                <div className="mt-2 space-y-2 text-[#F2F2F0]/65">
                  <p><span className="text-[#F2F2F0]/38 mr-4">Vercel Inc.</span>alojamiento del sitio web</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Mailjet</span>envío de correos electrónicos y de la newsletter</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Supabase Inc.</span>base de datos</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Meta Platforms, Inc.</span>formularios instantáneos de anuncios (Facebook/Instagram Ads)</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Calendly LLC</span>gestión de la agenda de citas</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Google LLC</span>videollamadas (Meet) y gestión de calendario (Calendar)</p>
                </div>
                <p>
                  Algunos de estos proveedores están ubicados fuera del Espacio Económico Europeo (EE. UU.). En esos casos, la transferencia internacional de datos se realiza al amparo de las Cláusulas Contractuales Tipo de la Comisión Europea u otras garantías adecuadas conforme al RGPD.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                8. Newsletter
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Si te suscribes a la newsletter, tratamos tu correo electrónico con tu consentimiento previo para enviarte contenidos y ofertas propias de forma periódica.
                </p>
                <p>
                  Puedes darte de baja en cualquier momento con un solo clic, a través del enlace incluido en cada envío. La baja no afecta a la licitud del tratamiento realizado con anterioridad a la retirada de tu consentimiento.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                9. Tus derechos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, limitación del tratamiento, portabilidad y oposición escribiendo a <span className="text-[#F2F2F0]/85">info@alainzulaika.com</span>, indicando en el asunto «Protección de datos».
                </p>
                <p>
                  Si no obtienes respuesta satisfactoria, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <footer className="border-t border-white/6 px-8 py-14 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">Aviso legal</Link>
              <Link href="/privacidad" className="text-[#F2F2F0]/62">Privacidad</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
