"use client";

import { useEffect, useRef, useState } from "react";
import { Header, Footer, inputStyle, labelStyle, fieldStyle } from "../_ui";
import PreviewHojaDeRuta from "../PreviewHojaDeRuta";
import {
  HOJA_RUTA_BOTON,
  HOJA_RUTA_CIERRE,
  HOJA_RUTA_HERO,
  HOJA_RUTA_HUECOS,
  HOJA_RUTA_SECCIONES,
  type Parrafo,
  type SeccionHR,
  type VarianteHR,
} from "./_content";
import { CONSENT_HOJA_RUTA, UTM_KEYS, mensajeErrorFormulario, type Utm } from "@/lib/entrenatzaile-formularios";
import type { HuecoDisponible } from "@/lib/entrenatzaile-huecos";

function leerUtm(): Utm {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v;
  }
  if (document.referrer) utm.referrer = document.referrer;
  return utm;
}

const tituloClase = "font-[family-name:var(--font-lora)] font-medium tracking-[-0.02em]";
const cuerpoClase = "whitespace-pre-line text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]";
const botonClase =
  "inline-block scale-100 bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg";

const pistaStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  fontStyle: "italic",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.50)",
  marginBottom: "0.7rem",
};

function Parrafos({ parrafos }: { parrafos: Parrafo[] }) {
  return (
    <div className="space-y-6">
      {parrafos.map((p, i) => (
        <div key={i}>
          {p.destacado && (
            <p className="text-[1.15rem] leading-[1.7] font-semibold text-[#1C3A5E] md:text-[1.22rem]">
              {p.destacado}
              {p.nota && <span className="font-normal text-[#0F2240]/55"> {p.nota}</span>}
            </p>
          )}
          {p.texto && <p className={cuerpoClase}>{p.texto}</p>}
        </div>
      ))}
    </div>
  );
}

