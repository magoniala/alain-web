"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EMAIL_RE, LIMITES, NOTAS, NOTA_EMOJI, OPINION_TEXTOS, PERMISOS, type Idioma, type Nota, type Origen, type Permiso } from "@/lib/opinion";

// Formulario de opinión de familias: una pregunta por pantalla, todas
// opcionales menos la primera (un toque), y cada respuesta se guarda en el
// momento. Misma estética que /quetal.

const CIAN = "#2ED3E6";
const TOTAL_PASOS = 6;

const inputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.6,
  color: "rgba(242,242,240,0.88)",
  paddingBottom: "0.6rem",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "rgba(242,242,240,0.58)",
  display: "block",
  marginBottom: "0.4rem",
};
const preguntaStyle: React.CSSProperties = {
  fontSize: "clamp(1.35rem,2.2vw,1.9rem)",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  color: "rgba(242,242,240,0.95)",
  marginBottom: "1.6rem",
  lineHeight: 1.3,
  display: "block",
};
const ayudaStyle: React.CSSProperties = { fontSize: "0.9rem", lineHeight: 1.6, color: "rgba(242,242,240,0.55)", marginTop: "0.6rem" };
const lineaStyle: React.CSSProperties = { borderBottom: "1px solid rgba(242,242,240,0.12)" };

type Datos = {
  nota: Nota | null;
  textoPeques: string;
  textoAdulto: string;
  palabra: string;
  mejora: string;
  permiso: Permiso | "";
  nombre: string;
  email: string;
  web: string; // honeypot
};

function Opcion({ elegida, onClick, children }: { elegida: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={elegida}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "0.85rem 0",
        borderBottom: "1px solid rgba(242,242,240,0.08)",
        color: elegida ? CIAN : undefined,
        background: "none",
        cursor: "pointer",
        fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
        transition: "color 0.2s",
      }}
      className={elegida ? "" : "text-[#F2F2F0]/62 hover:text-[#F2F2F0]/90"}
    >
      {elegida ? "→ " : ""}
      {children}
    </button>
  );
}

