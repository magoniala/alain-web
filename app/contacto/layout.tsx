import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontaktua",
  description:
    "Cuéntame qué tienes en mente. En diez minutos sabemos si tiene encaje.",
  alternates: {
    canonical: "/contacto",
    languages: { eu: "/contacto", es: "/es/contacto" },
  },
  openGraph: {
    title: "Kontaktua | Alain Zulaika",
    description: "Cuéntame qué tienes en mente. En diez minutos sabemos si tiene encaje.",
    url: "/contacto",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
