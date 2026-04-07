"use client";

import Link from "next/link";
import { useState } from "react";

const FIRMA_OPTIONS = [
  "Nire izena bakarrik",
  "Izena + enpresa edo kargua",
  "Anonimoa izatea nahiago dut",
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

// Screens: 0=ongi etorri, 1=datuak, 2=ekitaldia, 3=balorazioa, 4=publikoa, 5=hobetzea, 6=testigantza, 7=baimena(baldintzapean), 8=eskerrak
const TOTAL_STEPS = 6;

export default function BalorazioaPage() {
  const [screen, setScreen] = useState(0);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    nombreEvento: "",
    valoracion: -1,
    comentariosPublico: "",
    mejora: "",
    cita: "",
    permisoCita: "",
    firmaCita: "",
    lang: "eu",
  });
  const [error, setError] = useState("");
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const hasCita = formData.cita.trim().length > 0;

  const screenToStep = (s: number): number => {
    if (s === 7) return 6;
    return s;
  };
  const currentStep = screenToStep(screen);

  const submit = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/valoracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      setScreen(8);
    } catch {
      setError("Zerbait gaizki joan da. Saiatu berriro edo idatzi niri zuzenean.");
    } finally {
      setSending(false);
    }
  };

  const goNext = async () => {
    setError("");

    if (screen === 1) {
      if (!formData.nombre.trim() || !formData.email.trim()) {
        setError("Mesedez, bete zure izena eta emaila.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError("Sartu baliozko email bat.");
        return;
      }
    }

    if (screen === 2 && !formData.nombreEvento.trim()) {
      setError("Mesedez, adierazi ekitaldiaren izena.");
      return;
    }

    if (screen === 3 && formData.valoracion < 0) {
      setError("Mesedez, hautatu balorazioa.");
      return;
    }

    if (screen === 6) {
      if (hasCita) { setScreen(7); return; }
      await submit(); return;
    }

    if (screen === 7) {
      if (!formData.permisoCita) {
        setError("Mesedez, adierazi zure testigantza erabil dezakegun.");
        return;
      }
      if (formData.permisoCita === "Bai" && !formData.firmaCita) {
        setError("Adierazi nola nahi duzun zure izena agertzea.");
        return;
      }
      await submit(); return;
    }

    setScreen(screen + 1);
  };

  const goBack = () => {
    setError("");
    if (screen === 7) { setScreen(6); return; }
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
        color:
          selected === value
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

  const nextBtn = (label = "Hurrengoa →") => (
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
            background: i < currentStep ? "#2ED3E6" : "rgba(242,242,240,0.12)",
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
          <div key={0} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.05rem,1.3vw,1.2rem)", color: "rgba(242,242,240,0.65)", marginBottom: "2rem", lineHeight: 1.7 }}>
              Pare bat minutu bakarrik. Zure iritziak zerk funtzionatzen duen eta zer hobetu behar dudan jakiteko laguntzen dit.
            </p>
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]"
              style={{ background: "none", cursor: "pointer" }}
            >
              Hasi
            </button>
          </div>
        );

      case 1:
        return (
          <div key={1} className="context-fade-in">
            <div style={fieldStyle}>
              <label style={labelStyle}>Zure izena</label>
              <input
                type="text"
                placeholder="Izena eta abizena"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Zure emaila</label>
              <input
                type="email"
                placeholder="zu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/30"
              />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 2:
        return (
          <div key={2} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Zein ekitaldi edo ekintzatan izan zen?
            </p>
            <div style={fieldStyle}>
              <input
                type="text"
                placeholder="Ekitaldi izena, enpresa, eguna..."
                value={formData.nombreEvento}
                onChange={(e) => setFormData({ ...formData, nombreEvento: e.target.value })}
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
          <div key={3} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              0tik 5era, nola baloratuko zenuke emanaldi osoa?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setFormData({ ...formData, valoracion: n }); setError(""); }}
                  style={{
                    width: "3.2rem",
                    height: "3.2rem",
                    border: formData.valoracion === n
                      ? "1px solid rgba(46,211,230,0.60)"
                      : "1px solid rgba(242,242,240,0.18)",
                    color: formData.valoracion === n ? "#2ED3E6" : "rgba(242,242,240,0.70)",
                    background: formData.valoracion === n ? "rgba(46,211,230,0.05)" : "none",
                    fontSize: "1.15rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  className="hover:border-white/40 hover:text-[#F2F2F0]"
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "rgba(242,242,240,0.35)", letterSpacing: "0.08em" }}>
              0 = Ez zituen espektatibak bete &nbsp;·&nbsp; 5 = Espektatiba guztiak gainditu zituen
            </p>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 4:
        return (
          <div key={4} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.5 }}>
              Nola erreakzionatu zuen publikoak?
            </p>
            <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.40)", letterSpacing: "0.08em", marginBottom: "1.6rem" }}>
              Aukerakoa — kontatu ikusitakoa
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="Harritu egin ziren, barre egin zuten, engantxatuta geratu ziren..."
                value={formData.comentariosPublico}
                onChange={(e) => setFormData({ ...formData, comentariosPublico: e.target.value })}
                rows={5}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            {nextBtn()}
          </div>
        );

      case 5:
        return (
          <div key={5} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.5 }}>
              Ba al dago hobetu beharrekorik?
            </p>
            <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.40)", letterSpacing: "0.08em", marginBottom: "1.6rem" }}>
              Aukerakoa — edozein xehetasun ongi etorria da
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="Erritmoa, iraupena, une zehatz bat..."
                value={formData.mejora}
                onChange={(e) => setFormData({ ...formData, mejora: e.target.value })}
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
          <div key={6} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.5 }}>
              Testigantza bat utzi nahi al duzu?
            </p>
            <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.40)", letterSpacing: "0.08em", marginBottom: "1.6rem" }}>
              Aukerakoa — nahi baduzu, zure esperientzia laburbiltzen duen esaldi bat
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="«Gaueko une berezienetako bat izan zen...»"
                value={formData.cita}
                onChange={(e) => setFormData({ ...formData, cita: e.target.value, permisoCita: "", firmaCita: "" })}
                rows={4}
                style={{ ...inputStyle, resize: "none", paddingTop: "0.25rem" }}
                className="placeholder:text-[#F2F2F0]/30"
                autoFocus
              />
            </div>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn(sending ? "Bidaltzen..." : hasCita ? "Hurrengoa →" : "Bidali →")}
          </div>
        );

      case 7:
        return (
          <div key={7} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "2rem", lineHeight: 1.5 }}>
              Zure testigantza web orrian edo sare sozialetan erabil al dezaket?
            </p>
            <div>
              {["Bai", "Ez"].map((opt) =>
                optionButton(opt, formData.permisoCita, (v) => setFormData({ ...formData, permisoCita: v, firmaCita: "" }), opt)
              )}
            </div>

            {formData.permisoCita === "Bai" && (
              <div style={{ marginTop: "2rem" }}>
                <p style={{ fontSize: "clamp(1.05rem,1.3vw,1.15rem)", color: "rgba(242,242,240,0.75)", marginBottom: "1.2rem", lineHeight: 1.5 }}>
                  Nola nahi duzu zure izena agertzea?
                </p>
                <div>
                  {FIRMA_OPTIONS.map((opt) =>
                    optionButton(opt, formData.firmaCita, (v) => setFormData({ ...formData, firmaCita: v }), opt)
                  )}
                </div>
              </div>
            )}

            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn(sending ? "Bidaltzen..." : "Bidali →")}
          </div>
        );

      case 8:
        return (
          <div key={8} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.85rem,3.1vw,2.8rem)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "2.5rem" }}>
              Eskerrik asko, {formData.nombre.split(" ")[0]}.
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
              className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/72"
            >
              <p>Zure balorazioa jaso dut.</p>
              <p>Hurrengo emanaldiak hobetzen laguntzen dit.</p>
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
          <Link href="/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EUS</span>
            <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
            <Link href="/valoracion" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-[38vh] max-w-[1400px] flex-col justify-end px-8 pb-16 md:px-16 md:pb-20">
        <div>
          <p className="mb-6 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6] uppercase">
            Balorazioa
          </p>
          <h1 className="max-w-[820px] text-[clamp(2.4rem,4.5vw,4.2rem)] font-medium leading-[1.06] tracking-[-0.03em]">
            Nola joan zen emanaldia?
          </h1>
        </div>
      </section>

      {/* FORMULARIO */}
      <section className="mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[600px]">
          <div
            className="p-6 md:p-10"
            style={{
              border: "1px solid rgba(242,242,240,0.16)",
              background: "rgba(242,242,240,0.025)",
            }}
          >
            {screen > 0 && screen < 8 && renderProgress()}
            {renderForm()}
            {screen > 0 && screen < 8 && (
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
                ← itzuli
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-10 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.88rem] text-[#F2F2F0]/28">© Alain Zulaika</p>
        </div>
      </footer>

    </main>
  );
}
