"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import { ESPALDA_FORMULARIO } from "./_content";
import {
  CONSENT_ESPALDA,
  FICHA_ESPALDA_TITULO_PUBLICO,
  GENEROS,
  mensajeErrorFormulario,
  PISTAS_ESPALDA,
  PREGUNTAS_ESPALDA,
  type Utm,
} from "@/lib/entrenatzaile-formularios";

// Una pantalla por pregunta (son el grueso y piden escribir), y luego tres
// más: contacto, quién eres, y el permiso.
const PASO_CONTACTO = PREGUNTAS_ESPALDA.length; // 3
const PASO_PERFIL = PASO_CONTACTO + 1; // 4
const PASO_PERMISO = PASO_PERFIL + 1; // 5
const PASOS_TOTAL = PASO_PERMISO + 1; // 6

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

// El mismo formulario aparece dos veces en la página: una encima del cuerpo,
// para quien ya ha decidido, y otra al final, para quien necesitaba leerlo
// entero. Son dos instancias independientes —lo que se escribe en una no
// aparece en la otra— y por eso cada campo lleva su posición pegada al id:
// dos <label for="nombre"> en la misma página harían que tocar la etiqueta
// de abajo enfocara el campo de arriba.
export default function FormularioEspalda({
  posicion,
  marcar,
  origenActual,
  irAGracias,
}: {
  posicion: "top" | "bottom";
  // marcar() ya descarta los repetidos por sesión, así que da igual cuál de
  // los dos formularios dispare un paso: cuenta una vez y solo la primera.
  marcar: (evento: string, detalle?: string) => void;
  origenActual: () => Utm;
  irAGracias: (token: unknown) => void;
}) {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<string[]>(PREGUNTAS_ESPALDA.map(() => ""));
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "", edad: "", genero: "" });
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [consentDatos, setConsentDatos] = useState(false);
  const [generoHover, setGeneroHover] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const yaMontado = useRef(false);

  // Sufijo de los ids. Es lo único que distingue un formulario del otro en
  // el DOM.
  const id = (campo: string) => `${campo}-${posicion}`;

  // Cuántos llegan a tener el formulario delante. Con dos en la página, el
  // primero que entre en pantalla es el que cuenta; del segundo no sale nada
  // porque marcar() ya lo ha registrado.
  useEffect(() => {
    const tarjeta = tarjetaRef.current;
    if (!tarjeta) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        marcar("form_visible");
        observer.disconnect();
      }
    });
    observer.observe(tarjeta);
    return () => observer.disconnect();
  }, [marcar]);

  // Al cambiar de pantalla: la tarjeta a la vista y el cursor en el primer
  // campo. En el primer render no se hace nada, y aquí es más importante que
  // nunca: con dos formularios montados a la vez, enfocar al montar haría
  // que la página saltara sola a uno de los dos nada más cargar.
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    primerCampoRef.current?.focus({ preventScroll: true });
  }, [paso]);

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

    // El paso ha validado, así que está completo. Se cuenta aquí y no en el
    // clic: pulsar "Siguiente" con un campo vacío no es haberlo rellenado.
    if (paso < PASO_CONTACTO) marcar(`q${paso + 1}_done`);
    else if (paso === PASO_CONTACTO) marcar("datos_done");
    else if (paso === PASO_PERFIL) marcar("perfil_done");

    if (paso < PASO_PERMISO) {
      setPaso(paso + 1);
      return;
    }

    setEnviando(true);

    try {
      const res = await fetch("/api/entrenatzaile/espalda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respuestas,
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          edad: datos.edad,
          genero: datos.genero,
          consentDatos,
          consentWhatsapp,
          utm: origenActual(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        marcar("submit_error", String(res.status));
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      // "top" o "bottom": el único dato del envío que se guarda en el
      // embudo, y sirve para saber cuál de los dos formularios convierte.
      marcar("submit_ok", posicion);
      irAGracias(data.t);
    } catch {
      marcar("submit_error", "red");
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  function volver() {
    setError("");
    setPaso(paso - 1);
  }

  function renderPaso() {
    if (paso < PASO_CONTACTO) {
      return (
        <div key={paso} className="context-fade-in">
          <div style={{ ...fieldStyle, marginBottom: 0 }}>
            <label htmlFor={id(`pregunta-${paso}`)} style={labelStyle}>
              {paso + 1}. {PREGUNTAS_ESPALDA[paso]}
            </label>
            <p style={pistaStyle}>{PISTAS_ESPALDA[paso]}</p>
            <textarea
              id={id(`pregunta-${paso}`)}
              ref={primerCampoRef as React.RefObject<HTMLTextAreaElement>}
              rows={4}
              value={respuestas[paso]}
              onChange={(e) =>
                setRespuestas((prev) => prev.map((r, j) => (j === paso ? e.target.value : r)))
              }
              onBlur={() => {
                if (respuestas[paso].trim()) marcar(`q${paso + 1}_done`);
              }}
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
            <label htmlFor={id("nombre")} style={labelStyle}>
              Nombre
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.nombrePista}</p>
            <input
              id={id("nombre")}
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
            <label htmlFor={id("email")} style={labelStyle}>
              Correo electrónico
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.emailPista}</p>
            <input
              id={id("email")}
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
            <label htmlFor={id("telefono")} style={labelStyle}>
              Teléfono
            </label>
            <p style={pistaStyle}>{ESPALDA_FORMULARIO.telefonoPista}</p>
            <input
              id={id("telefono")}
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
            <label htmlFor={id("edad")} style={labelStyle}>
              Edad
            </label>
            <input
              id={id("edad")}
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
            onChange={(e) => {
              setConsentDatos(e.target.checked);
              if (e.target.checked) marcar("consent_done");
            }}
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
    <div ref={tarjetaRef} className="p-6 md:p-10" style={cardStyle}>
      <p className="mb-6 text-[1rem] leading-[1.6] text-[#0F2240]/75">
        {ESPALDA_FORMULARIO.antesDelFormulario}{" "}
        <span className="font-semibold text-[#1C3A5E]">«{FICHA_ESPALDA_TITULO_PUBLICO}»</span>
      </p>

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

      <form
        onSubmit={avanzar}
        onFocus={() => marcar("form_start")}
        onChange={() => marcar("form_start")}
        noValidate
      >
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

      {/* Sin portezuela que cerrar, en la primera pregunta no hay adónde
          volver: el botón solo aparece a partir de la segunda pantalla. */}
      {paso > 0 && (
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
      )}
    </div>
  );
}
