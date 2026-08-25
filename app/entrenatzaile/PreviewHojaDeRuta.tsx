"use client";

import { useEffect, useRef } from "react";

// Bloque visual del entregable: la portada y una página interior de la Hoja
// de Ruta en abanico, y debajo un recorte legible de la tabla de valoración.
// Reutilizable en cualquiera de las landings de Entrenatzaile.
//
// Los estilos viven en app/globals.css (clases hr-*), que es donde este
// proyecto guarda sus keyframes y su política de movimiento reducido.
//
// El seguimiento del puntero es mejora progresiva: si el JS no corre, la
// pila se queda en su posición inclinada de reposo y se ve igual de bien.

export default function PreviewHojaDeRuta({
  pie = "Esto es una parte. La tuya tendrá unas 9 páginas, con tu nombre y tu caso.",
  className = "",
}: {
  pie?: string;
  className?: string;
}) {
  const escenaRef = useRef<HTMLDivElement>(null);
  const pilaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Solo con ratón de verdad: en táctil no hay puntero que seguir, y en
    // movimiento reducido no se toca la animación.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const escena = escenaRef.current;
    const pila = pilaRef.current;
    if (!escena || !pila) return;

    const onMove = (e: MouseEvent) => {
      const r = escena.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      // Se pausa la flotación mientras se interactúa, en vez de anularla:
      // así se queda donde está y no pega un salto al volver a cero.
      escena.style.animationPlayState = "paused";
      pila.style.transform = `rotateY(${-7 + x * 10}deg) rotateX(${3 - y * 8}deg)`;
    };
    const onLeave = () => {
      pila.style.transform = "rotateY(-7deg) rotateX(3deg)";
      escena.style.animationPlayState = "";
    };

    escena.addEventListener("mousemove", onMove);
    escena.addEventListener("mouseleave", onLeave);
    return () => {
      escena.removeEventListener("mousemove", onMove);
      escena.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className={`w-full ${className}`}>
      <div className="hr-escena" ref={escenaRef}>
        <div className="hr-pila" ref={pilaRef}>
          {/* <img> normal y no next/image: son WebP ya optimizados (40 y 115
              KB) y la pila depende de position/transform propios, que el
              wrapper de next/image complicaría sin ganar nada.
              Los width/height se mantienen para que no haya salto de layout. */}
          {/* eslint-disable @next/next/no-img-element */}
          <img
            className="hr-pagina hr-anexo"
            src="/anexo-preview.webp"
            alt=""
            width={900}
            height={1273}
          />
          <img
            className="hr-pagina hr-portada"
            src="/portada-preview.webp"
            alt="Portada de la Hoja de Ruta"
            width={900}
            height={1273}
          />
        </div>
      </div>

      <figure className="hr-detalle">
        <img
          src="/anexo-detalle-movilidad.webp"
          alt="Detalle de la tabla de movilidad de la Hoja de Ruta"
          width={1000}
          height={322}
        />
        {/* eslint-enable @next/next/no-img-element */}
        <figcaption>{pie}</figcaption>
      </figure>
    </div>
  );
}
