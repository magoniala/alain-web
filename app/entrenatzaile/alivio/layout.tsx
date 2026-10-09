import type { Metadata } from "next";
import { ALIVIO_TEXTOS } from "@/lib/alivio";

export const metadata: Metadata = {
  title: `${ALIVIO_TEXTOS.hero.titular} — Entrenatzaile`,
  description: ALIVIO_TEXTOS.hero.entrada,
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/alivio",
  },
  openGraph: {
    title: ALIVIO_TEXTOS.hero.titular,
    description: ALIVIO_TEXTOS.hero.entrada,
    url: "https://entrenatzaile.alainzulaika.com/alivio",
    siteName: "Entrenatzaile",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/alivio/portada.png", width: 1024, height: 1536 }],
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
