import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Two Bascos — Prentsa",
  description:
    "Dossier de prensa y material para programadores. Two Bascos: magia escénica contemporánea en euskara.",
  alternates: {
    canonical: "/twobascos-prentsa",
    languages: { eu: "/twobascos-prentsa", es: "/es/twobascos-prentsa" },
  },
  openGraph: {
    title: "Two Bascos — Prentsa | Alain Zulaika",
    description:
      "Dossier de prensa y material para programadores. Two Bascos: magia escénica en euskara.",
    url: "/twobascos-prentsa",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
