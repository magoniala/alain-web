// Páginas de la preventa de las masterclasses (castellano y euskera).
// Las rutas son finas: app/entrenatzaile/masterclass/** (euskera) y
// app/entrenatzaile/es/masterclass/** (castellano) solo llaman a esto.
// En el subdominio se ven en entrenatzaile.alainzulaika.com/masterclass y /es/masterclass.

import Image from "next/image";
import Link from "next/link";
import { CONTENIDO } from "./_contenido";
import CompraForm from "./CompraForm";
import { DesistimientoForm, EnlaceForm } from "./FormulariosSimples";
import { ahora, enlaceAcceso, firmaValida, videosDe, yaHayTres } from "@/lib/preventa";
import { FECHAS, faseEn, NOMBRE, type Fase, type Idioma } from "@/lib/preventa-reglas";
import { AVISO_SALUD, DATOS, DESISTIMIENTO, MODELO_DESISTIMIENTO, fechaLarga, rutaPreventa } from "@/lib/preventa-textos";
import { AMBER, CARD, LINE, NAVY, PAPER, cardStyle, emphasisP, proseP, sectionTitle } from "../_ui";

type Pagina = "" | "gracias" | "desistimiento" | "acceso";

function Marco({ idioma, pagina, children }: { idioma: Idioma; pagina: Pagina; children: React.ReactNode }) {
  const activo: React.CSSProperties = { color: AMBER, background: "rgba(196,120,0,0.08)" };
  const inactivo: React.CSSProperties = { color: "rgba(15,34,64,0.55)" };
  const otra = (l: Idioma) => rutaPreventa(l, pagina === "acceso" ? "" : pagina);
  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: NAVY }}>
      <header className="border-b border-[#E0D4C0] px-6 py-4 md:px-16">
        <div className="mx-auto flex max-w-[860px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/entrenatzaile-logo.png" alt="" width={34} height={27} priority />
            <p className="text-[0.82rem] uppercase tracking-[0.1em] text-[#C47800] md:text-[0.9rem] md:tracking-[0.3em]">Entrenatzaile</p>
          </div>
          <div className="flex items-center border border-[#0F2240]/20 text-[0.75rem] tracking-[0.1em]">
            <Link href={otra("eu")} style={idioma === "eu" ? activo : inactivo} className="px-2.5 py-1.5">
              EUS
            </Link>
            <span className="w-px self-stretch bg-[#0F2240]/15" />
            <Link href={otra("es")} style={idioma === "es" ? activo : inactivo} className="px-2.5 py-1.5">
              ES
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-6 py-14 md:px-10 md:py-20">{children}</main>
      <footer className="border-t border-[#E0D4C0] px-6 py-10 md:px-16">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 text-[0.88rem] text-[#4A5C73] md:flex-row md:items-center md:justify-between">
          <p>© Alain Zulaika · contacto@alainzulaika.com</p>
          <div className="flex gap-5">
            <Link href={rutaPreventa(idioma, "desistimiento")}>{idioma === "es" ? "Desistimiento" : "Atzera egitea"}</Link>
            <Link href="/privacidad">{CONTENIDO[idioma].privacidad}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const h2 = { ...sectionTitle, fontSize: "clamp(1.4rem,2.2vw,1.8rem)", marginBottom: "1.1rem" };
const seccion: React.CSSProperties = { marginBottom: "3.2rem" };
const peq: React.CSSProperties = { fontSize: "0.92rem", lineHeight: 1.7, color: "rgba(15,34,64,0.78)", marginBottom: "0.8rem" };

function BloqueDesistimiento({ idioma }: { idioma: Idioma }) {
  const d = DESISTIMIENTO[idioma];
  return (
    <section id="devolucion" style={seccion}>
      <h2 style={h2}>{d.titulo}</h2>
      {d.parrafos.map((p, i) => (
        <p key={i} style={peq}>
          {p}
        </p>
      ))}
      <p style={peq}>
        <Link href={rutaPreventa(idioma, "desistimiento")} style={{ textDecoration: "underline" }}>
          {idioma === "es" ? "Formulario de desistimiento" : "Atzera egiteko formularioa"}
        </Link>
      </p>
      <details style={{ ...peq, marginTop: "0.6rem" }}>
        <summary style={{ cursor: "pointer" }}>{CONTENIDO[idioma].modelo}</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: "0.8rem", padding: "1rem", border: `1px solid ${LINE}`, background: CARD, borderRadius: "0.5rem" }}>
          {MODELO_DESISTIMIENTO[idioma]}
        </pre>
      </details>
    </section>
  );
}

