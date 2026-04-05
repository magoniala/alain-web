import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Cuéntame qué tienes en mente. En diez minutos sabemos si encaja.",
  alternates: {
    canonical: "/es/contacto",
    languages: { es: "/es/contacto", eu: "/contacto" },
  },
  openGraph: {
    title: "Contacto | Alain Zulaika",
    description: "Cuéntame qué tienes en mente. En diez minutos sabemos si encaja.",
    url: "/es/contacto",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
