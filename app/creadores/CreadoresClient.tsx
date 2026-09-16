"use client";

import { useEffect, useRef, useState } from "react";
import {
  Header,
  Footer,
  botonClase,
  cardStyle,
  cuerpoClase,
  fieldStyle,
  inputStyle,
  labelStyle,
  pistaStyle,
  tituloClase,
} from "./_ui";
import {
  CREADORES_BOTON,
  CREADORES_CIERRE,
  CREADORES_HERO,
  CREADORES_HUECOS,
  CREADORES_PASOS,
} from "./_content";
import { AVISO_SIN_NEWSLETTER, CONSENT_CREADORES } from "@/lib/creadores-formularios";
import { UTM_KEYS, mensajeErrorFormulario, type Utm } from "@/lib/entrenatzaile-formularios";
import type { HuecoDisponible } from "@/lib/entrenatzaile-huecos";
import Calendario, { etiquetaDia, soloHora, type EstiloCalendario } from "@/app/_reserva/Calendario";

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

// Las mismas cuatro pantallas que la Hoja de Ruta, y por el mismo motivo: el
// lead se guarda al terminar la del permiso, ANTES de que elija día y hora,
// para que abandonar el calendario no borre sus datos.
const PASO_DATOS = 0;
const PASO_PERMISO = 1;
const PASO_DIA = 2;
const PASO_HORA = 3;
const PASOS_TOTAL = 4;

const ETIQUETAS_PASO = [
  CREADORES_PASOS.datos,
  CREADORES_PASOS.permiso,
  CREADORES_PASOS.dia,
  CREADORES_PASOS.hora,
];

// Aspecto del calendario compartido en esta página: negro con cian, la
// estética del sitio principal. La estructura y el comportamiento son los
// mismos que en la Hoja de Ruta (app/_reserva/Calendario.tsx).
const ESTILO_CALENDARIO: EstiloCalendario = {
  flecha:
    "flex h-9 w-9 items-center justify-center border border-[#F2F2F0]/16 text-[#F2F2F0]/75 transition-colors hover:border-[#2ED3E6]/60 hover:text-[#2ED3E6] disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-[#F2F2F0]/16 disabled:hover:text-[#F2F2F0]/75",
  titulo: "text-[1.02rem] font-medium text-[#F2F2F0]",
  cabecera: "pb-1 text-[0.7rem] uppercase tracking-[0.1em] text-[#F2F2F0]/35",
  libre:
    "flex aspect-square items-center justify-center text-[0.95rem] transition-colors border border-[#2ED3E6]/35 bg-[#2ED3E6]/[0.06] text-[#F2F2F0] hover:border-[#2ED3E6] hover:bg-[#2ED3E6]/15",
  elegido:
    "flex aspect-square items-center justify-center text-[0.95rem] transition-colors bg-[#2ED3E6] font-semibold text-[#0B0B0C]",
  ocupado: "flex aspect-square items-center justify-center text-[0.95rem] text-[#F2F2F0]/20 line-through",
  leyenda: "mt-4 flex items-center gap-2 text-[0.82rem] text-[#F2F2F0]/45",
  muestra: "inline-block h-3 w-3 border border-[#2ED3E6]/35 bg-[#2ED3E6]/[0.06]",
};