/**
 * La landing. `faseVista` deja ver la página de una fase antes de tiempo
 * (?fase=B o ?fase=A) para revisarla y para las compras de prueba de Alain;
 * quién puede pagar lo sigue decidiendo el servidor por fecha y correo.
 */
export async function Landing({ idioma, faseVista }: { idioma: Idioma; faseVista?: string }) {
  const c = CONTENIDO[idioma];
  const real = faseEn(ahora());
  const fase: Fase = (real === "antes" || real === "cerrada") && (faseVista === "A" || faseVista === "B") ? faseVista : real;
  const tres = fase === "A" || fase === "B" ? await yaHayTres() : { A: false, B: false };

  if (fase === "antes" || fase === "cerrada") {
    const bloque = fase === "antes" ? c.antes : c.cerrada;
    return (
      <Marco idioma={idioma} pagina="">
        <p style={{ ...peq, color: AMBER, letterSpacing: "0.12em", textTransform: "uppercase" }}>{c.marca}</p>
        <h1 style={{ ...sectionTitle, fontSize: "clamp(2rem,4vw,3rem)" }}>{bloque.titulo}</h1>
        {bloque.texto.map((t, i) => (
          <p key={i} style={proseP}>
            {t}
          </p>
        ))}
        {fase === "cerrada" && (
          <div style={{ ...cardStyle, padding: "1.8rem" }}>
            <EnlaceForm idioma={idioma} />
          </div>
        )}
      </Marco>
    );
  }

  const p = c[fase];
  return (
    <Marco idioma={idioma} pagina="">
      <p style={{ ...peq, color: AMBER, letterSpacing: "0.12em", textTransform: "uppercase" }}>{c.marca}</p>
      <h1 style={{ ...sectionTitle, fontSize: "clamp(2.1rem,4.4vw,3.3rem)", marginBottom: "1.4rem" }}>{p.titulo}</h1>
      <p style={proseP}>{p.promesa}</p>
      <p style={emphasisP}>{p.paraQuien}</p>
      {tres[fase] && (
        <p style={{ display: "inline-block", padding: "0.5rem 1rem", border: `1px solid ${AMBER}`, color: AMBER, borderRadius: "0.5rem", marginBottom: "2rem" }}>{c.yaSomosTres}</p>
      )}
      <p style={{ marginBottom: "3.2rem" }}>
        <a href="#apuntate" className="inline-block rounded-xl bg-[#0F2240] px-9 py-4 text-[0.98rem] tracking-[0.06em] text-[#F7F1E6] shadow-md transition-all hover:brightness-110">
          {fase === "B" ? (idioma === "es" ? "Apuntarme por 7 €" : "Apuntatu 7 €-tan") : idioma === "es" ? "Apuntarme por 17 €" : "Apuntatu 17 €-tan"}
        </a>
      </p>

      <section style={seccion}>
        <h2 style={h2}>{c.queRecibes.titulo}</h2>
        {c.queRecibes.lineas.map((l, i) => (
          <p key={i} style={{ ...proseP, marginBottom: "0.9rem" }}>
            {l}
          </p>
        ))}
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.precio.titulo}</h2>
        <p style={{ ...proseP, marginBottom: "0.9rem", opacity: fase === "A" ? 0.55 : 1 }}>{c.precio.B}</p>
        <p style={{ ...proseP, marginBottom: "0.9rem" }}>{c.precio.A}</p>
        <p style={proseP}>{c.precio.real}</p>
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.preventa.titulo}</h2>
        {c.preventa.texto.map((t, i) => (
          <p key={i} style={{ ...proseP, marginBottom: "0.9rem" }}>
            {t}
          </p>
        ))}
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.quienSoy.titulo}</h2>
        <p style={proseP}>{c.quienSoy.texto}</p>
        <blockquote style={{ ...cardStyle, padding: "1.4rem 1.6rem", margin: 0 }}>
          <p style={{ ...emphasisP, marginBottom: "0.6rem" }}>&quot;{c.testimonio.cita}&quot;</p>
          <p style={peq}>{c.testimonio.autor}</p>
        </blockquote>
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.faqTitulo}</h2>
        {c.faq.map((f, i) => (
          <div key={i} style={{ marginBottom: "1.3rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{f.p}</p>
            <p style={{ ...proseP, marginBottom: 0 }}>{f.r}</p>
          </div>
        ))}
      </section>

      <section id="apuntate" style={{ ...cardStyle, padding: "2rem 1.6rem", marginBottom: "3.2rem" }}>
        <h2 style={h2}>{fase === "A" ? c.form.tituloSubida : c.form.titulo}</h2>
        <CompraForm idioma={idioma} fase={fase} />
      </section>

      <p style={{ ...peq, marginBottom: "3.2rem" }}>{AVISO_SALUD[idioma]}</p>
      <BloqueDesistimiento idioma={idioma} />
      <p style={peq}>
        {DATOS[idioma]}{" "}
        <Link href="/privacidad" style={{ textDecoration: "underline" }}>
          {c.privacidad}
        </Link>
      </p>
    </Marco>
  );
}

