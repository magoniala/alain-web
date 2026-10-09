import { Header, Footer } from "../_ui";
import { AUDIO_TEXTOS } from "@/lib/audio-formularios";
import FormularioAudio from "./FormularioAudio";

// Una página de una sola cosa: el formulario. Sin cuerpo de venta, sin
// secciones y sin segundo formulario al final — quien llega aquí ya ha
// comprado el kit y viene a rellenarlo, no a decidir si le interesa.
export default function AudioPage() {
  return (
    <main className="min-h-screen bg-[#F7F1E6] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="mx-auto max-w-[680px] px-6 py-14 md:px-8 md:py-20">
        <h1 className="mb-7 font-[family-name:var(--font-fraunces)] text-[clamp(1.9rem,6vw,3rem)] leading-[1.14] font-medium tracking-[-0.02em] text-[#0F2240]">
          {AUDIO_TEXTOS.titulo}
        </h1>

        <div className="mb-12 space-y-4">
          {AUDIO_TEXTOS.intro.map((p, i) => (
            <p key={i} className="text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]">
              {p}
            </p>
          ))}
        </div>

        <FormularioAudio />
      </section>

      <Footer />
    </main>
  );
}
