import { Header, Footer } from "../_ui";
import { PARQ_TEXTOS } from "@/lib/parq";
import FormularioParq from "./FormularioParq";

// Como /audio: una página de una sola cosa, el cuestionario.
export default function ParqPage() {
  return (
    <main className="min-h-screen bg-[#F7F1E6] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="mx-auto max-w-[680px] px-6 py-14 md:px-8 md:py-20">
        <h1 className="mb-7 font-[family-name:var(--font-fraunces)] text-[clamp(1.9rem,6vw,3rem)] leading-[1.14] font-medium tracking-[-0.02em] text-[#0F2240]">
          {PARQ_TEXTOS.titulo}
        </h1>

        <div className="mb-12 space-y-4">
          {PARQ_TEXTOS.intro.map((p, i) => (
            <p key={i} className="text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]">
              {p}
            </p>
          ))}
        </div>

        <FormularioParq />

        <p className="mt-10 text-[0.85rem] leading-[1.6] text-[#4A5C73]">{PARQ_TEXTOS.fuente}</p>
      </section>

      <Footer />
    </main>
  );
}
