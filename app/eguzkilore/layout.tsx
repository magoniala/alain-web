import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eguzkilore",
  description:
    "Una moneda que crece ante los ojos. El regalo que nadie espera y todos recuerdan.",
  alternates: {
    canonical: "/eguzkilore",
    languages: { eu: "/eguzkilore", es: "/es/eguzkilore" },
  },
  openGraph: {
    title: "Eguzkilore | Alain Zulaika",
    description: "Una moneda que crece ante los ojos. El regalo que nadie espera y todos recuerdan.",
    url: "/eguzkilore",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
