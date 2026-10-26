import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { TOKEN_RE, esIdioma, esTipo, type Idioma, type TipoEvento } from "@/lib/quetal";
import FormularioQuetal, { type Inicial } from "./FormularioQuetal";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Con token, el formulario sale relleno con los datos del enlace y solo con
// las preguntas de su tipo de evento. Sin token, o con uno que no existe, se
// pide todo a mano: nunca un error en la cara de quien viene a ayudarme.
//
// Idioma: el del enlace; sin enlace, la cookie `lang` que pone proxy.ts; y si
// tampoco, euskera, que es el idioma por defecto del sitio.
export default async function QuetalPage({ searchParams }: { searchParams: Busqueda }) {
  const params = await searchParams;
  const token = primero(params.t);
  const lang = (await cookies()).get("lang")?.value;
  const idiomaCookie: Idioma = esIdioma(lang) ? lang : "eu";

  let inicial: Inicial = { idioma: idiomaCookie, nombre: "", entidad: "", nombreEvento: "", fecha: "", respondido: false };

  if (token && TOKEN_RE.test(token)) {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const { data: link } = await supabase
      .from("feedback_links")
      .select("id, tipo_evento, nombre_evento, fecha_evento, entidad, contacto_nombre, idioma, usado")
      .eq("token", token)
      .maybeSingle();

    if (link && esTipo(link.tipo_evento)) {
      // Si se guardó la respuesta pero no llegó a marcarse el enlace, cuenta
      // como respondido igual.
      let respondido = Boolean(link.usado);
      if (!respondido) {
        const { count } = await supabase
          .from("feedback_organizadores")
          .select("id", { count: "exact", head: true })
          .eq("link_id", link.id);
        respondido = (count ?? 0) > 0;
      }
      inicial = {
        token,
        tipo: link.tipo_evento as TipoEvento,
        idioma: esIdioma(link.idioma) ? link.idioma : idiomaCookie,
        nombre: link.contacto_nombre ?? "",
        entidad: link.entidad ?? "",
        nombreEvento: link.nombre_evento ?? "",
        fecha: link.fecha_evento ?? "",
        respondido,
      };
    }
  }

  return <FormularioQuetal inicial={inicial} resenaUrl={process.env.GOOGLE_REVIEW_URL?.trim() || ""} />;
}
