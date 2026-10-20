"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import {
  CONDICIONES,
  CONSENT_PARQ,
  PARQ_TEXTOS,
  PREGUNTAS_CONTACTO,
  PREGUNTAS_GENERALES,
  RESULTADOS,
  calcularResultado,
  type Respuesta,
  type ResultadoParq,
} from "@/lib/parq";
import { mensajeErrorFormulario, UTM_KEYS, type Utm } from "@/lib/entrenatzaile-formularios";

type Paso =
  | { tipo: "contacto" }
  | { tipo: "general"; indice: number }
  | { tipo: "condicion"; indice: number }
  | { tipo: "permiso" };

const PASOS_GENERALES: Paso[] = PREGUNTAS_GENERALES.map((_, i) => ({ tipo: "general", indice: i }));
const PASOS_CONDICIONES: Paso[] = CONDICIONES.map((_, i) => ({ tipo: "condicion", indice: i }));

const pistaStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  fontStyle: "italic",
  lineHeight: 1.55,
  color: "rgba(15,34,64,0.50)",
  marginBottom: "0.7rem",
};

const preguntaStyle: React.CSSProperties = {
  fontSize: "clamp(1.1rem,1.4vw,1.25rem)",
  lineHeight: 1.6,
  color: "#0F2240",
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
// nunca por query string: van en el cuerpo del POST.
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

// Sí / No en fila. Mismo aspecto que las opciones de /audio.
function SiNo({
  nombre,
  valor,
  onElegir,
}: {
  nombre: string;
  valor: Respuesta | undefined;
  onElegir: (v: Respuesta) => void;
}) {
  const [hover, setHover] = useState<Respuesta | null>(null);
  const opciones: { v: Respuesta; texto: string }[] = [
    { v: "si", texto: PARQ_TEXTOS.si },
    { v: "no", texto: PARQ_TEXTOS.no },
  ];
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
      {opciones.map(({ v, texto }) => {
        const activo = valor === v;
        return (
          <button
            key={`${nombre}-${v}`}
            type="button"
            onClick={() => onElegir(v)}
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(null)}
            aria-pressed={activo}
            style={{
              padding: "0.55rem 1.6rem",
              fontSize: "0.95rem",
              cursor: "pointer",
              border: `1px solid ${activo || hover === v ? "#C47800" : "rgba(15,34,64,0.25)"}`,
              background: activo ? "rgba(196,120,0,0.10)" : "none",
              color: activo ? "#0F2240" : "rgba(15,34,64,0.70)",
              transition: "border-color 0.2s, background 0.2s, color 0.2s",
            }}
          >
            {texto}
          </button>
        );
      })}
    </div>
  );
}

