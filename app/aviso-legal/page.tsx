import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal",
};

export default function AvisoLegalPage() {
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

          <p className="mb-14 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Aviso legal
          </p>

          <div className="space-y-14">

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                1. Datos identificativos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos identificativos del titular de este sitio web:
                </p>
                <div className="mt-6 space-y-2 text-[#F2F2F0]/65">
                  <p><span className="text-[#F2F2F0]/38 mr-4">Titular</span>Alain Zulaika Fuente</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">NIF</span>79187841Z</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Domicilio</span>Elgoibar, Gipuzkoa, 20870</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Correo electrónico</span>contacto@niala.es</p>
                  <p><span className="text-[#F2F2F0]/38 mr-4">Sitio web</span>www.alainzulaika.com</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                2. Objeto y condiciones de uso
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Este sitio web tiene como finalidad presentar los servicios de intervención escénica con magia para eventos corporativos y culturales ofrecidos por Alain Zulaika Fuente.
                </p>
                <p>
                  El acceso y uso de este sitio web implica la aceptación de las presentes condiciones. El titular se reserva el derecho a modificar en cualquier momento su contenido, presentación y configuración.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                3. Propiedad intelectual e industrial
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Todos los contenidos de este sitio web —textos, imágenes, diseño gráfico, código fuente y demás elementos— son propiedad de Alain Zulaika Fuente o de terceros que han autorizado expresamente su uso.
                </p>
                <p>
                  Queda prohibida su reproducción total o parcial, distribución, comunicación pública o transformación sin autorización expresa del titular.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                4. Limitación de responsabilidad
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  El titular no se responsabiliza de los daños o perjuicios que pudieran derivarse del uso de este sitio web, de errores u omisiones en su contenido, ni de la disponibilidad técnica del mismo.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                5. Legislación aplicable y jurisdicción
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Las presentes condiciones se rigen por la legislación española. Para cualquier controversia derivada del uso de este sitio web, las partes se someten a los juzgados y tribunales de Gipuzkoa, con renuncia expresa a cualquier otro fuero que pudiera corresponderles.
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
              <Link href="/aviso-legal" className="text-[#F2F2F0]/62">Aviso legal</Link>
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Privacidad</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
