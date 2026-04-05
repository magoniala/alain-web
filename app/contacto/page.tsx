"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONTEXTO_LABELS: Record<string, string> = {
  empresa: "Enpresa",
  cultura: "Kultura / erakundea",
  educativo: "Hezkuntza-zentroa",
  hosteleria: "Ostalaritza",
  otro: "Beste bat",
};

const TIPO_PREGUNTA: Record<string, string> = {
  empresa: "Zein ekitaldi mota dator hobeto antolatzen ari zarenarekin?",
  cultura: "Zein proposamen mota dator gehien bilatzen duzunarekin?",
  educativo: "Zein proposamen mota dator gehien bilatzen duzunarekin?",
};

const TIPO_OPTIONS: Record<string, string[]> = {
  empresa: ["Ekitaldi komertziala", "Marka ekitaldia", "Barne ekitaldia", "Ez dakit ondo / orientazioa behar dut"],
  cultura: ["Publiko zabalak", "Testuingurura egokitutako interbentzioak", "Nortasunezko proposamenak", "Ez dakit ondo / orientazioa behar dut"],
  educativo: ["Publiko zabaletarako ikuskizuna", "Hitzaldia edo tailerra", "Gai zehatz bati egokitutako interbentzio bat", "Ez dakit ondo / orientazioa behar dut"],
};

const PREFERENCIA_OPTIONS = ["Goizez", "Arratsaldez", "Berdin zait"];

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
        setError("Mesedez, bete eremu guztiak.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError("Sartu baliozko email bat.");
        return;
      }
      const phoneRegex = /^[0-9\s+()-]{9,15}$/;
      if (!phoneRegex.test(formData.telefono.trim())) {
        setError("Sartu baliozko telefono bat.");
        return;
      }
    }
    if (screen === 2 && !formData.contexto) {
      setError("Jarraitzeko aukeratu bat.");
      return;
    }
    if (screen === 3 && !formData.tipoEvento) {
      setError("Jarraitzeko aukeratu bat.");
      return;
    }
    if (screen === 5 && !formData.preferencia) {
      setError("Jarraitzeko aukeratu bat.");
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
        setError("Zerbait gaizki joan da. Saiatu berriro edo idatzi niri zuzenean.");
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
              Hasi
            </button>
          </div>
        );

      case 1:
        return (
          <div key={1} className="context-fade-in">
            <div style={fieldStyle}>
              <label style={labelStyle}>Izena</label>
              <input type="text" placeholder="Zure izena" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyle} className="placeholder:text-[#F2F2F0]/30" autoFocus />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Emaila</label>
              <input type="email" placeholder="zu@email.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} className="placeholder:text-[#F2F2F0]/30" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Telefonoa</label>
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
              Zer testuingurutan kokatzen da gehien antolatzear duzuna?
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
                  placeholder="Zehaztu dezakezu? (aukerakoa)"
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
              Kontatu labur zer antolatzear zaren <span style={{ color: "rgba(242,242,240,0.42)", fontSize: "0.9em" }}>(aukerakoa)</span>
            </p>
            <div style={{ borderBottom: "1px solid rgba(242,242,240,0.12)" }}>
              <textarea
                placeholder="Deskribatu labur ekitaldiak: data, tokia, gutxi gorabehera parte-hartzaile kopurua..."
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
              Noiz nahiago duzu deitzea?
            </p>
            <div>
              {PREFERENCIA_OPTIONS.map((opt) =>
                optionButton(opt, formData.preferencia, (v) => setFormData({ ...formData, preferencia: v }), opt)
              )}
            </div>
            <p style={{ marginTop: "2rem", fontSize: "1rem", lineHeight: 1.7, color: "rgba(242,242,240,0.65)" }}>
              Normalean dei labur bat izaten da.<br />
              Lehen saiakeran ez bazaitut lokalizatzen, hobeto zehazteko idatziko dizut.
            </p>
            {error && <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.45)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn(sending ? "Bidaltzen..." : "Bidali eta hitz egin")}
          </div>
        );

      case 6:
        return (
          <div key={6} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.85rem,3.1vw,2.8rem)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "2.5rem" }}>
              Eskerrik asko, {formData.nombre.split(" ")[0]}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
              className="text-[clamp(1.15rem,1.45vw,1.35rem)] leading-relaxed text-[#F2F2F0]/72">
              <p>Zure informazioa jaso dut.</p>
              <p>Hurrengo pausoa testuingurua ondo ulertzeko dei labur bat da.</p>
              <p>Lehen saiakeran ez bazaitut lokalizatzen,<br />hobeto zehazteko idatziko dizut.</p>
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
          <Link href="/" className="text-[0.96rem] uppercase tracking-[0.35em] text-[#2ED3E6]">
            Alain Zulaika
          </Link>
          <nav className="flex items-center gap-6 md:gap-8">
            <Link href="/#como-trabajo" className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Nola egiten dut lan</Link>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>EU</span>
              <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
              <Link href="/es/contacto" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>ES</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-8 md:px-16">
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15" style={{ height: "240px" }} />
          <div className="pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6]">
              <span className="uppercase">Kontaktua</span>
            </p>
            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              Hasteko modu onena
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                testuingurua ondo ulertzea da.
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
              <p>Bete formulario labur hau eta bilatzen zaudena xehetasunez ulertzeko deituko dizut.</p>
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
                ← itzuli
              </button>
            )}
          </div>
          {screen < 6 && (
            <p style={{ marginTop: "1.5rem", fontSize: "clamp(1.05rem,1.3vw,1.2rem)", lineHeight: 1.6, color: "rgba(242,242,240,0.65)" }}>
              Hortik aurrera, zentzua badu, proposamen bat bidaliko dizut.
            </p>
          )}
        </div>
      </section>

      {/* EMAIL */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[600px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
              Zuzenean idatzi nahi badidazu:
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
            Prentsarako eta ekitaldiak kontratatzeaz aparteko gaietarako.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16 md:py-18">
        <div className="mx-auto grid max-w-[1400px] gap-16 md:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Nabigazioa</p>
            <div className="grid gap-y-3">
              <Link href="/" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Hasiera<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/empresa" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Enpresa<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/cultura" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Kultura<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/hosteleria" className="group relative w-fit text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]">Ostalaritza<span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#2ED3E6] transition-all duration-300 group-hover:w-full" /></Link>
              <Link href="/contacto" className="group relative w-fit text-[#2ED3E6]">Kontaktua<span className="absolute -bottom-0.5 left-0 h-px w-full bg-[#2ED3E6]" /></Link>
            </div>
          </div>
          <div className="max-w-[520px]">
            <p className="mb-6 text-[0.82rem] uppercase tracking-[0.16em] text-[#F2F2F0]/42">Identitatea</p>
            <p className="text-[1.1rem] font-medium text-[#F2F2F0]">Alain Zulaika</p>
            <p className="mt-4 max-w-[420px] leading-relaxed text-[#F2F2F0]/66">Ekitaldi korporatibo eta kulturaletarako interbentzio eszenikoak magiarekin.</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-[1400px] border-t border-white/6 pt-6">
          <div className="flex flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
            <p>© Alain Zulaika</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">Lege oharra</Link>
              <Link href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">Pribatutasuna</Link>
              <Link href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">Cookieak</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
