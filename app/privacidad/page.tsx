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
            Última actualización: 26 de octubre de 2026
          </p>

          <p className="-mt-10 mb-14 text-[0.9rem] text-[#F2F2F0]/55">
            <a href="#euskaraz" className="underline underline-offset-4 transition-colors hover:text-[#2ED3E6]">Laburpena euskaraz ↓</a>
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
                  Al reservar una videollamada de valoración o de Hoja de Ruta en nuestra propia agenda recogemos tu nombre, correo electrónico, teléfono y la información que facilites voluntariamente sobre tu situación física.
                </p>
                <p>
                  Al reservar una reunión de trabajo en creadores.alainzulaika.com recogemos únicamente tu nombre y tu correo electrónico. En esa reserva no se recoge ninguna información sobre salud ni estado físico, ni se te da de alta en ninguna lista de correo.
                </p>
                <p>
                  A través del formulario de valoración (alainzulaika.com/quetal), que envío a quien me ha contratado para un evento, recogemos tu nombre, cargo, entidad, correo electrónico (opcional) y tu valoración del evento y, si decides facilitarlos, el nombre y el teléfono o correo electrónico de otra persona que organice eventos.
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
                  Además, según el formulario a través del que nos hayas facilitado tus datos, los tratamos para: enviarte las guías gratuitas que hayas solicitado; enviarte una newsletter diaria con contenidos y ofertas propias, si has dado tu consentimiento para ello; gestionar las citas reservadas en nuestra agenda y la elaboración de tu plan de entrenamiento personal; y gestionar el cobro de los servicios de pago que contrates.
                </p>
                <p>
                  En el caso concreto de las reuniones reservadas en creadores.alainzulaika.com, tu nombre y tu correo se tratan con la única finalidad de concertar la reunión, recordártela y mantener el contacto necesario para celebrarla.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                5. Base legal
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  El tratamiento se basa en el consentimiento del interesado (art. 6.1.a del Reglamento General de Protección de Datos), prestado de forma libre e informada al enviar el formulario de contacto, los formularios de captación de la web, los formularios de Meta o al reservar una cita en nuestra agenda.
                </p>
                <p>
                  Cuando reservas una cita o contratas un servicio, el tratamiento se basa además en la ejecución de un contrato o en la aplicación de medidas precontractuales adoptadas a petición tuya (art. 6.1.b), y en el cumplimiento de obligaciones legales de facturación y contabilidad en lo relativo a los pagos (art. 6.1.c).
                </p>
                <p>
                  La publicación de testimonios se basa en tu consentimiento, y el primer contacto con las personas que nos recomiendes, en nuestro interés legítimo (art. 6.1.f). Ver el apartado 10.
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
                <p>
                  Las valoraciones se conservan un máximo de 3 años desde el evento. Los testimonios publicados permanecen hasta que retires tu consentimiento. Los datos de las personas recomendadas se eliminan si en 3 meses no hay respuesta o no hay interés.
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
                  <p><span className="text-[#F2F2F0]/38 mr-4">Stripe, Inc.</span>procesamiento de los pagos</p>
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
                9. Pagos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Si contratas un servicio de pago, el cobro se tramita a través de Stripe, que actúa como encargado del tratamiento. Los datos de tu tarjeta los recoge y custodia directamente Stripe: no llegan a nuestros sistemas ni los conservamos en ningún momento.
                </p>
                <p>
                  De cada cobro conservamos únicamente el importe, la fecha y el identificador de la operación, para poder emitir la factura y atender nuestras obligaciones legales de facturación y contabilidad.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                10. Valoraciones, testimonios y personas recomendadas
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  <span className="text-[#F2F2F0]/85">Valoraciones.</span> Usamos tus respuestas para mejorar el servicio. La respuesta a «Si tuvieras que mejorar una cosa, ¿cuál sería?» es solo para uso interno y nunca se publica.
                </p>
                <p>
                  <span className="text-[#F2F2F0]/85">Testimonios.</span> Solo publicamos tu valoración en alainzulaika.com y en nuestros perfiles de redes sociales si lo has autorizado en el formulario, y únicamente con el grado de identificación que hayas elegido: con tu nombre, cargo y entidad; solo con la entidad; o de forma anónima. Podemos corregir erratas o acortar el texto sin cambiar su sentido y, si nos has dejado tu correo, te lo enseñamos antes de publicarlo. El logo de la entidad y las fotos o vídeos del evento solo se usan si has marcado la casilla correspondiente.
                </p>
                <p>
                  La base legal es tu consentimiento (art. 6.1.a RGPD). Puedes retirarlo cuando quieras escribiendo a <span className="text-[#F2F2F0]/85">info@alainzulaika.com</span>, y retiraremos el testimonio de la web y de nuestros perfiles en un plazo máximo de 30 días. Lo que ya hayan compartido terceros puede quedar fuera de nuestro alcance.
                </p>
                <p>
                  <span className="text-[#F2F2F0]/85">Personas recomendadas.</span> Si nos facilitas los datos de otra persona, declaras que lo haces con su conocimiento o que tienes motivos razonables para pensar que no se opondría. Usamos esos datos una sola vez, para presentarnos profesionalmente y ofrecerle nuestros servicios, sobre la base de nuestro interés legítimo (art. 6.1.f RGPD). Solo te mencionaremos si nos lo has autorizado. En ese primer contacto le diremos de dónde hemos obtenido sus datos y cómo ejercer sus derechos. Si no responde o no le interesa, eliminamos sus datos y no volvemos a contactarle.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                11. Tus derechos
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


            <div id="euskaraz" lang="eu" className="scroll-mt-10 border-t border-white/10 pt-14">
              <p className="mb-4 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
                Pribatutasun-politika: laburpena
              </p>
              <p className="mb-10 text-[0.95rem] text-[#F2F2F0]/50">
                Testu osoa gaztelaniaz dago; hau haren laburpena da.
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p><span className="text-[#F2F2F0]/85">Arduraduna.</span> Alain Zulaika Fuente (IFZ 79187841Z), Elgoibar (Gipuzkoa). Harremana: info@alainzulaika.com.</p>
                <p><span className="text-[#F2F2F0]/85">Zer datu biltzen ditugu.</span> Webguneko formularioetan ematen dizkiguzunak (izena, emaila, telefonoa eta ekitaldiari edo zure egoerari buruz kontatzen duzuna), Meta-ren formularioetakoak eta gure agendako erreserbetakoak. Entrenatzaile zerbitzuan osasun-datuak ere tratatu daitezke, beti zure baimen esplizituarekin.</p>
                <p><span className="text-[#F2F2F0]/85">Zertarako.</span> Zure kontsultari erantzuteko eta proposamenak bidaltzeko; eskatu dituzun gidak eta, baimena eman baduzu, newsletterra bidaltzeko; hitzorduak kudeatzeko; eta kontratatutako zerbitzuak kobratzeko.</p>
                <p><span className="text-[#F2F2F0]/85">Balorazioak eta testigantzak.</span> /quetal formularioko erantzunak zerbitzua hobetzeko erabiltzen ditugu. Zure balorazioa argitaratzeko baimena eman baduzu bakarrik argitaratzen dugu, eta zuk aukeratutako moduan: izen, kargu eta erakundearekin, erakundearekin bakarrik edo anonimoki. Hobetzeko proposamena ez da inoiz argitaratzen. Baimena edozein unetan ken dezakezu, eta gehienez 30 egunean kenduko dugu testigantza.</p>
                <p><span className="text-[#F2F2F0]/85">Gomendatutako pertsonak.</span> Beste pertsona baten datuak ematen badizkiguzu, behin bakarrik erabiliko ditugu harengana aurkezteko. Datuak nondik atera ditugun esango diogu, eta interesik ez badu, ezabatu egingo ditugu.</p>
                <p><span className="text-[#F2F2F0]/85">Oinarri juridikoa.</span> Zure baimena; hitzordu edo zerbitzu bat kontratatzen duzunean, kontratua betetzea; fakturazioari dagokionez, legezko betebeharrak; eta gomendatutako pertsonekin, gure interes legitimoa.</p>
                <p><span className="text-[#F2F2F0]/85">Hartzaileak.</span> Ez diegu inori lagatzen, legeak behartzen gaituenean izan ezik. Zerbitzu-hornitzaile hauek ditugu: Vercel, Mailjet, Supabase, Meta, Stripe eta Google. Horietako batzuk Europako Esparru Ekonomikotik kanpo daude, eta datuen transferentzia Europako Batzordearen kontratu-klausula tipoen babesean egiten da.</p>
                <p><span className="text-[#F2F2F0]/85">Iraupena.</span> Harreman komertzialak dirauen bitartean edo ezabatzeko eskatu arte; ondoren, legeak agindutako epeetan blokeatuta gordetzen dira. Balorazioak ekitalditik 3 urtez gordetzen dira gehienez, eta gomendatutako pertsonen datuak ezabatu egiten dira 3 hilabetean erantzunik edo interesik ez badago.</p>
                <p><span className="text-[#F2F2F0]/85">Zure eskubideak.</span> Zure datuak eskuratu, zuzendu eta ezabatu ditzakezu, eta tratamendua mugatzea, datuen eramangarritasuna eta tratamenduaren aurka egitea ere eska ditzakezu. Idatzi info@alainzulaika.com helbidera, gaian «Datuen babesa» jarrita. Erantzunarekin pozik ez bazaude, erreklamazioa aurkez dezakezu Datuak Babesteko Espainiako Agentzian (www.aepd.es).</p>
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
