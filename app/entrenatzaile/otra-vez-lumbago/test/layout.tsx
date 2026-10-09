import type { Metadata } from "next";

// noindex: el test no es una puerta de entrada desde Google, es el último
// recurso de quien ya está en la landing y no se decide.
export const metadata: Metadata = {
  title: "Test rápido para personas con dolor lumbar — Entrenatzaile",
  description:
    "Tres preguntas para saber si el KIT · Otra vez lumbago encaja con tu caso.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "https://entrenatzaile.alainzulaika.com/otra-vez-lumbago/test",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
