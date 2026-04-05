import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eguzkilore",
  description:
    "Una moneda que crece ante los ojos. El regalo que nadie espera y todos recuerdan.",
  alternates: {
    canonical: "/es/eguzkilore",
    languages: { es: "/es/eguzkilore", eu: "/eguzkilore" },
  },
  openGraph: {
    title: "Eguzkilore | Alain Zulaika",
    description: "Una moneda que crece ante los ojos. El regalo que nadie espera y todos recuerdan.",
    url: "/es/eguzkilore",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