function Checks({ lineas }: { lineas: string[] }) {
  return (
    <ul className="mt-8 space-y-2">
      {lineas.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-[0.98rem] leading-[1.6] text-[#F2F2F0]/70">
          <span aria-hidden className="text-[#2ED3E6]">
            ✓
          </span>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CreadoresClient() {
  const [paso, setPaso] = useState(PASO_DATOS);
  const [datos, setDatos] = useState({ nombre: "", email: "" });
  const [consentDatos, setConsentDatos] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [huecos, setHuecos] = useState<HuecoDisponible[] | null>(null);
  const [diaElegido, setDiaElegido] = useState("");
  const [huecoElegido, setHuecoElegido] = useState("");
  const [cuandoReservado, setCuandoReservado] = useState("");
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const utm = useRef<Utm>({});
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
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

  // Al cambiar de pantalla, la tarjeta a la vista. En el primer render no,
  // que el formulario está al final de la página.
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tarjetaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    primerCampoRef.current?.focus({ preventScroll: true });
  }, [paso, hecho]);

  // Días con hueco, en orden, a partir de la lista plana que da la API.
  const porDia = new Map<string, HuecoDisponible[]>();
  for (const h of huecos ?? []) {
    const dia = h.valor.slice(0, 10);
    const lista = porDia.get(dia) ?? [];
    lista.push(h);
    porDia.set(dia, lista);
  }
  const diasDisponibles = Array.from(porDia.keys());

  async function cargarHuecos() {
    setHuecos(null);
    try {
      const res = await fetch("/api/creadores/reserva", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setHuecos(res.ok ? (data.huecos ?? []) : []);
    } catch {
      setHuecos([]);
    }
  }

  function validarPaso(): string | null {
    if (paso === PASO_DATOS) {
      if (!datos.nombre.trim()) return "Escribe tu nombre para poder seguir.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return "Escribe un email válido.";
      return null;
    }
    if (paso === PASO_PERMISO && !consentDatos) {
      return "Marca la casilla para poder reservar.";
    }
    if (paso === PASO_DIA && !diaElegido) return "Elige un día para seguir.";
    if (paso === PASO_HORA && !huecoElegido) return "Elige una hora, por favor.";
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

    if (paso === PASO_DATOS) {
      setPaso(PASO_PERMISO);
      return;
    }

    // Fin del permiso: se guarda el lead ANTES de enseñarle el calendario.
    if (paso === PASO_PERMISO) {
      setEnviando(true);
      try {
        const res = await fetch("/api/creadores/reserva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...datos, consentDatos, utm: utm.current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(mensajeErrorFormulario(res.status, data.error));
          return;
        }
        setReservaId(data.id);
        setPaso(PASO_DIA);
        cargarHuecos();
      } catch {
        setError(mensajeErrorFormulario(0));
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (paso === PASO_DIA) {
      setHuecoElegido("");
      setPaso(PASO_HORA);
      return;
    }

    // Última pantalla: confirmar el hueco.
    setEnviando(true);
    try {
      const res = await fetch("/api/creadores/reserva", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservaId, hueco: huecoElegido }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        // Si se lo han quitado entretanto —desde aquí o desde la otra
        // agenda—, se repinta el calendario desde el día.
        if (res.status === 409 || res.status === 400) {
          setHuecoElegido("");
          setDiaElegido("");
          setPaso(PASO_DIA);
          cargarHuecos();
        }
        return;
      }
      setCuandoReservado(data.cuando ?? "");
      setHecho(true);
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      setEnviando(false);
    }
  }

  // Solo se puede volver dentro del calendario. Una vez guardado el lead, no
  // se vuelve a la pantalla de datos: reenviarla crearía una segunda fila
  // para la misma persona.
  const puedeVolver = paso === PASO_PERMISO || paso === PASO_HORA;
  function volver() {
    setError("");
    if (paso === PASO_PERMISO) setPaso(PASO_DATOS);
    if (paso === PASO_HORA) setPaso(PASO_DIA);
  }

  const textoBoton =
    paso === PASO_HORA ? CREADORES_HUECOS.boton : paso === PASO_PERMISO ? CREADORES_BOTON : "Siguiente →";

  function renderPaso() {
    if (paso === PASO_DATOS) {
      return (
        <div key="datos" className="context-fade-in">
          <div style={fieldStyle}>
            <label htmlFor="nombre" style={labelStyle}>
              Nombre
            </label>
            <input
              id="nombre"
              ref={primerCampoRef}
              autoComplete="name"
              placeholder="Tu nombre"
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              style={inputStyle}
              className="placeholder:text-[#F2F2F0]/30"
            />
          </div>

          <div style={{ ...fieldStyle, marginBottom: 0 }}>
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
              className="placeholder:text-[#F2F2F0]/30"
            />
          </div>
        </div>
      );
    }

    if (paso === PASO_PERMISO) {
      return (
        <div key="permiso" className="context-fade-in">
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.6rem",
              cursor: "pointer",
              fontSize: "0.95rem",
              lineHeight: 1.55,
              color: "rgba(242,242,240,0.72)",
            }}
          >
            <input
              type="checkbox"
              checked={consentDatos}
              onChange={(e) => setConsentDatos(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "#2ED3E6" }}
            />
            {CONSENT_CREADORES.datos}
          </label>
          <p style={{ ...pistaStyle, marginTop: "0.9rem", marginBottom: 0 }}>{AVISO_SIN_NEWSLETTER}</p>
          <p style={{ ...pistaStyle, marginTop: "0.5rem", marginBottom: 0 }}>
            <a
              href="/privacidad"
              className="underline underline-offset-4 transition-colors hover:text-[#2ED3E6]"
            >
              {CREADORES_CIERRE.privacidad}
            </a>
          </p>
        </div>
      );
    }

    if (paso === PASO_DIA) {
      if (huecos === null) return <p className={cuerpoClase}>{CREADORES_HUECOS.cargando}</p>;
      if (!diasDisponibles.length) return <p className={cuerpoClase}>{CREADORES_HUECOS.vacio}</p>;

      return (
        <div key="dia" className="context-fade-in">
          <Calendario
            dias={diasDisponibles}
            elegido={diaElegido}
            onElegir={setDiaElegido}
            estilo={ESTILO_CALENDARIO}
            textoSinDisponibilidad={CREADORES_HUECOS.sinDisponibilidad}
            textoLeyenda={CREADORES_HUECOS.leyenda}
          />
        </div>
      );
    }

    // PASO_HORA
    const delDia = porDia.get(diaElegido) ?? [];
    return (
      <div key="hora" className="context-fade-in">
        <p className="text-[1.05rem] font-medium text-[#F2F2F0] capitalize">{etiquetaDia(diaElegido)}</p>
        <p style={{ ...pistaStyle, marginTop: "0.35rem", marginBottom: "1.4rem" }}>{CREADORES_HUECOS.horaIntro}</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
          {delDia.map((h) => {
            const activo = huecoElegido === h.valor;
            return (
              <button
                key={h.valor}
                type="button"
                onClick={() => setHuecoElegido(h.valor)}
                aria-pressed={activo}
                className={`py-2.5 text-center text-[0.95rem] tabular-nums transition-colors ${
                  activo
                    ? "bg-[#2ED3E6] font-semibold text-[#0B0B0C]"
                    : "border border-[#F2F2F0]/14 text-[#F2F2F0]/75 hover:border-[#2ED3E6] hover:text-[#2ED3E6]"
                }`}
              >
                {soloHora(h.etiqueta)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main id="top" className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      <Header />

      {/* HERO. Una frase, dos checks y el botón: quien llega acaba de ver el
          vídeo y no necesita que se lo vuelvan a contar. */}
      <section className="mx-auto max-w-[1400px] px-8 py-20 md:px-16 md:py-28">
        <div className="relative">
          <div className="absolute left-0 top-0 h-[150px] w-[2px] bg-white/15 md:h-[200px]" />
          <div className="max-w-[760px] pl-5 md:pl-10">
            <h1 className={`hero-fade-2 text-[clamp(1.7rem,4.2vw,3.2rem)] leading-[1.12] ${tituloClase}`}>
              {CREADORES_HERO.titulo}
            </h1>
            <div className="hero-fade-3">
              <a href="#reserva" className={`mt-10 ${botonClase}`}>
                {CREADORES_BOTON}
              </a>
              <Checks lineas={CREADORES_HERO.bullets} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL CON EL FORMULARIO */}
      <section id="reserva" className="scroll-mt-20 border-t border-white/6 px-8 py-16 md:py-24">
        <div className="mx-auto max-w-[680px]">
          <h2 className={`mb-7 text-[clamp(1.6rem,4.8vw,2.3rem)] leading-[1.2] text-[#F2F2F0] ${tituloClase}`}>
            {CREADORES_CIERRE.titulo}
          </h2>

          <div ref={tarjetaRef} className="mt-10 p-6 md:p-10" style={cardStyle}>
            {hecho ? (
              <>
                <h3 className={`mb-4 text-[clamp(1.3rem,3.6vw,1.7rem)] leading-[1.25] text-[#F2F2F0] ${tituloClase}`}>
                  {CREADORES_HUECOS.hechoTitulo}
                </h3>
                {cuandoReservado && (
                  <p className="mb-4 text-[1.2rem] font-medium text-[#2ED3E6] capitalize md:text-[1.3rem]">
                    {cuandoReservado}
                  </p>
                )}
                <p className={cuerpoClase}>{CREADORES_HUECOS.hechoTexto}</p>
              </>
            ) : (
              <>
                <h3 className={`mb-6 text-[clamp(1.3rem,3.6vw,1.7rem)] leading-[1.25] text-[#F2F2F0] ${tituloClase}`}>
                  {CREADORES_CIERRE.formularioTitulo}
                </h3>

                {/* Cuánto queda */}
                <div style={{ marginBottom: "2.5rem" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {Array.from({ length: PASOS_TOTAL }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          height: "2px",
                          flex: 1,
                          background: i <= paso ? "#2ED3E6" : "rgba(242,242,240,0.12)",
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
                      color: "rgba(242,242,240,0.50)",
                    }}
                  >
                    Paso {paso + 1} de {PASOS_TOTAL} · {ETIQUETAS_PASO[paso]}
                  </p>
                </div>

                <form onSubmit={avanzar} noValidate>
                  {renderPaso()}

                  {error && (
                    <p style={{ fontSize: "0.92rem", color: "#FF8A80", marginTop: "1.5rem", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  )}

                  {/* Sin huecos no hay nada que confirmar: se oculta el botón. */}
                  {!(paso === PASO_DIA && huecos !== null && !diasDisponibles.length) && (
                    <button
                      type="submit"
                      disabled={enviando || (paso === PASO_DIA && huecos === null)}
                      style={{
                        marginTop: "2.5rem",
                        padding: "0.9rem 2.5rem",
                        fontSize: "0.98rem",
                        letterSpacing: "0.08em",
                        cursor: enviando ? "default" : "pointer",
                        display: "block",
                        background: "none",
                        opacity: enviando ? 0.6 : 1,
                      }}
                      className="border border-white/20 text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
                    >
                      {enviando ? CREADORES_CIERRE.enviando : textoBoton}
                    </button>
                  )}
                </form>

                {puedeVolver && (
                  <button
                    type="button"
                    onClick={volver}
                    style={{
                      marginTop: "1.2rem",
                      fontSize: "0.82rem",
                      letterSpacing: "0.08em",
                      color: "rgba(242,242,240,0.45)",
                      background: "none",
                      cursor: "pointer",
                      display: "block",
                      padding: 0,
                    }}
                    className="transition-colors duration-200 hover:text-[#F2F2F0]/75"
                  >
                    {paso === PASO_HORA ? CREADORES_HUECOS.cambiarDia : "← volver"}
                  </button>
                )}
              </>
            )}
          </div>

          <p className={`mt-10 ${cuerpoClase}`}>{CREADORES_CIERRE.cierre}</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
