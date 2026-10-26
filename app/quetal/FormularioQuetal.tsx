"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AUDIENCIA,
  EMAIL_RE,
  LIMITES,
  PERMISOS,
  PREGUNTAS_TIPO,
  REPETIR,
  TIPOS_EVENTO,
  VALORACIONES,
  preguntaVisible,
  type CampoValoracion,
  type Idioma,
  type Permiso,
  type Repetir,
  type TipoEvento,
} from "@/lib/quetal";
import { QUETAL_TEXTOS } from "@/lib/quetal-textos";

export type Inicial = {
  token?: string;
  tipo?: TipoEvento;
  idioma: Idioma;
  nombre: string;
  entidad: string;
  nombreEvento: string;
  fecha: string;
  respondido: boolean;
};

// Misma estética que /contacto: inputs con solo la línea de abajo, etiquetas
// en mayúsculas pequeñas, opciones en lista y cian para lo elegido.
const CIAN = "#2ED3E6";

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

const fieldStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(242,242,240,0.12)",
  marginBottom: "2rem",
};

const preguntaStyle: React.CSSProperties = {
  fontSize: "clamp(1.15rem,1.45vw,1.35rem)",
  color: "rgba(242,242,240,0.90)",
  marginBottom: "1.2rem",
  lineHeight: 1.5,
};

const ayudaStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  lineHeight: 1.6,
  color: "rgba(242,242,240,0.55)",
  marginTop: "0.6rem",
};

