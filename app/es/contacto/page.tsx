"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONTEXTO_LABELS: Record<string, string> = {
  empresa: "Empresa",
  cultura: "Cultura / institución",
  educativo: "Centro educativo",
  hosteleria: "Hostelería",
  otro: "Otro",
};

const TIPO_PREGUNTA: Record<string, string> = {
  empresa: "¿Qué tipo de evento encaja mejor con lo que estás organizando?",
  cultura: "¿Qué tipo de propuesta encaja mejor con lo que buscas?",
  educativo: "¿Qué tipo de propuesta encaja mejor con lo que buscas?",
};

const TIPO_OPTIONS: Record<string, string[]> = {
  empresa: ["Evento comercial", "Evento de marca", "Evento interno", "No lo tengo claro / necesito orientación"],
  cultura: ["Públicos amplios", "Intervenciones adaptadas al contexto", "Propuestas con identidad", "No lo tengo claro / necesito orientación"],
  educativo: ["Espectáculo para público amplio", "Charla o taller", "Intervención adaptada a un tema concreto", "No lo tengo claro / necesito orientación"],
};

const PREFERENCIA_OPTIONS = ["Por la mañana", "Por la tarde", "Me da igual"];

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

export default function ContactoPage() {
  const [screen, setScreen] = useState(0);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    contexto: "",
    contextoOtro: "",
    tipoEvento: "",
    descripcion: "",
    preferencia: "",
  });
  const [error, setError] = useState("");
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goNext = async () => {
    setError("");
    if (screen === 1) {
      if (!formData.nombre.trim() || !formData.email.trim() || !formData.telefono.trim()) {
        setError("Por favor completa todos los campos.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError("Introduce un email válido.");
        return;
      }
      const phoneRegex = /^[0-9\s+()-]{9,15}$/;
      if (!phoneRegex.test(formData.telefono.trim())) {
        setError("Introduce un teléfono válido.");
        return;
      }
    }
    if (screen === 2 && !formData.contexto) {
      setError("Selecciona una opción para continuar.");
      return;
    }
    if (screen === 3 && !formData.tipoEvento) {
      setError("Selecciona una opción para continuar.");
      return;
    }
    if (screen === 5 && !formData.preferencia) {
      setError("Selecciona una opción para continuar.");
      return;
    }

    if (screen === 5) {
      setSending(true);
      try {
        const res = await fetch("/api/contacto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        setScreen(6);
      } catch {
        setError("Algo fue mal. Inténtalo de nuevo o escríbeme directamente.");
      } finally {
        setSending(false);
      }
      return;
    }

    if (screen === 2) {
      if (formData.contexto === "hosteleria") { setScreen(5); return; }
      if (formData.contexto === "otro") { setScreen(4); return; }
      setScreen(3); return;
    }
    setScreen(screen + 1);
  };

  const goBack = () => {
    setError("");
    if (screen === 4) {
      if (formData.contexto === "otro") { setScreen(2); return; }
      setScreen(3); return;
    }
    if (screen === 5) {
      if (formData.contexto === "hosteleria") { setScreen(2); return; }
      setScreen(4); return;
    }
    setScreen(screen - 1);
  };

  const renderProgress = () => {
    const ctx = formData.contexto;
    let step = screen;
    let total = 5;

    if (ctx === "hosteleria") {
      const map: Record<number, number> = { 1: 1, 2: 2, 5: 3 };
      step = map[screen] ?? screen;
      total = 3;
    } else if (ctx === "otro") {
      const map: Record<number, number> = { 1: 1, 2: 2, 4: 3, 5: 4 };
      step = map[screen] ?? screen;
      total = 4;
    }

    return (
      <div style={{ display: "flex", gap: "6px", marginBottom: "2.5rem" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: "24px",
              height: "2px",
              background: i < step ? "#2ED3E6" : "rgba(242,242,240,0.12)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    );
  };

  const optionButton = (value: string, selected: string, onSelect: (v: string) => void, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => { onSelect(value); setError(""); }}
      onMouseEnter={() => setHoveredOption(value)}
      onMouseLeave={() => setHoveredOption(null)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "1rem 0",
        borderBottom: "1px solid rgba(242,242,240,0.08)",
        color: selected === value
          ? "#2ED3E6"
          : hoveredOption === value
          ? "rgba(242,242,240,0.90)"
          : "rgba(242,242,240,0.62)",
        background: "none",
        cursor: "pointer",
        fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
        transition: "color 0.2s",
      }}
    >
      {selected === value ? "→ " : ""}{label}
    </button>
  );

  const nextBtn = (label = "Siguiente →") => (
    <button
      type="button"
      onClick={goNext}
      style={{
        marginTop: "2.5rem",
        border: "1px solid rgba(242,242,240,0.20)",
        padding: "0.9rem 2.5rem",
        fontSize: "0.98rem",
        letterSpacing: "0.08em",
        color: "rgba(242,242,240,1)",
        background: "none",
        cursor: "pointer",
        display: "block",
      }}
      className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]"
    >
      {label}
    </button>
  );

  const renderForm = () => {
    switch (screen) {
      case 0:
        return (
          <div key={0} className="context-fade-in">
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
              style={{ background: "none", cursor: "pointer" }}
            >
              Empezar
            </button>
          </div>
        );

      case 1:
        return (
          <div key={1} className="context-fade-in">
            <div style={fieldStyle}>
              <label style={labelStyle}>Nombre</label>
              <input type="text" placeholder="Tu nombre" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyle} className="placeholder:text-[#F2F2F0]/30" autoFocus />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input type="email" placeholder="tu@email.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} className="placeholder:text-[#F2F2F0]/30" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" placeholder="+34 600 000 000" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} style={inputStyle} className="placeholder:text-[#F2F2F0]/30" />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 2:
        return (
          <div key={2} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              ¿En qué contexto encaja mejor lo que estás organizando?
            </p>
            <div>
              {Object.entries(CONTEXTO_LABELS).map(([val, lbl]) =>
                optionButton(val, formData.contexto, (v) => setFormData({ ...formData, contexto: v, contextoOtro: "", tipoEvento: "" }), lbl)
              )}
            </div>
            {formData.contexto === "otro" && (
              <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)", marginTop: "1.2rem" }}>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="¿Puedes especificar? (opcional)"
                  value={formData.contextoOtro}
                  onChange={e => setFormData({ ...formData, contextoOtro: e.target.value })}
                  style={{ ...inputStyle, color: "rgba(242,242,240,0.72)" }}
                  autoFocus
                />
              </div>
            )}
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 3: {
        const ctx = formData.contexto as keyof typeof TIPO_OPTIONS;
        return (
          <div key={3} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              {TIPO_PREGUNTA[ctx]}
            </p>
            <div>
              {(TIPO_OPTIONS[ctx] || []).map((opt) =>
                optionButton(opt, formData.tipoEvento, (v) => setFormData({ ...formData, tipoEvento: v }), opt)
              )}
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );
      }

      case 4:
        return (
          <div key={4} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Cuéntame brevemente qué estás organizando <span style={{ color: "rgba(242,242,240,0.42)", fontSize: "0.9em" }}>(opcional)</span>
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="Describe brevemente el evento: fecha, lugar, nº asistentes aproximado..."
                value={formData.descripcion}
                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                rows={5}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 5:
        return (
          <div key={5} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              ¿Cuándo prefieres que te llame?
            </p>
            <div>
              {PREFERENCIA_OPTIONS.map((opt) =>
                optionButton(opt, formData.preferencia, (v) => setFormData({ ...formData, preferencia: v }), opt)
              )}
            </div>
            <p style={{ marginTop: "2rem", fontSize: "1rem", lineHeight: 1.7, color: "rgba(242,242,240,0.65)" }}>
              Suele ser una llamada breve.<br />
              Si no consigo localizarte al primer intento, te escribiré para concretarlo mejor.
            </p>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn(sending ? "Enviando..." : "Enviar y hablarlo")}
          </div>
        );

      case 6:
        return (
          <div key={6} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.85rem,3.1vw,2.8rem)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "2.5rem" }}>
              Gracias, {formData.nombre.split(" ")[0]}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
              className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/72">
              <p>He recibido tu información.</p>
              <p>El siguiente paso es una llamada breve<br />para entender bien el contexto.</p>
              <p>Si no consigo localizarte al primer intento,<br />te escribiré para concretarlo mejor.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/es/" className="text-[0.96rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <nav className="flex items-center gap-6 md:gap-8">
            <Link href="/es/#como-trabajo" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Cómo trabajo</Link>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <a href="/contacto" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} className="hover:text-[#F2F2F0]/90">EU</a>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15" style={{ height: "360px" }} />
          <div className="pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Contacto</span>
            </p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              La mejor forma de empezar
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                es entender bien el contexto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FORMULARIO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pt-6 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[600px]">
          {screen < 6 && (
            <div style={{ marginBottom: "2.5rem" }}
              className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
              <p>Rellena este formulario breve<br />y te llamaré para entender bien lo que buscas.</p>
            </div>
          )}
          <div
            style={{
              border: "1px solid rgba(242,242,240,0.16)",
              background: "rgba(242,242,240,0.025)",
              padding: "2.5rem",
            }}
          >
            {screen > 0 && screen < 6 && renderProgress()}
            {renderForm()}
            {screen > 0 && screen < 6 && (
              <button
                type="button"
                onClick={goBack}
                style={{
                  marginTop: "1.2rem",
                  fontSize: "0.82rem",
                  letterSpacing: "0.08em",
                  color: "rgba(242,242,240,0.32)",
                  background: "none",
                  cursor: "pointer",
                  display: "block",
                  padding: 0,
                }}
                className="transition-colors duration-200 hover:text-[#F2F2F0]/60"
              >
                ← volver
              </button>
            )}
          </div>
          {screen < 6 && (
            <p style={{ marginTop: "1.5rem", fontSize: "clamp(1.05rem,1.3vw,1.2rem)", lineHeight: 1.6, color: "rgba(242,242,240,0.65)" }}>
              A partir de ahí, si tiene sentido, te enviaré una propuesta.
            </p>
          )}
        </div>
      </section>

      {/* EMAIL */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[600px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
              Si prefieres escribirme directamente:
            </p>
            <a
              href="mailto:contacto@niala.es"
              style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(46,211,230,0.75)", transition: "color 0.2s" }}
              className="hover:text-[#2ED3E6]"
            >
              contacto@niala.es
            </a>
          </div>
          <p style={{ marginTop: "0.8rem", fontSize: "0.95rem", lineHeight: 1.6, color: "rgba(242,242,240,0.72)" }}>
            Reservado para prensa y cuestiones ajenas a la contratación de eventos.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Navegación</p>
            <div className="grid gap-y-3">
              <Link href="/es/" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Inicio<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Empresa<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Cultura<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Hostelería<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/es/contacto" className="group relative w-fit text-[#2ED3E6]">Contacto<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
            </div>
          </div>
          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Identidad</p>
            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">Alain Zulaika</p>
            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">Intervenciones escénicas con magia para eventos corporativos y culturales.</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">Aviso legal</Link>
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Privacidad</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
