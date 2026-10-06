"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import {
  AUDIO_TEXTOS,
  AVISO_BANDERA_ROJA,
  BANDERAS_ROJAS,
  BANDERA_NINGUNA,
  CONSENT_AUDIO,
  DIAS_SEMANA,
  EJERCICIO_ACTUAL,
  EJERCICIO_OTRO,
  EJERCICIO_SIN_DIAS,
  FRECUENCIA_LUMBAGO,
  PISTAS_AUDIO,
  PREGUNTAS_AUDIO,
  RANGOS_EDAD,
  TIEMPO_SEMANAL,
  tieneBanderaRoja,
} from "@/lib/audio-formularios";
import { mensajeErrorFormulario, UTM_KEYS, type Utm } from "@/lib/entrenatzaile-formularios";

// Una pantalla por bloque, en el orden en que se le pregunta.
const PASOS = [
  "contacto",
  "edad",
  "frecuencia",
  "ultimo",
  "banderas",
  "ejercicio",
  "tiempo",
  "deseo",
  "extra",
  "permiso",
] as const;

const PASO_PERMISO = PASOS.length - 1;

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

// Solo el origen de la campaña se lee de la URL. Las respuestas no viajan
// nunca por query string: van en el cuerpo del POST y punto.
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

// Opciones en fila, una sola elegible. Mismo aspecto que el selector de
// género de /espalda, que es el patrón que ya conoce quien llega aquí.
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
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
      {opciones.map((opt) => {
        const activo = valor === opt;
        return (
          <button
            key={`${nombre}-${opt}`}
            type="button"
            onClick={() => onElegir(opt)}
            onMouseEnter={() => setHover(opt)}
            onMouseLeave={() => setHover(null)}
            aria-pressed={activo}
            style={{
              padding: "0.55rem 1.1rem",
              fontSize: "0.95rem",
              cursor: "pointer",
              border: `1px solid ${activo || hover === opt ? "#D4860A" : "rgba(28,58,94,0.25)"}`,
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
  );
}

export default function FormularioAudio() {
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState({
    nombre: "",
    email: "",
    telefono: "",
    edad: "",
    frecuencia: "",
    ultimo: "",
    ejercicio: "",
    ejercicioDetalle: "",
    dias: "",
    tiempo: "",
    deseo: "",
    extra: "",
  });
  const [banderas, setBanderas] = useState<string[]>([]);
  const [consentDatos, setConsentDatos] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const utm = useRef<Utm>({});
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const yaMontado = useRef(false);

  useEffect(() => {
    utm.current = leerUtm();
  }, []);

  // Al cambiar de pantalla: la tarjeta a la vista y el cursor en el primer
  // campo. En el primer render no se toca nada, para que la página no salte
  // sola al cargar.
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    primerCampoRef.current?.focus({ preventScroll: true });
  }, [paso, enviado]);

  // "Ninguna" es excluyente: no se puede no tener nada y tener algo.
  function alternarBandera(opcion: string) {
    setBanderas((prev) => {
      if (opcion === BANDERA_NINGUNA) {
        return prev.includes(BANDERA_NINGUNA) ? [] : [BANDERA_NINGUNA];
      }
      const sinNinguna = prev.filter((b) => b !== BANDERA_NINGUNA);
      return sinNinguna.includes(opcion)
        ? sinNinguna.filter((b) => b !== opcion)
        : [...sinNinguna, opcion];
    });
  }

  function validarPaso(): string | null {
    switch (PASOS[paso]) {
      case "contacto":
        if (!datos.nombre.trim()) return "Escribe tu nombre para poder seguir.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return "Escribe un email válido.";
        if (datos.telefono.replace(/[\s().+-]/g, "").length < 9)
          return "Escribe un número de WhatsApp válido: es donde te llega el audio.";
        return null;
      case "edad":
        return datos.edad ? null : "Elige un rango para seguir.";
      case "frecuencia":
        return datos.frecuencia ? null : "Elige una opción para seguir.";
      case "ultimo":
        return datos.ultimo.trim() ? null : "Escribe tu respuesta para poder seguir.";
      case "banderas":
        // La única pregunta de la lista que no admite el silencio: si no
        // marca nada no se sabe si no tiene ninguna o si no la ha leído.
        return banderas.length ? null : "Marca al menos una opción. Si no te pasa ninguna, marca «Ninguna».";
      case "ejercicio":
        if (!datos.ejercicio) return "Elige una opción para seguir.";
        if (datos.ejercicio === EJERCICIO_OTRO && !datos.ejercicioDetalle.trim())
          return "Dime qué deporte es.";
        if (datos.ejercicio !== EJERCICIO_SIN_DIAS && !datos.dias)
          return "Dime cuántos días a la semana.";
        return null;
      case "tiempo":
        return datos.tiempo ? null : "Elige una opción para seguir.";
      case "deseo":
        return datos.deseo.trim() ? null : "Escribe tu respuesta: es la pregunta que más me sirve de todas.";
      case "extra":
        // Opcional de verdad: se puede pasar de largo.
        return null;
      case "permiso":
        return consentDatos
          ? null
          : "Necesito tu permiso para tratar las respuestas antes de poder prepararte nada.";
    }
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
    try {
      const res = await fetch("/api/entrenatzaile/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, banderas, consentDatos, utm: utm.current }),
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

  function volver() {
    setError("");
    setPaso(paso - 1);
  }

  // Confirmación en la misma página: no hay nada que enlazar ni que medir
  // aparte, así que no se le manda a otra URL.
  if (enviado) {
    return (
      <div ref={tarjetaRef} className="context-fade-in p-6 md:p-10" style={cardStyle}>
        <h2
          className="mb-6 font-[family-name:var(--font-lora)] text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] font-medium tracking-[-0.02em] text-[#1C3A5E]"
        >
          {AUDIO_TEXTOS.graciasTitulo}
        </h2>
        <div className="space-y-4">
          {AUDIO_TEXTOS.graciasParrafos.map((p, i) => (
            <p key={i} className="text-[1.05rem] leading-[1.8] text-[#0F2240]/80">
              {p}
            </p>
          ))}
        </div>
        {tieneBanderaRoja(banderas) && (
          <p
            className="mt-7 border-l-2 border-[#B3261E]/50 pl-4 text-[1.02rem] leading-[1.7] text-[#0F2240]/85"
          >
            {AVISO_BANDERA_ROJA}
          </p>
        )}
      </div>
    );
  }

  function renderPaso() {
    switch (PASOS[paso]) {
      case "contacto":
        return (
          <div key="contacto" className="context-fade-in">
            <div style={fieldStyle}>
              <label htmlFor="nombre" style={labelStyle}>
                {PREGUNTAS_AUDIO.nombre}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.nombre}</p>
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
                {PREGUNTAS_AUDIO.email}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.email}</p>
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

            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label htmlFor="telefono" style={labelStyle}>
                {PREGUNTAS_AUDIO.telefono}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.telefono}</p>
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
          </div>
        );

      case "edad":
        return (
          <div key="edad" className="context-fade-in">
            <label style={labelStyle}>{PREGUNTAS_AUDIO.edad}</label>
            <Opciones
              nombre="edad"
              opciones={RANGOS_EDAD}
              valor={datos.edad}
              onElegir={(v) => setDatos({ ...datos, edad: v })}
            />
          </div>
        );

      case "frecuencia":
        return (
          <div key="frecuencia" className="context-fade-in">
            <label style={labelStyle}>{PREGUNTAS_AUDIO.frecuencia}</label>
            <Opciones
              nombre="frecuencia"
              opciones={FRECUENCIA_LUMBAGO}
              valor={datos.frecuencia}
              onElegir={(v) => setDatos({ ...datos, frecuencia: v })}
            />
          </div>
        );

      case "ultimo":
        return (
          <div key="ultimo" className="context-fade-in">
            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label htmlFor="ultimo" style={labelStyle}>
                {PREGUNTAS_AUDIO.ultimo}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.ultimo}</p>
              <textarea
                id="ultimo"
                ref={primerCampoRef as React.RefObject<HTMLTextAreaElement>}
                rows={3}
                value={datos.ultimo}
                onChange={(e) => setDatos({ ...datos, ultimo: e.target.value })}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#1C3A5E]/35"
              />
            </div>
          </div>
        );

      case "banderas":
        return (
          <div key="banderas" className="context-fade-in">
            <label style={labelStyle}>{PREGUNTAS_AUDIO.banderas}</label>
            <p style={pistaStyle}>{PISTAS_AUDIO.banderas}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.9rem" }}>
              {BANDERAS_ROJAS.map((opt) => (
                <label key={opt} style={casillaStyle}>
                  <input
                    type="checkbox"
                    checked={banderas.includes(opt)}
                    onChange={() => alternarBandera(opt)}
                    style={{ marginTop: "0.2rem" }}
                  />
                  {opt}
                </label>
              ))}
            </div>
            {/* Lo que el audio le va a decir, dicho ya. No bloquea el envío:
                el audio sale igual, pero esto no puede esperar 72 horas. */}
            {tieneBanderaRoja(banderas) && (
              <p className="mt-6 border-l-2 border-[#B3261E]/50 pl-4 text-[0.98rem] leading-[1.7] text-[#0F2240]/85">
                {AVISO_BANDERA_ROJA}
              </p>
            )}
          </div>
        );

      case "ejercicio":
        return (
          <div key="ejercicio" className="context-fade-in">
            <label style={labelStyle}>{PREGUNTAS_AUDIO.ejercicio}</label>
            <Opciones
              nombre="ejercicio"
              opciones={EJERCICIO_ACTUAL}
              valor={datos.ejercicio}
              onElegir={(v) =>
                setDatos({
                  ...datos,
                  ejercicio: v,
                  // Cambiar de opción no puede dejar colgados los datos de la
                  // anterior: ni días de quien ahora dice que no hace nada, ni
                  // el nombre de un deporte que ya no es "otro".
                  dias: v === EJERCICIO_SIN_DIAS ? "" : datos.dias,
                  ejercicioDetalle: v === EJERCICIO_OTRO ? datos.ejercicioDetalle : "",
                })
              }
            />

            {datos.ejercicio === EJERCICIO_OTRO && (
              <div style={{ ...fieldStyle, marginTop: "2rem", marginBottom: 0 }}>
                <label htmlFor="ejercicioDetalle" style={labelStyle}>
                  ¿Cuál?
                </label>
                <input
                  id="ejercicioDetalle"
                  placeholder="Pádel, bici, natación…"
                  value={datos.ejercicioDetalle}
                  onChange={(e) => setDatos({ ...datos, ejercicioDetalle: e.target.value })}
                  style={inputStyle}
                  className="placeholder:text-[#1C3A5E]/35"
                />
              </div>
            )}

            {datos.ejercicio && datos.ejercicio !== EJERCICIO_SIN_DIAS && (
              <div style={{ marginTop: "2rem" }}>
                <label style={labelStyle}>{PREGUNTAS_AUDIO.dias}</label>
                <p style={pistaStyle}>{PISTAS_AUDIO.dias}</p>
                <Opciones
                  nombre="dias"
                  opciones={DIAS_SEMANA}
                  valor={datos.dias}
                  onElegir={(v) => setDatos({ ...datos, dias: v })}
                />
              </div>
            )}
          </div>
        );

      case "tiempo":
        return (
          <div key="tiempo" className="context-fade-in">
            <label style={labelStyle}>{PREGUNTAS_AUDIO.tiempo}</label>
            <p style={pistaStyle}>{PISTAS_AUDIO.tiempo}</p>
            <Opciones
              nombre="tiempo"
              opciones={TIEMPO_SEMANAL}
              valor={datos.tiempo}
              onElegir={(v) => setDatos({ ...datos, tiempo: v })}
            />
          </div>
        );

      case "deseo":
        return (
          <div key="deseo" className="context-fade-in">
            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label htmlFor="deseo" style={labelStyle}>
                {PREGUNTAS_AUDIO.deseo}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.deseo}</p>
              <textarea
                id="deseo"
                ref={primerCampoRef as React.RefObject<HTMLTextAreaElement>}
                rows={4}
                value={datos.deseo}
                onChange={(e) => setDatos({ ...datos, deseo: e.target.value })}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#1C3A5E]/35"
              />
            </div>
          </div>
        );

      case "extra":
        return (
          <div key="extra" className="context-fade-in">
            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label htmlFor="extra" style={labelStyle}>
                {PREGUNTAS_AUDIO.extra}
              </label>
              <p style={pistaStyle}>{PISTAS_AUDIO.extra}</p>
              <textarea
                id="extra"
                ref={primerCampoRef as React.RefObject<HTMLTextAreaElement>}
                rows={4}
                value={datos.extra}
                onChange={(e) => setDatos({ ...datos, extra: e.target.value })}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#1C3A5E]/35"
              />
            </div>
          </div>
        );

      // Último paso: el permiso. Es la base legal del art. 9 para tratar las
      // respuestas, así que va solo, sin nada que le reste atención.
      case "permiso":
        return (
          <div key="permiso" className="context-fade-in">
            <label style={casillaStyle}>
              <input
                type="checkbox"
                checked={consentDatos}
                onChange={(e) => setConsentDatos(e.target.checked)}
                style={{ marginTop: "0.2rem" }}
              />
              {CONSENT_AUDIO.datos}
            </label>
            <p style={{ ...pistaStyle, marginTop: "0.9rem", marginBottom: 0 }}>
              <a
                href="/privacidad"
                className="not-italic underline underline-offset-4 transition-colors hover:text-[#0F2240]"
              >
                {AUDIO_TEXTOS.privacidad}
              </a>
            </p>
          </div>
        );
    }
  }

  return (
    <div ref={tarjetaRef} className="p-6 md:p-10" style={cardStyle}>
      {/* Cuánto queda: los segmentos de un vistazo y el conteo escrito para
          quien quiera el número exacto. */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {PASOS.map((_, i) => (
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
          Paso {paso + 1} de {PASOS.length}
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
            ? AUDIO_TEXTOS.siguiente
            : enviando
              ? AUDIO_TEXTOS.enviando
              : AUDIO_TEXTOS.boton}
        </button>
      </form>

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
          {AUDIO_TEXTOS.volver}
        </button>
      )}
    </div>
  );
}
