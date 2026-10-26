import { Header, Footer } from "../_ui";
import { ACOMPANAMIENTO_TEXTOS } from "@/lib/acompanamiento";
import { getPlazasLibres } from "@/lib/acompanamiento-config";
import FormularioAcompanamiento from "./FormularioAcompanamiento";
import AvisoPlazas from "./AvisoPlazas";

// El contador se cambia desde /admin y tiene que verse al momento.
export const dynamic = "force-dynamic";

// Sin precio, sin duración y sin cuerpo de venta: todo eso va en el
// presupuesto que le mando por WhatsApp. La página solo recoge lo que necesito para escribirle.
export default async function AcompanamientoPage() {
  const plazas = await getPlazasLibres();
  const abiertas = plazas > 0;

  return (
    <main className="min-h-screen bg-[#F7F1E6] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="mx-auto max-w-[680px] px-6 py-14 md:px-8 md:py-20">
        <h1 className="mb-7 font-[family-name:var(--font-fraunces)] text-[clamp(1.9rem,6vw,3rem)] leading-[1.14] font-medium tracking-[-0.02em] text-[#0F2240]">
          {abiertas ? ACOMPANAMIENTO_TEXTOS.titulo : ACOMPANAMIENTO_TEXTOS.cubiertasTitulo}
        </h1>

        {abiertas && (
          <p className="mb-6 text-[0.75rem] uppercase tracking-[0.16em] text-[#C47800]">
            Plazas libres: {plazas}
          </p>
        )}

        <div className="mb-12 space-y-4">
          {(abiertas ? ACOMPANAMIENTO_TEXTOS.intro : ACOMPANAMIENTO_TEXTOS.cubiertasIntro).map((p, i) => (
            <p key={i} className="text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]">
              {p}
            </p>
          ))}
        </div>

        {abiertas && (
          <div className="mb-12">
            <h2 className="mb-4 text-[0.75rem] uppercase tracking-[0.16em] text-[#C47800]">
              {ACOMPANAMIENTO_TEXTOS.comoFuncionaTitulo}
            </h2>
            <ol className="list-decimal space-y-2 pl-6 text-[1.05rem] leading-[1.7] text-[#0F2240]/80 marker:text-[#C47800] md:text-[1.12rem]">
              {ACOMPANAMIENTO_TEXTOS.comoFunciona.map((paso, i) => (
                <li key={i}>{paso}</li>
              ))}
            </ol>
          </div>
        )}

        {abiertas ? <FormularioAcompanamiento /> : <AvisoPlazas />}
      </section>

      <Footer />
    </main>
  );
}
