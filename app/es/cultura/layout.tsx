import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cultura",
  description:
    "Magia escénica para festivales, teatros y espacios culturales en el País Vasco. Propuestas para programadores y gestores culturales.",
  alternates: {
    canonical: "/es/cultura",
    languages: { es: "/es/cultura", eu: "/cultura" },
  },
  openGraph: {
    title: "Cultura | Alain Zulaika",
    description:
      "Magia escénica para festivales, teatros y espacios culturales en el País Vasco.",
    url: "/es/cultura",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
