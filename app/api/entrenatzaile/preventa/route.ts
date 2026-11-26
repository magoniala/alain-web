import { NextResponse } from "next/server";
import { crearCheckout, ofertaParaEmail, reenviarEnlace, registrarDesistimiento } from "@/lib/preventa";
import { infoPrevia } from "@/lib/preventa-textos";
import { normalizarEmail, type Idioma } from "@/lib/preventa-reglas";

// API pública de la preventa de las masterclasses (landing /masterclass y /es/masterclass).
//
//   resumen      → qué puede comprar este correo hoy y lo que se le enseña antes de pagar
//   pagar        → crea la sesión de Stripe Checkout y devuelve su URL
//   enlace       → reenvía el enlace de acceso a los vídeos (si tiene compra)
//   desistir     → formulario de desistimiento
//
// Qué se vende y a qué precio lo decide SIEMPRE el servidor (fecha + compras
// del correo): el navegador solo manda el correo.

const BASE_ENTRENATZAILE = "https://entrenatzaile.alainzulaika.com";

function baseDeRetorno(req: Request): { base: string; prefijo: string } {
  const origen = req.headers.get("origin") ?? "";
  if (/^http:\/\/localhost:\d+$/.test(origen)) return { base: origen, prefijo: "/entrenatzaile" };
  return { base: BASE_ENTRENATZAILE, prefijo: "" };
}

function emailValido(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = normalizarEmail(e);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200 ? v : null;
}

const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "peticion" }, { status: 400 });
  }
  const idioma: Idioma = b.idioma === "eu" ? "eu" : "es";
  const email = emailValido(b.email);
  if (!email) return NextResponse.json({ error: "email" }, { status: 400 });

  try {
    switch (b.accion) {
      case "resumen": {
        const { oferta } = await ofertaParaEmail(email);
        return NextResponse.json({
          oferta,
          info: oferta.tipo === "comprar" ? infoPrevia(oferta.producto, oferta.importe_cent, idioma) : [],
        });
      }
      case "pagar": {
        const r = await crearCheckout({
          email,
          nombre: texto(b.nombre, 120),
          idioma,
          newsletter: b.newsletter === true,
          retorno: baseDeRetorno(req),
        });
        if ("url" in r) return NextResponse.json({ url: r.url });
        return NextResponse.json(r, { status: r.error === "interno" || r.error === "stripe" ? 500 : 409 });
      }
      case "enlace": {
        await reenviarEnlace(email, idioma).catch((e) => console.error("preventa: reenvío de enlace fallido:", e));
        return NextResponse.json({ ok: true });
      }
      case "desistir": {
        await registrarDesistimiento({ email, nombre: texto(b.nombre, 120), mensaje: texto(b.mensaje, 2000), idioma });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "accion" }, { status: 400 });
    }
  } catch (err) {
    console.error("preventa API:", err);
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
