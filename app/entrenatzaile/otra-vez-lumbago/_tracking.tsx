"use client";

import { useEffect } from "react";

// El píxel de Whop ya lo carga el layout raíz (cuenta biz_pvD09VuWBli5OP) y
// manda el `page` de cada vista. Aquí sólo se replican los eventos de
// producto que la tienda de Whop dispara en esta misma landing, para que las
// dos versiones cuenten igual.
type Whop = { track: (evento: string, datos?: unknown) => void };

const VALOR = { value: 24.19, currency: "EUR" };

function track(evento: string, datos?: unknown) {
  if (typeof window === "undefined") return;
  (window as unknown as { whop?: Whop }).whop?.track(evento, datos);
}

/** `view_content` al abrir la página, y `complete_registration` si se vuelve
 *  del checkout con el pago hecho. */
export function VistaKit() {
  useEffect(() => {
    track("view_content", VALOR);

    const params = new URLSearchParams(window.location.search);
    const estado = params.get("checkout_status") || params.get("status");
    if (
      estado === "success" ||
      estado === "succeeded" ||
      estado === "paid"
    ) {
      const pago = params.get("payment") || params.get("payment_id");
      track(
        "complete_registration",
        pago ? { event_id: `complete_registration:${pago}` } : undefined,
      );
    }
  }, []);

  return null;
}

/** Enlace que avisa al píxel antes de salir. */
export function EnlaceTrackeado({
  href,
  evento,
  conValor = false,
  className,
  children,
}: {
  href: string;
  evento: string;
  conValor?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => track(evento, conValor ? VALOR : undefined)}
    >
      {children}
    </a>
  );
}
