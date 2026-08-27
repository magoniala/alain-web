"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

// Banner de consentimiento y píxel de Meta.
//
// El píxel NO se carga hasta que la persona acepta. Esa es la única forma de
// usarlo aquí sin exponerse: en la UE el seguimiento publicitario necesita
// permiso previo, y "rechazar" tiene que costar lo mismo que "aceptar" — por
// eso los dos botones pesan igual y no hay ninguna cruz escondida.
//
// La decisión se guarda en una cookie (no en localStorage) porque el
// servidor también la necesita: los envíos a Meta desde el backend se hacen
// solo si esa cookie dice que sí.

const COOKIE = "consentimiento";
const UN_ANIO = 60 * 60 * 24 * 365;

type Decision = "aceptado" | "rechazado" | null;

function leerDecision(): Decision {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(aceptado|rechazado)`));
  return (m?.[1] as Decision) ?? null;
}

function guardarDecision(valor: Exclude<Decision, null>) {
  document.cookie = `${COOKIE}=${valor}; path=/; max-age=${UN_ANIO}; SameSite=Lax`;
}

export default function Consentimiento({
  pixelId,
  preguntar = false,
}: {
  pixelId?: string;
  /**
   * Si es true, se pregunta a quien no haya decidido todavía.
   *
   * Solo se pregunta en la landing de entrada, que es por donde llega el
   * tráfico de anuncios. En el resto de páginas el componente sigue puesto
   * —para cargar el píxel a quien YA aceptó— pero no vuelve a preguntar:
   * quien viene del embudo ya respondió, y a quien llega por otra vía no se
   * le mide nada, que es justo lo que debe pasar sin permiso.
   */
  preguntar?: boolean;
}) {
  // Un solo estado: hasta que no se ha leído la cookie no se sabe nada, y
  // las dos cosas cambian a la vez.
  const [estado, setEstado] = useState<{ montado: boolean; decision: Decision }>({
    montado: false,
    decision: null,
  });

  // La cookie solo existe en el navegador, así que hay que leerla después de
  // hidratar. Se hace aquí, y no leyéndola en el layout del servidor, porque
  // eso obligaría a renderizar TODA la web de forma dinámica solo para saber
  // si hay que pintar un banner.
  //
  // La alternativa sin efecto (useSyncExternalStore) haría aparecer el banner
  // durante un fotograma a quien ya respondió, que es peor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado({ montado: true, decision: leerDecision() });
  }, []);

  function decidir(valor: Exclude<Decision, null>) {
    guardarDecision(valor);
    setEstado({ montado: true, decision: valor });
  }

  // Hasta saber qué decidió, no se pinta nada: evita que el banner parpadee
  // en cada carga a quien ya respondió.
  if (!estado.montado) return null;

  const acepto = estado.decision === "aceptado";

  return (
    <>
      {acepto && pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}

      {preguntar && estado.decision === null && (
        <div
          role="dialog"
          aria-label="Consentimiento de cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-[#0B0B0C]/95 px-5 py-4 backdrop-blur md:px-8"
        >
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* La palabra "anuncios" no es decorativa: son cookies
                publicitarias de Meta, y describirlas como simple medición
                ("saber qué atrae gente") es la vaguedad por la que se
                sanciona a estos banners. Con "anuncios" en la frase, el
                propósito queda claro sin tener que soltar la etiqueta
                "cookies de publicidad", que suena a aviso legal. */}
            <p className="text-[0.92rem] leading-relaxed text-[#F2F2F0]/80">
              Uso cookies para saber qué anuncios traen gente y qué estoy haciendo para nada. Ni te
              sigo por otras webs, ni vendo tus datos.{" "}
              <Link href="/cookies" className="underline underline-offset-4 hover:text-[#F2F2F0]">
                Qué guardo exactamente
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decidir("rechazado")}
                className="border border-white/25 px-5 py-2.5 text-[0.88rem] text-[#F2F2F0]/85 transition-colors hover:border-white/50"
              >
                No, gracias
              </button>
              <button
                type="button"
                onClick={() => decidir("aceptado")}
                className="border border-white/25 bg-[#F2F2F0] px-5 py-2.5 text-[0.88rem] text-[#0B0B0C] transition-colors hover:bg-white"
              >
                Vale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Manda un evento por el píxel del navegador, si está cargado.
 *
 * El `eventId` tiene que ser el MISMO que use el envío desde el servidor: es
 * lo que permite a Meta darse cuenta de que las dos señales son la misma
 * conversión y no contarla dos veces.
 */
export function eventoPixel(nombre: string, eventId: string) {
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq === "function") fbq("track", nombre, {}, { eventID: eventId });
}
