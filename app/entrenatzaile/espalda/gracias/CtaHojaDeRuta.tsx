"use client";

import { eventoPixel } from "@/app/_components/Consentimiento";

// Enlace a la Hoja de Ruta que además avisa a Meta de que este lead ha ido
// más allá de pedir la ficha.
//
// Este evento es para MEDIR, no para optimizar: a este volumen nunca va a
// tener las conversiones semanales que Meta necesita para aprender. Sirve
// para saber qué porcentaje de leads llega hasta aquí.
export default function CtaHojaDeRuta({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => eventoPixel("ViewContent", crypto.randomUUID())}
    >
      {children}
    </a>
  );
}
