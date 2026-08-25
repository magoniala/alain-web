import { Lora } from "next/font/google";

// Solo la fuente. Los metadatos viven en page.tsx porque dependen de
// ?ventana=1, y un layout no recibe los parámetros de búsqueda.
const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={lora.variable}>{children}</div>;
}
