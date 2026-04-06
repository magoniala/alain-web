import type { Metadata } from "next";

export const metadata: Metadata = {
  description:
    "Magia escénica para eventos de empresa, hostelería y cultura en el País Vasco.",
  openGraph: {
    siteName: "Alain Zulaika",
    images: [{ url: "/og.jpg", width: 1200, height: 600, alt: "Alain Zulaika" }],
    locale: "es_ES",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
