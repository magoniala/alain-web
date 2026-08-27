import { Metadata } from "next";
import { Header, Footer } from "../_ui";

export const metadata: Metadata = {
  title: "Política de privacidad",
};

export default function PrivacidadEntrenatzailePage() {
  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="mx-auto max-w-[1400px] px-8 pt-20 pb-40 md:px-16 md:pt-28">
        <div className="max-w-[680px]">

          <p className="mb-4 text-[0.82rem] uppercase tracking-[0.35em] text-[#D4860A]">
            Política de privacidad
          </p>

          <p className="mb-14 text-[0.85rem] text-[#0F2240]/40">
            Última actualización: 24 de agosto de 2026
          </p>

          <div className="space-y-14">

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                1. Responsable del tratamiento
              </p>
              <div className="space-y-2 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/70">
                <p><span className="text-[#0F2240]/40 mr-4">Nombre</span>Alain Zulaika Fuente</p>
                <p><span className="text-[#0F2240]/40 mr-4">NIF</span>79187841Z</p>
                <p><span className="text-[#0F2240]/40 mr-4">Domicilio</span>Elgoibar, Gipuzkoa, 20870</p>
                <p><span className="text-[#0F2240]/40 mr-4">Contacto</span>info@alainzulaika.com</p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                2. Datos que recogemos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
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
                  A través del formulario de la página <span className="text-[#0F2240]/90">/espalda</span> recogemos tu correo electrónico, tu teléfono, tu edad, tu género y las respuestas de texto libre que escribas sobre tu historial de espalda, sobre lo que ya has probado y sobre lo que te preocupa que llegue a pasarte.
                </p>
                <p>
                  A través del formulario de reserva de la página <span className="text-[#0F2240]/90">/hoja-de-ruta</span> recogemos tu nombre, tu correo electrónico, tu teléfono y el hueco de agenda que elijas.
                </p>
                <p>
                  En ambos formularios registramos también la fecha y hora de envío, la casilla o casillas de consentimiento que has marcado junto con el texto exacto que se te mostró al marcarlas, y los parámetros de campaña de la dirección desde la que llegaste (UTM). Las respuestas que escribes en los formularios no viajan nunca en la dirección web ni en ningún parámetro de medición.
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
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                3. Categorías especiales de datos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  En el marco del servicio de entrenamiento personal (Entrenatzaile) pueden tratarse datos relativos a la salud —como historial de lesiones, molestias, dolor o condición física—, aportados siempre de forma voluntaria por el interesado.
                </p>
                <p>
                  Esto incluye de forma expresa las respuestas de texto libre del formulario de la página <span className="text-[#0F2240]/90">/espalda</span> y cualquier información sobre tu estado físico que compartas en la llamada de la Hoja de Ruta. Estos datos constituyen una categoría especial de datos personales conforme al art. 9 del Reglamento General de Protección de Datos.
                </p>
                <p>
                  La base legal para este tratamiento es el consentimiento explícito del interesado (art. 9.2.a del Reglamento General de Protección de Datos), que se recoge mediante una casilla específica, separada del resto y no marcada por defecto, en la que se describe este tratamiento. Sin ese consentimiento no se envía el formulario ni se conserva ninguna respuesta.
                </p>
                <p>
                  Estos datos no se utilizan para elaborar perfiles publicitarios, no se emplean como criterio de segmentación en plataformas de anuncios y no se transmiten a ellas.
                </p>
                <p>
                  Estos datos se tratan con estricta confidencialidad, únicamente para elaborar y ejecutar tu plan de entrenamiento, y no se ceden a terceros.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                4. Finalidad del tratamiento
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Los datos facilitados se utilizan exclusivamente para atender tu consulta, contactarte para entender mejor el contexto de tu evento y, si procede, elaborar y enviarte una propuesta de servicios.
                </p>
                <p>
                  Además, según el formulario a través del que nos hayas facilitado tus datos, los tratamos para: enviarte las guías y el material gratuito que hayas solicitado; enviarte una newsletter diaria con contenidos y ofertas propias; gestionar las citas de valoración y las reservas de la llamada de la Hoja de Ruta; y elaborar tu plan de entrenamiento personal.
                </p>
                <p>
                  Si marcas la casilla correspondiente, tratamos además tu teléfono para escribirte por WhatsApp, tanto para el seguimiento de tu solicitud como para informarte de nuestros servicios.
                </p>
                <p>
                  Si empiezas una reserva y no llegas a elegir hueco, te escribimos una sola vez por correo para que puedas retomarla o proponernos otro momento. Es un único mensaje: si no respondes, no insistimos.
                </p>
                <p>
                  Si aceptas las cookies, comunicamos a Meta que has rellenado un formulario o reservado una llamada, con tu correo y tu teléfono cifrados, para medir qué anuncios funcionan. <span className="text-[#0F2240]/90">Nunca se le envían las respuestas de los formularios</span>, ni ninguna información sobre tu estado físico o de salud. Si rechazas las cookies, no se le envía absolutamente nada.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                5. Base legal
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  El tratamiento se basa en el consentimiento del interesado (art. 6.1.a del Reglamento General de Protección de Datos), prestado de forma libre e informada al enviar el formulario de contacto, los formularios de captación de la web, los formularios de Meta o al reservar una cita.
                </p>
                <p>
                  Para los datos relativos a la salud, la base legal es el consentimiento explícito del art. 9.2.a, recogido en una casilla separada tal y como se describe en el apartado 3.
                </p>
                <p>
                  Para la ejecución del servicio contratado, la base legal es además la ejecución de un contrato o de medidas precontractuales a petición del interesado (art. 6.1.b).
                </p>
                <p>
                  Cada finalidad tiene su propia casilla, separada de las demás y no marcada por defecto. Puedes retirar cualquiera de estos consentimientos en cualquier momento, sin que ello afecte a la licitud del tratamiento anterior a la retirada.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                6. Conservación de los datos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Los datos se conservan mientras la relación comercial esté activa o hasta que solicites su supresión. Una vez finalizada la relación, se bloquean durante los plazos legalmente establecidos antes de su eliminación definitiva.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                7. Destinatarios
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Los datos no se ceden a terceros salvo obligación legal. Para prestar el servicio, contamos con los siguientes proveedores, que actúan como encargados del tratamiento:
                </p>
                <div className="mt-2 space-y-2 text-[#0F2240]/70">
                  <p><span className="text-[#0F2240]/40 mr-4">Vercel Inc.</span>alojamiento del sitio web</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Mailjet</span>envío de correos electrónicos y de la newsletter</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Supabase Inc.</span>base de datos</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Meta Platforms, Inc.</span>formularios instantáneos de anuncios (Facebook/Instagram Ads)</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Calendly LLC</span>gestión de la agenda de citas</p>
                  <p><span className="text-[#0F2240]/40 mr-4">WhatsApp Ireland Ltd.</span>mensajería, si has consentido este canal</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Meta Platforms Ireland Ltd.</span>medición de anuncios, solo si aceptas las cookies</p>
                  <p><span className="text-[#0F2240]/40 mr-4">Google LLC</span>videollamadas (Meet) y gestión de calendario (Calendar)</p>
                </div>
                <p>
                  Algunos de estos proveedores están ubicados fuera del Espacio Económico Europeo (EE. UU.). En esos casos, la transferencia internacional de datos se realiza al amparo de las Cláusulas Contractuales Tipo de la Comisión Europea u otras garantías adecuadas conforme al RGPD.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                8. Newsletter
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Si te suscribes a la newsletter, tratamos tu correo electrónico con tu consentimiento previo para enviarte contenidos y ofertas propias de forma periódica. La frecuencia habitual es diaria, aunque no se garantiza una periodicidad fija.
                </p>
                <p>
                  <span className="text-[#0F2240]/90">El material gratuito se entrega a cambio del alta en la newsletter.</span> Las guías, informes y demás materiales que ofrecemos en la web no tienen precio en dinero: la contraprestación por ellos es tu alta en la newsletter, y así se te declara de forma expresa en el propio formulario antes de enviarlo, mediante una casilla específica no marcada por defecto. Si no aceptas esa casilla, no podemos entregarte el material, pero puedes seguir navegando por la web y contratar cualquiera de los servicios de pago sin darte de alta.
                </p>
                <p>
                  Puedes darte de baja en cualquier momento con un solo clic, a través del enlace incluido en cada envío, y conservar el material que ya hayas recibido. La baja no afecta a la licitud del tratamiento realizado con anterioridad a la retirada de tu consentimiento.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                9. WhatsApp
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Al facilitar tu teléfono en un formulario nos autorizas a escribirte por WhatsApp para lo operativo de aquello que has solicitado: confirmar datos puntuales, coordinar una llamada o resolver una incidencia con el envío. Así se te indica en el propio campo del teléfono, junto al que lo escribes.
                </p>
                <p>
                  Además, cada formulario incluye una casilla específica, separada de las demás y no marcada por defecto, con la que puedes autorizarnos a escribirte también por iniciativa nuestra, para proponerte contenidos o servicios que creamos que te pueden servir.
                </p>
                <p>
                  Esa casilla es opcional: si no la marcas, recibes igualmente el material y el servicio que hayas solicitado. Puedes retirar cualquiera de los dos usos en cualquier momento respondiendo <span className="text-[#0F2240]/90">BAJA</span> al propio WhatsApp o escribiendo a la dirección del apartado 10.
                </p>
                <p>
                  Los mensajes los escribe Alain Zulaika personalmente, uno a uno. No se realizan envíos masivos ni automatizados.
                </p>
                <p>
                  El servicio de mensajería lo presta WhatsApp Ireland Limited (grupo Meta), conforme a sus propias condiciones y política de privacidad.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#0F2240]/40">
                10. Tus derechos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#0F2240]/75">
                <p>
                  Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, limitación del tratamiento, portabilidad y oposición escribiendo a{" "}
                  <span className="text-[#0F2240]/90">info@alainzulaika.com</span>, indicando en el asunto «Protección de datos».
                </p>
                <p>
                  Si no obtienes respuesta satisfactoria, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
