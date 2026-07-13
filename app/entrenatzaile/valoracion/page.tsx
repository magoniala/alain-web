"use client";

import { useEffect, useState } from "react";

const TURNO_OPTIONS = ["Mañana", "Tarde", "Me da igual"];

const TOTAL_PLAZAS = 10;

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

const proseP: React.CSSProperties = {
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.8,
  color: "rgba(242,242,240,0.72)",
  marginBottom: "1.4rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "clamp(1.7rem,2.6vw,2.3rem)",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  marginBottom: "1.8rem",
  color: "#F2F2F0",
};

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
    fetch("/api/entrenatzaile/valoracion")
      .then((r) => r.json())
      .then((d) => setRemaining(typeof d.remaining === "number" ? d.remaining : null))
      .catch(() => {});
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
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">
      {/* HEADER */}
      <header className="border-b border-white/10 px-8 py-4 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Entrenatzaile
          </p>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-[1400px] px-8 pb-16 pt-16 md:px-16 md:pb-20 md:pt-24">
        <div className="max-w-[820px]">
          <h1
            className="hero-fade-2"
            style={{
              fontSize: "clamp(2.2rem,4.2vw,3.8rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: "1.5rem",
            }}
          >
            ¿Y si llevas años dando vueltas?
          </h1>
          <p
            className="hero-fade-3"
            style={{ fontSize: "clamp(1.2rem,1.6vw,1.5rem)", lineHeight: 1.6, color: "rgba(242,242,240,0.75)" }}
          >
            No necesitas más esfuerzo. Necesitas un mejor mapa.
          </p>
        </div>
      </section>

      {/* CUERPO PRINCIPAL — metáfora del mapa */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-20 md:px-16">
        <div className="max-w-[680px]">
          <p style={proseP}>Quieres ir de Madrid a Bruselas en coche.</p>
          <p style={proseP}>Sin mapa, sin GPS y sin compañía.</p>
          <p style={proseP}>
            Sales sin saber muy bien qué carretera coger. Vas mirando carteles. Cuando ves uno, respiras.
            Cuando pasas veinte minutos sin ver ninguno, empiezas a dudar. &ldquo;¿Estaré yendo bien?
            ¿Debería haber cogido aquella salida de antes?&rdquo;
          </p>
          <p style={proseP}>
            Paras en una gasolinera y preguntas. La persona te da unas indicaciones que no terminas de
            entender. Sigues. A los diez kilómetros dudas otra vez si te dijeron &ldquo;la segunda a la
            derecha&rdquo; o &ldquo;la segunda a la izquierda&rdquo;.
          </p>
          <p style={proseP}>
            Y así todo el rato. Preguntar, dudar, volver atrás, corregir. Muchos kilómetros de más. Muchas
            horas de más. Mucho más gasto en gasolina.
          </p>
          <p style={proseP}>Y cada dos por tres el pensamiento de &ldquo;¿merece la pena seguir?&rdquo;</p>
          <p style={{ ...proseP, marginBottom: "2.5rem" }}>
            Muchos llegan, pero cansados, tarde y con la sensación de haber sufrido lo que no estaba en los
            planes.
          </p>

          <p style={proseP}>Ahora imagínate lo mismo con un mapa.</p>
          <p style={proseP}>Nada que ver.</p>
          <p style={proseP}>
            Sales con un plan. Sabes por dónde tienes que ir. De vez en cuando paras un momento a mirarlo,
            ubicarte, y sigues. Menos dudas. Menos preguntas. Menos vueltas.
          </p>
          <p style={proseP}>
            Aun así, te comes algún atasco que no esperabas. Algún peaje que hubieras podido evitar. Alguna
            desviación por obras.
          </p>
          <p style={{ ...proseP, marginBottom: "2.5rem" }}>Pero llegas. Y llegas antes. Y sin tanto estrés.</p>

          <p style={proseP}>Ahora imagina el mapa más un copiloto (o Google Maps).</p>
          <p style={proseP}>
            Alguien que va a tu lado y te dice &ldquo;gira aquí, coge la segunda salida, ojo con este tramo
            que suele haber atascos, para en la próxima gasolinera que llevas la reserva baja.&rdquo;
          </p>
          <p style={proseP}>
            Se adelanta a lo que tú no ves. Ajusta la ruta cuando aparece algo imprevisto. Va contigo durante
            todo el camino.
          </p>
          <p style={proseP}>Es lo que hace cualquiera hoy en día.</p>
          <p style={{ ...proseP, marginBottom: "2.5rem" }}>
            Ya hemos aprendido que ir sin mapa y sin copiloto puede costarte mucho.
          </p>

          <p style={proseP}>Con cualquier cambio físico pasa exactamente lo mismo.</p>
          <p style={proseP}>Solo que muchos aún piensan que pueden ir sin mapa sin problemas.</p>
          <p style={proseP}>
            Van dando tumbos. Empiezan por una cosa, luego otra, dudan si correr o levantar peso, prueban
            máquinas que no saben si están hechas para ellos.
          </p>
          <p style={proseP}>
            Preguntan a un colega que entrena y le dicen una cosa. A otro que le va bien y le dicen la
            contraria. Empujando a ciegas.
          </p>
          <p style={proseP}>
            Muchas veces ven algún resultado a los años, pero nada comparado con lo que podrían haber
            conseguido con menos tiempo, esfuerzo y dinero, con dirección.
          </p>
          <p style={proseP}>
            Con mapa, sabes qué priorizar y qué evitar. Sabes qué esperar a los 3 meses. Qué a los 12. Vas
            directo. Aún tienes que decidir tú, pero decides con criterio.
          </p>
          <p style={{ ...proseP, color: "rgba(242,242,240,0.90)" }}>
            Con mapa y copiloto, encima tienes a alguien ajustando la ruta cuando aparece un imprevisto — una
            molestia, una semana rara, un cambio en tu vida — y exigiéndote un poco más cuando podrías estar
            quedándote corto sin darte cuenta.
          </p>
        </div>
      </section>

      {/* QUÉ ES ESTO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-20 md:px-16">
        <div className="max-w-[680px]">
          <p style={proseP}>Llevo semanas diseñando ese mapa.</p>
          <p style={proseP}>
            Un protocolo de valoración inicial donde recojo tu situación real — historial, lesiones, hábitos,
            control postural, composición corporal, fuerza, cardio, movilidad — y te preparo una ficha con tu
            plan personalizado.
          </p>
          <p style={proseP}>Qué priorizar. Qué evitar. Qué esperar en 3 meses. Qué en 12.</p>
          <p style={proseP}>
            Un mapa personalizado que puedes seguir por tu cuenta, conmigo, o con otro entrenador. Sin
            compromiso.
          </p>
          <p style={{ ...proseP, color: "rgba(242,242,240,0.90)" }}>
            Y te lo hago en menos de 90 minutos de tu tiempo.
          </p>
        </div>
      </section>

      {/* OFERTA + CONTADOR + FORMULARIO */}
      <section id="formulario" className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[680px]">
          <p style={proseP}>
            Cuando el servicio esté rodado, hacerte este mapa tendrá su precio. Ahora estoy en fase inicial y
            quiero probar el protocolo con personas reales antes de cerrarlo.
          </p>
          <p style={{ ...proseP, color: "rgba(242,242,240,0.90)" }}>
            Por eso he decidido hacerlo gratis a las 10 primeras personas que me lo pidan.
          </p>
          <p
            style={{
              fontSize: "clamp(1.3rem,1.8vw,1.6rem)",
              fontWeight: 500,
              color: "#2ED3E6",
              marginBottom: "2.5rem",
            }}
          >
            {remaining === null
              ? "Cargando plazas disponibles…"
              : full
              ? "Todas las plazas están cubiertas."
              : `Quedan ${remaining} plaza${remaining === 1 ? "" : "s"} de ${TOTAL_PLAZAS}.`}
          </p>
        </div>

        <div className="max-w-[600px]">
          {done ? (
            <div
              className="context-fade-in p-6 md:p-10"
              style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}
            >
              <p style={{ fontSize: "clamp(1.5rem,2.4vw,2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                Recibido, {formData.nombre.split(" ")[0]}.
              </p>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(242,242,240,0.72)" }}>
                Te contacto en menos de 48h.
              </p>
            </div>
          ) : full ? (
            <div
              className="p-6 md:p-10"
              style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}
            >
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(242,242,240,0.72)" }}>
                Todas las plazas están cubiertas. Si quieres avisarte para futuras aperturas, escribe a{" "}
                <a href="mailto:newsletter@niala.es" style={{ color: "#2ED3E6" }}>
                  newsletter@niala.es
                </a>
                .
              </p>
            </div>
          ) : (
            <div
              className="p-6 md:p-10"
              style={{ border: "1px solid rgba(242,242,240,0.16)", background: "rgba(242,242,240,0.025)" }}
            >
              <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(242,242,240,0.90)", marginBottom: "0.6rem", lineHeight: 1.4 }}>
                Pide tu valoración gratuita
              </p>
              <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.55)", marginBottom: "2rem", lineHeight: 1.6 }}>
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
                    className="placeholder:text-[#F2F2F0]/30"
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
                    className="placeholder:text-[#F2F2F0]/30"
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
                  <label style={labelStyle}>Qué te ha traído aquí</label>
                  <input
                    type="text"
                    placeholder="Cuéntamelo en una frase"
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#F2F2F0]/30"
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
                              ? "1px solid rgba(46,211,230,0.60)"
                              : "1px solid rgba(242,242,240,0.18)",
                          color:
                            formData.turno === opt
                              ? "#2ED3E6"
                              : hoveredTurno === opt
                              ? "rgba(242,242,240,0.90)"
                              : "rgba(242,242,240,0.62)",
                          background: formData.turno === opt ? "rgba(46,211,230,0.05)" : "none",
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
                    color: "rgba(242,242,240,0.65)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.newsletter}
                    onChange={(e) => setFormData({ ...formData, newsletter: e.target.checked })}
                    style={{ marginTop: "0.2rem" }}
                  />
                  Quiero recibir sus mails diarios sobre entrenamiento y salud. Gratis, y me doy de baja
                  cuando quiera.
                </label>

                {error && (
                  <p style={{ fontSize: "0.88rem", color: "rgba(242,242,240,0.65)", marginBottom: "1rem" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    border: "1px solid rgba(242,242,240,0.20)",
                    padding: "0.9rem 2.5rem",
                    fontSize: "0.98rem",
                    letterSpacing: "0.08em",
                    color: "rgba(242,242,240,1)",
                    background: "none",
                    cursor: sending ? "default" : "pointer",
                    display: "block",
                    opacity: sending ? 0.6 : 1,
                  }}
                  className="transition-colors duration-300 hover:border-white/40 hover:text-[#2ED3E6]"
                >
                  {sending ? "Enviando..." : "Pedir mi valoración gratuita"}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-20 md:px-16">
        <div className="max-w-[680px]">
          <p
            style={{
              fontSize: "clamp(1.3rem,1.7vw,1.6rem)",
              lineHeight: 1.6,
              color: "rgba(242,242,240,0.85)",
              fontStyle: "italic",
              marginBottom: "1rem",
            }}
          >
            &ldquo;Esto me motiva más, eskerrik asko.&rdquo;
          </p>
          <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.45)" }}>— Mi madre, 55 años</p>
        </div>
      </section>

      {/* DUDAS FRECUENTES */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-20 md:px-16">
        <div className="max-w-[680px]">
          <p style={sectionTitle}>Dudas frecuentes</p>

          <div style={{ marginBottom: "2rem" }}>
            <p style={{ fontSize: "1.1rem", color: "#F2F2F0", marginBottom: "0.5rem" }}>&ldquo;No tengo tiempo.&rdquo;</p>
            <p style={proseP}>
              La sesión son 90 minutos, una sola vez. Después tienes el mapa por escrito para seguirlo cuando
              y como quieras.
            </p>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <p style={{ fontSize: "1.1rem", color: "#F2F2F0", marginBottom: "0.5rem" }}>
              &ldquo;No sé si estoy en forma para esto.&rdquo;
            </p>
            <p style={proseP}>
              Precisamente es para eso. El punto de partida da igual. El protocolo se adapta a lo que hay.
            </p>
          </div>

          <div>
            <p style={{ fontSize: "1.1rem", color: "#F2F2F0", marginBottom: "0.5rem" }}>&ldquo;Vivo lejos.&rdquo;</p>
            <p style={proseP}>La valoración puede ser online. Puedes hacerla desde donde estés.</p>
          </div>
        </div>
      </section>

      {/* CONTACTO ALTERNATIVO */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-20 md:px-16">
        <div className="max-w-[680px]">
          <p style={{ fontSize: "1.15rem", color: "rgba(242,242,240,0.72)", marginBottom: "0.6rem" }}>
            ¿Prefieres escribirme directamente?
          </p>
          <a
            href="mailto:newsletter@niala.es"
            style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: "rgba(46,211,230,0.75)" }}
            className="hover:text-[#2ED3E6]"
          >
            newsletter@niala.es
          </a>
        </div>
      </section>

      {/* PD FINAL — SOBRE MÍ */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16">
        <div className="max-w-[680px]" style={{ borderTop: "1px solid rgba(242,242,240,0.12)", paddingTop: "2rem" }}>
          <p style={{ ...proseP, marginBottom: 0 }}>
            Soy Alain Zulaika (Entrenatzaile). Llevo más de 10 años entrenando. Hace 6 me saqué varias
            titulaciones de entrenador/monitor. Hace años acompañé a varias personas en su cambio físico y
            ahora estoy retomándolo. Si te ha llegado este enlace por alguien cercano y quieres saber más,
            escríbeme.
          </p>
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
