import type { Metadata } from "next";

// noindex: a esta página se llega por el enlace que mando después de cada
// evento, no por Google.
export const metadata: Metadata = {
  title: { absolute: "Nola joan zen? — Alain Zulaika" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
