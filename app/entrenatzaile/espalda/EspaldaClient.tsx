"use client";

import { useCallback, useEffect, useRef } from "react";
import { Header, Footer } from "../_ui";
import FormularioEspalda from "./FormularioEspalda";
import { ESPALDA_CUERPO, ESPALDA_HERO, ESPALDA_PUENTE } from "./_content";
import {
  FICHA_ESPALDA_TITULO_PUBLICO,
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

// Identificador de sesión para la medición del embudo. Vive en memoria y
// muere al cerrar la pestaña. crypto.randomUUID() no existe fuera de un
// contexto seguro, y la medición no puede tumbar la página por eso: si
// falta, vale cualquier cadena aleatoria.
function nuevaSesion(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const tituloClase = "font-[family-name:var(--font-lora)] font-medium tracking-[-0.02em]";
const cuerpoClase = "text-[1.15rem] leading-[1.8] text-[#0F2240]/80 md:text-[1.22rem]";

// Un bloque de lectura: titular opcional y sus párrafos.
function BloqueTexto({ titulo, parrafos }: { titulo?: string; parrafos: string[] }) {
  return (
    <div className="fade-in">
      {titulo && (
        <h2 className={`mb-6 text-[clamp(1.6rem,5vw,2.2rem)] leading-[1.2] text-[#1C3A5E] ${tituloClase}`}>
          {titulo}
        </h2>
      )}
      <div className="space-y-5">
        {parrafos.map((p, j) => (
          <p key={j} className={cuerpoClase}>
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function EspaldaClient() {
  const utm = useRef<Utm>({});

  // Medición del embudo: en qué paso se queda la gente, y nada más. Lo que
  // escribe no viaja aquí —eso son datos de salud y van a su tabla con su
  // consentimiento—; solo el nombre del paso que ha completado.
  //
  // El identificador de sesión se genera en memoria al cargar la página: no
  // hay cookie ni localStorage, se pierde al cerrar la pestaña y no sirve
  // para reconocer a nadie entre visitas. Por eso es medición técnica
  // anónima y se dispara sin depender del banner.
  const sesion = useRef("");
  const marcados = useRef<Set<string>>(new Set());

  const marcar = useCallback((evento: string, detalle?: string) => {
    if (!sesion.current) return;
    // Cada paso cuenta una sola vez por sesión. Con el formulario duplicado
    // en la página, esto es también lo que hace que "lo ve" y "lo empieza"
    // se cuenten en el primero de los dos donde ocurran, y no dos veces.
    // El error de envío es la excepción: si alguien lo intenta tres veces,
    // quiero verlas las tres.
    if (evento !== "submit_error") {
      if (marcados.current.has(evento)) return;
      marcados.current.add(evento);
    }
    // A ciegas y sin esperar: un fallo de medición no puede frenar ni
    // romper el formulario. keepalive para que el último evento salga
    // aunque el navegador ya esté yéndose a la página de gracias.
    try {
      fetch("/api/entrenatzaile/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landing: "espalda",
          sesion: sesion.current,
          evento,
          detalle,
          utm: utm.current,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Silencio absoluto. Aquí no hay nada que salvar.
    }
  }, []);

  const origenActual = useCallback(() => utm.current, []);

  // De lo que ha escrito, nada viaja hasta la página de gracias: la regla
  // dura se mantiene. Van solo dos identificadores opacos que no dicen nada
  // de nadie: su token de ventana —lo que permite que el botón de gracias le
  // lleve a SU versión de la Hoja de Ruta, con su fecha límite, en vez de a
  // la de 90 €— y la sesión del embudo, para que el clic hacia la Hoja de
  // Ruta se cosa a este mismo recorrido en lugar de aparecer como una visita
  // suelta. Ni cuál de los dos formularios usó: eso ya viaja en su evento.
  const irAGracias = useCallback((token: unknown) => {
    const base = window.location.pathname.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (typeof token === "string" && token) params.set("t", token);
    if (sesion.current) params.set("s", sesion.current);
    const query = params.toString();
    window.location.assign(query ? `${base}/gracias?${query}` : `${base}/gracias`);
  }, []);

  useEffect(() => {
    utm.current = leerUtm();
    sesion.current = nuevaSesion();
    marcar("page_view");
  }, [marcar]);

  // Cuánto aguantan con la página delante. Separa "no les convence" de "no
  // llegaron a leerla": quien se va a los tres segundos no ha rechazado
  // nada, ni siquiera lo ha visto.
  //
  // Se cuenta en segundos enteros y SOLO con la pestaña visible, así que un
  // intervalo que ignora los ticks de fondo hace de contador y de pausa a la
  // vez: si se van a otra pestaña, el reloj se queda donde estaba y sigue
  // cuando vuelven. Una pestaña abierta y olvidada no suma nada.
  useEffect(() => {
    const HITOS: [number, string][] = [
      [3, "time_3s"],
      [10, "time_10s"],
      [30, "time_30s"],
    ];
    const ultimo = HITOS[HITOS.length - 1][0];
    let visibles = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibles += 1;
      const hito = HITOS.find(([segundos]) => segundos === visibles);
      // marcar() ya descarta los repetidos, así que cada hito sale una vez
      // por sesión aunque el intervalo se reinicie.
      if (hito) marcar(hito[1]);
      // Pasado el último no queda nada que contar.
      if (visibles >= ultimo) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [marcar]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
            onClick={() => marcar("hero_cta_click")}
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

      {/* El puente. Anuncia las tres preguntas y, en su último párrafo,
          declara el alta en la newsletter: por eso va por encima de los DOS
          formularios y no puede bajar de aquí. */}
      <section className="mx-auto max-w-[680px] px-6 pt-16 pb-10 md:px-8 md:pt-24 md:pb-12">
        <BloqueTexto {...ESPALDA_PUENTE} />
      </section>

      {/* Primer formulario: el punto de conversión pegado al final de la
          lectura corta, para quien ya ha decidido con el hero y el puente.
          Es el que recibe el ancla del botón de arriba. */}
      <section id="formulario" className="scroll-mt-8 px-6 pb-16 md:px-8 md:pb-20">
        <div className="mx-auto max-w-[680px]">
          <FormularioEspalda
            posicion="top"
            marcar={marcar}
            origenActual={origenActual}
            irAGracias={irAGracias}
          />
        </div>
      </section>

      {/* El cuerpo, para quien necesita leerlo entero antes de decidir. */}
      <section className="mx-auto max-w-[680px] px-6 pb-16 md:px-8 md:pb-20">
        <div className="space-y-14 md:space-y-16">
          {ESPALDA_CUERPO.map((bloque, i) => (
            <BloqueTexto key={i} {...bloque} />
          ))}
        </div>
      </section>

      {/* Segundo formulario: el mismo, con su propio estado. Quien ha bajado
          leyendo no tiene que volver a subir. */}
      <section id="formulario-final" className="scroll-mt-8 px-6 pb-24 md:px-8">
        <div className="mx-auto max-w-[680px]">
          <FormularioEspalda
            posicion="bottom"
            marcar={marcar}
            origenActual={origenActual}
            irAGracias={irAGracias}
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}
