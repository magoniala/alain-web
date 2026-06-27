"use client";

import { useState, useEffect, useRef } from "react";

type Lang = "eu" | "es";

interface ParticipanteTaller {
  nombre: string;
  edad: string;
  anio_pasado: boolean;
}
interface ParticipanteMicromagia {
  nombre: string;
}
interface CapacitySlot {
  reservados: number;
  total: number;
}
interface CapacityData {
  taller: Record<string, CapacitySlot>;
  micromagia: Record<string, CapacitySlot>;
}

const TEAL = "#2ED3E6";
const BG = "#0B0B0C";
const FG = "#F2F2F0";
const MUTED = "rgba(242,242,240,0.55)";
const VERY_MUTED = "rgba(242,242,240,0.38)";
const BORDER = "rgba(242,242,240,0.16)";

const TALLER_SESIONES: { sesion: string; edades: string; edadesEs: string; nota?: string; notaEs?: string }[] = [
  { sesion: "10:00 – 10:55", edades: "6–7 urte", edadesEs: "6–7 años" },
  { sesion: "11:10 – 12:05", edades: "8–10 urte", edadesEs: "8–10 años" },
  { sesion: "12:20 – 13:15", edades: "+11 urte", edadesEs: "+11 años", nota: "Helduak ere bai", notaEs: "Adultos bienvenidos" },
];

const MICROMAGIA_HORARIOS = [
  "10:00 – 10:30",
  "11:00 – 11:30",
  "12:00 – 12:30",
  "17:30 – 18:00",
  "18:30 – 19:00",
];

function assignSession(edad: number): string {
  if (edad <= 7) return "10:00 – 10:55";
  if (edad <= 10) return "11:10 – 12:05";
  return "12:20 – 13:15";
}

const inputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: "clamp(1rem, 1.3vw, 1.1rem)",
  lineHeight: 1.6,
  color: "rgba(242,242,240,0.88)",
  paddingBottom: "0.55rem",
};
const fieldStyle: React.CSSProperties = {
  borderBottom: `1px solid ${BORDER}`,
  marginBottom: "1.75rem",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  color: VERY_MUTED,
  display: "block",
  marginBottom: "0.35rem",
};

function emptyTaller(): ParticipanteTaller {
  return { nombre: "", edad: "", anio_pasado: false };
}
function emptyMicromagia(): ParticipanteMicromagia {
  return { nombre: "" };
}

