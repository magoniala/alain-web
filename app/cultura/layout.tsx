import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kultura",
  description:
    "Magia escénica para festivales, teatros y espacios culturales. Propuestas para programadores y gestores culturales en Euskal Herria.",
  alternates: {
    canonical: "/cultura",
    languages: { eu: "/cultura", es: "/es/cultura" },
  },
  openGraph: {
    title: "Kultura | Alain Zulaika",
    description:
      "Magia escénica para festivales, teatros y espacios culturales en Euskal Herria.",
    url: "/cultura",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
