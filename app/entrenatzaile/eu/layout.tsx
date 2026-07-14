import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doako balorazioa zure aldaketa fisikorako — Entrenatzaile",
  description:
    "Zure aldaketa fisikorako mapa pertsonalizatua: zer lehenetsi, zer saihestu, zer espero 3 eta 12 hilabetera. Hasierako balorazio doakoa lehen 10 pertsonentzat.",
  alternates: {
    canonical: "/",
    languages: { eu: "/", es: "/es" },
  },
  openGraph: {
    title: "Doako balorazioa zure aldaketa fisikorako — Entrenatzaile",
    description:
      "Zure aldaketa fisikorako mapa pertsonalizatua: zer lehenetsi, zer saihestu, zer espero 3 eta 12 hilabetera.",
    locale: "eu_EU",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