export default function FormularioOpinion({
  evento,
  nombreEvento,
  origen,
  idiomaInicial,
  resenaUrl,
}: {
  evento: string;
  nombreEvento: string;
  origen: Origen | null;
  idiomaInicial: Idioma;
  resenaUrl: string;
}) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);
  const [paso, setPaso] = useState(1);
  const [fin, setFin] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [d, setD] = useState<Datos>({ nota: null, textoPeques: "", textoAdulto: "", palabra: "", mejora: "", permiso: "", nombre: "", email: "", web: "" });
  const abiertoEn = useRef(0);
  const fila = useRef<{ id: string; clave: string } | null>(null);
  const cola = useRef<Promise<boolean>>(Promise.resolve(true));
  const tarjeta = useRef<HTMLDivElement>(null);

  const T = OPINION_TEXTOS[idioma];
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setError("");
  };

  useEffect(() => {
    abiertoEn.current = Date.now();
  }, []);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  useEffect(() => {
    if (paso > 1 || fin) tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [paso, fin]);

  // Guarda todo lo contestado hasta ahora. Las llamadas van en fila, una
  // detrás de otra, para que la primera cree la fila y las demás la sigan.
  // Si una falla, la siguiente vuelve a mandarlo todo.
  function guardar(datos: Datos, terminado = false): Promise<boolean> {
    if (datos.nota === null) return Promise.resolve(false);
    const siguiente = cola.current.then(async () => {
      try {
        const res = await fetch("/api/opinion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(fila.current ?? {}),
            evento,
            origen,
            idioma,
            nota: datos.nota,
            textoPeques: datos.textoPeques,
            textoAdulto: datos.textoAdulto,
            palabra: datos.palabra,
            mejora: datos.mejora,
            permiso: datos.permiso || null,
            nombre: datos.nombre,
            email: EMAIL_RE.test(datos.email.trim()) ? datos.email.trim() : "",
            terminado,
            web: datos.web,
            abiertoEn: abiertoEn.current,
          }),
        });
        if (!res.ok) return false;
        const j = (await res.json()) as { id?: string; clave?: string };
        if (j.id && j.clave) fila.current = { id: j.id, clave: j.clave };
        return true;
      } catch {
        return false;
      }
    });
    cola.current = siguiente;
    return siguiente;
  }

  function elegirNota(n: Nota) {
    const nuevo = { ...d, nota: n };
    setD(nuevo);
    guardar(nuevo);
    setPaso(2);
  }

  function avanzar() {
    setError("");
    guardar(d);
    setPaso((p) => Math.min(TOTAL_PASOS, p + 1));
  }

  async function terminar() {
    if (d.permiso === "con_nombre" && !d.nombre.trim()) {
      setError(T.errorNombre);
      return;
    }
    if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) {
      setError(T.errorEmail);
      return;
    }
    setEnviando(true);
    // Si este último guardado falla, lo anterior ya está guardado: no se le
    // hace repetir nada a quien ha venido a ayudar.
    await guardar(d, true);
    setEnviando(false);
    setFin(true);
  }

  const area = (k: "textoPeques" | "textoAdulto" | "mejora", id: string) => (
    <div style={lineaStyle}>
      <textarea id={id} value={d[k]} maxLength={LIMITES.texto} rows={3} onChange={(e) => set(k, e.target.value)} style={{ ...inputStyle, resize: "vertical", paddingTop: "0.25rem" }} autoFocus />
    </div>
  );

  function renderPaso() {
    switch (paso) {
      case 1:
        return (
          <>
            <p style={preguntaStyle}>{T.nota}</p>
            <div className="grid grid-cols-2 gap-3">
              {NOTAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => elegirNota(n)}
                  aria-pressed={d.nota === n}
                  style={{
                    border: `1px solid ${d.nota === n ? CIAN : "rgba(242,242,240,0.18)"}`,
                    background: d.nota === n ? "rgba(46,211,230,0.08)" : "none",
                    padding: "1.4rem 0.6rem",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "border-color 0.2s",
                  }}
                  className="hover:border-white/40"
                >
                  <span style={{ display: "block", fontSize: "2.6rem", lineHeight: 1.1 }} aria-hidden>
                    {NOTA_EMOJI[n]}
                  </span>
                  <span style={{ display: "block", marginTop: "0.6rem", fontSize: "0.98rem", color: d.nota === n ? CIAN : "rgba(242,242,240,0.8)" }}>{T.notas[n]}</span>
                </button>
              ))}
            </div>
            <p style={{ ...ayudaStyle, marginTop: "1.4rem" }}>{T.intro}</p>
          </>
        );
      case 2:
        return (
          <>
            <label htmlFor="o-peques" style={preguntaStyle}>
              {T.peques}
            </label>
            {area("textoPeques", "o-peques")}
          </>
        );
      case 3:
        return (
          <>
            <label htmlFor="o-adulto" style={preguntaStyle}>
              {T.adulto}
            </label>
            {area("textoAdulto", "o-adulto")}
            <p style={ayudaStyle}>{T.adultoAyuda}</p>
          </>
        );
      case 4:
        return (
          <>
            <label htmlFor="o-palabra" style={preguntaStyle}>
              {T.palabra}
            </label>
            <div style={lineaStyle}>
              <input
                id="o-palabra"
                value={d.palabra}
                maxLength={LIMITES.palabra}
                onChange={(e) => set("palabra", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") avanzar();
                }}
                style={inputStyle}
                autoFocus
              />
            </div>
          </>
        );
      case 5:
        return (
          <>
            <label htmlFor="o-mejora" style={{ ...preguntaStyle, marginBottom: "0.6rem" }}>
              {T.mejora}
            </label>
            <p style={{ ...ayudaStyle, marginTop: 0, marginBottom: "1.2rem", color: CIAN }}>🔒 {T.mejoraPrivada}</p>
            {area("mejora", "o-mejora")}
          </>
        );
      case 6:
        return (
          <>
            <p style={preguntaStyle}>{T.permiso}</p>
            {PERMISOS.map((p) => (
              <Opcion key={p} elegida={d.permiso === p} onClick={() => set("permiso", d.permiso === p ? "" : p)}>
                {T.permisos[p]}
              </Opcion>
            ))}
            {d.permiso === "con_nombre" && (
              <div style={{ ...lineaStyle, marginTop: "1.6rem" }}>
                <label style={labelStyle} htmlFor="o-nombre">
                  {T.nombre} *
                </label>
                <input id="o-nombre" value={d.nombre} maxLength={LIMITES.nombre} onChange={(e) => set("nombre", e.target.value)} style={inputStyle} autoComplete="name" autoFocus />
              </div>
            )}
            {d.permiso !== "" && d.permiso !== "no" && (
              <>
                <div style={{ ...lineaStyle, marginTop: "1.6rem" }}>
                  <label style={labelStyle} htmlFor="o-email">
                    {T.email} {T.opcional}
                  </label>
                  <input
                    id="o-email"
                    type="email"
                    value={d.email}
                    maxLength={LIMITES.email}
                    onChange={(e) => set("email", e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                    placeholder={idioma === "eu" ? "zu@email.com" : "tu@email.com"}
                    className="placeholder:text-[#F2F2F0]/30"
                  />
                </div>
                <p style={ayudaStyle}>{T.emailAyuda}</p>
              </>
            )}
            <p style={{ ...ayudaStyle, marginTop: "1.8rem" }}>
              {T.compartir} {T.privacidadAntes}
              <Link href={idioma === "eu" ? "/privacidad#euskaraz" : "/privacidad"} target="_blank" className="underline underline-offset-4 hover:text-[#2ED3E6]">
                {T.privacidadEnlace}
              </Link>
              .
            </p>
          </>
        );
    }
    return null;
  }

  const boton: React.CSSProperties = {
    marginTop: "2.5rem",
    border: "1px solid rgba(242,242,240,0.20)",
    padding: "0.9rem 2.5rem",
    fontSize: "0.98rem",
    letterSpacing: "0.08em",
    color: "rgba(242,242,240,1)",
    background: "none",
    cursor: enviando ? "wait" : "pointer",
  };
  const botonSuave: React.CSSProperties = { fontSize: "0.82rem", letterSpacing: "0.08em", color: "rgba(242,242,240,0.50)", background: "none", cursor: "pointer", padding: 0 };

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href={idioma === "es" ? "/es" : "/"} className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            {(["eu", "es"] as const).map((l, i) => (
              <span key={l} style={{ display: "flex", alignItems: "stretch" }}>
                {i > 0 && <span style={{ width: "1px", background: "rgba(242,242,240,0.12)" }} />}
                <button
                  type="button"
                  onClick={() => setIdioma(l)}
                  aria-pressed={idioma === l}
                  style={{ padding: "0.3rem 0.65rem", color: idioma === l ? CIAN : "rgba(242,242,240,0.55)", background: idioma === l ? "rgba(46,211,230,0.06)" : "none", cursor: "pointer", transition: "color 0.2s" }}
                  className={idioma === l ? "" : "hover:text-[#F2F2F0]/90"}
                >
                  {l === "eu" ? "EUS" : "ES"}
                </button>
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-8 pt-12 pb-8 md:px-16 md:pt-20 md:pb-10">
        <div className="relative">
          <div className="absolute left-0 top-0 h-full w-[2px] bg-white/15" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-3 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">{T.kicker}</p>
            <h1 className="hero-fade-2 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[1.05] tracking-[-0.03em]">{nombreEvento}</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[640px]" style={{ scrollMarginTop: "5rem" }} ref={tarjeta}>
          <div className="p-5 md:p-10" style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}>
            {fin ? (
              <div key="gracias" className="context-fade-in">
                <p className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-medium leading-snug tracking-[-0.02em]">{T.gracias}</p>
                <p style={{ ...ayudaStyle, fontSize: "1.05rem" }}>{T.graciasDetalle}</p>
                {/* A todos, sin mirar la nota: Google no permite pedir reseña solo a quien ha valorado bien. */}
                {resenaUrl && (
                  <a
                    href={resenaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-8 inline-block border border-white/20 px-6 py-4 text-[0.98rem] leading-snug tracking-[0.04em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
                  >
                    {T.resena}
                  </a>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "6px", marginBottom: "2rem" }} aria-hidden>
                  {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
                    <div key={i} style={{ width: "24px", height: "2px", background: i < paso ? CIAN : "rgba(242,242,240,0.12)", transition: "background 0.3s" }} />
                  ))}
                </div>

                <div key={paso} className="context-fade-in">
                  {renderPaso()}
                </div>

                {/* Honeypot: invisible para personas, tentador para bots. */}
                <div aria-hidden style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Web
                    <input type="text" tabIndex={-1} autoComplete="off" value={d.web} onChange={(e) => set("web", e.target.value)} />
                  </label>
                </div>

                {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}

                {paso > 1 && (
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
                    {paso < TOTAL_PASOS ? (
                      <button type="button" onClick={avanzar} style={boton} className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]">
                        {T.siguiente}
                      </button>
                    ) : (
                      <button type="button" onClick={terminar} disabled={enviando} style={boton} className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]">
                        {T.enviar}
                      </button>
                    )}
                    {paso < TOTAL_PASOS && (
                      <button type="button" onClick={avanzar} style={{ ...botonSuave, marginTop: "2.5rem" }} className="transition-colors duration-200 hover:text-[#F2F2F0]/80">
                        {T.saltar}
                      </button>
                    )}
                  </div>
                )}
                {paso > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setPaso(paso - 1);
                    }}
                    style={{ ...botonSuave, marginTop: "1.2rem", display: "block" }}
                    className="transition-colors duration-200 hover:text-[#F2F2F0]/80"
                  >
                    {T.volver}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/6 px-8 py-10 md:px-16">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
          <p>© Alain Zulaika</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">{T.pie.aviso}</Link>
            <Link href={idioma === "eu" ? "/privacidad#euskaraz" : "/privacidad"} className="transition-colors hover:text-[#F2F2F0]/62">{T.pie.privacidad}</Link>
            <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">{T.pie.cookies}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
