"use client";

import { ALIVIO_CHECKOUT } from "@/lib/alivio";

/* ---------------------------------------------------------------------------
   Botón a la guía.

   Va directo al checkout de Whop, que es donde está subida y donde se entrega
   el acceso. Aquí no hay formulario: Whop ya pide el correo en su checkout, y
   pedirlo antes obligaba a escribirlo dos veces seguidas. El alta en la
   newsletter se hace después, desde los contactos que recoge Whop.

   Es cliente sólo por el píxel: el `track` del clic necesita el navegador.
   --------------------------------------------------------------------------- */

type Whop = { track: (evento: string, datos?: unknown) => void };

export default function BotonGuia({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={ALIVIO_CHECKOUT}
      className={className}
      onClick={() => {
        if (typeof window === "undefined") return;
        (window as unknown as { whop?: Whop }).whop?.track("add_to_cart", {
          content_name: "alivia_tu_lumbago_hoy",
        });
      }}
    >
      {children}
    </a>
  );
}
