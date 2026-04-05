import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Empresa",
  description:
    "Magia integrada en eventos de empresa: ferias, presentaciones de marca y celebraciones internas. Sin show, sin relleno — el elemento que hace que todo lo demás tenga peso.",
  alternates: {
    canonical: "/empresa",
    languages: { eu: "/empresa", es: "/es/empresa" },
  },
  openGraph: {
    title: "Empresa | Alain Zulaika",
    description:
      "Magia integrada en eventos de empresa: ferias, presentaciones de marca y celebraciones internas.",
    url: "/empresa",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
