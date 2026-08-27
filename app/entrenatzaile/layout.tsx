import Consentimiento from "../_components/Consentimiento";

// Banner de consentimiento y píxel de Meta, SOLO en Entrenatzaile.
//
// Los anuncios apuntan a entrenatzaile.alainzulaika.com, así que es aquí
// donde hay algo que medir. En las páginas de magia el píxel no aportaría
// nada y el banner sería una molestia gratuita — y además guardar datos que
// no se usan es justo lo que la ley pide no hacer.
export default function EntrenatzaileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Consentimiento pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
    </>
  );
}