export default function FormularioParq() {
  const [paso, setPaso] = useState(0);
  const [contacto, setContacto] = useState({ nombre: "", email: "", telefono: "" });
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
  const [consentDatos, setConsentDatos] = useState(false);
  const [resultado, setResultado] = useState<ResultadoParq | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const utm = useRef<Utm>({});
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const yaMontado = useRef(false);

  useEffect(() => {
    utm.current = leerUtm();
  }, []);

  // El seguimiento solo existe si hay algún «sí» en la página 1, así que el
  // número de pasos cambia según se responde.
  const conSeguimiento = PREGUNTAS_GENERALES.some((p) => respuestas[p.id] === "si");
  const pasos: Paso[] = [
    { tipo: "contacto" },
    ...PASOS_GENERALES,
    ...(conSeguimiento ? PASOS_CONDICIONES : []),
    { tipo: "permiso" },
  ];
  const esUltimo = paso === pasos.length - 1;

  // Al cambiar de pantalla, la tarjeta a la vista. En el primer render no se
  // toca nada, para que la página no salte sola al cargar.
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [paso, resultado]);

  function responder(id: string, v: Respuesta) {
    setError("");
    setRespuestas((prev) => {
      const nuevo = { ...prev, [id]: v };
      // Si la condición pasa a «no», sus subpreguntas dejan de existir: que
      // no queden respuestas colgadas que luego cuenten en el resultado.
      const condicion = CONDICIONES.find((c) => c.id === id);
      if (condicion && v === "no") {
        for (const s of condicion.subpreguntas) delete nuevo[s.id];
      }
      return nuevo;
    });
  }

  function validarPaso(): string | null {
    const actual = pasos[paso];
    switch (actual.tipo) {
      case "contacto":
        if (!contacto.nombre.trim()) return "Escribe tu nombre para poder seguir.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.email.trim())) return "Escribe un email válido.";
        if (contacto.telefono.replace(/[\s().+-]/g, "").length < 9) return "Escribe un número de WhatsApp válido.";
        return null;
      case "general":
        return respuestas[PREGUNTAS_GENERALES[actual.indice].id] ? null : PARQ_TEXTOS.faltaRespuesta;
      case "condicion": {
        const c = CONDICIONES[actual.indice];
        if (!respuestas[c.id]) return PARQ_TEXTOS.faltaRespuesta;
        if (respuestas[c.id] === "si" && c.subpreguntas.some((s) => !respuestas[s.id]))
          return PARQ_TEXTOS.faltanSubpreguntas;
        return null;
      }
      case "permiso":
        return consentDatos ? null : PARQ_TEXTOS.faltaPermiso;
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

    if (!esUltimo) {
      setPaso(paso + 1);
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/parq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contacto, respuestas, consentDatos, utm: utm.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        return;
      }
      // Lo que se enseña es lo que ha calculado el servidor, que es lo que ha
      // quedado guardado. Si por lo que sea no lo devuelve, el del navegador
      // sale con la misma regla.
      setResultado(data.resultado ?? calcularResultado(respuestas));
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

  if (resultado) {
    const r = RESULTADOS[resultado];
    return (
      <div ref={tarjetaRef} className="context-fade-in p-6 md:p-10" style={cardStyle}>
        <h2 className="mb-6 font-[family-name:var(--font-fraunces)] text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] font-medium tracking-[-0.02em] text-[#0F2240]">
          {r.titulo}
        </h2>
        <div className="space-y-4">
          {r.parrafos.map((p, i) => (
            <p key={i} className="text-[1.05rem] leading-[1.8] text-[#0F2240]/80">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-9 border-l-2 border-[#C47800]/50 pl-4">
          <p className="mb-3 text-[1.02rem] font-medium text-[#0F2240]">{RESULTADOS.esperaTitulo}</p>
          <ul className="space-y-2.5">
            {RESULTADOS.espera.map((p, i) => (
              <li key={i} className="text-[0.98rem] leading-[1.7] text-[#0F2240]/80">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-9 text-[0.82rem] tracking-[0.08em] text-[#0F2240]/60 underline underline-offset-4 transition-colors hover:text-[#0F2240] print:hidden"
        >
          {PARQ_TEXTOS.imprimir}
        </button>
      </div>
    );
  }

  function renderPaso() {
    const actual = pasos[paso];
    switch (actual.tipo) {
      case "contacto":
        return (
          <div key="contacto" className="context-fade-in">
            <div style={fieldStyle}>
              <label htmlFor="nombre" style={labelStyle}>
                {PREGUNTAS_CONTACTO.nombre}
              </label>
              <input
                id="nombre"
                ref={primerCampoRef}
                autoComplete="name"
                placeholder="Tu nombre"
                value={contacto.nombre}
                onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#0F2240]/35"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="email" style={labelStyle}>
                {PREGUNTAS_CONTACTO.email}
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={contacto.email}
                onChange={(e) => setContacto({ ...contacto, email: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#0F2240]/35"
              />
            </div>

            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label htmlFor="telefono" style={labelStyle}>
                {PREGUNTAS_CONTACTO.telefono}
              </label>
              <input
                id="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+34 600 000 000"
                value={contacto.telefono}
                onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#0F2240]/35"
              />
            </div>
          </div>
        );

      case "general": {
        const p = PREGUNTAS_GENERALES[actual.indice];
        return (
          <div key={p.id} className="context-fade-in">
            <p style={preguntaStyle}>{p.texto}</p>
            {p.pista && <p style={pistaStyle}>{p.pista}</p>}
            <SiNo nombre={p.id} valor={respuestas[p.id]} onElegir={(v) => responder(p.id, v)} />
          </div>
        );
      }

      case "condicion": {
        const c = CONDICIONES[actual.indice];
        return (
          <div key={c.id} className="context-fade-in">
            <p style={preguntaStyle}>{c.texto}</p>
            {c.pista && <p style={pistaStyle}>{c.pista}</p>}
            <SiNo nombre={c.id} valor={respuestas[c.id]} onElegir={(v) => responder(c.id, v)} />

            {respuestas[c.id] === "si" && (
              <div
                className="context-fade-in"
                style={{ marginTop: "2.2rem", display: "flex", flexDirection: "column", gap: "2rem" }}
              >
                {c.subpreguntas.map((s) => (
                  <div key={s.id} style={{ borderTop: "1px solid rgba(15,34,64,0.12)", paddingTop: "1.5rem" }}>
                    <p style={{ ...preguntaStyle, fontSize: "1.02rem" }}>{s.texto}</p>
                    {s.pista && <p style={pistaStyle}>{s.pista}</p>}
                    <SiNo nombre={s.id} valor={respuestas[s.id]} onElegir={(v) => responder(s.id, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

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
              {CONSENT_PARQ.datos}
            </label>
            <p style={{ ...pistaStyle, marginTop: "0.9rem", marginBottom: 0 }}>
              <a
                href="/privacidad"
                className="not-italic underline underline-offset-4 transition-colors hover:text-[#0F2240]"
              >
                {PARQ_TEXTOS.privacidad}
              </a>
            </p>
          </div>
        );
    }
  }

  const tipo = pasos[paso].tipo;
  const etiquetaPaso =
    tipo === "contacto"
      ? "Tus datos"
      : tipo === "general"
        ? "Preguntas generales"
        : tipo === "condicion"
          ? "Preguntas de seguimiento"
          : "Permiso";

  return (
    <div ref={tarjetaRef} className="p-6 md:p-10" style={cardStyle}>
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {pasos.map((_, i) => (
            <div
              key={i}
              style={{
                height: "2px",
                flex: 1,
                background: i <= paso ? "#C47800" : "rgba(15,34,64,0.15)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <p style={{ ...labelStyle, marginTop: "0.7rem", marginBottom: 0, color: "rgba(15,34,64,0.55)" }}>
          {etiquetaPaso} · {paso + 1} de {pasos.length}
        </p>
      </div>

      <form onSubmit={avanzar} noValidate>
        {renderPaso()}

        {error && (
          <p style={{ fontSize: "0.92rem", color: "#B3261E", marginTop: "1.5rem", lineHeight: 1.6 }}>{error}</p>
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
          className="rounded-xl scale-100 bg-[#0F2240] text-[#F7F1E6] shadow-md transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-lg"
        >
          {!esUltimo ? PARQ_TEXTOS.siguiente : enviando ? PARQ_TEXTOS.enviando : PARQ_TEXTOS.verResultado}
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
          {PARQ_TEXTOS.volver}
        </button>
      )}
    </div>
  );
}
