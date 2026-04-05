import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hostelería",
  description:
    "Magia en directo para bares y restaurantes del País Vasco. Los clientes vuelven, lo cuentan y traen a otros.",
  alternates: {
    canonical: "/es/hosteleria",
    languages: { es: "/es/hosteleria", eu: "/hosteleria" },
  },
  openGraph: {
    title: "Hostelería | Alain Zulaika",
    description:
      "Magia en directo para bares y restaurantes. Los clientes vuelven, lo cuentan y traen a otros.",
    url: "/es/hosteleria",
    locale: "es_ES",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
