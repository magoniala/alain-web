"use client";

import { useEffect, useState } from "react";
import {
  AMBER,
  NAVY,
  Header,
  Footer,
  inputStyle,
  labelStyle,
  fieldStyle,
  proseP,
  emphasisP,
  cardStyle,
} from "../_ui";
import type { Variante } from "@/lib/entrenatzaile-variantes";
import { GUIAS_CONTENIDO, type EngancheBloque } from "./_content";

function Enganche({ bloques }: { bloques: EngancheBloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        if (b.tipo === "emphasis") {
          return (
            <p key={i} style={emphasisP}>
              {b.texto}
            </p>
          );
        }
        if (b.tipo === "lines") {
          return (
            <div key={i} style={{ marginBottom: "2rem" }}>
              {b.lineas.map((linea, j) => (
                <p key={j} style={{ ...proseP, marginBottom: j === b.lineas.length - 1 ? 0 : "0.75rem" }}>
                  {linea}
                </p>
              ))}
            </div>
          );
        }
        return (
          <p key={i} style={proseP}>
            {b.texto}
          </p>
        );
      })}
    </>
  );
}

export default function GuiasClient({
  variante,
  bonusGuias,
}: {
  variante: Variante;
  bonusGuias: { titulo: string; desc: string }[];
}) {
  const contenido = GUIAS_CONTENIDO[variante];

  const [formData, setFormData] = useState({ nombre: "", email: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/entrenatzaile/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landing: "guias" }),
      keepalive: true,
    }).catch(() => {});
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.nombre.trim() || !formData.email.trim()) {
      setError("Por favor, rellena tu nombre y tu email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Introduce un email válido.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/entrenatzaile/guias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Algo ha ido mal. Inténtalo de nuevo o escríbeme directamente.");
        return;
      }
      setDone(true);
    } catch {
      setError("Algo ha ido mal. Inténtalo de nuevo o escríbeme directamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="es" showLangSwitch={false} />

      {/* HERO */}
      <section className="w-full bg-[#D4860A] px-8 py-24 md:px-16 md:py-32">
        <div className="relative mx-auto max-w-[1400px]">
          <div className="absolute left-0 top-0 w-[2px] bg-[#1C3A5E]/30 h-[242px] md:h-[287px] xl:h-[329px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#0F2240]">
              <span className="uppercase">Guía</span> gratuita
            </p>

            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.9rem,5vw,4.4rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[#0F2240]">
              {contenido.heroTitulo}
            </h1>

            <div className="hero-fade-3 mt-8 max-w-[640px]">
              <p className="text-[clamp(1.2rem,1.6vw,1.5rem)] leading-relaxed text-[#0F2240]/75">
                {contenido.heroSubtitulo}
              </p>
            </div>

            <div className="hero-fade-3 mt-10">
              <a
                href="#formulario"
                className="inline-block scale-100 bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
              >
                Quiero las guías gratis
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TEXTO DE ENGANCHE */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 pt-20 md:px-16 md:pt-28">
        <div className="max-w-[680px]">
          <Enganche bloques={contenido.enganche} />
        </div>
      </section>

      {/* QUÉ SE LLEVA */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={{ ...emphasisP, marginBottom: "1.5rem" }}>
            Al dejar tu correo recibes, gratis y al momento, la guía &ldquo;{contenido.guiaPrincipalTitulo}&rdquo;:
          </p>
          <div className="p-6 md:p-8" style={{ ...cardStyle, marginBottom: "3rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {contenido.guiaPrincipalBullets.map((b) => (
                <div key={b} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: "0.5rem",
                      height: "0.5rem",
                      borderRadius: "50%",
                      background: AMBER,
                      marginTop: "0.55rem",
                    }}
                  />
                  <p style={{ ...proseP, marginBottom: 0 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>

          <p style={{ ...emphasisP, marginBottom: "1.5rem" }}>Y de regalo, otras dos guías:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {bonusGuias.map(({ titulo, desc }) => (
              <div key={titulo} className="p-5 md:p-6" style={cardStyle}>
                <p style={{ fontSize: "1.1rem", color: NAVY, fontWeight: 500, marginBottom: "0.5rem" }}>
                  {titulo}
                </p>
                <p style={{ ...proseP, marginBottom: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMULARIO */}
      <section id="formulario" className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[600px]">
          {done ? (
            <div className="context-fade-in p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.5rem,2.4vw,2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem", color: NAVY }}>
                Hecho, {formData.nombre.split(" ")[0]}.
              </p>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(15,34,64,0.80)" }}>
                Revisa tu correo — las tres guías te llegan en un par de minutos. Si no las ves, mira en spam.
              </p>
            </div>
          ) : (
            <div className="p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: NAVY, marginBottom: "1.75rem", lineHeight: 1.4 }}>
                Quiero las guías gratis
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

                {error && (
                  <p style={{ fontSize: "0.88rem", color: "#B3261E", marginBottom: "1rem" }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    border: "none",
                    padding: "0.9rem 2.5rem",
                    fontSize: "0.98rem",
                    letterSpacing: "0.08em",
                    cursor: sending ? "default" : "pointer",
                    display: "block",
                    opacity: sending ? 0.6 : 1,
                  }}
                  className="scale-100 bg-[#1C3A5E] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
                >
                  {sending ? "Enviando..." : "Quiero las guías gratis"}
                </button>

                <p style={{ fontSize: "0.85rem", color: "rgba(15,34,64,0.55)", marginTop: "1rem", marginBottom: "1.5rem" }}>
                  Gratis. Sin spam. Te das de baja cuando quieras, en un clic.
                </p>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "rgba(15,34,64,0.55)", marginBottom: 0 }}>
                  Además de las guías, te envío un correo diario sobre entrenamiento y salud para gente de tu
                  edad: útil, breve y sin relleno. Si no te aporta, te bajas y ya está.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* QUIÉN SOY */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16">
        <div className="max-w-[680px]" style={{ borderTop: "1px solid rgba(28,58,94,0.15)", paddingTop: "2rem" }}>
          <p style={proseP}>
            Soy Alain Zulaika (Entrenatzaile). Llevo entrenando desde los 14 años y más de 6 años como
            entrenador titulado. Ahora ayudo a personas de 45 a 65 a mantener su fuerza, su movilidad y su
            autonomía de cara a las próximas décadas.
          </p>
          <p style={{ ...proseP, marginBottom: 0 }}>
            Sin humo, sin promesas milagro: solo lo que funciona y alguien al lado para sostenerlo.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
