"use client";

import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
   Test rápido · Pack de recursos Otra vez lumbago.

   Tres preguntas y una sola salida: el precio. La excepción es "No me ha
   ocurrido nunca": quien responde eso no tiene el problema que resuelve el
   pack, así que se le dice y se acaba ahí. Venderle sería venderle humo.
   --------------------------------------------------------------------------- */

const CHECKOUT = "https://entrenatzaile-kit.whop.site/checkout/plan_PmEle1e4obHUF";
const TITULAR = "font-[family-name:var(--font-fraunces)]";

// Respuesta que corta el test en seco, sin pasar por la venta.
const NUNCA = "No me ha ocurrido nunca";

const PREGUNTAS = [
  {
    id: "duracion",
    prompt: "¿Cuánto tiempo hace que empezó el episodio actual?",
    options: ["Hoy", "Hace una semana", "Más de un mes"],
  },
  {
    id: "historial",
    prompt: "¿Es la primera vez o te ha ocurrido antes?",
    options: ["Primera vez", "Me ocurre cada pocos meses", NUNCA],
  },
  {
    id: "sentado",
    prompt: "¿Pasas más de 6 horas al día sentado?",
    options: ["Sí", "No"],
  },
];

type Whop = { track: (evento: string, datos?: unknown) => void };

function track(evento: string, datos?: unknown) {
  if (typeof window === "undefined") return;
  (window as unknown as { whop?: Whop }).whop?.track(evento, datos);
}

export default function Test() {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<string[]>([]);
  const [descartado, setDescartado] = useState(false);
  const yaContado = useRef(false);

  const terminado = paso >= PREGUNTAS.length;
  const pregunta = PREGUNTAS[paso];

  useEffect(() => {
    track("quiz_start");
  }, []);

  useEffect(() => {
    if (terminado && !descartado && !yaContado.current) {
      yaContado.current = true;
      track("complete_registration");
    }
  }, [terminado, descartado]);

  function responder(opcion: string) {
    if (pregunta) track("quiz_step", { step: pregunta.id });

    if (opcion === NUNCA) {
      setDescartado(true);
      return;
    }

    setRespuestas((previas) => [...previas, opcion]);
    setPaso((p) => p + 1);
  }

  function repetir() {
    yaContado.current = false;
    setRespuestas([]);
    setDescartado(false);
    setPaso(0);
  }

  return (
    <div className="min-h-screen bg-[#F7F1E6] text-[#0F2240]">
      <section className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        {descartado ? (
          <Descartado onRepetir={repetir} />
        ) : !terminado && pregunta ? (
          <>
            <p className="text-xs tracking-[0.28em] text-[#C47800] uppercase">Diagnóstico</p>
            <h1
              className={`${TITULAR} mt-4 text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl`}
            >
              Test rápido para personas con dolor lumbar
            </h1>
            <div className="mt-12">
              <p className="text-sm text-[#4A5C73]">
                Pregunta {paso + 1} de {PREGUNTAS.length}
              </p>
              <h2 className="mt-3 text-2xl leading-snug font-semibold">{pregunta.prompt}</h2>
              <div className="mt-8 flex flex-col gap-3">
                {pregunta.options.map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => responder(opcion)}
                    className="min-h-12 rounded-xl border border-[#0F2240]/15 bg-[#EFE6D4] px-5 text-left text-base font-medium transition hover:border-[#0F2240] hover:bg-[#F7F1E6]"
                  >
                    {opcion}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Venta respuestas={respuestas} onRepetir={repetir} />
        )}
      </section>
    </div>
  );
}

function Venta({ respuestas, onRepetir }: { respuestas: string[]; onRepetir: () => void }) {
  return (
    <div className="rounded-xl border border-[#E0D4C0] bg-[#EFE6D4] p-8 md:p-10">
      <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
        Siguiente paso
      </p>
      <h1 className={`${TITULAR} mt-3 text-3xl font-semibold tracking-tight`}>
        Pack de recursos · Otra vez lumbago
      </h1>
      <p className="mt-6 flex flex-wrap items-baseline gap-3">
        <span className={`${TITULAR} text-5xl font-semibold whitespace-nowrap`}>24,19 €</span>
        <span className="text-[#4A5C73]">IVA incluido</span>
      </p>
      <p className="mt-2 text-sm text-[#4A5C73]">19,99 € + IVA · cinco recursos</p>
      <p className="mt-6 text-lg leading-relaxed text-[#4A5C73]">
        El pack cubre tu fase exacta. Con tus respuestas
        {respuestas.length > 0 ? ` (${respuestas.join(" · ")})` : ""}, te da el plan para este episodio y para no
        repetir el ciclo.
      </p>
      <a
        href={CHECKOUT}
        onClick={() => track("add_to_cart", { value: 24.19, currency: "EUR" })}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F2240] px-7 font-semibold text-[#F7F1E6] transition hover:brightness-110"
      >
        Quiero el pack · 24,19 €
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </a>
      <button
        type="button"
        onClick={onRepetir}
        className="mt-4 w-full text-center text-sm text-[#4A5C73] underline decoration-[#E0D4C0] underline-offset-4 hover:text-[#0F2240] hover:decoration-[#0F2240]"
      >
        Repetir el test
      </button>
    </div>
  );
}

function Descartado({ onRepetir }: { onRepetir: () => void }) {
  return (
    <div className="rounded-xl border border-[#E0D4C0] bg-[#EFE6D4] p-8 md:p-10">
      <p className="text-sm font-semibold tracking-[0.22em] text-[#C47800] uppercase">
        Sin lumbago
      </p>
      <h1 className={`${TITULAR} mt-3 text-3xl leading-tight font-semibold tracking-tight`}>
        Esto seguramente no te interese por ahora
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-[#4A5C73]">
        El pack está escrito para quien ya ha pasado un lumbago y no quiere que vuelva. Si nunca lo
        has tenido, no te hace falta.
      </p>
      <button
        type="button"
        onClick={onRepetir}
        className="mt-8 text-sm text-[#4A5C73] underline decoration-[#E0D4C0] underline-offset-4 hover:text-[#0F2240] hover:decoration-[#0F2240]"
      >
        Repetir el test
      </button>
    </div>
  );
}
