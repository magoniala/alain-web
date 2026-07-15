import type { Metadata } from "next";
import { getVarianteActual } from "@/lib/entrenatzaile-variantes";
import { GUIAS_CONTENIDO } from "./_content";

export async function generateMetadata(): Promise<Metadata> {
  const variante = await getVarianteActual("guias");
  const { heroTitulo, heroSubtitulo } = GUIAS_CONTENIDO[variante];
  const title = `${heroTitulo} — Entrenatzaile`;

  return {
    title,
    description: heroSubtitulo,
    alternates: {
      canonical: "https://entrenatzaile.alainzulaika.com/guias",
    },
    openGraph: {
      title,
      description: heroSubtitulo,
      url: "https://entrenatzaile.alainzulaika.com/guias",
      siteName: "Entrenatzaile",
      locale: "es_ES",
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
