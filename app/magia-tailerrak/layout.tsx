import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Magia-tailerrak · Niala magoa",
  description: "Sekretu handiak mago txikientzat: liburutxoetako jolasak bideoan, eta opari bat.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
