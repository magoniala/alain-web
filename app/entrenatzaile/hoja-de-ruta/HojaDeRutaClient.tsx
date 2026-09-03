"use client";

import { useEffect, useRef, useState } from "react";
import { Header, Footer, inputStyle, labelStyle, fieldStyle, cardStyle } from "../_ui";
import PreviewHojaDeRuta from "../PreviewHojaDeRuta";
import { eventoPixel } from "@/app/_components/Consentimiento";
import {
  HOJA_RUTA_BOTON,
  HOJA_RUTA_HUECOS,
  HOJA_RUTA_PASOS,
  type ContenidoHR,
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

// Cuatro pantallas. El lead se guarda al terminar la del permiso, ANTES de
// que elija día y hora: si abandona el calendario, sus datos ya están.
const PASO_DATOS = 0;
const PASO_PERMISO = 1;
const PASO_DIA = 2;
const PASO_HORA = 3;
const PASOS_TOTAL = 4;

const ETIQUETAS_PASO = [
  HOJA_RUTA_PASOS.datos,
  HOJA_RUTA_PASOS.permiso,
  HOJA_RUTA_PASOS.dia,
  HOJA_RUTA_PASOS.hora,
];

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

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const CABECERA_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// Día de la semana del 1 de ese mes, con el lunes como 0 (aquí las semanas
// empiezan en lunes, no en domingo).
function primerDiaSemana(anio: number, mes: number) {
  const d = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  return d === 0 ? 6 : d - 1;
}

function diasEnMes(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function sumarMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Calendario de mes, con los días sin hueco en gris y tachados. Las flechas
// solo se mueven entre meses que tienen algo que enseñar: no tiene sentido
// dejar navegar a diciembre si solo se reserva a 30 días vista.
function Calendario({
  dias,
  elegido,
  onElegir,
}: {
  dias: string[];
  elegido: string;
  onElegir: (dia: string) => void;
}) {
  const primerMes = dias[0].slice(0, 7);
  const ultimoMes = dias[dias.length - 1].slice(0, 7);
  const [mes, setMes] = useState(primerMes);

  const disponibles = new Set(dias);
  const [anio, numMes] = mes.split("-").map(Number);
  const huecosDelante = primerDiaSemana(anio, numMes);
  const total = diasEnMes(anio, numMes);

  const celdas: (string | null)[] = [
    ...Array.from({ length: huecosDelante }, () => null),
    ...Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];

  const puedeAtras = mes > primerMes;
  const puedeAlante = mes < ultimoMes;

  const flechaClase =
    "flex h-9 w-9 items-center justify-center border border-[#1C3A5E]/20 bg-white text-[#1C3A5E] transition-colors hover:border-[#1C3A5E]/45 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[#1C3A5E]/20";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMes(sumarMes(mes, -1))}
          disabled={!puedeAtras}
          aria-label="Mes anterior"
          className={flechaClase}
        >
          ‹
        </button>
        <p className="text-[1.02rem] font-semibold text-[#1C3A5E]">
          <span className="capitalize">{MESES[numMes - 1]}</span> {anio}
        </p>
        <button
          type="button"
          onClick={() => setMes(sumarMes(mes, 1))}
          disabled={!puedeAlante}
          aria-label="Mes siguiente"
          className={flechaClase}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {CABECERA_SEMANA.map((d, i) => (
          <div key={i} className="pb-1 text-[0.7rem] uppercase tracking-[0.1em] text-[#0F2240]/40">
            {d}
          </div>
        ))}

        {celdas.map((dia, i) => {
          if (!dia) return <div key={`v${i}`} />;
          const numero = Number(dia.slice(-2));
          const libre = disponibles.has(dia);
          const activo = elegido === dia;

          if (!libre) {
            return (
              <div
                key={dia}
                title={HOJA_RUTA_HUECOS.sinDisponibilidad}
                aria-disabled="true"
                className="flex aspect-square items-center justify-center text-[0.95rem] text-[#0F2240]/25 line-through"
              >
                {numero}
              </div>
            );
          }

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onElegir(dia)}
              aria-pressed={activo}
              className={`flex aspect-square items-center justify-center text-[0.95rem] transition-colors ${
                activo
                  ? "bg-[#1C3A5E] font-semibold text-[#FAF3E8]"
                  : "border border-[#D4860A]/45 bg-[#D4860A]/10 text-[#0F2240] hover:border-[#D4860A] hover:bg-[#D4860A]/20"
              }`}
            >
              {numero}
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-2 text-[0.82rem] text-[#0F2240]/50">
        <span aria-hidden className="inline-block h-3 w-3 border border-[#D4860A]/45 bg-[#D4860A]/10" />
        {HOJA_RUTA_HUECOS.leyenda}
      </p>
    </div>
  );
}

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

// "2026-08-27" -> "jue 27 ago"
function etiquetaDia(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// De la etiqueta completa ("jueves, 27 de agosto · 10:30") solo la hora.
function soloHora(etiqueta: string) {
  return etiqueta.split("·").pop()?.trim() ?? etiqueta;
}

export interface HojaDeRutaClientProps {
  contenido: ContenidoHR;
  variante: VarianteHR;
  /**
   * Último día de la ventana gratuita de ESTE lead, ya formateado
   * ("domingo 6 de septiembre"). Solo viene cuando variante es "ventana":
   * lo calcula el servidor a partir del token del enlace.
   */
  finVentana?: string;
  /**
   * Lo que se guarda en la columna `variante` de la reserva. Por defecto, la
   * variante que se está pintando. /capacidades manda la suya para que en
   * Supabase se vea de qué página salió cada reserva: pinta la de pago igual
   * que la evergreen, pero es otra landing y conviene poder distinguirlas.
   */
  etiquetaVariante?: string;
}

export default function HojaDeRutaClient({
  contenido,
  variante,
  finVentana,
  etiquetaVariante,
}: HojaDeRutaClientProps) {
  const { hero: HERO, cierre: CIERRE } = contenido;

  // Las secciones y los párrafos marcados con `soloEn` salen únicamente en su
  // versión. El filtro de párrafos va aquí y no dentro de <Parrafos> para que
  // una sección que se quede sin ninguno no pinte un hueco vacío.
  const secciones = contenido.secciones
    .filter((s: SeccionHR) => !s.soloEn || s.soloEn === variante)
    .map((s: SeccionHR) => ({
      ...s,
      parrafos: s.parrafos.filter((p: Parrafo) => !p.soloEn || p.soloEn === variante),
    }));

  // El check de la versión gratuita lleva la fecha exacta en que deja de
  // serlo. Si por lo que sea no hubiera fecha, se cae a "tus primeros 8
  // días": es menos concreto, pero nunca deja un "{fecha}" a la vista.
  const conFecha = (linea: string) =>
    linea.replace("{fecha}", finVentana ?? "el último de tus primeros 8 días");

  const [paso, setPaso] = useState(PASO_DATOS);
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "" });
  const [consentDatos, setConsentDatos] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [huecos, setHuecos] = useState<HuecoDisponible[] | null>(null);
  const [diaElegido, setDiaElegido] = useState("");
  const [huecoElegido, setHuecoElegido] = useState("");
  const [cuandoReservado, setCuandoReservado] = useState("");
  const [hecho, setHecho] = useState(false);
  // Sesión de Checkout de esta reserva, cuando toca cobrar. Solo se guarda en
  // el estado si hay que enseñarle algo antes de mandarlo a Stripe; en el
  // caso normal se redirige directamente y no llega a pintarse nada.
  const [pagoUrl, setPagoUrl] = useState<string | null>(null);
  const [avisoPlazoVencido, setAvisoPlazoVencido] = useState(false);
  const [yendoAPago, setYendoAPago] = useState(false);
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
  // que el formulario está al final de una página larga.
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
      const res = await fetch("/api/entrenatzaile/hoja-de-ruta", { cache: "no-store" });
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
      if (datos.telefono.replace(/[\s().+-]/g, "").length < 9) return "Escribe un teléfono válido.";
      return null;
    }
    if (paso === PASO_PERMISO && !consentDatos) {
      return "Marca la casilla de consentimiento para poder reservar.";
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
        const res = await fetch("/api/entrenatzaile/hoja-de-ruta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...datos,
            consentDatos,
            variante: etiquetaVariante ?? variante,
            utm: utm.current,
          }),
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
    const eventId = crypto.randomUUID();

    try {
      const res = await fetch("/api/entrenatzaile/hoja-de-ruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservaId, hueco: huecoElegido, eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mensajeErrorFormulario(res.status, data.error));
        // Si se lo han quitado entretanto, se repinta el calendario desde el día.
        if (res.status === 409 || res.status === 400) {
          setHuecoElegido("");
          setDiaElegido("");
          setPaso(PASO_DIA);
          cargarHuecos();
        }
        return;
      }
      eventoPixel("Schedule", eventId);
      setCuandoReservado(data.cuando ?? "");

      // El hueco ya está apartado pase lo que pase de aquí en adelante. Lo
      // único que queda por decidir es a dónde va esta persona.
      //
      // Sin pagoUrl (la gratuita, o un fallo al crear la sesión) se queda en
      // la pantalla de siempre: el correo que acaba de salir lleva lo que
      // haga falta.
      if (data.avisoPlazoVencido) {
        // Su plazo gratuito venció mientras reservaba. No se le manda a pagar
        // sin avisar: lo lee, y pulsa él si le sigue interesando.
        setPagoUrl(data.pagoUrl ?? null);
        setAvisoPlazoVencido(true);
        setHecho(true);
        return;
      }
      if (data.pagoUrl) {
        // A Stripe. Se deja `yendoAPago` puesto para que la tarjeta no
        // parpadee a "Hueco reservado." durante la navegación: todavía no lo
        // está, está apartado.
        setYendoAPago(true);
        window.location.href = data.pagoUrl;
        return;
      }
      setHecho(true);
    } catch {
      setError(mensajeErrorFormulario(0));
    } finally {
      // Si estamos navegando a Stripe no se reactiva nada: la página se va.
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
    paso === PASO_HORA ? HOJA_RUTA_HUECOS.boton : paso === PASO_PERMISO ? CIERRE.boton : "Siguiente →";

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

          <div style={{ ...fieldStyle, marginBottom: 0 }}>
            <label htmlFor="telefono" style={labelStyle}>
              Teléfono
            </label>
            <p style={pistaStyle}>{CIERRE.telefonoPista}</p>
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
              {CIERRE.privacidad}
            </a>
          </p>
        </div>
      );
    }

    if (paso === PASO_DIA) {
      if (huecos === null) return <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.cargando}</p>;
      if (!diasDisponibles.length) return <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.vacio}</p>;

      return (
        <div key="dia" className="context-fade-in">
          <Calendario dias={diasDisponibles} elegido={diaElegido} onElegir={setDiaElegido} />
        </div>
      );
    }

    // PASO_HORA
    const delDia = porDia.get(diaElegido) ?? [];
    return (
      <div key="hora" className="context-fade-in">
        <p className="text-[1.05rem] font-semibold text-[#1C3A5E] capitalize">{etiquetaDia(diaElegido)}</p>
        <p style={{ ...pistaStyle, marginTop: "0.35rem", marginBottom: "1.4rem" }}>{HOJA_RUTA_HUECOS.horaIntro}</p>
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
                    ? "bg-[#1C3A5E] font-semibold text-[#FAF3E8]"
                    : "border border-[#1C3A5E]/20 bg-white text-[#0F2240]/80 hover:border-[#D4860A] hover:text-[#0F2240]"
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
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      {/* SECCIÓN 1 — Above the fold */}
      <section className="w-full bg-[#D4860A] px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 md:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className={`hero-fade-2 text-[clamp(2rem,6.2vw,3.6rem)] leading-[1.1] text-[#0F2240] ${tituloClase}`}>
              {HERO.titulo}
            </h1>
            <p className="hero-fade-2 mt-5 text-[1.15rem] leading-[1.6] text-[#0F2240]/85 md:text-[1.25rem]">
              {HERO.subtitulo}
            </p>
            <p className="hero-fade-3 mt-7 max-w-[600px] text-[1.08rem] leading-[1.75] text-[#0F2240]/80 md:text-[1.15rem]">
              {HERO.entradilla[variante]}
            </p>
            <a href="#reserva" className={`hero-fade-3 mt-9 ${botonClase}`}>
              {HERO.boton}
            </a>
            <div className="hero-fade-3">
              <Checks lineas={[conFecha(HERO.bulletPrecio[variante]), ...HERO.bullets]} />
            </div>
          </div>

          {/* El objeto real que se lleva el cliente, no un mockup genérico. */}
          <div className="hero-fade-3">
            <PreviewHojaDeRuta />
            {HERO.pieVisual && (
              <p className="mt-4 text-[0.88rem] leading-[1.55] text-[#0F2240]/60 italic">{HERO.pieVisual}</p>
            )}
          </div>
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
                    {micro && <Checks lineas={[conFecha(micro)]} />}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 9 — CTA final con el formulario de reserva */}
      <section
        id="reserva"
        className="scroll-mt-8 border-t border-[#1C3A5E]/12 bg-[#1C3A5E]/[0.04] px-6 py-16 md:px-8 md:py-24"
      >
        <div className="mx-auto max-w-[680px]">
          <h2 className={`mb-7 text-[clamp(1.7rem,5.2vw,2.4rem)] leading-[1.2] text-[#1C3A5E] ${tituloClase}`}>
            {CIERRE.titulo}
          </h2>

          <Parrafos parrafos={CIERRE.parrafos} />

          <p className={`mt-6 ${cuerpoClase}`}>{CIERRE.precio[variante]}</p>

          <div ref={tarjetaRef} className="mt-12 p-6 md:p-10" style={cardStyle}>
            {yendoAPago ? (
              <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.llevandoAPago}</p>
            ) : hecho && avisoPlazoVencido ? (
              <>
                <h3 className={`mb-4 text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.25] text-[#1C3A5E] ${tituloClase}`}>
                  {HOJA_RUTA_HUECOS.plazoVencidoTitulo}
                </h3>
                {cuandoReservado && (
                  <p className="mb-4 text-[1.2rem] font-semibold text-[#1C3A5E] capitalize md:text-[1.3rem]">
                    {cuandoReservado}
                  </p>
                )}
                <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.plazoVencidoTexto}</p>
                {/* Sin enlace de pago (no se pudo crear la sesión) se queda
                    solo la explicación: el correo que acaba de salir le dice
                    cómo pagar. Lo que no puede pasar es que no se le cuente. */}
                {pagoUrl && (
                  <a href={pagoUrl} className={`mt-9 ${botonClase}`}>
                    {HOJA_RUTA_HUECOS.plazoVencidoBoton}
                  </a>
                )}
              </>
            ) : hecho ? (
              <>
                <h3 className={`mb-4 text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.25] text-[#1C3A5E] ${tituloClase}`}>
                  {HOJA_RUTA_HUECOS.hechoTitulo}
                </h3>
                {cuandoReservado && (
                  <p className="mb-4 text-[1.2rem] font-semibold text-[#1C3A5E] capitalize md:text-[1.3rem]">
                    {cuandoReservado}
                  </p>
                )}
                <p className={cuerpoClase}>{HOJA_RUTA_HUECOS.hechoTexto}</p>
              </>
            ) : (
              <>
                <h3 className={`mb-6 text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.25] text-[#1C3A5E] ${tituloClase}`}>
                  {CIERRE.formularioTitulo}
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
                    Paso {paso + 1} de {PASOS_TOTAL} · {ETIQUETAS_PASO[paso]}
                  </p>
                </div>

                <form onSubmit={avanzar} noValidate>
                  {renderPaso()}

                  {error && (
                    <p style={{ fontSize: "0.92rem", color: "#B3261E", marginTop: "1.5rem", lineHeight: 1.6 }}>
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
                      {enviando ? CIERRE.enviando : textoBoton}
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
                      color: "rgba(15,34,64,0.50)",
                      background: "none",
                      cursor: "pointer",
                      display: "block",
                      padding: 0,
                    }}
                    className="transition-colors duration-200 hover:text-[#0F2240]/75"
                  >
                    {paso === PASO_HORA ? HOJA_RUTA_HUECOS.cambiarDia : "← volver"}
                  </button>
                )}
              </>
            )}
          </div>

          <p className={`mt-10 ${cuerpoClase}`}>{CIERRE.cierre[variante]}</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
