"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import {
  ACOMPANAMIENTO_TEXTOS,
  ACTIVIDAD_ACTUAL,
  ACTIVIDAD_SIN_DIAS,
  CONSENT_ACOMPANAMIENTO,
  DIAS_SEMANA,
  FRENOS,
  FRENO_OTRO,
  LUGARES,
  PISTAS_ACOMPANAMIENTO,
  PREGUNTAS_ACOMPANAMIENTO,
  RANGOS_EDAD,
} from "@/lib/acompanamiento";
import { mensajeErrorFormulario, type Utm } from "@/lib/entrenatzaile-formularios";
import { botonClase, botonStyle, casillaStyle, leerUtm, pistaStyle } from "./comun";

const bloqueStyle: React.CSSProperties = { marginBottom: "2.6rem" };

const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "none", paddingTop: "0.25rem" };

// Opciones en fila, una sola elegible. Mismo aspecto que en /audio.
function Opciones({
  nombre,
  opciones,
  valor,
  onElegir,
}: {
  nombre: string;
  opciones: readonly string[];
  valor: string;
  onElegir: (v: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div role="radiogroup" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
      {opciones.map((opt) => {
        const activo = valor === opt;
        return (
          <button
            key={`${nombre}-${opt}`}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(opt)}
            onMouseEnter={() => setHover(opt)}
            onMouseLeave={() => setHover(null)}
            style={{
              padding: "0.55rem 1.1rem",
              fontSize: "0.95rem",
              cursor: "pointer",
              border: `1px solid ${activo || hover === opt ? "#C47800" : "rgba(15,34,64,0.25)"}`,
              background: activo ? "rgba(196,120,0,0.10)" : "none",
              color: activo ? "#0F2240" : "rgba(15,34,64,0.70)",
              transition: "border-color 0.2s, background 0.2s, color 0.2s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Un solo formulario, de arriba abajo: son nueve preguntas cortas y quien
// llega desde la newsletter ya sabe a qué viene.
export default function FormularioAcompanamiento() {
  const [datos, setDatos] = useState({
    nombre: "",
    email: "",
    prefijo: "+34",
    telefono: "",
    edad: "",
    objetivo: "",
    frenosOtro: "",
    actividad: "",
    dias: "",
    salud: "",
    lugar: "",
  });
  const [frenos, setFrenos] = useState<string[]>([]);
  const [consentDatos, setConsentDatos] = useState(false);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const utm = useRef<Utm>({});
  const tarjetaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    utm.current = leerUtm();
  }, []);

  useEffect(() => {
    if (enviado) tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [enviado]);

  function alternarFreno(opcion: string) {
    setFrenos((prev) => (prev.includes(opcion) ? prev.filter((f) => f !== opcion) : [...prev, opcion]));
  }

  function validar(): string | null {
    if (!datos.nombre.trim()) return "Escribe tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return "Escribe un email válido.";
    if (datos.telefono.replace(/[\s().+-]/g, "").length < 9)
      return "Escribe un número de WhatsApp válido: es por donde te voy a escribir.";
    if (!datos.edad) return "Elige tu rango de edad.";
    if (!datos.objetivo.trim()) return "Cuéntame qué te gustaría volver a poder hacer o conseguir.";
    if (!frenos.length) return "Marca al menos una opción en qué te ha frenado.";
    if (frenos.includes(FRENO_OTRO) && !datos.frenosOtro.trim()) return "Cuéntame qué otra cosa te ha frenado.";
    if (!datos.actividad) return "Dime qué haces ahora mismo.";
    if (datos.actividad !== ACTIVIDAD_SIN_DIAS && !datos.dias) return "Dime cuántos días por semana.";
    if (!datos.lugar) return "Dime dónde entrenarías.";
    if (!consentDatos || !consentWhatsapp)
      return "Necesito que marques las dos casillas para poder valorar tu caso y escribirte.";
    return null;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const fallo = validar();
    if (fallo) {
      setError(fallo);
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/acompanamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, frenos, consentDatos, consentWhatsapp, utm: utm.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      setEnviado(true);
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div ref={tarjetaRef} className="context-fade-in p-6 md:p-10" style={cardStyle}>
        <h2 className="mb-6 font-[family-name:var(--font-fraunces)] text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] font-medium tracking-[-0.02em] text-[#0F2240]">
          {ACOMPANAMIENTO_TEXTOS.graciasTitulo}
        </h2>
        <div className="space-y-4">
          {ACOMPANAMIENTO_TEXTOS.graciasParrafos.map((p, i) => (
            <p key={i} className="text-[1.05rem] leading-[1.8] text-[#0F2240]/80">
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={tarjetaRef} className="p-6 md:p-10" style={cardStyle}>
      <form onSubmit={enviar} noValidate>
        <div style={fieldStyle}>
          <label htmlFor="nombre" style={labelStyle}>
            {PREGUNTAS_ACOMPANAMIENTO.nombre}
          </label>
          <input
            id="nombre"
            autoComplete="given-name"
            placeholder="Tu nombre"
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            style={inputStyle}
            className="placeholder:text-[#0F2240]/35"
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="email" style={labelStyle}>
            {PREGUNTAS_ACOMPANAMIENTO.email}
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
            className="placeholder:text-[#0F2240]/35"
          />
        </div>

        <div style={{ ...fieldStyle, marginBottom: "2.6rem" }}>
          <label htmlFor="telefono" style={labelStyle}>
            {PREGUNTAS_ACOMPANAMIENTO.telefono}
          </label>
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <input
              aria-label="Prefijo"
              autoComplete="tel-country-code"
              value={datos.prefijo}
              onChange={(e) => setDatos({ ...datos, prefijo: e.target.value })}
              style={{ ...inputStyle, width: "4.2rem", flex: "none" }}
            />
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="600 000 000"
              value={datos.telefono}
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
              style={inputStyle}
              className="placeholder:text-[#0F2240]/35"
            />
          </div>
        </div>

        <div style={bloqueStyle}>
          <label style={labelStyle}>{PREGUNTAS_ACOMPANAMIENTO.edad}</label>
          <Opciones
            nombre="edad"
            opciones={RANGOS_EDAD}
            valor={datos.edad}
            onElegir={(v) => setDatos({ ...datos, edad: v })}
          />
        </div>

        <div style={{ ...fieldStyle, marginBottom: "2.6rem" }}>
          <label htmlFor="objetivo" style={labelStyle}>
            {PREGUNTAS_ACOMPANAMIENTO.objetivo}
          </label>
          <textarea
            id="objetivo"
            rows={4}
            value={datos.objetivo}
            onChange={(e) => setDatos({ ...datos, objetivo: e.target.value })}
            style={textareaStyle}
          />
        </div>

        <div style={bloqueStyle}>
          <label style={labelStyle}>{PREGUNTAS_ACOMPANAMIENTO.frenos}</label>
          <p style={pistaStyle}>{PISTAS_ACOMPANAMIENTO.frenos}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.9rem" }}>
            {FRENOS.map((opt) => (
              <label key={opt} style={casillaStyle}>
                <input
                  type="checkbox"
                  checked={frenos.includes(opt)}
                  onChange={() => alternarFreno(opt)}
                  style={{ marginTop: "0.2rem" }}
                />
                {opt}
              </label>
            ))}
          </div>
          {frenos.includes(FRENO_OTRO) && (
            <div style={{ ...fieldStyle, marginTop: "1.4rem", marginBottom: 0 }}>
              <input
                aria-label="¿Qué otra cosa?"
                placeholder="¿Qué otra cosa?"
                value={datos.frenosOtro}
                onChange={(e) => setDatos({ ...datos, frenosOtro: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#0F2240]/35"
              />
            </div>
          )}
        </div>

        <div style={bloqueStyle}>
          <label style={labelStyle}>{PREGUNTAS_ACOMPANAMIENTO.actividad}</label>
          <Opciones
            nombre="actividad"
            opciones={ACTIVIDAD_ACTUAL}
            valor={datos.actividad}
            onElegir={(v) =>
              // Pasar a "Nada" no puede dejar colgados los días de antes.
              setDatos({ ...datos, actividad: v, dias: v === ACTIVIDAD_SIN_DIAS ? "" : datos.dias })
            }
          />
          {datos.actividad && datos.actividad !== ACTIVIDAD_SIN_DIAS && (
            <div style={{ marginTop: "1.6rem" }}>
              <label style={labelStyle}>{PREGUNTAS_ACOMPANAMIENTO.dias}</label>
              <Opciones
                nombre="dias"
                opciones={DIAS_SEMANA}
                valor={datos.dias}
                onElegir={(v) => setDatos({ ...datos, dias: v })}
              />
            </div>
          )}
        </div>

        <div style={{ ...fieldStyle, marginBottom: "2.6rem" }}>
          <label htmlFor="salud" style={labelStyle}>
            {PREGUNTAS_ACOMPANAMIENTO.salud}
          </label>
          <p style={pistaStyle}>{PISTAS_ACOMPANAMIENTO.salud}</p>
          <textarea
            id="salud"
            rows={3}
            value={datos.salud}
            onChange={(e) => setDatos({ ...datos, salud: e.target.value })}
            style={textareaStyle}
          />
        </div>

        <div style={bloqueStyle}>
          <label style={labelStyle}>{PREGUNTAS_ACOMPANAMIENTO.lugar}</label>
          <Opciones
            nombre="lugar"
            opciones={LUGARES}
            valor={datos.lugar}
            onElegir={(v) => setDatos({ ...datos, lugar: v })}
          />
        </div>

        {/* Las dos casillas, sin premarcar y obligatorias. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={casillaStyle}>
            <input
              type="checkbox"
              checked={consentDatos}
              onChange={(e) => setConsentDatos(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            {CONSENT_ACOMPANAMIENTO.datos}
          </label>
          <label style={casillaStyle}>
            <input
              type="checkbox"
              checked={consentWhatsapp}
              onChange={(e) => setConsentWhatsapp(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            {CONSENT_ACOMPANAMIENTO.whatsapp}
          </label>
          <p style={{ ...pistaStyle, marginBottom: 0 }}>
            <a
              href="/privacidad"
              className="not-italic underline underline-offset-4 transition-colors hover:text-[#0F2240]"
            >
              {ACOMPANAMIENTO_TEXTOS.privacidad}
            </a>
          </p>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: "0.92rem", color: "#B3261E", marginTop: "1.5rem", lineHeight: 1.6 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando} style={botonStyle(enviando)} className={botonClase}>
          {enviando ? ACOMPANAMIENTO_TEXTOS.enviando : ACOMPANAMIENTO_TEXTOS.boton}
        </button>
      </form>
    </div>
  );
}
