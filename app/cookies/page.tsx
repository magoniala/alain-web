import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies",
};

export default function CookiesPage() {
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
            Política de cookies
          </p>

          <div className="space-y-14">

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                1. ¿Qué son las cookies?
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Las cookies son pequeños archivos de texto que un sitio web almacena en tu dispositivo cuando lo visitas. Permiten que el sitio recuerde información sobre tu visita para mejorar tu experiencia.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                2. Cookies que utilizamos
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Este sitio web utiliza únicamente cookies técnicas necesarias para su funcionamiento correcto. No se utilizan cookies de seguimiento, publicidad ni analítica de terceros.
                </p>
                <div className="mt-4 border border-white/10 p-5 space-y-4">
                  <div>
                    <p className="text-[#F2F2F0]/85 mb-1">Cookies de sesión</p>
                    <p className="text-[0.92rem] text-[#F2F2F0]/50">Necesarias para el funcionamiento básico del sitio. Se eliminan al cerrar el navegador. No recogen información personal.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                3. Cómo gestionar las cookies
              </p>
              <div className="space-y-4 text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Puedes configurar tu navegador para rechazar o eliminar cookies en cualquier momento. Ten en cuenta que deshabilitar las cookies técnicas puede afectar al funcionamiento del sitio.
                </p>
                <div className="mt-2 space-y-2 text-[#F2F2F0]/55">
                  <p><span className="text-[#F2F2F0]/38 mr-3">Chrome</span>Configuración → Privacidad y seguridad → Cookies</p>
                  <p><span className="text-[#F2F2F0]/38 mr-3">Firefox</span>Configuración → Privacidad y seguridad</p>
                  <p><span className="text-[#F2F2F0]/38 mr-3">Safari</span>Preferencias → Privacidad</p>
                  <p><span className="text-[#F2F2F0]/38 mr-3">Edge</span>Configuración → Privacidad, búsqueda y servicios</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.78rem] uppercase tracking-[0.16em] text-[#F2F2F0]/38">
                4. Contacto
              </p>
              <div className="text-[clamp(1.05rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
                <p>
                  Para cualquier consulta sobre el uso de cookies en este sitio, puedes escribir a <span className="text-[#F2F2F0]/85">contacto@niala.es</span>.
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
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Privacidad</Link>
              <Link href="/cookies" className="text-[#F2F2F0]/62">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
