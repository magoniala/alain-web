import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ostalaritza",
  description:
    "Magia en directo para tabernas y bares del País Vasco. Los clientes no solo vuelven: traen a otros y cuentan lo que vieron.",
  alternates: {
    canonical: "/hosteleria",
    languages: { eu: "/hosteleria", es: "/es/hosteleria" },
  },
  openGraph: {
    title: "Ostalaritza | Alain Zulaika",
    description:
      "Magia en directo para tabernas y bares. Los clientes vuelven, lo cuentan y traen a otros.",
    url: "/hosteleria",
    locale: "eu_EU",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
