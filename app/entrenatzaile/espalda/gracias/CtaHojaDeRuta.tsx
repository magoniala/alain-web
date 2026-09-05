"use client";

// Enlace a la Hoja de Ruta que, además de llevar, deja constancia del clic
// en la medición interna. Es el último escalón del embudo de /espalda:
// hasta aquí llega quien, después de pedir la ficha, va a por la llamada.
//
// La sesión llega por la URL desde el formulario. Sin ella no se registra
// nada: quien entra a /gracias a pelo no tiene ningún recorrido al que
// engancharse, y una sesión inventada aquí solo serviría para inflar el
// total de visitas del embudo con gente que nunca vio la landing.
export default function CtaHojaDeRuta({
  href,
  className,
  sesion,
  children,
}: {
  href: string;
  className?: string;
  sesion?: string;
  children: React.ReactNode;
}) {
  function marcar() {
    if (!sesion) return;
    // A ciegas y sin esperar, como el resto de la medición: esto no puede
    // retrasar ni un milisegundo la navegación. keepalive para que el
    // evento salga aunque el navegador ya esté yéndose.
    try {
      fetch("/api/entrenatzaile/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landing: "espalda", sesion, evento: "hoja_ruta_click" }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Silencio absoluto.
    }
  }

  return (
    <a href={href} className={className} onClick={marcar}>
      {children}
    </a>
  );
}
