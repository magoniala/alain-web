import type { Metadata } from "next";
import { TESTUAK } from "@/lib/magia-hizkuntza";
import { hizkuntza } from "@/lib/magia-plataforma";

export async function generateMetadata(): Promise<Metadata> {
  const t = TESTUAK[await hizkuntza()];
  return { title: `Magia-tailerrak · ${t.izena}`, description: t.metaDeskribapena };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
