"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  personas_testadas: number;
  conocen_gilipollas: number;
  creen_que_diran_su_nombre: number;
  media_gilipollas: number | null;
}

interface Frase {
  id: string;
  texto: string;
  sujeto_num: number;
}

export default function ArrogantePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [frases, setFrases] = useState<Frase[]>([]);
  const [origen, setOrigen] = useState("qr");

  const [formStarted, setFormStarted] = useState(false);
  const [formScreen, setFormScreen] = useState(1);
  const [cuantos, setCuantos] = useState("");
  const [quien, setQuien] = useState("");
  const [cree, setCree] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const loadStats = () => fetch("/api/arrogante/stats").then(r => r.json()).then(setStats).catch(() => {});

  useEffect(() => {
    loadStats();
    fetch("/api/arrogante/frases").then(r => r.json()).then(setFrases).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref === "tiktok") setOrigen("tiktok");
    else if (ref === "web") setOrigen("web");
    else if (ref === "newsletter") setOrigen("newsletter");

    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const pct = (n: number) => {
    if (!stats || stats.personas_testadas === 0) return "—";
    return Math.round((n / stats.personas_testadas) * 100) + "%";
  };

  async function handleSubmit() {
    if (!cuantos || !cree || !privacy) return;
    setStatus("sending");
    const res = await fetch("/api/arrogante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuantos_gilipollas: cuantos,
        cree_que_diran_su_nombre: cree,
        respuesta_texto_libre: quien || null,
        email: email || null,
        origen,
      }),
    });
    if (res.ok) { setStatus("done"); loadStats(); }
    else setStatus("error");
  }

  const OptionBtn = ({
    value, label, selected, onSelect,
  }: { value: string; label: string; selected: string; onSelect: (v: string) => void }) => (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="block w-full text-left py-4 border-b border-gray-200 text-[clamp(1rem,1.3vw,1.1rem)] transition-colors duration-150"
      style={{ color: selected === value ? "#DC2626" : "#1a1a1a", background: "none", fontWeight: selected === value ? 500 : 400 }}
    >
      <span style={{ display: "inline-block", width: "1.5rem", color: "#DC2626" }}>{selected === value ? "→" : ""}</span>{label}
    </button>
  );

  const canProceed = () => {
    if (formScreen === 1) return !!cuantos;
    if (formScreen === 3) return !!cree;
    return true;
  };

  const nextScreen = () => setFormScreen(s => s + 1);
  const prevScreen = () => setFormScreen(s => s - 1);

  const Progress = () => (
    <div className="flex gap-1.5 mb-8">
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 24, height: 2,
          background: i <= formScreen ? "#DC2626" : "#e5e7eb",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );

  const NextBtn = ({ label = "Siguiente →", onClick = nextScreen, disabled = false }: { label?: string; onClick?: () => void; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 bg-[#1a1a1a] text-white px-8 py-3.5 text-[0.9rem] tracking-[0.06em] transition-opacity hover:opacity-80 disabled:opacity-25"
    >
      {label}
    </button>
  );

  const BackBtn = () => (
    <button
      type="button"
      onClick={prevScreen}
      className="mt-3 text-[0.8rem] text-gray-400 hover:text-gray-600 transition-colors"
      style={{ background: "none", display: "block" }}
    >
      ← volver
    </button>
  );

  const renderFormScreen = () => {
    switch (formScreen) {
      case 1:
        return (
          <div>
            <p className="text-[1rem] font-medium text-[#1a1a1a] mb-4">
              ¿Cuántos gilipollas dirías que conoces?
            </p>
            <div>
              <OptionBtn value="ninguno" label="Ninguno" selected={cuantos} onSelect={setCuantos} />
              <OptionBtn value="1-2" label="1–2" selected={cuantos} onSelect={setCuantos} />
              <OptionBtn value="3-5" label="3–5" selected={cuantos} onSelect={setCuantos} />
              <OptionBtn value="6-10" label="6–10" selected={cuantos} onSelect={setCuantos} />
              <OptionBtn value="mas-de-10" label="Más de 10" selected={cuantos} onSelect={setCuantos} />
            </div>
            <NextBtn disabled={!canProceed()} />
          </div>
        );
      case 2:
        return (
          <div>
            <p className="text-[1rem] font-medium text-[#1a1a1a] mb-4">
              ¿Quién es la persona más gilipollas que conoces? <span className="normal-case">(Desahógate)</span>
            </p>
            <p className="text-[0.78rem] text-gray-400 mb-3">
              Puedes escribir un nombre, una relación, una descripción o hasta una historia.<br />
              Ejemplos: mi jefe, un ex compañero, un vecino…
            </p>
            <div style={{ borderBottom: "1px solid #e5e7eb" }}>
              <textarea
                value={quien}
                onChange={e => setQuien(e.target.value)}
                rows={4}
                placeholder="Opcional"
                className="w-full px-0 py-3 text-[clamp(1rem,1.3vw,1.1rem)] resize-none outline-none text-[#1a1a1a] placeholder:text-gray-300"
                style={{ background: "none", border: "none" }}
                autoFocus
              />
            </div>
            <NextBtn />
            <BackBtn />
          </div>
        );
      case 3:
        return (
          <div>
            <p className="text-[1rem] font-medium text-[#1a1a1a] mb-4">
              Si preguntara a la gente que te conoce…<br />¿alguien diría tu nombre?
            </p>
            <div>
              <OptionBtn value="no" label="No" selected={cree} onSelect={setCree} />
              <OptionBtn value="probablemente-no" label="Probablemente no" selected={cree} onSelect={setCree} />
              <OptionBtn value="probablemente-si" label="Probablemente sí" selected={cree} onSelect={setCree} />
              <OptionBtn value="si" label="Sí" selected={cree} onSelect={setCree} />
            </div>
            <NextBtn disabled={!canProceed()} />
            <BackBtn />
          </div>
        );
      case 4:
        return (
          <div>
            <p className="text-[1rem] font-medium text-[#1a1a1a] mb-4">
              ¿Quieres saber cómo termina el experimento?
            </p>
            <p className="text-[0.78rem] text-gray-400 mb-3">
              Te enviaré el documental cuando publiquemos el resultado.
            </p>
            <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: "2rem" }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com (opcional)"
                className="w-full px-0 py-3 text-[clamp(1rem,1.3vw,1.1rem)] outline-none text-[#1a1a1a] placeholder:text-gray-300"
                style={{ background: "none", border: "none" }}
                autoFocus
              />
            </div>
            <div className="flex items-start gap-3 mb-6">
              <input
                type="checkbox"
                id="privacy"
                checked={privacy}
                onChange={e => setPrivacy(e.target.checked)}
                className="mt-1 w-4 h-4 flex-shrink-0 accent-[#DC2626]"
              />
              <label htmlFor="privacy" className="text-[0.78rem] text-gray-400 leading-relaxed">
                He leído la{" "}
                <Link href="/privacidad" target="_blank" className="underline hover:text-gray-600">
                  política de privacidad
                </Link>{" "}
                y consiento el tratamiento de mis datos para este experimento
                {email.trim() && " y el envío del documental por email"}.
              </label>
            </div>
            {status === "error" && (
              <p className="text-[#DC2626] text-sm mb-4">Ha ocurrido un error. Inténtalo de nuevo.</p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!privacy || status === "sending"}
              className="w-full bg-[#DC2626] text-white py-4 text-[0.85rem] uppercase tracking-[0.18em] transition-opacity disabled:opacity-35 hover:opacity-90"
            >
              {status === "sending" ? "Enviando..." : "Enviar respuesta"}
            </button>
            <BackBtn />
          </div>
        );
    }
  };

  return (
    <main>
      {/* HERO */}
      <section className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0] flex flex-col justify-center px-6 py-20 md:px-16">
        <div className="max-w-[680px]">
          <h1 className="text-[clamp(2.4rem,8vw,5.2rem)] font-medium leading-[1.03] tracking-[-0.02em] mb-10">
            El experimento<br />de <span className="text-[#DC2626]">Alcalá 77</span>
          </h1>
          <div className="space-y-5 text-[clamp(1rem,2vw,1.2rem)] leading-relaxed text-[#F2F2F0]/70 max-w-[520px]">
            <p>Aquí puedes ver cómo está respondiendo la gente.</p>
            <p>Y, si quieres, aportar nueva información.</p>
          </div>
          <button
            onClick={() => document.getElementById("stats")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-16 text-[#F2F2F0]/50 hover:text-[#F2F2F0]/90 transition-colors text-2xl select-none cursor-pointer"
            style={{ background: "none", border: "none", display: "block" }}
          >
            ↓
          </button>
        </div>
      </section>

      {/* STATS */}
      <section id="stats" className="bg-white text-[#1a1a1a] px-6 py-14 md:px-16 md:py-20">
        <div className="max-w-[680px]">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[#DC2626] mb-10">
            Resultados del experimento
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10">
            <div className="col-span-2">
              <p className="text-[clamp(3rem,12vw,5.5rem)] font-bold leading-none tracking-[-0.03em] text-[#1a1a1a]">
                {stats?.personas_testadas ?? "—"}
              </p>
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.15em] text-[#888] leading-[1.6]">
                Sujetos han participado
              </p>
            </div>
            <div>
              <p className="text-[clamp(3rem,12vw,5.5rem)] font-bold leading-none tracking-[-0.03em] text-[#DC2626]">
                {stats?.media_gilipollas != null ? stats.media_gilipollas : "—"}
              </p>
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.15em] text-[#888] leading-[1.6]">
                Gilipollas de media<br />por persona
              </p>
            </div>
            <div>
              <p className="text-[clamp(3rem,12vw,5.5rem)] font-bold leading-none tracking-[-0.03em] text-[#DC2626]">
                {stats ? pct(stats.creen_que_diran_su_nombre) : "—"}
              </p>
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.15em] text-[#888] leading-[1.6]">
                Creen que alguien<br />diría su nombre
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FRASES */}
      {frases.length > 0 && (
        <section className="bg-[#0B0B0C] text-[#F2F2F0] px-6 py-14 md:px-16 md:py-20">
          <div className="max-w-[680px]">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[#DC2626] mb-12">
              Respuestas reales
            </p>
            <div className="space-y-10">
              {frases.map((frase) => (
                <div key={frase.id} className="border-l-2 border-[#DC2626] pl-6">
                  <p className="text-[clamp(1.05rem,2.5vw,1.3rem)] leading-relaxed text-[#F2F2F0]/85 italic">
                    &ldquo;{frase.texto}&rdquo;
                  </p>
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-[#F2F2F0]/35">
                    — sujeto {frase.sujeto_num}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FORM */}
      <section className="bg-white text-[#1a1a1a] px-6 py-14 md:px-16 md:py-20">
        <div className="max-w-[600px]">
          {status === "done" ? (
            <div className="py-6">
              <p className="text-[clamp(1.6rem,5vw,2.4rem)] font-medium leading-tight mb-5 tracking-[-0.02em]">
                Tu respuesta ya está dentro del experimento.
              </p>
              <p className="text-[1rem] text-gray-500 leading-relaxed">
                Cuando publiquemos el resultado final te enviaré el documental.
              </p>
            </div>
          ) : !formStarted ? (
            <div>
              <div className="mb-8 space-y-3 text-[1rem] text-gray-500 leading-relaxed border-l-2 border-gray-200 pl-4">
                <p>Si hiciste el test en la calle, esta es la segunda parte del experimento.</p>
                <p>Si no, puedes responder igualmente.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormStarted(true)}
                className="bg-[#DC2626] text-white px-8 py-4 text-[0.85rem] uppercase tracking-[0.18em] transition-opacity hover:opacity-90"
              >
                Participa en el experimento
              </button>
            </div>
          ) : (
            <>
              <Progress />
              {renderFormScreen()}
            </>
          )}
        </div>
      </section>

      {/* EXPLANATION */}
      <section className="bg-[#0B0B0C] text-[#F2F2F0] px-6 py-14 md:px-16 md:py-20">
        <div className="max-w-[600px]">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[#DC2626] mb-10">
            Qué es este experimento
          </p>
          <div className="space-y-5 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-[#F2F2F0]/70">
            <p>La hipótesis del experimento nace de una frase de un libro.</p>
            <p className="text-[#F2F2F0] font-medium italic border-l-2 border-[#DC2626] pl-5 py-1">
              &ldquo;Es imposible no triunfar en esta vida…<br />con la cantidad de gilipollas que te rodean.&rdquo;
            </p>
            <p>La frase abre varias preguntas.</p>
            <p className="text-[#F2F2F0]">
              ¿Es realmente cierto?<br />
              ¿Son tantos los gilipollas que nos rodean?<br />
              ¿Y qué ocurre cuando haces esta pregunta cara a cara?
            </p>
            <p>Durante estos días estamos saliendo a la calle para comprobarlo.</p>
            <p>El resultado será un documental.</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#0B0B0C] border-t border-white/6 px-6 py-8">
        <p className="text-[0.75rem] text-[#F2F2F0]/25">© Alain Zulaika</p>
      </footer>
    </main>
  );
}
