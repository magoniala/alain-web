"use client";

import { useEffect } from "react";

export default function PremiosMiraPage() {
  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main id="top" className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      {/* ── 1. HERO ──────────────────────────────────────────── */}
      <section className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15 h-[230px] md:h-[302px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.75rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
              Premios Mira — 1ª Edición
            </p>

            <h1 className="hero-fade-2 max-w-[860px] text-[clamp(1.6rem,3vw,3.5rem)] font-medium leading-[1.1] tracking-[-0.025em]">
              Una lona convertida en
              <br />
              experimento, documental y campaña.
            </h1>

            <p className="hero-fade-3 mt-8 text-[clamp(1rem,1.3vw,1.15rem)] text-[#F2F2F0]/50 tracking-[0.04em]">
              El experimento de Alcalá 77
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. EL DETONANTE ──────────────────────────────────── */}
      <section className="fade-in mx-auto max-w-[1200px] px-8 py-16 md:px-16 md:py-28">
        <div className="h-px w-16 bg-white/10 mb-16" />
        <div className="max-w-[780px]">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.3em] text-[#2ED3E6]/70">
            El detonante
          </p>
          <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.025em]">
            De la lona a la calle
          </h2>

          <div className="mt-8 space-y-5 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>La lona de Alcalá 77 planteaba una afirmación directa:</p>

            <p className="border-l-2 border-[#2ED3E6]/40 pl-5 text-[#F2F2F0]/85 italic">
              "Es imposible no triunfar en esta vida con la cantidad de gilipollas que te rodean."
            </p>

            <p>
              A partir de ahí, la idea fue sencilla: llevar esa afirmación al mundo real y
              comprobar qué ocurre cuando deja de ser una frase.
            </p>

            <div className="space-y-1 text-[#F2F2F0]/60">
              <p>Convertirla en un test real.</p>
              <p>Plantearla a personas en la calle.</p>
              <p>Y observar cómo cada uno se sitúa frente a ella.</p>
            </div>

            <p>De ahí nace el experimento.</p>
          </div>
        </div>
      </section>

      {/* ── 3. LA ACCIÓN FÍSICA ──────────────────────────────── */}
      <section className="fade-in mx-auto max-w-[1200px] px-8 py-16 md:px-16 md:py-28">
        <div className="h-px w-16 bg-white/10 mb-16" />
        <div className="max-w-[780px]">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.3em] text-[#2ED3E6]/70">
            La acción física
          </p>
          <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.025em]">
            El dispositivo en la calle
          </h2>

          <div className="mt-8 space-y-5 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>
              Una parte importante del proyecto consistía en que la provocación no se quedara
              solo en el plano publicitario, sino que tuviera presencia real en la calle.
            </p>
            <p>
              Para ello diseñé y produje un dispositivo completo de acción: cartelería, elementos
              visuales, certificados y una lógica de interacción pensada para que el experimento
              tuviera tono, presencia y credibilidad propia.
            </p>
            <p>
              Todo eso no funcionaba como decoración, sino como parte del propio sistema:
              convertir la premisa en experiencia.
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-[860px]">
          <p className="mb-5 text-[0.68rem] uppercase tracking-[0.28em] text-[#F2F2F0]/50">
            Elementos del dispositivo
          </p>
          <div className="flex gap-8 items-start overflow-x-auto">
            <div>
              <img
                src="/premios-mira/cartel-experimento.png"
                alt="Diseño del cartel del experimento"
                className="h-[680px] w-auto border border-white/8"
              />
              <p className="mt-3 text-[0.82rem] text-[#F2F2F0]/38">
                Cartel de 175×110 cm para captar participantes
              </p>
            </div>
            <div>
              <img
                src="/premios-mira/certificado-experimento.png"
                alt="Diseño del certificado del experimento"
                className="h-[680px] w-auto border border-white/8"
              />
              <p className="mt-3 text-[0.82rem] text-[#F2F2F0]/38">
                Certificados de 10×7 cm para prolongar la experiencia
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. EL DOCUMENTAL ─────────────────────────────────── */}
      <section
        id="documental"
        className="fade-in mx-auto max-w-[1200px] px-8 py-16 md:px-16 md:py-28"
      >
        <div className="h-px w-16 bg-white/10 mb-16" />
        <div className="max-w-[780px]">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.3em] text-[#2ED3E6]/70">
            La pieza central
          </p>
          <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.025em]">
            El documental
          </h2>

          <div className="mt-8 space-y-5 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>El documental es el núcleo del proyecto.</p>
            <p>
              Es donde se cruzan la idea, el dispositivo, la calle y las reacciones reales.
            </p>
            <p>
              No está planteado como un resumen, sino como la forma de convertir una acción
              pública en relato, y una provocación en experiencia documentada.
            </p>
          </div>
        </div>

        {/* Embed del documental */}
        <div className="mt-12 max-w-[860px]">
          <p className="mb-4 text-[0.68rem] uppercase tracking-[0.28em] text-[#F2F2F0]/50">
            Pieza completa
          </p>
          <div className="aspect-video w-full">
            <iframe
              src="https://www.youtube.com/embed/jTBkv-by4N4?start=66"
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* ── 5. LA EXTENSIÓN DIGITAL ──────────────────────────── */}
      <section className="fade-in mx-auto max-w-[1200px] px-8 py-16 md:px-16 md:py-28">
        <div className="h-px w-16 bg-white/10 mb-16" />
        <div className="max-w-[780px]">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.3em] text-[#2ED3E6]/70">
            La extensión digital
          </p>
          <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.025em]">
            El experimento continúa online
          </h2>

          <div className="mt-8 space-y-5 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>El proyecto no termina en la calle ni en el documental.</p>
            <p>
              Para darle continuidad, construí una página específica desde la que cualquier
              persona puede participar, consultar las métricas acumuladas y seguir el experimento
              más allá del momento presencial.
            </p>
            <p>
              Esta capa digital no solo prolonga la acción:
              <br />
              la convierte en algo consultable, medible y abierto.
            </p>
            <p>
              Permite que la participación no dependa de estar físicamente en Madrid y añade una
              segunda dimensión al proyecto: la de quienes llegan después y deciden entrar
              igualmente en la propuesta.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <p className="text-[0.78rem] text-[#F2F2F0]/55 italic">
              Datos capturados en el momento de la presentación.
            </p>
            <img
              src="/premios-mira/web-experimento.png"
              alt="Página del experimento online"
              className="w-full max-w-[640px] border border-white/8"
            />
            <a
              href="/arrogante"
              target="_blank"
              className="inline-block border border-[#2ED3E6]/40 px-7 py-3.5 text-[0.85rem] tracking-[0.1em] text-[#2ED3E6]/80 transition-all duration-300 hover:bg-[#2ED3E6]/8 hover:border-[#2ED3E6] hover:text-[#2ED3E6]"
            >
              Ver la página del experimento →
            </a>
          </div>
        </div>
      </section>

      {/* ── 6. CAMPAÑA Y ALCANCE ─────────────────────────────── */}
      <section className="fade-in bg-[#0E0E10] w-full px-8 py-16 md:px-16 md:py-28">
        <div className="mx-auto max-w-[1200px]">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.3em] text-[#2ED3E6]/70">
            Campaña y alcance
          </p>
          <h2 className="max-w-[680px] text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.025em]">
            Una campaña pensada en fases
          </h2>

          <div className="mt-8 max-w-[760px] space-y-5 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/68">
            <p>El alcance del proyecto no depende del documental.</p>
            <p>
              La primera fase ha servido para mostrar el proceso y generar atención en torno al
              experimento.
            </p>
            <p>
              Pero la parte más potente no está ahí, sino en lo que ocurrió en la calle:
              <br />
              interacciones reales, registradas y preparadas para seguir generando contenido.
            </p>
            <p>A partir de aquí comienza una segunda fase centrada en ese material.</p>
            <p>
              El proyecto pasa de ser una acción puntual a convertirse en un sistema capaz de
              seguir generando piezas, relato y alcance en el tiempo.
            </p>
            <p className="text-[#F2F2F0]/85">
              La creatividad no está solo en responder a la lona, sino en construir algo que
              continúa.
            </p>
          </div>

          <p className="mt-8 max-w-[760px] text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed text-[#F2F2F0]/68">
            El volumen y la naturaleza del material hacen que esta segunda fase no sea lineal,
            sino que pueda generar picos de alcance a partir de algunas piezas.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-px bg-white/8 border border-white/8 max-w-[760px] sm:grid-cols-2">
            {[
              { label: "TikTok — fase de proceso", value: "17.000+", unit: "visualizaciones" },
              { label: "Interacciones reales", value: "50+", unit: "" },
              { label: "Piezas cortas para TikTok", value: "150+", unit: "listas para publicar" },
              { label: "Inicio segunda fase", value: "22 abr", unit: "" },
            ].map((item) => (
              <div key={item.label} className="bg-[#0B0B0C] px-7 py-7">
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[#F2F2F0]/38 mb-3">
                  {item.label}
                </p>
                <p className="text-[clamp(1.8rem,2.4vw,2.4rem)] font-medium tracking-[-0.03em] text-[#F2F2F0]">
                  {item.value}
                </p>
                <p className="text-[0.8rem] text-[#F2F2F0]/40 mt-0.5">{item.unit}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <a
              href="https://www.tiktok.com/@proyecto_2026"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.8rem] uppercase tracking-[0.18em] text-[#F2F2F0]/30 transition-colors hover:text-[#F2F2F0]/55"
            >
              Ver el proceso en TikTok →
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/6 px-8 py-10 md:px-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-[0.8rem] text-[#F2F2F0]/25">© Alain Zulaika</p>
        </div>
      </footer>
    </main>
  );
}
