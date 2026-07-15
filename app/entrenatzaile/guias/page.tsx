import { getVarianteActual, GUIAS_ANUNCIADAS_EXTRA, GUIA_INFO } from "@/lib/entrenatzaile-variantes";
import GuiasClient from "./GuiasClient";

// La plantilla activa puede cambiar en cualquier momento desde
// /guias-estadisticas, así que esta página no debe cachearse estáticamente.
export const dynamic = "force-dynamic";

export default async function GuiasPage() {
  const variante = await getVarianteActual("guias");
  const bonusGuias = GUIAS_ANUNCIADAS_EXTRA[variante].map((g) => GUIA_INFO[g.file]);

  return <GuiasClient variante={variante} bonusGuias={bonusGuias} />;
}