export function Gracias({ idioma, producto }: { idioma: Idioma; producto?: string }) {
  const es = idioma === "es";
  const dosFechas = producto === "A" || producto === "subida";
  return (
    <Marco idioma={idioma} pagina="gracias">
      <h1 style={{ ...sectionTitle, fontSize: "clamp(2rem,4vw,2.8rem)" }}>{es ? "Gracias. Ya estás dentro." : "Eskerrik asko. Barruan zaude."}</h1>
      <p style={proseP}>
        {es
          ? "En unos minutos te llega un correo con la confirmación de la compra y las condiciones. Si no lo ves, mira en spam."
          : "Minutu batzuk barru erosketaren berrespena eta baldintzak jasoko dituzu postan. Ikusten ez baduzu, begiratu spam karpetan."}
      </p>
      <p style={proseP}>
        {es
          ? `El jueves 10 de diciembre cuento cuántas somos y te escribo. Si llegamos a 3, ${dosFechas ? "la de empezar te llega el 28 de diciembre y la de la espalda el 10 de enero" : "te llega el 28 de diciembre"}.`
          : `Abenduaren 10ean zenbat garen kontatuko dut eta idatziko dizut. 3ra iristen bagara, ${dosFechas ? "hastekoa abenduaren 28an jasoko duzu eta bizkarrekoa urtarrilaren 10ean" : "abenduaren 28an jasoko duzu"}.`}
      </p>
      <p style={peq}>{AVISO_SALUD[idioma]}</p>
    </Marco>
  );
}

export function Desistimiento({ idioma }: { idioma: Idioma }) {
  const es = idioma === "es";
  return (
    <Marco idioma={idioma} pagina="desistimiento">
      <h1 style={{ ...sectionTitle, fontSize: "clamp(2rem,4vw,2.8rem)" }}>{es ? "Formulario de desistimiento" : "Atzera egiteko formularioa"}</h1>
      <p style={proseP}>
        {es
          ? "Rellénalo si quieres desistir de la compra de una masterclass. No hace falta dar ningún motivo."
          : "Bete ezazu masterclass baten erosketatik atzera egin nahi baduzu. Ez da arrazoirik eman behar."}
      </p>
      <div style={{ ...cardStyle, padding: "1.8rem", marginBottom: "3rem" }}>
        <DesistimientoForm idioma={idioma} />
      </div>
      <BloqueDesistimiento idioma={idioma} />
    </Marco>
  );
}

