"use client";

import { useEffect, useState } from "react";

const TURNO_OPTIONS = ["Mañana", "Tarde", "Me da igual"];

const TOTAL_PLAZAS = 10;

const AMBER = "#D4860A";
const NAVY = "#1C3A5E";
const CREAM = "#FAF3E8";
const DARK_NAVY = "#0F2240";

const inputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.6,
  color: DARK_NAVY,
  paddingBottom: "0.6rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "rgba(28,58,94,0.65)",
  display: "block",
  marginBottom: "0.4rem",
};

const fieldStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(28,58,94,0.25)",
  marginBottom: "2rem",
};

const proseP: React.CSSProperties = {
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.8,
  color: "rgba(15,34,64,0.80)",
  marginBottom: "2rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "clamp(1.7rem,2.6vw,2.3rem)",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  marginBottom: "1.8rem",
  color: NAVY,
};

const emphasisP: React.CSSProperties = {
  fontSize: "clamp(1.4rem,2vw,1.75rem)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.35,
  color: NAVY,
  marginBottom: "2rem",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(28,58,94,0.18)",
  background: "rgba(28,58,94,0.04)",
};

function Lines({ lines, mb = "2.75rem" }: { lines: string[]; mb?: string }) {
  return (
    <div style={{ marginBottom: mb }}>
      {lines.map((line, i) => (
        <p key={i} style={{ ...proseP, marginBottom: i === lines.length - 1 ? 0 : "0.75rem" }}>
          {line}
        </p>
      ))}
    </div>
  );
}