export default function Mirariak2026Page() {
  const [lang, setLang] = useState<Lang>("eu");
  const eu = lang === "eu";
  const [capacity, setCapacity] = useState<CapacityData | null>(null);

  // Form
  const [screen, setScreen] = useState(0);
  const [formData, setFormData] = useState({
    actividad: "" as "taller" | "micromagia" | "ambas" | "",
    numTaller: 1,
    participantesTaller: [emptyTaller()] as ParticipanteTaller[],
    numMicromagia: 1,
    participantesMicromagia: [emptyMicromagia()] as ParticipanteMicromagia[],
    horarioMicromagia: "",
    nombreContacto: "",
    email: "",
    newsletter: false,
  });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const reservasRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".fade-in").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/mirariak2026/capacity")
      .then((r) => r.json())
      .then(setCapacity)
      .catch(() => {});
  }, []);

  function scrollToForm() {
    reservasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Participant array resize helpers
  function setNumTaller(n: number) {
    setFormData((f) => {
      const cur = f.participantesTaller;
      const next =
        n > cur.length
          ? [...cur, ...Array.from({ length: n - cur.length }, emptyTaller)]
          : cur.slice(0, n);
      return { ...f, numTaller: n, participantesTaller: next };
    });
  }
  function setNumMicromagia(n: number) {
    setFormData((f) => {
      const cur = f.participantesMicromagia;
      const next =
        n > cur.length
          ? [...cur, ...Array.from({ length: n - cur.length }, emptyMicromagia)]
          : cur.slice(0, n);
      return { ...f, numMicromagia: n, participantesMicromagia: next };
    });
  }

  // Progress
  function getProgress(): { current: number; total: number } {
    const act = formData.actividad;
    let path: number[];
    if (act === "taller") path = [1, 3, 4, 5];
    else if (act === "micromagia") path = [2, 3, 4, 5];
    else path = [1, 2, 3, 4, 5];
    const idx = path.indexOf(screen);
    return { current: Math.max(idx + 1, 1), total: path.length };
  }

  // Navigation
  function goNext() {
    setError("");

    if (screen === 0) {
      if (!formData.actividad) {
        setError(eu ? "Aukeratu jarduera bat." : "Elige una actividad.");
        return;
      }
      if (formData.actividad === "micromagia") { setScreen(2); return; }
      setScreen(1); return;
    }

    if (screen === 1) {
      for (const p of formData.participantesTaller) {
        if (!p.nombre.trim()) {
          setError(eu ? "Bete parte-hartzaile guztien izena." : "Completa el nombre de todos los participantes.");
          return;
        }
        const edad = parseInt(p.edad);
        if (!p.edad || isNaN(edad) || edad < 6) {
          setError(eu ? "Adina 6 urtetik gorakoa izan behar da." : "La edad debe ser de 6 años o más.");
          return;
        }
      }
      // Client-side capacity check for taller
      if (capacity) {
        const demand: Record<string, number> = {};
        for (const p of formData.participantesTaller) {
          const s = assignSession(parseInt(p.edad));
          demand[s] = (demand[s] || 0) + 1;
        }
        for (const [sesion, n] of Object.entries(demand)) {
          const slot = capacity.taller[sesion];
          if (slot && slot.reservados + n > slot.total) {
            setError(
              eu
                ? `${sesion} saioa beteta dago. Jarri harremanetan kontaktu@niala.es helbidean.`
                : `La sesión ${sesion} está completa. Escríbenos a kontaktu@niala.es.`
            );
            return;
          }
        }
      }
      if (formData.actividad === "ambas") { setScreen(2); return; }
      setScreen(3); return;
    }

    if (screen === 2) {
      for (const p of formData.participantesMicromagia) {
        if (!p.nombre.trim()) {
          setError(eu ? "Bete parte-hartzaile guztien izena." : "Completa el nombre de todos los participantes.");
          return;
        }
      }
      if (!formData.horarioMicromagia) {
        setError(eu ? "Aukeratu ordutegia." : "Elige un horario.");
        return;
      }
      if (capacity) {
        const slot = capacity.micromagia[formData.horarioMicromagia];
        if (slot && slot.reservados + formData.participantesMicromagia.length > slot.total) {
          setError(
            eu
              ? `${formData.horarioMicromagia} saioa beteta dago. Aukeratu beste ordutegia.`
              : `La sesión ${formData.horarioMicromagia} está completa. Elige otro horario.`
          );
          return;
        }
      }
      setScreen(3); return;
    }

    if (screen === 3) {
      if (!formData.nombreContacto.trim()) {
        setError(eu ? "Sartu zure izena." : "Introduce tu nombre.");
        return;
      }
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        setError(eu ? "Sartu email baliodun bat." : "Introduce un email válido.");
        return;
      }
      setScreen(4); return;
    }

    if (screen === 4) { setScreen(5); return; }

    if (screen === 5) {
      handleSubmit(); return;
    }
  }

  function goBack() {
    setError("");
    if (screen === 1) { setScreen(0); return; }
    if (screen === 2) {
      if (formData.actividad === "ambas") { setScreen(1); return; }
      setScreen(0); return;
    }
    if (screen === 3) {
      if (formData.actividad === "taller") { setScreen(1); return; }
      setScreen(2); return;
    }
    if (screen === 4) { setScreen(3); return; }
    if (screen === 5) { setScreen(4); return; }
  }

  async function handleSubmit() {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/mirariak2026", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actividad: formData.actividad,
          participantesTaller:
            formData.actividad !== "micromagia"
              ? formData.participantesTaller.map((p) => ({
                  ...p,
                  edad: parseInt(p.edad),
                }))
              : undefined,
          participantesMicromagia:
            formData.actividad !== "taller" ? formData.participantesMicromagia : undefined,
          horarioMicromagia:
            formData.actividad !== "taller" ? formData.horarioMicromagia : undefined,
          nombreContacto: formData.nombreContacto,
          email: formData.email,
          newsletter: formData.newsletter,
          idioma: lang,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setScreen(6);
        // Refresh capacity after successful reservation
        fetch("/api/mirariak2026/capacity")
          .then((r) => r.json())
          .then(setCapacity)
          .catch(() => {});
      } else {
        setError(data.error || (eu ? "Zerbait gaizki joan da." : "Algo ha fallado."));
      }
    } catch {
      setError(eu ? "Zerbait gaizki joan da. Saiatu berriro." : "Algo ha fallado. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  }

  // Capacity badge
  function capBadge(slot: CapacitySlot | undefined): React.ReactNode {
    if (!slot) return null;
    const libre = slot.total - slot.reservados;
    if (libre <= 0) {
      return (
        <span style={{
          display: "inline-block",
          padding: "0.2rem 0.6rem",
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#e56060",
          border: "1px solid rgba(229,80,80,0.35)",
          background: "rgba(229,80,80,0.08)",
        }}>
          {eu ? "Beteta" : "Completo"}
        </span>
      );
    }
    const few = libre <= 4;
    return (
      <span style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        fontSize: "0.78rem",
        color: few ? "#f0a050" : TEAL,
        border: `1px solid ${few ? "rgba(240,160,80,0.4)" : "rgba(46,211,230,0.3)"}`,
        background: few ? "rgba(240,160,80,0.06)" : "transparent",
      }}>
        {libre} libre
      </span>
    );
  }

  function renderProgress() {
    const { current, total } = getProgress();
    return (
      <div style={{ display: "flex", gap: "5px", marginBottom: "2rem" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "2px",
              background: i < current ? TEAL : BORDER,
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    );
  }

  function numSelector(value: number, onChange: (n: number) => void) {
    return (
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: "44px",
              height: "44px",
              border: `1px solid ${value === n ? "rgba(46,211,230,0.55)" : BORDER}`,
              background: "transparent",
              color: value === n ? TEAL : MUTED,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  function nextBtn(label?: string) {
    return (
      <button
        type="button"
        onClick={goNext}
        style={{
          marginTop: "2rem",
          border: `1px solid rgba(242,242,240,0.20)`,
          padding: "0.9rem 2.5rem",
          fontSize: "0.95rem",
          letterSpacing: "0.08em",
          color: FG,
          background: "none",
          cursor: "pointer",
          display: "block",
        }}
        className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]"
      >
        {label ?? (eu ? "Hurrengoa →" : "Siguiente →")}
      </button>
    );
  }

  function backBtn() {
    return (
      <button
        type="button"
        onClick={goBack}
        style={{
          marginTop: "1rem",
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          color: VERY_MUTED,
          background: "none",
          cursor: "pointer",
          display: "block",
          padding: 0,
        }}
        className="transition-colors duration-200 hover:text-[#F2F2F0]/60"
      >
        ← {eu ? "itzuli" : "atrás"}
      </button>
    );
  }

  function renderForm() {
    switch (screen) {
      case 0:
        return (
          <div key={0} className="context-fade-in">
            <p style={{ fontSize: "clamp(1.1rem,1.4vw,1.25rem)", color: "rgba(242,242,240,0.88)", marginBottom: "1.75rem", lineHeight: 1.5 }}>
              {eu ? "Zer jarduera nahi duzue?" : "¿A qué actividad queréis venir?"}
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(
                [
                  { key: "taller", labelEu: "Tailerra", labelEs: "Taller", subEu: "Larunbata, azaroaren 14a", subEs: "Sábado, 14 de noviembre" },
                  { key: "micromagia", labelEu: "Mikromagia", labelEs: "Micromagia", subEu: "Igandea, azaroaren 15a", subEs: "Domingo, 15 de noviembre" },
                  { key: "ambas", labelEu: "Biak", labelEs: "Ambas", subEu: "Tailerra + mikromagia", subEs: "Taller + micromagia" },
                ] as const
              ).map((op) => {
                const sel = formData.actividad === op.key;
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => { setFormData((f) => ({ ...f, actividad: op.key })); setError(""); }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 0",
                      borderBottom: `1px solid rgba(242,242,240,0.08)`,
                      color: sel ? TEAL : "rgba(242,242,240,0.62)",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "color 0.2s",
                    }}
                    className="hover:text-[#F2F2F0]/90"
                  >
                    <span>
                      <span style={{ display: "block", fontSize: "clamp(1rem,1.3vw,1.15rem)", fontWeight: sel ? 500 : 400 }}>
                        {sel ? "→ " : ""}{eu ? op.labelEu : op.labelEs}
                      </span>
                      <span style={{ display: "block", fontSize: "0.82rem", color: VERY_MUTED, marginTop: "0.15rem" }}>
                        {eu ? op.subEu : op.subEs}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {error && <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
          </div>
        );

      case 1: {
        const hasTaller = formData.actividad === "taller" || formData.actividad === "ambas";
        if (!hasTaller) return null;
        return (
          <div key={1} className="context-fade-in">
            {renderProgress()}
            <p style={{ fontSize: "clamp(1.1rem,1.4vw,1.25rem)", color: "rgba(242,242,240,0.88)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              {eu ? "Tailerrerako zenbat plaza behar dituzue?" : "¿Cuántas plazas necesitáis para el taller?"}
            </p>
            {numSelector(formData.numTaller, setNumTaller)}
            {formData.participantesTaller.map((p, i) => {
              const edadNum = parseInt(p.edad);
              const sesion = !isNaN(edadNum) && edadNum >= 6 ? assignSession(edadNum) : null;
              const sesionSlot = sesion && capacity ? capacity.taller[sesion] : null;
              const libre = sesionSlot ? sesionSlot.total - sesionSlot.reservados : null;
              return (
                <div key={i} style={{ marginBottom: "1.75rem", paddingBottom: "1.75rem", borderBottom: i < formData.numTaller - 1 ? `1px solid ${BORDER}` : "none" }}>
                  <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: TEAL, marginBottom: "1rem" }}>
                    {eu ? `${i + 1}. parte-hartzailea` : `Participante ${i + 1}`}
                  </p>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>{eu ? "Izena eta abizenak" : "Nombre y apellidos"}</label>
                    <input
                      type="text"
                      placeholder={eu ? "Izena eta abizenak" : "Nombre y apellidos"}
                      value={p.nombre}
                      onChange={(e) => {
                        const arr = [...formData.participantesTaller];
                        arr[i] = { ...arr[i], nombre: e.target.value };
                        setFormData((f) => ({ ...f, participantesTaller: arr }));
                      }}
                      style={inputStyle}
                      className="placeholder:text-[#F2F2F0]/25"
                      autoFocus={i === 0}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
                    <div style={{ flex: "0 0 100px", borderBottom: `1px solid ${BORDER}`, marginBottom: "0" }}>
                      <label style={labelStyle}>{eu ? "Adina" : "Edad"}</label>
                      <input
                        type="number"
                        min="6"
                        max="99"
                        placeholder="—"
                        value={p.edad}
                        onChange={(e) => {
                          const arr = [...formData.participantesTaller];
                          arr[i] = { ...arr[i], edad: e.target.value };
                          setFormData((f) => ({ ...f, participantesTaller: arr }));
                        }}
                        style={{ ...inputStyle, width: "80px" }}
                        className="placeholder:text-[#F2F2F0]/25"
                      />
                    </div>
                    {sesion && (
                      <div style={{ paddingTop: "1.1rem" }}>
                        <span style={{ fontSize: "0.78rem", color: VERY_MUTED }}>{eu ? "Saioa → " : "Sesión → "}</span>
                        <span style={{ fontSize: "0.88rem", color: libre === 0 ? "#e55" : TEAL }}>{sesion}</span>
                        {libre !== null && (
                          <span style={{ fontSize: "0.75rem", color: libre === 0 ? "#e55" : libre <= 3 ? "#f0a050" : VERY_MUTED, marginLeft: "0.5rem" }}>
                            {libre === 0
                              ? eu ? "(beteta)" : "(completo)"
                              : `(${libre} libre${libre !== 1 && !eu ? "s" : ""})`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.25rem", cursor: "pointer", fontSize: "0.88rem", color: MUTED }}>
                    <input
                      type="checkbox"
                      checked={p.anio_pasado}
                      onChange={(e) => {
                        const arr = [...formData.participantesTaller];
                        arr[i] = { ...arr[i], anio_pasado: e.target.checked };
                        setFormData((f) => ({ ...f, participantesTaller: arr }));
                      }}
                      style={{ accentColor: TEAL }}
                    />
                    {eu ? "Mirariak 2025ean parte hartu zuen" : "Participó en Mirariak 2025"}
                  </label>
                </div>
              );
            })}
            {error && <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.65)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn()}
            {backBtn()}
          </div>
        );
      }

      case 2: {
        const hasMM = formData.actividad === "micromagia" || formData.actividad === "ambas";
        if (!hasMM) return null;
        return (
          <div key={2} className="context-fade-in">
            {renderProgress()}
            <p style={{ fontSize: "clamp(1.1rem,1.4vw,1.25rem)", color: "rgba(242,242,240,0.88)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              {eu ? "Mikromagiarako zenbat plaza behar dituzue?" : "¿Cuántas plazas necesitáis para la micromagia?"}
            </p>
            {numSelector(formData.numMicromagia, setNumMicromagia)}
            {formData.participantesMicromagia.map((p, i) => (
              <div key={i} style={{ marginBottom: "1.5rem", ...fieldStyle }}>
                <label style={labelStyle}>
                  {eu ? `${i + 1}. parte-hartzailea — izena` : `Participante ${i + 1} — nombre y apellidos`}
                </label>
                <input
                  type="text"
                  placeholder={eu ? "Izena eta abizenak" : "Nombre y apellidos"}
                  value={p.nombre}
                  onChange={(e) => {
                    const arr = [...formData.participantesMicromagia];
                    arr[i] = { nombre: e.target.value };
                    setFormData((f) => ({ ...f, participantesMicromagia: arr }));
                  }}
                  style={inputStyle}
                  className="placeholder:text-[#F2F2F0]/25"
                  autoFocus={i === 0}
                />
              </div>
            ))}
            <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.15em", color: VERY_MUTED, marginBottom: "0.75rem", marginTop: "0.5rem" }}>
              {eu ? "Ordutegia aukeratu" : "Elige horario"}
            </p>
            {MICROMAGIA_HORARIOS.map((h) => {
              const slot = capacity?.micromagia[h];
              const libre = slot ? slot.total - slot.reservados : null;
              const full = libre !== null && libre <= 0;
              const sel = formData.horarioMicromagia === h;
              return (
                <label
                  key={h}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 0",
                    borderBottom: `1px solid rgba(242,242,240,0.07)`,
                    cursor: full ? "not-allowed" : "pointer",
                    opacity: full ? 0.4 : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <input
                      type="radio"
                      name="horario"
                      value={h}
                      disabled={full || false}
                      checked={sel}
                      onChange={() => !full && setFormData((f) => ({ ...f, horarioMicromagia: h }))}
                      style={{ accentColor: TEAL }}
                    />
                    <span style={{ fontSize: "clamp(0.95rem,1.2vw,1.05rem)", color: sel ? FG : MUTED }}>{h}</span>
                  </span>
                  {slot ? capBadge(slot) : (
                    <span style={{ fontSize: "0.78rem", color: VERY_MUTED }}>20 plaza</span>
                  )}
                </label>
              );
            })}
            {error && <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.65)", marginTop: "1rem" }}>{error}</p>}
            {nextBtn()}
            {backBtn()}
          </div>
        );
      }

      case 3:
        return (
          <div key={3} className="context-fade-in">
            {renderProgress()}
            <p style={{ fontSize: "clamp(1.1rem,1.4vw,1.25rem)", color: "rgba(242,242,240,0.88)", marginBottom: "0.5rem", lineHeight: 1.5 }}>
              {eu ? "Zure datuak" : "Tus datos de contacto"}
            </p>
            <p style={{ fontSize: "0.88rem", color: VERY_MUTED, marginBottom: "2rem" }}>
              {eu
                ? "Baieztapena email honetan jasoko duzu."
                : "Recibirás la confirmación en este email."}
            </p>
            <div style={fieldStyle}>
              <label style={labelStyle}>{eu ? "Izena eta abizenak" : "Nombre y apellidos"}</label>
              <input
                type="text"
                placeholder={eu ? "Zure izena eta abizenak" : "Tu nombre y apellidos"}
                value={formData.nombreContacto}
                onChange={(e) => setFormData((f) => ({ ...f, nombreContacto: e.target.value }))}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/25"
                autoFocus
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder={eu ? "zure@emaila.com" : "tu@email.com"}
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                style={inputStyle}
                className="placeholder:text-[#F2F2F0]/25"
              />
            </div>
            {error && <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.65)", marginBottom: "0.5rem" }}>{error}</p>}
            {nextBtn()}
            {backBtn()}
          </div>
        );

      case 4:
        return (
          <div key={4} className="context-fade-in">
            {renderProgress()}
            <label
              style={{
                display: "flex",
                gap: "0.85rem",
                cursor: "pointer",
                padding: "1.5rem",
                border: `1px solid ${BORDER}`,
                background: "rgba(242,242,240,0.02)",
                marginBottom: "2rem",
              }}
            >
              <input
                type="checkbox"
                checked={formData.newsletter}
                onChange={(e) => setFormData((f) => ({ ...f, newsletter: e.target.checked }))}
                style={{ accentColor: TEAL, marginTop: "0.2rem", flexShrink: 0 }}
              />
              <span style={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.75 }}>
                {eu
                  ? "Tailer eta ikuskizunen inguruko informazio esklusiboa jaso nahi dut + etxean egiteko magia truko bat"
                  : "Quiero recibir info exclusiva sobre los talleres y shows + un juego de magia para hacer en casa"}
              </span>
            </label>
            {nextBtn(eu ? "Hurrengoa →" : "Siguiente →")}
            {backBtn()}
          </div>
        );

      case 5: {
        const hasTaller = formData.actividad !== "micromagia";
        const hasMM = formData.actividad !== "taller";
        return (
          <div key={5} className="context-fade-in">
            {renderProgress()}
            <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: TEAL, marginBottom: "1.5rem" }}>
              {eu ? "Erresebaren laburpena" : "Resumen de la reserva"}
            </p>

            {hasTaller && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                  {eu ? "Tailerra · Larunbata, azaroaren 14a" : "Taller · Sábado 14 de noviembre"}
                </p>
                {formData.participantesTaller.map((p, i) => {
                  const sesion = assignSession(parseInt(p.edad));
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0", borderBottom: `1px solid rgba(242,242,240,0.07)`, fontSize: "0.9rem" }}>
                      <span style={{ color: MUTED }}>{p.nombre || "—"}</span>
                      <span style={{ color: TEAL }}>{sesion}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {hasMM && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                  {eu ? "Mikromagia · Igandea, azaroaren 15a" : "Micromagia · Domingo 15 de noviembre"}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0", borderBottom: `1px solid rgba(242,242,240,0.07)`, fontSize: "0.9rem" }}>
                  <span style={{ color: MUTED }}>{formData.participantesMicromagia.map((p) => p.nombre).join(", ") || "—"}</span>
                  <span style={{ color: TEAL }}>{formData.horarioMicromagia}</span>
                </div>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1.25rem", marginBottom: "2rem" }}>
              <p style={{ fontSize: "0.85rem", color: VERY_MUTED, marginBottom: "0.25rem" }}>
                {eu ? "Email baieztapenerako:" : "Email de confirmación:"}
              </p>
              <p style={{ fontSize: "0.95rem", color: MUTED }}>{formData.email}</p>
            </div>

            {error && <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.65)", marginBottom: "1rem" }}>{error}</p>}

            <button
              type="button"
              onClick={goNext}
              disabled={sending}
              style={{
                width: "100%",
                border: `1px solid ${sending ? BORDER : "rgba(46,211,230,0.45)"}`,
                padding: "1.1rem",
                background: "transparent",
                cursor: sending ? "not-allowed" : "pointer",
                color: sending ? MUTED : TEAL,
                letterSpacing: "0.1em",
                transition: "all 0.25s",
                lineHeight: 1.4,
              }}
            >
              {sending ? (
                eu ? "Bidaltzen..." : "Enviando..."
              ) : (
                <>
                  <span style={{ display: "block", fontSize: "0.88rem" }}>FORMULARIOA BIDALI</span>
                  <span style={{ display: "block", fontSize: "0.78rem", opacity: 0.65 }}>ENVIAR RESERVA</span>
                </>
              )}
            </button>
            {backBtn()}
          </div>
        );
      }

      case 6:
        return (
          <div key={6} className="context-fade-in" style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
              {eu ? "Bikain." : "¡Perfecto."}
            </p>
            <p style={{ fontSize: "1rem", color: MUTED, lineHeight: 1.85, marginBottom: "0.5rem" }}>
              {eu ? "Zure erreserbak baieztatuta daude." : "Tu reserva está confirmada."}
            </p>
            <p style={{ fontSize: "0.88rem", color: VERY_MUTED, lineHeight: 1.75 }}>
              {eu
                ? "Baieztapena email bidez bidali dizugu. Spam karpetan ikusten ez baduzu, begiratu bertan."
                : "Hemos enviado la confirmación por email. Si no ves nada, revisa la carpeta de spam."}
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: BG, color: FG }}>

      {/* Header */}
      <header style={{ padding: "1.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "960px", margin: "0 auto" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: TEAL }}>
          Alain Zulaika
        </p>
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${BORDER}`, fontSize: "0.75rem", letterSpacing: "0.1em" }}>
          <button
            onClick={() => setLang("eu")}
            style={{ padding: "0.3rem 0.65rem", background: eu ? "rgba(46,211,230,0.06)" : "transparent", color: eu ? TEAL : MUTED, border: "none", cursor: "pointer" }}
          >
            EUS
          </button>
          <span style={{ width: "1px", alignSelf: "stretch", background: BORDER }} />
          <button
            onClick={() => setLang("es")}
            style={{ padding: "0.3rem 0.65rem", background: !eu ? "rgba(46,211,230,0.06)" : "transparent", color: !eu ? TEAL : MUTED, border: "none", cursor: "pointer" }}
          >
            ES
          </button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "5rem 2rem 7rem", textAlign: "center" }}>
        <p className="hero-fade-1" style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: VERY_MUTED, marginBottom: "2rem" }}>
          {eu ? "Elgoibarko bigarren magia asteburua" : "El segundo fin de semana de magia de Elgoibar"}
        </p>
        <h1 className="hero-fade-2" style={{ fontSize: "clamp(3.5rem, 9vw, 7rem)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 0.95, marginBottom: "2.5rem" }}>
          MIRARIAK<br />2026
        </h1>
        <div className="hero-fade-3" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.75rem" }}>
          <p style={{ fontSize: "clamp(1rem, 1.8vw, 1.2rem)", color: MUTED }}>
            {eu ? "2026ko azaroaren 14 eta 15ean" : "14 y 15 de noviembre de 2026"}
          </p>
          <p style={{ fontSize: "clamp(1rem, 1.8vw, 1.2rem)", color: MUTED }}>
            Aita Agirre Kulturgunea, Areto Nagusia · Elgoibar
          </p>
          <p style={{ fontSize: "clamp(1rem, 1.8vw, 1.2rem)", color: TEAL, fontWeight: 500 }}>
            {eu ? "Doan · Plazak mugatuak" : "Gratuito · Plazas limitadas"}
          </p>
        </div>
        <button
          className="hero-fade-3"
          onClick={scrollToForm}
          style={{ background: "transparent", border: `1px solid ${BORDER}`, padding: "1rem 2.5rem", fontSize: "0.9rem", letterSpacing: "0.15em", textTransform: "uppercase", color: FG, cursor: "pointer", transition: "all 0.25s" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(46,211,230,0.55)"; e.currentTarget.style.color = TEAL; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = FG; }}
        >
          {eu ? "Plaza eskatu" : "Reserva tu plaza"}
        </button>
      </section>

      {/* Qué es Mirariak */}
      <section style={{ maxWidth: "640px", margin: "0 auto", padding: "0 2rem 5rem" }}>
        <div className="fade-in" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "3rem", textAlign: "center" }}>
          <p style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: "1.5rem" }}>
            {eu ? "Bi egun. Magia benetakoa. Elgoibarren." : "Dos días. Magia de verdad. En Elgoibar."}
          </p>
          <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.1rem)", color: MUTED, lineHeight: 1.85, marginBottom: "1.25rem" }}>
            {eu
              ? "Mirariak Elgoibarko magia asteburua da — tailerrak umeentzat eta mikromagia helduentzat eta gazteentzat, talde txikietan, gertutik."
              : "Mirariak es el fin de semana de magia de Elgoibar — talleres para niños y micromagia para jóvenes y adultos, en grupos pequeños, de cerca."}
          </p>
          <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.1rem)", fontWeight: 500, marginBottom: "2rem" }}>
            {eu ? "Ez da ikuskizun hutsa. Parte hartzen duzu." : "No es un espectáculo. Participas."}
          </p>
          <p style={{ fontSize: "1rem", color: VERY_MUTED, fontStyle: "italic", lineHeight: 1.75 }}>
            {eu
              ? '"Nire helburua munduko ilusio-kuota handitzea da, Elgoibartik hasita." — Alain Zulaika'
              : '"Mi objetivo es aumentar la cuota mundial de ilusión, empezando desde Elgoibar." — Alain Zulaika'}
          </p>
        </div>
      </section>

      {/* Talleres */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 2rem 5rem" }}>
        <div className="fade-in" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "3rem" }}>
          <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.25em", color: TEAL, marginBottom: "1rem" }}>
            {eu ? "Larunbata, azaroaren 14a" : "Sábado, 14 de noviembre"}
          </p>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
            {eu ? "Magiaren tailerrak" : "Talleres de magia"}
          </h2>
          <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.05rem)", color: "rgba(242,242,240,0.70)", lineHeight: 1.85, marginBottom: "2.5rem", maxWidth: "600px" }}>
            {eu
              ? "Goizean zehar, Elgoibarko aurrek magiaren sekretuak ikasiko dituzte: pertsona bat erditik nola moztu eta objektuak nola hipnotizatu."
              : "Por la mañana, los niños y niñas de Elgoibar aprenderán los secretos de la magia: cómo cortar a una persona por la mitad y cómo hipnotizar objetos."}
          </p>
          <div style={{ marginBottom: "3rem" }}>
            {TALLER_SESIONES.map((row, i) => {
              const slot = capacity?.taller[row.sesion];
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "1rem",
                    padding: "1.1rem 0",
                    borderBottom: `1px solid ${BORDER}`,
                    borderTop: i === 0 ? `1px solid ${BORDER}` : "none",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{row.sesion}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.92rem", color: MUTED }}>{eu ? row.edades : row.edadesEs}</span>
                    {row.nota && (
                      <span style={{ fontSize: "0.75rem", color: VERY_MUTED }}>{eu ? row.nota : row.notaEs}</span>
                    )}
                  </span>
                  <span>{slot ? capBadge(slot) : <span style={{ fontSize: "0.78rem", color: VERY_MUTED }}>16 plaza</span>}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={scrollToForm}
            style={{ background: "transparent", border: `1px solid ${BORDER}`, padding: "0.9rem 2rem", fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase", color: FG, cursor: "pointer", transition: "all 0.25s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(46,211,230,0.55)"; e.currentTarget.style.color = TEAL; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = FG; }}
          >
            {eu ? "Plaza eskatu" : "Reserva tu plaza"}
          </button>
        </div>
      </section>

      {/* Micromagia */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 2rem 5rem" }}>
        <div className="fade-in" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "3rem" }}>
          <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.25em", color: TEAL, marginBottom: "1rem" }}>
            {eu ? "Igandea, azaroaren 15a" : "Domingo, 15 de noviembre"}
          </p>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
            Mikromagia
          </h2>
          <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.05rem)", color: "rgba(242,242,240,0.70)", lineHeight: 1.85, marginBottom: "2.5rem", maxWidth: "600px" }}>
            {eu
              ? "Magia gertutik. Talde txikietan. Begien aurrean gertatzen da dena. Ume, gazte eta helduek parte har dezakete (+5 urte)."
              : "Magia de cerca. En grupos pequeños. Todo ocurre delante de tus ojos. Pueden participar niños, jóvenes y adultos (+5 años)."}
          </p>
          <div style={{ marginBottom: "3rem" }}>
            {MICROMAGIA_HORARIOS.map((h, i) => {
              const slot = capacity?.micromagia[h];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem 0",
                    borderBottom: `1px solid ${BORDER}`,
                    borderTop: i === 0 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{h}</span>
                  <span>{slot ? capBadge(slot) : <span style={{ fontSize: "0.78rem", color: VERY_MUTED }}>20 plaza</span>}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={scrollToForm}
            style={{ background: "transparent", border: `1px solid ${BORDER}`, padding: "0.9rem 2rem", fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase", color: FG, cursor: "pointer", transition: "all 0.25s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(46,211,230,0.55)"; e.currentTarget.style.color = TEAL; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = FG; }}
          >
            {eu ? "Plaza eskatu" : "Reserva tu plaza"}
          </button>
        </div>
      </section>

      {/* Reservas */}
      <section ref={reservasRef} id="reservas" style={{ maxWidth: "640px", margin: "0 auto", padding: "0 2rem 6rem" }}>
        <div className="fade-in" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "3rem" }}>
          <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.25em", color: TEAL, marginBottom: "1rem" }}>
            {eu ? "Erreserbak" : "Reservas"}
          </p>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: "1rem" }}>
            {eu ? "Eskatu zure plaza" : "Reserva tu plaza"}
          </h2>
          {screen < 6 && (
            <p style={{ fontSize: "0.95rem", color: MUTED, lineHeight: 1.8, marginBottom: "2.5rem" }}>
              {eu
                ? "Plaza kopurua mugatua da. Iaz dena bete zen. Formularioa bete eta berehala jasoko duzu baieztapena email bidez, zure plaza eta ordutegi zehatza."
                : "Las plazas son limitadas. El año pasado se llenó todo. Rellena el formulario y recibirás confirmación inmediata por email con tu plaza y horario concreto."}
            </p>
          )}
          <div
            style={{
              padding: "1.75rem 2rem",
              border: `1px solid ${BORDER}`,
              background: "rgba(242,242,240,0.025)",
            }}
          >
            {renderForm()}
          </div>
          {screen < 6 && (
            <p style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: VERY_MUTED, textAlign: "center" }}>
              {eu ? "Zalantzarik?" : "¿Dudas?"}{" "}
              <a href="mailto:kontaktu@niala.es" style={{ color: VERY_MUTED, textDecoration: "underline" }}>
                kontaktu@niala.es
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Info práctica */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 2rem 6rem" }}>
        <div className="fade-in" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "3rem" }}>
          <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.25em", color: TEAL, marginBottom: "2rem" }}>
            {eu ? "Informazio praktikoa" : "Información práctica"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2.5rem" }}>
            <div>
              <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                {eu ? "Non" : "Dónde"}
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                Aita Agirre Kulturgunea<br />Areto Nagusia · Elgoibar, Gipuzkoa
              </p>
              <a
                href="https://maps.app.goo.gl/vzK7QvcKDCXvfoRNA"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.82rem", color: TEAL, textDecoration: "none", display: "inline-block", marginTop: "0.4rem" }}
              >
                {eu ? "Mapa →" : "Ver mapa →"}
              </a>
            </div>
            <div>
              <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                {eu ? "Noiz" : "Cuándo"}
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: MUTED }}>
                {eu ? "Larunbata, azaroaren 14a" : "Sábado, 14 nov"} · 10:00–13:15<br />
                {eu ? "Igandea, azaroaren 15a" : "Domingo, 15 nov"} · 10:00–19:00
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                {eu ? "Prezioa" : "Precio"}
              </p>
              <p style={{ fontSize: "0.95rem", color: TEAL, fontWeight: 500 }}>
                {eu ? "Doan" : "Gratuito"}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: VERY_MUTED, marginBottom: "0.6rem" }}>
                {eu ? "Adina" : "Edad"}
              </p>
              <p style={{ fontSize: "0.92rem", color: MUTED, lineHeight: 1.8 }}>
                {eu ? "Tailerrak: 6 urte+" : "Talleres: 6 años+"}<br />
                {eu ? "Mikromagia: 5 urte+" : "Micromagia: 5 años+"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "2.5rem 2rem", maxWidth: "960px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <p style={{ fontSize: "0.85rem", color: VERY_MUTED }}>
            Alain Zulaika · Elgoibar, Gipuzkoa ·{" "}
            <a href="https://alainzulaika.com" style={{ color: VERY_MUTED, textDecoration: "none" }}>alainzulaika.com</a>
          </p>
          <p style={{ fontSize: "0.85rem", color: "rgba(242,242,240,0.22)" }}>
            {eu ? "Mirariak 2026 · Elgoibarko bigarren magia asteburua" : "Mirariak 2026 · El segundo fin de semana de magia de Elgoibar"}
          </p>
          <p style={{ fontSize: "0.85rem", color: VERY_MUTED }}>
            {eu ? "Zalantzarik?" : "¿Dudas?"}{" "}
            <a href="mailto:kontaktu@niala.es" style={{ color: VERY_MUTED }}>kontaktu@niala.es</a>
          </p>
        </div>
      </footer>

    </main>
  );
}
