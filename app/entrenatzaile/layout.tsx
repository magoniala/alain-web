import { Fraunces } from "next/font/google";

/* Fraunces es la tipografía de titulares de todo el subdominio. Se carga aquí
   arriba, y no en cada landing, para que todas compartan la misma: antes cada
   página declaraba la suya por su cuenta y /guias y /valoracion no tenían
   ninguna, así que sus titulares salían en la fuente del cuerpo. */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export default function EntrenatzaileLayout({ children }: { children: React.ReactNode }) {
  return <div className={fraunces.variable}>{children}</div>;
}
