import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Two Bascos — Prensa",
  description:
    "Dossier de prensa y material para programadores. Two Bascos: magia escénica contemporánea.",
  alternates: {
    canonical: "/es/twobascos-prentsa",
    languages: { es: "/es/twobascos-prentsa", eu: "/twobascos-prentsa" },
  },
  openGraph: {
    title: "Two Bascos — Prensa | Alain Zulaika",
    description:
      "Dossier de prensa y material para programadores. Two Bascos: magia escénica contemporánea.",
    url: "/es/twobascos-prentsa",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
