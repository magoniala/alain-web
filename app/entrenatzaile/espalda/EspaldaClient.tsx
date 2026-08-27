"use client";

import { useEffect, useRef, useState } from "react";
import { Header, Footer, inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import { eventoPixel } from "@/app/_components/Consentimiento";
import { ESPALDA_BLOQUES, ESPALDA_FORMULARIO, ESPALDA_HERO } from "./_content";
import {
  CONSENT_ESPALDA,
  FICHA_ESPALDA_TITULO_PUBLICO,
  GENEROS,
  mensajeErrorFormulario,
  PISTAS_ESPALDA,
  PREGUNTAS_ESPALDA,
  UTM_KEYS,
  type Utm,
} from "@/lib/entrenatzaile-formularios";

// Solo el origen de la campaña viaja por la URL. Las respuestas del
// formulario no salen nunca de aquí por query string, ni por el hash, ni
// dentro de ningún parámetro de evento de medición: van en el cuerpo del
// POST y punto.
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

// Una pantalla por pregunta (son el grueso y piden escribir), y luego tres
// más: contacto, quién eres, y el permiso.
const PASO_CONTACTO = PREGUNTAS_ESPALDA.length; // 3
const PASO_PERFIL = PASO_CONTACTO + 1; // 4
const PASO_PERMISO = PASO_PERFIL + 1; // 5
const PASOS_TOTAL = PASO_PERMISO + 1; // 6

const tituloClase = "font-[family-name:var(--font-lora)] font-medium tracking-[-0.02em]";
const cuerpoClase = "text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]";

// Aclaración pequeña bajo una etiqueta o junto a una casilla.
const pistaStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  fontStyle: "italic",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.50)",
  marginBottom: "0.7rem",
};

const casillaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.6rem",
  cursor: "pointer",
  fontSize: "0.95rem",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.72)",
};