const errorStyle: React.CSSProperties = { fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" };

const TOTAL_PASOS = 6;

type ValorNota = number | "na" | "";

type Datos = {
  tipo: TipoEvento | "";
  nombreEvento: string;
  fecha: string;
  nombre: string;
  cargo: string;
  entidad: string;
  email: string;
  nps: number | null;
  testimonio: string;
  momento: string;
  dudas: string;
  tipoResp: Record<string, string>;
  val: Record<CampoValoracion, ValorNota>;
  comentarioTrato: string;
  repetir: Repetir | "";
  referidoNombre: string;
  referidoContacto: string;
  referidoPermiso: boolean;
  mejora: string;
  permiso: Permiso | "";
  permisoLogo: boolean;
  permisoFotos: boolean;
  privacidad: boolean;
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

// Botón cuadrado para las escalas (0–10 y 1–5).
function Casilla({ elegida, onClick, children, ancho }: { elegida: boolean; onClick: () => void; children: React.ReactNode; ancho?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={elegida}
      style={{
        height: "2.75rem",
        minWidth: ancho ? undefined : "2.75rem",
        padding: ancho ? "0 0.9rem" : 0,
        border: `1px solid ${elegida ? CIAN : "rgba(242,242,240,0.18)"}`,
        background: elegida ? "rgba(46,211,230,0.08)" : "none",
        color: elegida ? CIAN : "rgba(242,242,240,0.78)",
        fontSize: ancho ? "0.88rem" : "1rem",
        cursor: "pointer",
        transition: "color 0.2s, border-color 0.2s",
      }}
      className={elegida ? "" : "hover:border-white/40"}
    >
      {children}
    </button>
  );
}

function Casilla2({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer", lineHeight: 1.55 }} className="text-[#F2F2F0]/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: "0.3rem", width: "1.05rem", height: "1.05rem", accentColor: CIAN, flexShrink: 0 }}
      />
      <span>{children}</span>
    </label>
  );
}

export default function FormularioQuetal({ inicial, resenaUrl }: { inicial: Inicial; resenaUrl: string }) {
  const [idioma, setIdioma] = useState<Idioma>(inicial.idioma);
  const [paso, setPaso] = useState(1);
  const [estado, setEstado] = useState<"form" | "gracias" | "ya">(inicial.respondido ? "ya" : "form");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const abiertoEn = useRef(0);
  const tarjeta = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<Datos>({
    tipo: inicial.tipo ?? "",
    nombreEvento: inicial.nombreEvento,
    fecha: inicial.fecha,
    nombre: inicial.nombre,
    cargo: "",
    entidad: inicial.entidad,
    email: "",
    nps: null,
    testimonio: "",
    momento: "",
    dudas: "",
    tipoResp: {},
    val: { val_comunicacion: "", val_promocional: "", val_puntualidad: "", val_adaptacion: "" },
    comentarioTrato: "",
    repetir: "",
    referidoNombre: "",
    referidoContacto: "",
    referidoPermiso: false,
    mejora: "",
    permiso: "",
    permisoLogo: false,
    permisoFotos: false,
    privacidad: false,
    web: "",
  });

  const T = QUETAL_TEXTOS[idioma];
  const conToken = Boolean(inicial.token);
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setError("");
  };

  useEffect(() => {
    abiertoEn.current = Date.now();
  }, []);

  useEffect(() => {
    document.documentElement.lang = idioma;
    document.title = T.meta;
  }, [idioma, T.meta]);

  // Al cambiar de paso, que el principio de la tarjeta quede a la vista: en
  // el móvil el botón de siguiente queda muy abajo.
  useEffect(() => {
    if (paso > 1 || estado !== "form") tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [paso, estado]);

  function validar(p: number): string {
    if (p === 1) {
      if (!d.nombre.trim() || !d.entidad.trim() || !d.nombreEvento.trim()) return T.errores.obligatorios;
      if (!conToken && (!d.tipo || !d.fecha)) return T.errores.obligatorios;
      if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) return T.errores.email;
    }
    if (p === 2) {
      if (d.nps === null) return T.errores.nps;
      if (!d.testimonio.trim()) return T.errores.testimonio;
    }
    if (p === 6) {
      if (!d.permiso) return T.errores.permiso;
      if (!d.privacidad) return T.errores.privacidad;
    }
    return "";
  }

  async function siguiente() {
    const e = validar(paso);
    if (e) {
      setError(e);
      return;
    }
    if (paso < TOTAL_PASOS) {
      setPaso(paso + 1);
      return;
    }
    await enviar();
  }

  async function enviar() {
    setEnviando(true);
    setError("");
    const tipo = d.tipo as TipoEvento;
    const visibles = PREGUNTAS_TIPO[tipo].filter((q) => preguntaVisible(q, d.tipoResp));
    const respuestasTipo = Object.fromEntries(
      visibles.map((q) => [q.id, d.tipoResp[q.id]?.trim() ?? ""]).filter(([, v]) => v)
    );
    const logoPosible = d.permiso === "completo" || d.permiso === "entidad";
    try {
      const res = await fetch("/api/quetal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inicial.token ?? null,
          idioma,
          tipo,
          nombreEvento: d.nombreEvento,
          fecha: d.fecha || null,
          nombre: d.nombre,
          cargo: d.cargo,
          entidad: d.entidad,
          email: d.email,
          nps: d.nps,
          testimonio: d.testimonio,
          momento: d.momento,
          dudas: d.dudas,
          respuestasTipo,
          valoraciones: Object.fromEntries(VALORACIONES.map((k) => [k, typeof d.val[k] === "number" ? d.val[k] : null])),
          comentarioTrato: d.comentarioTrato,
          repetir: d.repetir || null,
          referidoNombre: d.referidoNombre,
          referidoContacto: d.referidoContacto,
          referidoPermiso: d.referidoPermiso,
          mejora: d.mejora,
          permiso: d.permiso,
          permisoLogo: logoPosible && d.permisoLogo,
          permisoFotos: d.permisoFotos,
          privacidad: d.privacidad,
          web: d.web,
          abiertoEn: abiertoEn.current,
        }),
      });
      if (res.status === 409) {
        setEstado("ya");
        return;
      }
      if (!res.ok) throw new Error();
      setEstado("gracias");
    } catch {
      setError(T.errores.envio);
    } finally {
      setEnviando(false);
    }
  }

  function atras() {
    setError("");
    setPaso(Math.max(1, paso - 1));
  }

  const campo = (k: "nombre" | "cargo" | "entidad" | "email" | "nombreEvento", etiqueta: string, opts: { obligatorio?: boolean; tipo?: string; placeholder?: string; max?: number } = {}) => (
    <div style={fieldStyle}>
      <label style={labelStyle} htmlFor={`q-${k}`}>
        {etiqueta}
        {opts.obligatorio && " *"}
      </label>
      <input
        id={`q-${k}`}
        type={opts.tipo ?? "text"}
        value={d[k]}
        maxLength={opts.max ?? LIMITES.corto}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, e.target.value)}
        style={inputStyle}
        className="placeholder:text-[#F2F2F0]/30"
        autoComplete={k === "nombre" ? "name" : k === "email" ? "email" : k === "entidad" ? "organization" : "off"}
      />
    </div>
  );

  const area = (valor: string, onChange: (v: string) => void, opts: { filas?: number; max?: number; id?: string } = {}) => (
    <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
      <textarea
        id={opts.id}
        value={valor}
        maxLength={opts.max ?? LIMITES.respuesta}
        rows={opts.filas ?? 2}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, resize: "vertical", paddingTop: "0.25rem" }}
      />
    </div>
  );

  const pregunta = (texto: string, obligatorio = false, id?: string) => (
    <label htmlFor={id} style={{ ...preguntaStyle, display: "block" }}>
      {texto}
      {obligatorio && " *"}
    </label>
  );

  const bloque = (hijos: React.ReactNode) => <div style={{ marginBottom: "2.5rem" }}>{hijos}</div>;

  function renderPaso() {
    switch (paso) {
      case 1:
        return (
          <>
            {campo("nombre", T.nombre, { obligatorio: true })}
            {campo("cargo", T.cargo, { placeholder: T.cargoPlaceholder })}
            {campo("entidad", T.entidad, { obligatorio: true })}
            {campo("email", T.email, { tipo: "email", max: LIMITES.email, placeholder: idioma === "eu" ? "zu@email.com" : "tu@email.com" })}
            <p style={{ ...ayudaStyle, marginTop: "-1.4rem", marginBottom: "2.5rem" }}>{T.emailAyuda}</p>

            <p style={{ ...labelStyle, color: CIAN, marginBottom: "1.4rem" }}>{T.eventoTitulo}</p>
            {!conToken && (
              <div style={{ marginBottom: "2rem" }}>
                <span style={labelStyle}>{T.tipoEvento} *</span>
                {TIPOS_EVENTO.map((t) => (
                  <Opcion key={t} elegida={d.tipo === t} onClick={() => setD((p) => ({ ...p, tipo: t, tipoResp: p.tipo === t ? p.tipoResp : {} }))}>
                    {T.tipos[t]}
                  </Opcion>
                ))}
              </div>
            )}
            {conToken && d.tipo && (
              <p style={{ marginBottom: "2rem" }}>
                <span style={labelStyle}>{T.tipoEvento}</span>
                <span className="text-[#F2F2F0]/80">{T.tipos[d.tipo]}</span>
              </p>
            )}
            {campo("nombreEvento", T.nombreEvento, { obligatorio: true })}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="q-fecha">
                {T.fechaEvento}
                {!conToken && " *"}
              </label>
              <input
                id="q-fecha"
                type="date"
                value={d.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
              />
            </div>
          </>
        );

      case 2: {
        const audiencia = d.tipo ? AUDIENCIA[d.tipo] : "generico";
        return (
          <>
            {bloque(
              <>
                {pregunta(T.npsPregunta, true)}
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                  {Array.from({ length: 11 }, (_, n) => (
                    <Casilla key={n} elegida={d.nps === n} onClick={() => set("nps", n)}>
                      {n}
                    </Casilla>
                  ))}
                </div>
                <p style={{ ...ayudaStyle, display: "flex", justifyContent: "space-between" }}>
                  <span>0 · {T.npsMin}</span>
                  <span>10 · {T.npsMax}</span>
                </p>
              </>
            )}
            {bloque(
              <>
                {pregunta(T.testimonio[audiencia], true, "q-testimonio")}
                {area(d.testimonio, (v) => set("testimonio", v), { filas: 5, max: LIMITES.largo, id: "q-testimonio" })}
                <p style={ayudaStyle}>{T.testimonioAyuda}</p>
              </>
            )}
            {bloque(
              <>
                {pregunta(T.momento, false, "q-momento")}
                {area(d.momento, (v) => set("momento", v), { id: "q-momento" })}
              </>
            )}
            {pregunta(T.dudas, false, "q-dudas")}
            {area(d.dudas, (v) => set("dudas", v), { id: "q-dudas" })}
          </>
        );
      }

      case 3:
        if (!d.tipo) return <p style={ayudaStyle}>{T.sinPreguntasTipo}</p>;
        return (
          <>
            {PREGUNTAS_TIPO[d.tipo]
              .filter((q) => preguntaVisible(q, d.tipoResp))
              .map((q) => (
                <div key={q.id}>
                  {bloque(
                    q.tipo === "texto" ? (
                      <>
                        {pregunta(T.preguntasTipo[q.id], false, `q-${q.id}`)}
                        {area(d.tipoResp[q.id] ?? "", (v) => set("tipoResp", { ...d.tipoResp, [q.id]: v }), { id: `q-${q.id}` })}
                      </>
                    ) : (
                      <>
                        {pregunta(T.preguntasTipo[q.id])}
                        {q.opciones.map((o) => (
                          <Opcion
                            key={o}
                            elegida={d.tipoResp[q.id] === o}
                            onClick={() => set("tipoResp", { ...d.tipoResp, [q.id]: d.tipoResp[q.id] === o ? "" : o })}
                          >
                            {T.opciones[o]}
                          </Opcion>
                        ))}
                      </>
                    )
                  )}
                </div>
              ))}
          </>
        );

      case 4:
        return (
          <>
            {bloque(
              <>
                <p style={preguntaStyle}>{T.valorarTitulo}</p>
                {VALORACIONES.map((k) => (
                  <div key={k} style={{ marginBottom: "1.6rem" }}>
                    <p style={{ marginBottom: "0.6rem", lineHeight: 1.5 }} className="text-[#F2F2F0]/80">
                      {T.valoraciones[k]}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Casilla key={n} elegida={d.val[k] === n} onClick={() => set("val", { ...d.val, [k]: d.val[k] === n ? "" : n })}>
                          {n}
                        </Casilla>
                      ))}
                      <Casilla ancho elegida={d.val[k] === "na"} onClick={() => set("val", { ...d.val, [k]: d.val[k] === "na" ? "" : "na" })}>
                        {T.noAplica}
                      </Casilla>
                    </div>
                  </div>
                ))}
              </>
            )}
            {pregunta(T.comentarioTrato, false, "q-trato")}
            {area(d.comentarioTrato, (v) => set("comentarioTrato", v), { id: "q-trato" })}
          </>
        );

      case 5:
        return (
          <>
            {bloque(
              <>
                {pregunta(T.repetir)}
                {REPETIR.map((r) => (
                  <Opcion key={r} elegida={d.repetir === r} onClick={() => set("repetir", d.repetir === r ? "" : r)}>
                    {T.repetirOpciones[r]}
                  </Opcion>
                ))}
              </>
            )}
            {bloque(
              <>
                {pregunta(T.referido)}
                <div style={{ ...fieldStyle, marginBottom: "1.4rem" }}>
                  <label style={labelStyle} htmlFor="q-ref-nombre">
                    {T.referidoNombre}
                  </label>
                  <input
                    id="q-ref-nombre"
                    value={d.referidoNombre}
                    maxLength={LIMITES.corto}
                    onChange={(e) => set("referidoNombre", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldStyle, marginBottom: "1rem" }}>
                  <label style={labelStyle} htmlFor="q-ref-contacto">
                    {T.referidoContacto}
                  </label>
                  <input
                    id="q-ref-contacto"
                    value={d.referidoContacto}
                    maxLength={LIMITES.email}
                    onChange={(e) => set("referidoContacto", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <p style={{ ...ayudaStyle, marginBottom: "1rem" }}>{T.referidoAyuda}</p>
                <Casilla2 checked={d.referidoPermiso} onChange={(v) => set("referidoPermiso", v)}>
                  {T.referidoPermiso}
                </Casilla2>
              </>
            )}
            {pregunta(T.mejora, false, "q-mejora")}
            <p style={{ ...ayudaStyle, marginTop: "-0.6rem", marginBottom: "0.8rem", color: CIAN }}>🔒 {T.mejoraPrivada}</p>
            {area(d.mejora, (v) => set("mejora", v), { filas: 4, max: LIMITES.largo, id: "q-mejora" })}
          </>
        );

      case 6: {
        const logoPosible = d.permiso === "completo" || d.permiso === "entidad";
        return (
          <>
            {bloque(
              <>
                {pregunta(T.permiso, true)}
                {PERMISOS.map((p) => (
                  <Opcion key={p} elegida={d.permiso === p} onClick={() => set("permiso", p)}>
                    {T.permisoOpciones[p]}
                  </Opcion>
                ))}
              </>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {logoPosible && (
                <Casilla2 checked={d.permisoLogo} onChange={(v) => set("permisoLogo", v)}>
                  {T.permisoLogo}
                </Casilla2>
              )}
              <Casilla2 checked={d.permisoFotos} onChange={(v) => set("permisoFotos", v)}>
                {T.permisoFotos}
              </Casilla2>
              <Casilla2 checked={d.privacidad} onChange={(v) => set("privacidad", v)}>
                {T.privacidadAntes}
                <Link href={idioma === "eu" ? "/privacidad#euskaraz" : "/privacidad"} target="_blank" className="underline underline-offset-4 hover:text-[#2ED3E6]">
                  {T.privacidadEnlace}
                </Link>
                {T.privacidadDespues} *
              </Casilla2>
            </div>
          </>
        );
      }
    }
    return null;
  }

  const fin = estado !== "form";

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
                  style={{
                    padding: "0.3rem 0.65rem",
                    color: idioma === l ? CIAN : "rgba(242,242,240,0.55)",
                    background: idioma === l ? "rgba(46,211,230,0.06)" : "none",
                    cursor: "pointer",
                    transition: "color 0.2s",
                  }}
                  className={idioma === l ? "" : "hover:text-[#F2F2F0]/90"}
                >
                  {l === "eu" ? "EUS" : "ES"}
                </button>
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-8 pt-16 pb-10 md:px-16 md:pt-28 md:pb-14">
        <div className="relative">
          <div className="absolute left-0 top-0 h-full w-[2px] bg-white/15" />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-6 text-[0.82rem] uppercase tracking-[0.35em] text-[#2ED3E6]">{T.kicker}</p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">{T.titulo}</h1>
            {!fin && (
              <p className="hero-fade-3 mt-6 max-w-[640px] text-[clamp(1.1rem,1.5vw,1.4rem)] leading-relaxed text-[#F2F2F0]/75">{T.intro}</p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[640px]" style={{ scrollMarginTop: "5rem" }} ref={tarjeta}>
          <div className="p-5 md:p-10" style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}>
            {estado === "ya" && (
              <p key="ya" className="context-fade-in text-[clamp(1.35rem,2.2vw,1.9rem)] font-medium leading-snug tracking-[-0.02em]">
                {T.yaRespondido}
              </p>
            )}

            {estado === "gracias" && (
              <div key="gracias" className="context-fade-in">
                <p className="text-[clamp(1.35rem,2.2vw,1.9rem)] font-medium leading-snug tracking-[-0.02em]">{T.gracias}</p>
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
            )}

            {estado === "form" && (
              <>
                <div style={{ display: "flex", gap: "6px", marginBottom: "1.2rem" }} aria-hidden>
                  {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
                    <div key={i} style={{ width: "24px", height: "2px", background: i < paso ? CIAN : "rgba(242,242,240,0.12)", transition: "background 0.3s" }} />
                  ))}
                </div>
                <p style={{ ...labelStyle, marginBottom: "2.2rem" }}>
                  {paso}/{TOTAL_PASOS} · {T.secciones[paso - 1]}
                </p>

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

                {error && <p style={errorStyle}>{error}</p>}

                <button
                  type="button"
                  onClick={siguiente}
                  disabled={enviando}
                  style={{
                    marginTop: "2.5rem",
                    border: "1px solid rgba(242,242,240,0.20)",
                    padding: "0.9rem 2.5rem",
                    fontSize: "0.98rem",
                    letterSpacing: "0.08em",
                    color: "rgba(242,242,240,1)",
                    background: "none",
                    cursor: enviando ? "wait" : "pointer",
                    display: "block",
                  }}
                  className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]"
                >
                  {paso < TOTAL_PASOS ? T.siguiente : enviando ? T.enviando : T.enviar}
                </button>
                {paso > 1 && (
                  <button
                    type="button"
                    onClick={atras}
                    style={{ marginTop: "1.2rem", fontSize: "0.82rem", letterSpacing: "0.08em", color: "rgba(242,242,240,0.50)", background: "none", cursor: "pointer", display: "block", padding: 0 }}
                    className="transition-colors duration-200 hover:text-[#F2F2F0]/60"
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
