// Páginas de la preventa de la masterclass (castellano y euskera; modelo del 26-11-2026).
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
import { AMBER, CARD, LINE, MUTED, NAVY, PAPER, cardStyle, emphasisP, proseP, sectionTitle } from "../_ui";

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
      <main className="mx-auto max-w-[720px] px-6 py-14 md:px-10 md:py-20">{children}</main>
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

/** "?fase=bonus" / "?fase=sin" (también "B" y "A", del modelo anterior) para revisar la página antes de tiempo. */
function faseDeVista(v?: string): Fase | null {
  const x = (v ?? "").trim().toLowerCase();
  if (x === "bonus" || x === "b") return "bonus";
  if (x === "sin" || x === "a" || x === "venta") return "venta";
  return null;
}

const DIA_MS = 24 * 3600 * 1000;

const boton =
  "inline-block rounded-xl bg-[#0F2240] px-9 py-[1.05rem] text-center text-[1.05rem] tracking-[0.02em] text-[#F7F1E6] shadow-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C47800]";

/** Precio, plazo y botón: se repite arriba y a mitad de página. */
function Compra({ c, abierta }: { c: (typeof CONTENIDO)["es"]; abierta: boolean }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <p style={{ display: "flex", alignItems: "baseline", gap: "0.9rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
        <span style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: "2.6rem", fontWeight: 500, color: NAVY, lineHeight: 1 }}>{c.precio}</span>
        <span style={{ fontSize: "1rem", color: MUTED, lineHeight: 1.5 }}>{c.plazo}</span>
      </p>
      {abierta ? (
        <a href="#apuntate" className={`${boton} mt-4 w-full sm:w-auto`}>
          {c.cta}
        </a>
      ) : (
        <p style={{ ...proseP, fontWeight: 600, color: NAVY, margin: "1rem 0 0 0" }}>{c.abre}</p>
      )}
      <p style={{ fontSize: "0.98rem", lineHeight: 1.6, color: MUTED, marginTop: "1rem" }}>{c.garantia}</p>
    </div>
  );
}

/** El vale del regalo: lo único que destaca en la página. Desaparece el sáb 5-dic. */
function Vale({ c, aviso }: { c: (typeof CONTENIDO)["es"]; aviso: string }) {
  const muesca: React.CSSProperties = { position: "absolute", top: "-13px", width: 26, height: 26, borderRadius: "50%", background: PAPER };
  return (
    <aside aria-label={c.bonus.titulo} style={{ background: NAVY, color: PAPER, borderRadius: "1rem", margin: "3.2rem 0", overflow: "hidden" }}>
      <div style={{ padding: "1.6rem 1.7rem 1.3rem" }}>
        <p style={{ color: "#F0A63A", fontSize: "1.02rem", lineHeight: 1.5, margin: 0 }}>{c.bonus.titulo}</p>
        <p style={{ display: "inline-block", marginTop: "0.9rem", background: "#F0A63A", color: NAVY, fontWeight: 600, borderRadius: "999px", padding: "0.3rem 0.95rem", fontSize: "0.98rem" }}>{aviso}</p>
      </div>
      <div style={{ position: "relative", height: 0, borderTop: "2px dashed rgba(247,241,230,0.35)", margin: "0 1.3rem" }}>
        <span aria-hidden style={{ ...muesca, left: "calc(-1.3rem - 13px)" }} />
        <span aria-hidden style={{ ...muesca, right: "calc(-1.3rem - 13px)" }} />
      </div>
      <div style={{ padding: "1.4rem 1.7rem 1.7rem" }}>
        <p style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: "clamp(1.45rem,2.6vw,1.85rem)", lineHeight: 1.2, margin: "0 0 0.9rem 0" }}>&quot;{c.bonus.nombre}&quot;</p>
        <p style={{ fontSize: "1.08rem", lineHeight: 1.65, color: "rgba(247,241,230,0.88)", margin: "0 0 0.9rem 0" }}>{c.bonus.texto}</p>
        <p style={{ fontSize: "1.08rem", lineHeight: 1.6, margin: 0 }}>{c.bonus.entrega}</p>
      </div>
    </aside>
  );
}