export default function EspaldaClient() {
  const [empezado, setEmpezado] = useState(false);
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<string[]>(PREGUNTAS_ESPALDA.map(() => ""));
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "", edad: "", genero: "" });
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [consentDatos, setConsentDatos] = useState(false);
  const [generoHover, setGeneroHover] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const utm = useRef<Utm>({});
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const yaMontado = useRef(false);

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

  // Al cambiar de pantalla: la tarjeta a la vista y el cursor en el primer
  // campo. En el primer render no se hace nada — el formulario está al final
  // de la página y enfocarlo al cargar arrastraría al visitante hasta abajo
  // sin haber leído nada.
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    primerCampoRef.current?.focus({ preventScroll: true });
  }, [paso, empezado]);

  function validarPaso(): string | null {
    if (paso < PASO_CONTACTO) {
      return respuestas[paso].trim() ? null : "Escribe tu respuesta para poder seguir.";
    }
    if (paso === PASO_CONTACTO) {
      if (!datos.nombre.trim()) return "Escribe tu nombre para poder seguir.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return "Escribe un email válido.";
      if (datos.telefono.replace(/[\s().+-]/g, "").length < 9) return "Escribe un teléfono válido.";
      return null;
    }
    if (paso === PASO_PERFIL) {
      const edad = Number(datos.edad);
      if (!Number.isFinite(edad) || edad < 14 || edad > 100) return "Escribe una edad válida.";
      if (!datos.genero) return "Elige una opción para seguir.";
      return null;
    }
    if (paso === PASO_PERMISO && !consentDatos) {
      return "Necesito tu permiso para tratar las respuestas antes de poder enviarte nada.";
    }
    return null;
  }

  async function avanzar(e: React.FormEvent) {
    e.preventDefault();
    const fallo = validarPaso();
    if (fallo) {
      setError(fallo);
      return;
    }
    setError("");

    if (paso < PASO_PERMISO) {
      setPaso(paso + 1);
      return;
    }

    setEnviando(true);
    // Identificador compartido con el envío desde el servidor.
    const eventId = crypto.randomUUID();

    try {
      const res = await fetch("/api/entrenatzaile/espalda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Identificador compartido con el píxel: es lo que evita que Meta
          // cuente dos veces la misma conversión.
          eventId,
          respuestas,
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          edad: datos.edad,
          genero: datos.genero,
          consentDatos,
          consentWhatsapp,
          utm: utm.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      eventoPixel("Lead", eventId);

      // Sin parámetros en la URL de destino: nada de lo que ha escrito
      // viaja hasta la página de gracias.
      const base = window.location.pathname.replace(/\/$/, "");
      window.location.assign(`${base}/gracias`);
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  // Desde la primera pregunta se vuelve al botón de entrada, como en
  // /contacto: no se queda uno atrapado dentro del formulario.
  function volver() {
    setError("");
    if (paso === 0) {
      setEmpezado(false);
      return;
    }
    setPaso(paso - 1);
  }

  function renderPaso() {
    if (paso < PASO_CONTACTO) {
      return (
        <div key={paso} className="context-fade-in">
          <div style={{ ...fieldStyle, marginBottom: 0 }}>
            <label htmlFor={`pregunta-${paso}`} style={labelStyle}>
              {paso + 1}. {PREGUNTAS_ESPALDA[paso]}
            </label>
            <p style={pistaStyle}>{PISTAS_ESPALDA[paso]}</p>
            <textarea
              id={`pregunta-${paso}`}
              ref={primerCampoRef as React.RefObject<HTMLTextAreaElement>}
              rows={4}
              value={respuestas[paso]}
              onChange={(e) =>
                setRespuestas((prev) => prev.map((r, j) => (j === paso ? e.target.value : r)))
              }
              style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
              className="placeholder:text-[#1C3A5E]/35"
            />
          </div>
        </div>
      );
    }

    if (paso === PASO_CONTACTO) {
      return (
        <div key={paso} className="context-fade-in">
          <div style={fieldStyle}>
            <label htmlFor="nombre" style={labelStyle}>
              Nombre
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.nombrePista}</p>
            <input
              id="nombre"
              ref={primerCampoRef as React.RefObject<HTMLInputElement>}
              autoComplete="given-name"
              placeholder="Tu nombre"
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              style={inputStyle}
              className="placeholder:text-[#1C3A5E]/35"
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>
              Correo electrónico
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.emailPista}</p>
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

          <div style={{ ...fieldStyle, marginBottom: "1.1rem" }}>
            <label htmlFor="telefono" style={labelStyle}>
              Teléfono
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.telefonoPista}</p>
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

          {/* Casilla opcional de WhatsApp: va pegada al teléfono, que es el
              dato al que se refiere. */}
          <label style={casillaStyle}>
            <input
              type="checkbox"
              checked={consentWhatsapp}
              onChange={(e) => setConsentWhatsapp(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            {CONSENT_ESPALDA.whatsapp}
          </label>
          <p style={{ ...pistaStyle, marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.45rem" }}>
            {ESPALDA_FORMULARIO.whatsappPista}
          </p>
        </div>
      );
    }

    if (paso === PASO_PERFIL) {
      return (
        <div key={paso} className="context-fade-in">
          <div style={fieldStyle}>
            <label htmlFor="edad" style={labelStyle}>
              Edad
            </label>
            <input
              id="edad"
              ref={primerCampoRef as React.RefObject<HTMLInputElement>}
              type="number"
              inputMode="numeric"
              min={14}
              max={100}
              placeholder="Tu edad"
              value={datos.edad}
              onChange={(e) => setDatos({ ...datos, edad: e.target.value })}
              style={inputStyle}
              className="placeholder:text-[#1C3A5E]/35"
            />
          </div>

          <div>
            <label style={labelStyle}>Género</label>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {GENEROS.map((opt) => {
                const activo = datos.genero === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDatos({ ...datos, genero: opt })}
                    onMouseEnter={() => setGeneroHover(opt)}
                    onMouseLeave={() => setGeneroHover(null)}
                    style={{
                      padding: "0.55rem 1.1rem",
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      border: `1px solid ${activo || generoHover === opt ? "#D4860A" : "rgba(28,58,94,0.25)"}`,
                      background: activo ? "rgba(212,134,10,0.10)" : "none",
                      color: activo ? "#0F2240" : "rgba(15,34,64,0.70)",
                      transition: "border-color 0.2s, background 0.2s, color 0.2s",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Último paso: el permiso. Es la base legal del art. 9 para tratar las
    // respuestas, así que va solo, sin nada más que le reste atención.
    return (
      <div key={paso} className="context-fade-in">
        <label style={casillaStyle}>
          <input
            type="checkbox"
            checked={consentDatos}
            onChange={(e) => setConsentDatos(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          {CONSENT_ESPALDA.datos}
        </label>
        <p style={{ ...pistaStyle, marginTop: "0.9rem", marginBottom: 0 }}>
          <a
            href="/privacidad"
            className="not-italic underline underline-offset-4 transition-colors hover:text-[#0F2240]"
          >
            {ESPALDA_FORMULARIO.privacidad}
          </a>
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      <section className="w-full bg-[#D4860A] px-6 py-20 md:px-16 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <h1
            className={`hero-fade-2 max-w-[900px] text-[clamp(2.1rem,7vw,4.2rem)] leading-[1.1] text-[#0F2240] ${tituloClase}`}
          >
            {ESPALDA_HERO.titulo}
          </h1>
          <p className="hero-fade-3 mt-7 max-w-[620px] text-[1.25rem] leading-[1.65] text-[#0F2240]/85 md:text-[1.4rem]">
            {ESPALDA_HERO.subtitulo}
          </p>
          <a
            href="#formulario"
            className="hero-fade-3 mt-10 inline-block scale-100 bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
          >
            {ESPALDA_HERO.cta}
          </a>
          <p className="hero-fade-3 mt-5 max-w-[520px] text-[1rem] leading-[1.6] text-[#0F2240]/75">
            <span className="font-semibold text-[#0F2240]">«{FICHA_ESPALDA_TITULO_PUBLICO}»</span>
            <br />
            {ESPALDA_HERO.ctaNota}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[680px] px-6 py-16 md:px-8 md:py-24">
        <div className="space-y-14 md:space-y-16">
          {ESPALDA_BLOQUES.map((bloque, i) => (
            <div key={i} className="fade-in">
              {bloque.titulo && (
                <h2 className={`mb-6 text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] text-[#1C3A5E] ${tituloClase}`}>
                  {bloque.titulo}
                </h2>
              )}
              <div className="space-y-5">
                {bloque.parrafos.map((p, j) => (
                  <p key={j} className={cuerpoClase}>
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="formulario" className="scroll-mt-8 px-6 pb-24 md:px-8">
        <div className="mx-auto max-w-[680px]">
          <div ref={tarjetaRef} className="p-6 md:p-10" style={cardStyle}>
            <p className="mb-6 text-[1rem] leading-[1.6] text-[#0F2240]/75">
              {ESPALDA_FORMULARIO.antesDelFormulario}{" "}
              <span className="font-semibold text-[#1C3A5E]">«{FICHA_ESPALDA_TITULO_PUBLICO}»</span>
            </p>

            {!empezado ? (
              /* El formulario vive detrás de un botón, como en /contacto: la
                 página no se cierra con un muro de campos, y quien pulsa ya
                 ha decidido que le compensa. */
              <button
                type="button"
                onClick={() => setEmpezado(true)}
                style={{
                  border: "none",
                  padding: "0.95rem 2.5rem",
                  fontSize: "0.98rem",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  display: "block",
                }}
                className="scale-100 bg-[#1C3A5E] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
              >
                {ESPALDA_FORMULARIO.empezar}
              </button>
            ) : (
              <>
            {/* Cuánto queda: los segmentos de un vistazo y el conteo escrito
                para quien quiera el número exacto. */}
            <div style={{ marginBottom: "2.5rem" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {Array.from({ length: PASOS_TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: "2px",
                      flex: 1,
                      background: i <= paso ? "#D4860A" : "rgba(28,58,94,0.15)",
                      transition: "background 0.3s",
                    }}
                  />
                ))}
              </div>
              <p
                style={{
                  marginTop: "0.7rem",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "rgba(28,58,94,0.55)",
                }}
              >
                Paso {paso + 1} de {PASOS_TOTAL}
              </p>
            </div>

            <form onSubmit={avanzar} noValidate>
              {renderPaso()}

              {error && (
                <p style={{ fontSize: "0.92rem", color: "#B3261E", marginTop: "1.5rem", lineHeight: 1.6 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                style={{
                  marginTop: "2.5rem",
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
                {paso < PASO_PERMISO
                  ? "Siguiente →"
                  : enviando
                    ? ESPALDA_FORMULARIO.enviando
                    : ESPALDA_FORMULARIO.boton}
              </button>
            </form>

            <button
              type="button"
              onClick={volver}
              style={{
                marginTop: "1.2rem",
                fontSize: "0.82rem",
                letterSpacing: "0.08em",
                color: "rgba(15,34,64,0.50)",
                background: "none",
                cursor: "pointer",
                display: "block",
                padding: 0,
              }}
              className="transition-colors duration-200 hover:text-[#0F2240]/75"
            >
              ← volver
            </button>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
