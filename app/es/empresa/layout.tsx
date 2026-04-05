import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Empresa",
  description:
    "Magia integrada en eventos de empresa: ferias, lanzamientos, presentaciones de marca y celebraciones internas en el País Vasco.",
  alternates: {
    canonical: "/es/empresa",
    languages: { es: "/es/empresa", eu: "/empresa" },
  },
  openGraph: {
    title: "Empresa | Alain Zulaika",
    description:
      "Magia integrada en eventos de empresa: ferias, lanzamientos, presentaciones de marca y celebraciones internas.",
    url: "/es/empresa",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