export default function ValoracionEntrenatzailePage() {
  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    email: "",
    motivo: "",
    turno: "",
    newsletter: false,
  });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [hoveredTurno, setHoveredTurno] = useState<string | null>(null);

  useEffect(() => {
    const fetchRemaining = () => {
      fetch("/api/entrenatzaile/valoracion")
        .then((r) => r.json())
        .then((d) => setRemaining(typeof d.remaining === "number" ? d.remaining : null))
        .catch(() => {});
    };
    fetchRemaining();
    const interval = setInterval(fetchRemaining, 20000);
    return () => clearInterval(interval);
  }, []);

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

  const full = remaining !== null && remaining <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.nombre.trim() || !formData.edad.trim() || !formData.email.trim() || !formData.motivo.trim()) {
      setError("Por favor, rellena todos los campos obligatorios.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Introduce un email válido.");
      return;
    }
    const edadNum = Number(formData.edad);
    if (!Number.isFinite(edadNum) || edadNum < 14 || edadNum > 100) {
      setError("Introduce una edad válida.");
      return;
    }
    if (!formData.turno) {
      setError("Indica si prefieres mañana o tarde.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/entrenatzaile/valoracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, edad: edadNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Algo ha ido mal. Inténtalo de nuevo o escríbeme directamente.");
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        return;
      }
      setDone(true);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setError("Algo ha ido mal. Inténtalo de nuevo o escríbeme directamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      {/* HEADER */}
      <header className="border-b border-[#1C3A5E]/12 bg-[#FAF3E8] px-8 py-4 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#D4860A]">
            Entrenatzaile
          </p>
        </div>
      </header>

      {/* HERO */}
      <section className="w-full bg-[#D4860A] px-8 py-24 md:px-16 md:py-32">
        <div className="relative mx-auto max-w-[1400px]">
          <div className="absolute left-0 top-0 w-[2px] bg-[#1C3A5E]/30 h-[242px] md:h-[287px] xl:h-[329px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#0F2240]">
              <span className="uppercase">Valoración</span> gratuita
            </p>

            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.9rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em] text-[#0F2240]">
              ¿Y si llevas años dando vueltas?
            </h1>

            <div className="hero-fade-3 mt-8 max-w-[600px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#0F2240]/75">
                No necesitas más esfuerzo. Necesitas un mejor mapa.
              </p>
            </div>

            <div className="hero-fade-3 mt-10">
              <a
                href="#formulario"
                className="inline-block bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] transition-opacity duration-300 hover:opacity-90"
              >
                Quiero la valoración gratis
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CUERPO PRINCIPAL — metáfora del mapa */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <Lines lines={["Quieres ir de Madrid a Bruselas en coche.", "Sin mapa, sin GPS y sin compañía."]} />
          <Lines
            lines={[
              "Sales sin saber muy bien qué carretera coger.",
              "Vas mirando carteles.",
              "Cuando ves uno, respiras.",
              "Cuando pasas veinte minutos sin ver ninguno, empiezas a dudar.",
              "“¿Estaré yendo bien? ¿Debería haber cogido aquella salida de antes?”",
            ]}
          />
          <Lines
            lines={[
              "Paras en una gasolinera y preguntas.",
              "La persona te da unas indicaciones que no terminas de entender.",
              "Sigues.",
              "A los diez kilómetros dudas otra vez si te dijeron “la segunda a la derecha” o “la segunda a la izquierda”.",
            ]}
          />
          <Lines lines={["Y así todo el rato.", "Preguntar, dudar, volver atrás, corregir."]} />
          <Lines
            lines={[
              "Muchos kilómetros de más.",
              "Muchas horas de más.",
              "Mucho más gasto en gasolina.",
              "Y cada dos por tres el pensamiento de “¿merece la pena seguir?”",
              "Muchos llegan, pero cansados, tarde y con la sensación de haber sufrido lo que no estaba en los planes.",
            ]}
            mb="6.5rem"
          />

          <p style={emphasisP}>Ahora imagínate lo mismo con un mapa.</p>
          <Lines
            lines={[
              "Nada que ver.",
              "Sales con un plan.",
              "Sabes por dónde tienes que ir.",
              "De vez en cuando paras un momento a mirarlo, ubicarte, y sigues.",
            ]}
          />
          <Lines lines={["Menos dudas.", "Menos preguntas.", "Menos vueltas."]} />
          <Lines
            lines={[
              "Aun así, te comes algún atasco que no esperabas.",
              "Algún peaje que hubieras podido evitar.",
              "Alguna desviación por obras.",
            ]}
          />
          <p style={{ ...emphasisP, marginBottom: "6.5rem" }}>Pero llegas. Y llegas antes. Y sin tanto estrés.</p>

          <p style={emphasisP}>Y si encima tienes un copiloto (o Google Maps)...</p>
          <Lines
            lines={[
              "Alguien que va a tu lado y te dice “gira aquí, coge la segunda salida, ojo con este tramo que suele haber atascos, para en la próxima gasolinera que llevas la reserva baja.”",
            ]}
          />
          <Lines
            lines={[
              "Se adelanta a lo que tú no ves.",
              "Ajusta la ruta cuando aparece algo imprevisto.",
              "Va contigo durante todo el camino.",
            ]}
          />
          <Lines
            lines={["Es lo que hace cualquiera hoy en día.", "Ya hemos aprendido que ir sin mapa y sin copiloto puede costarte mucho."]}
            mb="6.5rem"
          />

          <p style={emphasisP}>Con cualquier cambio físico pasa exactamente lo mismo.</p>
          <Lines lines={["Solo que muchos aún piensan que pueden ir sin mapa sin problemas."]} />
          <Lines
            lines={[
              "Van dando tumbos.",
              "Empiezan por una cosa, luego otra, dudan si correr o levantar peso, prueban máquinas que no saben si están hechas para ellos.",
            ]}
          />
          <Lines
            lines={[
              "Preguntan a un colega que entrena y le dicen una cosa.",
              "A otro que le va bien y le dicen la contraria. Empujando a ciegas.",
            ]}
          />
          <p style={proseP}>
            Muchas veces ven algún resultado a los años, pero nada comparado con lo que podrían haber
            conseguido con menos tiempo, esfuerzo y dinero, con dirección.
          </p>
          <Lines
            lines={[
              "Con mapa, sabes qué priorizar y qué evitar.",
              "Sabes qué esperar a los 3 meses. Qué a los 12.",
              "Vas directo.",
              "Aún tienes que decidir tú, pero decides con criterio.",
            ]}
          />
          <p style={emphasisP}>
            Con mapa y copiloto, encima tienes a alguien ajustando la ruta cuando aparece un imprevisto — una
            molestia, una semana rara, un cambio en tu vida — y exigiéndote un poco más cuando podrías estar
            quedándote corto sin darte cuenta.
          </p>
        </div>
      </section>

      {/* QUÉ ES ESTO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={emphasisP}>Llevo semanas diseñando ese mapa.</p>
          <p style={proseP}>
            Un protocolo de valoración inicial donde recojo tu situación real — historial, lesiones, hábitos,
            control postural, composición corporal, fuerza, cardio, movilidad — y te preparo una ficha con tu
            plan personalizado.
          </p>
          <Lines lines={["Qué priorizar.", "Qué evitar.", "Qué esperar en 3 meses.", "Qué en 12."]} />
          <Lines
            lines={[
              "Un mapa personalizado que puedes seguir por tu cuenta, conmigo, o con otro entrenador.",
              "Sin compromiso.",
            ]}
          />
          <p style={emphasisP}>Y te lo hago en menos de 90 minutos de tu tiempo.</p>
        </div>
      </section>

      {/* OFERTA + CONTADOR + FORMULARIO */}
      <section id="formulario" className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[680px]">
          <Lines
            lines={[
              "Cuando el servicio esté rodado, hacerte este mapa tendrá su precio.",
              "Ahora estoy en fase inicial y quiero probar el protocolo con personas reales antes de cerrarlo.",
            ]}
          />
          <p style={emphasisP}>Por eso he decidido hacerlo gratis a las 10 primeras personas que me lo pidan.</p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              border: `1px solid ${full ? "rgba(28,58,94,0.18)" : "rgba(212,134,10,0.35)"}`,
              background: full ? "rgba(28,58,94,0.04)" : "rgba(212,134,10,0.08)",
              padding: "0.7rem 1.2rem",
              marginBottom: "2.5rem",
            }}
          >
            <span
              className="live-dot"
              style={{ color: full ? "rgba(28,58,94,0.45)" : AMBER, flexShrink: 0 }}
            />
            <span style={{ fontSize: "clamp(1.1rem,1.5vw,1.35rem)", fontWeight: 500, color: full ? "rgba(28,58,94,0.55)" : AMBER }}>
              {remaining === null
                ? "Actualizando plazas disponibles…"
                : full
                ? "Todas las plazas están cubiertas"
                : `Quedan ${remaining} plaza${remaining === 1 ? "" : "s"} de ${TOTAL_PLAZAS}`}
            </span>
          </div>
        </div>

        <div className="max-w-[600px]">
          {done ? (
            <div className="context-fade-in p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.5rem,2.4vw,2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem", color: NAVY }}>
                Recibido, {formData.nombre.split(" ")[0]}.
              </p>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(15,34,64,0.80)" }}>
                Te contacto en menos de 48h.
              </p>
            </div>
          ) : full ? (
            <div className="p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(15,34,64,0.80)" }}>
                Todas las plazas están cubiertas. Si quieres avisarte para futuras aperturas, escribe a{" "}
                <a href="mailto:contacto@niala.es" style={{ color: AMBER }}>
                  contacto@niala.es
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: NAVY, marginBottom: "0.6rem", lineHeight: 1.4 }}>
                Pide tu valoración gratuita
              </p>
              <p style={{ fontSize: "0.95rem", color: "rgba(15,34,64,0.60)", marginBottom: "2rem", lineHeight: 1.6 }}>
                Te contacto en menos de 48h para agendar una llamada de 90 minutos. Al terminar recibes tu
                mapa personalizado por escrito.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Edad</label>
                  <input
                    type="number"
                    placeholder="Tu edad"
                    value={formData.edad}
                    onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
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
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Qué te ha traído aquí</label>
                  <input
                    type="text"
                    placeholder="Cuéntamelo en una frase"
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>

                <div style={{ marginBottom: "2rem" }}>
                  <label style={labelStyle}>¿Mañana o tarde?</label>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {TURNO_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormData({ ...formData, turno: opt })}
                        onMouseEnter={() => setHoveredTurno(opt)}
                        onMouseLeave={() => setHoveredTurno(null)}
                        style={{
                          padding: "0.55rem 1.1rem",
                          border:
                            formData.turno === opt
                              ? `1px solid ${AMBER}`
                              : "1px solid rgba(28,58,94,0.25)",
                          color:
                            formData.turno === opt
                              ? AMBER
                              : hoveredTurno === opt
                              ? NAVY
                              : "rgba(28,58,94,0.62)",
                          background: formData.turno === opt ? "rgba(212,134,10,0.08)" : "none",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    marginBottom: "2rem",
                    cursor: "pointer",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                    color: "rgba(15,34,64,0.70)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.newsletter}
                    onChange={(e) => setFormData({ ...formData, newsletter: e.target.checked })}
                    style={{ marginTop: "0.2rem" }}
                  />
                  Quiero recibir mails diarios sobre entrenamiento y salud. Gratis, y me doy de baja
                  cuando quiera.
                </label>

                {error && (
                  <p style={{ fontSize: "0.88rem", color: "#B3261E", marginBottom: "1rem" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    background: NAVY,
                    border: "none",
                    padding: "0.9rem 2.5rem",
                    fontSize: "0.98rem",
                    letterSpacing: "0.08em",
                    color: CREAM,
                    cursor: sending ? "default" : "pointer",
                    display: "block",
                    opacity: sending ? 0.6 : 1,
                  }}
                  className="transition-opacity duration-300 hover:opacity-90"
                >
                  {sending ? "Enviando..." : "Pedir mi valoración gratuita"}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* DUDAS FRECUENTES */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={sectionTitle}>Dudas frecuentes</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                q: "“No tengo tiempo.”",
                a: "La sesión son 90 minutos, una sola vez. Después tienes el mapa por escrito para seguirlo cuando y como quieras.",
              },
              {
                q: "“No sé si estoy en forma para esto.”",
                a: "Precisamente es para eso. El punto de partida da igual. El protocolo se adapta a lo que hay.",
              },
              {
                q: "“Vivo lejos.”",
                a: "La valoración puede ser online. Puedes hacerla desde donde estés.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="p-5 md:p-6" style={cardStyle}>
                <p style={{ fontSize: "1.1rem", color: AMBER, marginBottom: "0.6rem" }}>{q}</p>
                <p style={{ ...proseP, marginBottom: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTO ALTERNATIVO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={{ fontSize: "1.15rem", color: "rgba(15,34,64,0.80)", marginBottom: "0.6rem" }}>
            ¿Prefieres escribirme directamente?
          </p>
          <a
            href="mailto:contacto@niala.es"
            style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: AMBER }}
            className="hover:opacity-80"
          >
            contacto@niala.es
          </a>
        </div>
      </section>

      {/* PD FINAL — SOBRE MÍ */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16">
        <div className="max-w-[680px]" style={{ borderTop: "1px solid rgba(28,58,94,0.15)", paddingTop: "2rem" }}>
          <Lines
            lines={[
              "Soy Alain Zulaika (Entrenatzaile).",
              "Llevo desde los 14 años entrenándome a mí mismo.",
              "Hace 6 años terminé mis estudios de entrenador/monitor y me saqué varias titulaciones.",
              "Durante un tiempo acompañé a varias personas en su cambio físico y ahora estoy retomándolo.",
              "Si te ha llegado este enlace por alguien cercano y quieres saber más, rellena el formulario.",
            ]}
            mb="0"
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1C3A5E]/12 px-8 py-10 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.88rem] text-[#0F2240]/35">© Alain Zulaika</p>
        </div>
      </footer>
    </main>
  );
}
