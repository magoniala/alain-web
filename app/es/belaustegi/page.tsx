"use client";

import Link from "next/link";
import { useState } from "react";

const TIPO_OPTIONS = [
  "Boda",
  "Evento de empresa",
  "Comunión",
  "Cumpleaños",
  "Otro",
];

const PERSONAS_OPTIONS = ["-25", "25–50", "50–80", "80–120"];

const MOMENTOS_OPTIONS = [
  "Aperitivo (antes de la comida o cena)",
  "Comida",
  "Sobremesa de comida",
  "Cena",
  "Sobremesa de cena",
  "Cóctel / momento de pie",
  "Aún por definir",
];

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

const TOTAL_STEPS = 6;

export default function BelaustegiEsPage() {
  const [screen, setScreen] = useState(0);
  const [formData, setFormData] = useState({
    tipoEvento: "",
    fechaAproximada: "",
    personas: "",
    momentos: [] as string[],
    notas: "",
    nombre: "",
    email: "",
    telefono: "",
    lang: "es",
  });
  const [error, setError] = useState("");
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const toggleMomento = (opt: string) => {
    setError("");
    const current = formData.momentos;
    if (current.includes(opt)) {
      setFormData({ ...formData, momentos: current.filter((o) => o !== opt) });
    } else {
      setFormData({ ...formData, momentos: [...current, opt] });
    }
  };

  const goNext = async () => {
    setError("");

    if (screen === 1 && !formData.tipoEvento) {
      setError("Por favor, selecciona una opción.");
      return;
    }
    if (screen === 2 && !formData.fechaAproximada.trim()) {
      setError("Por favor, indica la fecha aproximada.");
      return;
    }
    if (screen === 3 && !formData.personas) {
      setError("Por favor, selecciona una opción.");
      return;
    }
    if (screen === 4 && formData.momentos.length === 0) {
      setError("Selecciona al menos una opción.");
      return;
    }

    if (screen === 6) {
      if (!formData.nombre.trim() || !formData.email.trim() || !formData.telefono.trim()) {
        setError("Por favor, rellena todos los campos.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError("Introduce un email válido.");
        return;
      }
      setSending(true);
      try {
        const res = await fetch("/api/belaustegi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        setScreen(7);
      } catch {
        setError("Algo ha ido mal. Inténtalo de nuevo.");
      } finally {
        setSending(false);
      }
      return;
    }

    setScreen(screen + 1);
  };

  const goBack = () => {
    setError("");
    setScreen(screen - 1);
  };

  const optionButton = (
    value: string,
    selected: string,
    onSelect: (v: string) => void,
    label: string
  ) => (
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
        color: selected === value ? "#2ED3E6" : hoveredOption === value ? "rgba(242,242,240,0.90)" : "rgba(242,242,240,0.62)",
        background: "none",
        cursor: "pointer",
        fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
        transition: "color 0.2s",
      }}
    >
      {selected === value ? "→ " : ""}{label}
    </button>
  );

  const multiButton = (opt: string) => {
    const selected = formData.momentos.includes(opt);
    return (
      <button
        key={opt}
        type="button"
        onClick={() => toggleMomento(opt)}
        onMouseEnter={() => setHoveredOption(opt)}
        onMouseLeave={() => setHoveredOption(null)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "1rem 0",
          borderBottom: "1px solid rgba(242,242,240,0.08)",
          color: selected ? "#2ED3E6" : hoveredOption === opt ? "rgba(242,242,240,0.90)" : "rgba(242,242,240,0.62)",
          background: "none",
          cursor: "pointer",
          fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
          transition: "color 0.2s",
        }}
      >
        {selected ? "→ " : ""}{opt}
      </button>
    );
  };

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

  const renderProgress = () => (
    <div style={{ display: "flex", gap: "6px", marginBottom: "2.5rem" }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "24px",
            height: "2px",
            background: i < screen ? "#2ED3E6" : "rgba(242,242,240,0.12)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );

  const renderForm = () => {
    switch (screen) {
      case 0:
        return (
          <div key={0}>
            <p style={{ fontSize: "clamp(1.05rem,1.3vw,1.2rem)", color: "rgba(242,242,240,0.65)", marginBottom: "1.2rem", lineHeight: 1.7 }}>
              Información necesaria para valorar el servicio de magia para bodas, comuniones, eventos de empresa…
            </p>
            <p style={{ fontSize: "clamp(1.05rem,1.3vw,1.2rem)", color: "rgba(242,242,240,0.45)", marginBottom: "2rem", lineHeight: 1.7 }}>
              Rellenar el formulario no implica ningún compromiso. Con esta información, prepararé una propuesta adaptada a las características de tu evento.
            </p>
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
          <div key={1}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Tipo de evento
            </p>
            <div>
              {TIPO_OPTIONS.map((opt) =>
                optionButton(opt, formData.tipoEvento, (v) => setFormData({ ...formData, tipoEvento: v }), opt)
              )}
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 2:
        return (
          <div key={2}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Fecha del evento
            </p>
            <div style={fieldStyle}>
              <input
                type="text"
                placeholder="Junio de 2025, este otoño, aún no lo sabemos..."
                value={formData.fechaAproximada}
                onChange={(e) => setFormData({ ...formData, fechaAproximada: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 3:
        return (
          <div key={3}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Número de personas
            </p>
            <div>
              {PERSONAS_OPTIONS.map((opt) =>
                optionButton(opt, formData.personas, (v) => setFormData({ ...formData, personas: v }), opt)
              )}
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 4:
        return (
          <div key={4}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.5 }}>
              ¿Qué momentos tendrá el evento?
            </p>
            <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.40)", letterSpacing: "0.08em", marginBottom: "1.6rem" }}>
              Puedes elegir más de una opción
            </p>
            <div>
              {MOMENTOS_OPTIONS.map((opt) => multiButton(opt))}
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 5:
        return (
          <div key={5}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.5 }}>
              Notas
            </p>
            <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.40)", letterSpacing: "0.08em", marginBottom: "1.6rem" }}>
              Opcional — cualquier otro detalle a tener en cuenta
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="Escribe aquí tu respuesta..."
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={5}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            {nextBtn()}
          </div>
        );

      case 6:
        return (
          <div key={6}>
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Tus datos de contacto
            </p>
            <p style={{ fontSize: "clamp(1.05rem,1.3vw,1.15rem)", color: "rgba(242,242,240,0.55)", marginBottom: "2rem", lineHeight: 1.6 }}>
              Para enviarte la propuesta adaptada a tu evento.
            </p>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nombre</label>
              <input
                type="text"
                placeholder="Tu nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Teléfono</label>
              <input
                type="tel"
                placeholder="+34 600 000 000"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
              />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn(sending ? "Enviando..." : "Enviar →")}
          </div>
        );

      case 7:
        return (
          <div key={7}>
            <p style={{ fontSize: "clamp(1.85rem,3.1vw,2.8rem)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "2.5rem" }}>
              Gracias, {formData.nombre.split(" ")[0]}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
              className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/72">
              <p>Formulario recibido.</p>
              <p>En cuanto pueda te haré llegar una propuesta adaptada a tu evento.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            <Link href="/belaustegi" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EUS</Link>
            <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
            <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[38vh] max-w-[1400px] flex-col justify-end px-8 pb-16 md:px-16 md:pb-20">
        <div>
          <p className="mb-6 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6] uppercase">
            Belaustegi Baserria
          </p>
          <h1 className="max-w-[820px] text-[clamp(2.4rem,4.5vw,4.2rem)] font-medium leading-[1.06] tracking-[-0.03em]">
            Formulario para eventos especiales
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[600px]">
          <div
            className="p-6 md:p-10"
            style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}
          >
            {screen > 0 && screen < 7 && renderProgress()}
            {renderForm()}
            {screen > 0 && screen < 7 && (
              <button
                type="button"
                onClick={goBack}
                style={{
                  marginTop: "1.2rem",
                  fontSize: "0.82rem",
                  letterSpacing: "0.08em",
                  color: "rgba(242,242,240,0.50)",
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
        </div>
      </section>

      <footer className="border-t border-white/6 px-8 py-10 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.88rem] text-[#F2F2F0]/28">© Alain Zulaika</p>
        </div>
      </footer>

    </main>
  );
}
