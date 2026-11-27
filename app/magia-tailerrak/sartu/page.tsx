// Entrar en la plataforma de magia desde otro dispositivo (email → código).
// Server: lee el idioma (cookie `lang`) y pinta el formulario de cliente.
import { hizkuntza } from "@/lib/magia-plataforma";
import Oina from "../_components/Oina";
import SartuOrria from "./SartuOrria";

export const dynamic = "force-dynamic";

export default async function Sartu() {
  const h = await hizkuntza();
  return <SartuOrria h={h} oina={<Oina h={h} />} />;
}