// Marca de verificación de los micro-copys del hero y de los CTA.
function Checks({ lineas }: { lineas: string[] }) {
  return (
    <ul className="mt-6 space-y-2">
      {lineas.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-[0.98rem] leading-[1.6] text-[#0F2240]/75">
          <span aria-hidden className="text-[#1C3A5E]">
            ✓
          </span>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HojaDeRutaClient({ variante }: { variante: VarianteHR }) {
  const secciones = HOJA_RUTA_SECCIONES.filter((s: SeccionHR) => !s.soloEn || s.soloEn === variante);

  const [paso, setPaso] = useState<"datos" | "hueco" | "hecho">("datos");
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "" });
  const [consentDatos, setConsentDatos] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [huecos, setHuecos] = useState<HuecoDisponible[] | null>(null);
  const [huecoElegido, setHuecoElegido] = useState("");
  const [cuandoReservado, setCuandoReservado] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const utm = useRef<Utm>({});

  useEffect(() => {
    utm.current = leerUtm();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function cargarHuecos() {
    try {
      const res = await fetch("/api/entrenatzaile/hoja-de-ruta", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setHuecos(res.ok ? (data.huecos ?? []) : []);
    } catch {
      setHuecos([]);
    }
  }

  // Paso 1: el lead se guarda ANTES de que elija hueco. Si abandona el
  // calendario, sus datos ya están.
  async function guardarLead(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/hoja-de-ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, consentDatos, variante, utm: utm.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      setReservaId(data.id);
      setPaso("hueco");
      cargarHuecos();
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarHueco(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!huecoElegido) {
      setError("Elige un hueco, por favor.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/hoja-de-ruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservaId, hueco: huecoElegido }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        // Si el hueco lo acaban de coger, se repinta la lista al vuelo.
        if (res.status === 409 || res.status === 400) {
          setHuecoElegido("");
          cargarHuecos();
        }
        return;
      }
      setCuandoReservado(data.cuando ?? "");
      setPaso("hecho");
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      {/* SECCIÓN 1 — Above the fold */}
      <section className="w-full bg-[#D4860A] px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 md:grid-cols-[1.15fr_1fr]">
          <div>
            <h1
              className={`hero-fade-2 text-[clamp(2rem,6.2vw,3.6rem)] leading-[1.1] text-[#0F2240] ${tituloClase}`}
            >
              {HOJA_RUTA_HERO.titulo}
            </h1>
            <p className="hero-fade-2 mt-5 text-[1.15rem] leading-[1.6] text-[#0F2240]/85 md:text-[1.25rem]">
              {HOJA_RUTA_HERO.subtitulo}
            </p>
            <p className="hero-fade-3 mt-7 max-w-[600px] text-[1.08rem] leading-[1.75] text-[#0F2240]/80 md:text-[1.15rem]">
              {HOJA_RUTA_HERO.entradilla}
            </p>
            <a href="#reserva" className={`hero-fade-3 mt-9 ${botonClase}`}>
              {HOJA_RUTA_HERO.boton}
            </a>
            <div className="hero-fade-3">
              <Checks lineas={[HOJA_RUTA_HERO.bulletPrecio[variante], ...HOJA_RUTA_HERO.bullets]} />
            </div>
          </div>

          {/* El objeto real que se lleva el cliente, no un mockup genérico. */}
          <PreviewHojaDeRuta className="hero-fade-3" />
        </div>
      </section>

      {/* SECCIONES 2 a 8 */}
      <div className="mx-auto max-w-[680px] px-6 py-16 md:px-8 md:py-24">
        <div className="space-y-20 md:space-y-24">
          {secciones.map((seccion, i) => {
            const micro = seccion.cta?.micro?.[variante];
            return (
              <section key={i} className="fade-in">
                {seccion.titulo && (
                  <h2 className={`mb-7 text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] text-[#1C3A5E] ${tituloClase}`}>
                    {seccion.titulo}
                  </h2>
                )}
                <Parrafos parrafos={seccion.parrafos} />
                {seccion.cta && (
                  <div className="mt-10">
                    <a href="#reserva" className={botonClase}>
                      {HOJA_RUTA_BOTON}
                    </a>
                    {micro && <Checks lineas={[micro]} />}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 9 — CTA final con el formulario de reserva */}
      <section id="reserva" className="scroll-mt-8 border-t border-[#1C3A5E]/12 bg-[#1C3A5E]/[0.04] px-6 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[680px]">
          <h2 className={`mb-7 text-[clamp(1.7rem,5.2vw,2.4rem)] leading-[1.2] text-[#1C3A5E] ${tituloClase}`}>
            {HOJA_RUTA_CIERRE.titulo}
          </h2>

          <Parrafos parrafos={HOJA_RUTA_CIERRE.parrafos} />

          <p className={`mt-6 ${cuerpoClase}`}>{HOJA_RUTA_CIERRE.precio[variante]}</p>

          {paso === "hecho" ? (
            <div className="mt-12">
              <h3 className={`mb-4 text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.25] text-[#1C3A5E] ${tituloClase}`}>
                {HOJA_RUTA_HUECOS.hechoTitulo}
              </h3>
              {cuandoReservado && (
                <p className={`mb-4 text-[1.2rem] font-semibold text-[#1C3A5E] md:text-[1.3rem] first-letter:uppercase`}>
                  {cuandoReservado}
                </p>
              )}
              <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.hechoTexto}</p>
            </div>
          ) : (
            <div className="mt-12">
              <h3 className={`mb-8 text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.25] text-[#1C3A5E] ${tituloClase}`}>
                {paso === "datos" ? HOJA_RUTA_CIERRE.formularioTitulo : HOJA_RUTA_HUECOS.titulo}
              </h3>

              {paso === "datos" && (
                <form onSubmit={guardarLead} noValidate>
                  <div style={fieldStyle}>
                    <label htmlFor="nombre" style={labelStyle}>
                      Nombre
                    </label>
                    <input
                      id="nombre"
                      autoComplete="name"
                      placeholder="Tu nombre"
                      value={datos.nombre}
                      onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                      style={inputStyle}
                      className="placeholder:text-[#1C3A5E]/35"
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="email" style={labelStyle}>
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      value={datos.email}
                      onChange={(e) => setDatos({ ...datos, email: e.target.value })}
                      style={inputStyle}
                      className="placeholder:text-[#1C3A5E]/35"
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="telefono" style={labelStyle}>
                      Teléfono
                    </label>
                    <p style={pistaStyle}>{HOJA_RUTA_CIERRE.telefonoPista}</p>
                    <input
                      id="telefono"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+34 600 000 000"
                      value={datos.telefono}
                      onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                      style={inputStyle}
                      className="placeholder:text-[#1C3A5E]/35"
                    />
                  </div>

                  <div style={{ marginBottom: "2rem" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        lineHeight: 1.55,
                        color: "rgba(15,34,64,0.72)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={consentDatos}
                        onChange={(e) => setConsentDatos(e.target.checked)}
                        style={{ marginTop: "0.2rem" }}
                      />
                      {CONSENT_HOJA_RUTA.datos}
                    </label>
                    <p style={{ ...pistaStyle, marginTop: "0.9rem", marginBottom: 0 }}>
                      <a
                        href="/privacidad"
                        className="not-italic underline underline-offset-4 transition-colors hover:text-[#0F2240]"
                      >
                        {HOJA_RUTA_CIERRE.privacidad}
                      </a>
                    </p>
                  </div>

                  {error && (
                    <p style={{ fontSize: "0.92rem", color: "#B3261E", marginBottom: "1.2rem", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={enviando}
                    style={{
                      border: "none",
                      padding: "0.95rem 2.5rem",
                      fontSize: "0.98rem",
                      letterSpacing: "0.08em",
                      cursor: enviando ? "default" : "pointer",
                      display: "block",
                      opacity: enviando ? 0.6 : 1,
                    }}
                    className="scale-100 bg-[#1C3A5E] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
                  >
                    {enviando ? HOJA_RUTA_CIERRE.enviando : HOJA_RUTA_CIERRE.boton}
                  </button>
                </form>
              )}

              {paso === "hueco" && (
                <form onSubmit={confirmarHueco}>
                  {huecos === null && <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.cargando}</p>}

                  {huecos !== null && huecos.length === 0 && (
                    <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.vacio}</p>
                  )}

                  {huecos !== null && huecos.length > 0 && (
                    <>
                      <p style={{ ...pistaStyle, marginBottom: "1.4rem" }}>{HOJA_RUTA_HUECOS.intro}</p>
                      <div className="mb-8 space-y-3">
                        {huecos.map((h) => (
                          <label
                            key={h.valor}
                            className={`flex cursor-pointer items-center gap-3 border px-4 py-4 transition-colors ${
                              huecoElegido === h.valor
                                ? "border-[#D4860A] bg-[#D4860A]/10"
                                : "border-[#1C3A5E]/20 bg-white hover:border-[#1C3A5E]/45"
                            }`}
                          >
                            <input
                              type="radio"
                              name="hueco"
                              value={h.valor}
                              checked={huecoElegido === h.valor}
                              onChange={(e) => setHuecoElegido(e.target.value)}
                            />
                            <span className="text-[1.05rem] leading-[1.5] text-[#0F2240] first-letter:uppercase">
                              {h.etiqueta}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {error && (
                    <p style={{ fontSize: "0.92rem", color: "#B3261E", marginBottom: "1.2rem", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  )}

                  {huecos !== null && huecos.length > 0 && (
                    <button
                      type="submit"
                      disabled={enviando}
                      style={{
                        border: "none",
                        padding: "0.95rem 2.5rem",
                        fontSize: "0.98rem",
                        letterSpacing: "0.08em",
                        cursor: enviando ? "default" : "pointer",
                        display: "block",
                        opacity: enviando ? 0.6 : 1,
                      }}
                      className="scale-100 bg-[#1C3A5E] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
                    >
                      {enviando ? HOJA_RUTA_CIERRE.enviando : HOJA_RUTA_HUECOS.boton}
                    </button>
                  )}
                </form>
              )}
            </div>
          )}

          <p className={`mt-10 ${cuerpoClase}`}>{HOJA_RUTA_CIERRE.cierre[variante]}</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