function Lista({ items, marca }: { items: string[]; marca: "si" | "no" }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.6rem 0" }}>
      {items.map((t, i) => (
        <li key={i} style={{ ...proseP, display: "grid", gridTemplateColumns: "1.6rem 1fr", marginBottom: "0.8rem" }}>
          <span aria-hidden style={{ color: marca === "si" ? AMBER : MUTED, fontWeight: 700 }}>
            {marca === "si" ? "✓" : "✕"}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * La landing. Se vende "Que la espalda no te pare" a 17 €; del 1 al 4-dic
 * lleva de regalo "Por dónde empezar" (el vale). `faseVista` (?fase=bonus o
 * ?fase=sin) deja ver la página de una fase antes de tiempo; quién puede pagar
 * y con qué lo decide siempre el servidor por fecha y correo.
 */
export async function Landing({ idioma, faseVista }: { idioma: Idioma; faseVista?: string }) {
  const c = CONTENIDO[idioma];
  const t = ahora();
  const real = faseEn(t);
  const vista = faseDeVista(faseVista);
  const fase: Fase = (real === "antes" || real === "cerrada") && vista ? vista : real;

  if (fase === "cerrada") {
    return (
      <Marco idioma={idioma} pagina="">
        <h1 style={{ ...sectionTitle, fontSize: "clamp(2rem,4vw,3rem)" }}>{c.cerrada.titulo}</h1>
        {c.cerrada.texto.map((x, i) => (
          <p key={i} style={proseP}>
            {x}
          </p>
        ))}
        <div style={{ ...cardStyle, padding: "1.8rem" }}>
          <EnlaceForm idioma={idioma} />
        </div>
      </Marco>
    );
  }

  const abierta = fase === "bonus" || fase === "venta";
  const conBonus = fase === "antes" || fase === "bonus";
  const tres = abierta ? await yaHayTres() : false;
  const desde = Math.max(t.getTime(), FECHAS.inicio.getTime());
  const dias = Math.ceil((FECHAS.finBonus.getTime() - desde) / DIA_MS);
  const aviso = fase === "antes" ? c.bonus.antes : dias <= 1 ? c.bonus.ultimoDia : c.bonus.quedan(dias);

  return (
    <Marco idioma={idioma} pagina="">
      <section style={{ marginBottom: "1rem" }}>
        <p style={{ fontSize: "1rem", color: AMBER, marginBottom: "1rem" }}>{c.marca}</p>
        <h1 style={{ ...sectionTitle, fontSize: "clamp(2.6rem,7vw,4.4rem)", lineHeight: 1.02, letterSpacing: "-0.03em", marginBottom: "1.6rem" }}>{c.titulo}</h1>
        <p style={{ ...proseP, fontSize: "clamp(1.15rem,1.6vw,1.3rem)", color: NAVY, marginBottom: "1.2rem" }}>{c.promesa}</p>
        <p style={{ ...proseP, marginBottom: "2rem" }}>{c.paraQuien}</p>
        {tres && (
          <p style={{ display: "inline-block", padding: "0.45rem 1rem", border: `1px solid ${AMBER}`, color: AMBER, borderRadius: "0.5rem", marginBottom: "1.6rem" }}>{c.yaSomosTres}</p>
        )}
        <Compra c={c} abierta={abierta} />
      </section>

      {conBonus && <Vale c={c} aviso={aviso} />}

      <section style={seccion}>
        <h2 style={h2}>{c.paraTi.titulo}</h2>
        <Lista items={c.paraTi.si} marca="si" />
        <h3 style={{ ...h2, fontSize: "1.25rem", marginBottom: "0.9rem" }}>{c.paraTi.noTitulo}</h3>
        <Lista items={c.paraTi.no} marca="no" />
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.aprendes.titulo}</h2>
        <Lista items={c.aprendes.lineas} marca="si" />
        <h3 style={{ ...h2, fontSize: "1.25rem", marginBottom: "0.9rem" }}>{c.formato.titulo}</h3>
        {c.formato.lineas.map((x, i) => (
          <p key={i} style={{ ...proseP, marginBottom: "0.9rem" }}>
            {x}
          </p>
        ))}
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.como.titulo}</h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, borderLeft: `2px solid ${LINE}` }}>
          {c.como.pasos
            .filter((p) => conBonus || !p.soloBonus)
            .map((p, i) => (
              <li key={i} style={{ position: "relative", padding: "0 0 1.5rem 1.4rem" }}>
                <span aria-hidden style={{ position: "absolute", left: -7, top: "0.45rem", width: 12, height: 12, borderRadius: "50%", background: AMBER }} />
                <p style={{ fontWeight: 600, color: NAVY, fontSize: "1.08rem", margin: "0 0 0.25rem 0" }}>{p.cuando}</p>
                <p style={{ ...proseP, margin: 0 }}>{p.que}</p>
              </li>
            ))}
        </ol>
        {abierta && (
          <p style={{ marginTop: "1.6rem" }}>
            <a href="#apuntate" className={`${boton} w-full sm:w-auto`}>
              {c.cta}
            </a>
          </p>
        )}
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.quienSoy.titulo}</h2>
        <div className="grid items-center gap-5 sm:grid-cols-[132px_1fr]">
          <Image src="/otra-vez-lumbago/alain.png" alt={c.quienSoy.alt} width={264} height={264} className="h-[132px] w-[132px] rounded-full object-cover" />
          <p style={{ ...proseP, margin: 0 }}>{c.quienSoy.texto}</p>
        </div>
        <blockquote style={{ margin: "1.8rem 0 0 0", paddingLeft: "1.2rem", borderLeft: `3px solid ${AMBER}` }}>
          <p style={{ ...emphasisP, marginBottom: "0.5rem" }}>&quot;{c.testimonio.cita}&quot;</p>
          <p style={{ ...peq, margin: 0 }}>{c.testimonio.autor}</p>
        </blockquote>
      </section>

      <section style={seccion}>
        <h2 style={h2}>{c.faqTitulo}</h2>
        {c.faq
          .filter((f) => conBonus || !f.soloBonus)
          .map((f, i) => (
            <details key={i} style={{ borderTop: `1px solid ${LINE}`, padding: "1rem 0" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "1.1rem", color: NAVY }}>{f.p}</summary>
              <p style={{ ...proseP, margin: "0.7rem 0 0 0" }}>{f.r}</p>
            </details>
          ))}
      </section>

      <section id="apuntate" style={{ ...cardStyle, padding: "2rem 1.6rem", marginBottom: "3.2rem", scrollMarginTop: "1.5rem" }}>
        <h2 style={h2}>{c.form.titulo}</h2>
        {abierta ? (
          <>
            <p style={{ ...proseP, marginBottom: "1.8rem" }}>
              {c.precio}. {conBonus ? `${c.bonus.titulo}: "${c.bonus.nombre}".` : c.plazo}
            </p>
            <CompraForm idioma={idioma} boton={c.form.continuar} />
          </>
        ) : (
          <p style={{ ...proseP, margin: 0 }}>{c.abre}</p>
        )}
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

export function Gracias({ idioma, bonus }: { idioma: Idioma; bonus?: string }) {
  const es = idioma === "es";
  const conBonus = bonus === "1" || bonus === "A";
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
          ? `El jueves 10 de diciembre cuento cuántas personas somos y te escribo. Si llegamos a 3, ${conBonus ? "el regalo te llega el 28 de diciembre y la de la espalda el 10 de enero" : "te llega el 10 de enero"}.`
          : `Abenduaren 10ean zenbat garen kontatuko dut eta idatziko dizut. 3ra iristen bagara, ${conBonus ? "oparia abenduaren 28an jasoko duzu eta bizkarrekoa urtarrilaren 10ean" : "urtarrilaren 10ean jasoko duzu"}.`}
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
