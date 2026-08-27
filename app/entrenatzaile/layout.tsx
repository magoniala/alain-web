import Consentimiento from "../_components/Consentimiento";

// Píxel de Meta en Entrenatzaile, sin preguntar nada.
//
// Aquí el componente solo sirve para cargar el píxel a quien YA aceptó en la
// landing de entrada, de forma que se le pueda medir la reserva. Preguntar,
// se pregunta una sola vez y en /espalda.
//
// En las páginas de magia no va nada de esto: el píxel no mediría nada y el
// banner sería una molestia gratuita.
export default function EntrenatzaileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Consentimiento pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
    </>
  );
}