/**
 * Área de cliente mínima: el enlace del correo (correo + firma) enseña las
 * masterclasses que ya le tocan. Sin descarga: el reproductor es un iframe
 * del servicio de vídeo, que tiene que tener la descarga desactivada.
 */
export async function Acceso({ idioma, e, t }: { idioma: Idioma; e?: string; t?: string }) {
  const es = idioma === "es";
  const valido = !!e && !!t && firmaValida(e, t);
  if (!valido) {
    return (
      <Marco idioma={idioma} pagina="acceso">
        <h1 style={{ ...sectionTitle, fontSize: "clamp(1.8rem,3.6vw,2.6rem)" }}>{es ? "Tus masterclasses" : "Zure masterclassak"}</h1>
        <p style={proseP}>
          {es
            ? "Para verlas, entra con el enlace que te llegó por correo. Si lo has perdido, te lo mando otra vez:"
            : "Ikusteko, sartu postaz jaso zenuen estekarekin. Galdu baduzu, berriro bidaliko dizut:"}
        </p>
        <div style={{ ...cardStyle, padding: "1.8rem" }}>
          <EnlaceForm idioma={idioma} />
        </div>
      </Marco>
    );
  }
  const { disponibles, proximas } = await videosDe(e!);
  return (
    <Marco idioma={idioma} pagina="acceso">
      <h1 style={{ ...sectionTitle, fontSize: "clamp(1.8rem,3.6vw,2.6rem)" }}>{es ? "Tus masterclasses" : "Zure masterclassak"}</h1>
      <p style={{ ...peq, padding: "1rem 1.2rem", border: `1px solid ${AMBER}`, borderRadius: "0.5rem", marginBottom: "2.4rem" }}>{AVISO_SALUD[idioma]}</p>
      {disponibles.map((v) => (
        <section key={v.producto} style={seccion}>
          <h2 style={h2}>{NOMBRE[v.producto][idioma]}</h2>
          {v.url ? (
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: "0.6rem", overflow: "hidden", background: "#000" }}>
              <iframe
                src={v.url}
                title={NOMBRE[v.producto][idioma]}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          ) : (
            <p style={proseP}>{es ? "Estoy terminando de subirla. Te aviso por correo en cuanto esté." : "Igotzen ari naiz. Prest dagoenean postaz abisatuko dizut."}</p>
          )}
          <p style={{ ...peq, marginTop: "0.8rem" }}>
            {es ? `Disponible hasta el ${fechaLarga(v.hasta, idioma)}.` : `${fechaLarga(v.hasta, idioma)} arte ikusgai.`}
          </p>
        </section>
      ))}
      {proximas.map((p) => (
        <p key={p} style={proseP}>
          {es
            ? `"${NOMBRE[p].es}": te llega el ${fechaLarga(p === "B" ? FECHAS.entregaB : FECHAS.entregaA, idioma)}.`
            : `"${NOMBRE[p].eu}": ${fechaLarga(p === "B" ? FECHAS.entregaB : FECHAS.entregaA, idioma)} jasoko duzu.`}
        </p>
      ))}
      {disponibles.length === 0 && proximas.length === 0 && (
        <p style={proseP}>{es ? "Con este correo no hay ninguna masterclass para ver ahora." : "Posta honekin ez dago orain ikusteko masterclassik."}</p>
      )}
      <p style={peq}>
        <Link href={enlaceAcceso(e!, idioma === "es" ? "eu" : "es").replace(/^https:\/\/[^/]+/, "")}>{es ? "Euskaraz" : "Gaztelaniaz"}</Link>
      </p>
    </Marco>
  );
}
