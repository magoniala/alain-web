// Piezas visuales de creadores.alainzulaika.com.
//
// La estética es la del sitio principal (alainzulaika.com), no la de
// Entrenatzaile: negro #0B0B0C, texto #F2F2F0 y cian #2ED3E6, con los campos
// de formulario subrayados en vez de encajonados. Es el mismo lenguaje que
// /es/contacto, de donde salen estos estilos.
//
// No se importa nada de app/entrenatzaile/_ui.tsx a propósito: ese módulo
// lleva el logo y el rótulo de Entrenatzaile, que aquí no pintan nada.

export const NEGRO = "#0B0B0C";
export const CREMA = "#F2F2F0";
export const CIAN = "#2ED3E6";

export const inputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.6,
  color: "rgba(242,242,240,0.88)",
  paddingBottom: "0.6rem",
};

export const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "rgba(242,242,240,0.58)",
  display: "block",
  marginBottom: "0.4rem",
};

export const fieldStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(242,242,240,0.12)",
  marginBottom: "2rem",
};

export const pistaStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  lineHeight: 1.55,
  color: "rgba(242,242,240,0.45)",
  marginBottom: "0.7rem",
};

/** La tarjeta donde vive el formulario de reserva. */
export const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(242,242,240,0.12)",
  background: "rgba(242,242,240,0.02)",
};

export const botonClase =
  "inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6]";

export const tituloClase = "font-medium tracking-[-0.02em]";

export const cuerpoClase = "whitespace-pre-line text-[1.08rem] leading-[1.75] text-[#F2F2F0]/72 md:text-[1.15rem]";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[#0B0B0C]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
        <a
          href="#top"
          className="text-[0.72rem] uppercase tracking-[0.05em] text-[#2ED3E6] transition-colors md:text-[0.96rem] md:tracking-[0.35em]"
        >
          Alain Zulaika
        </a>
        <a
          href="#reserva"
          className="text-[0.82rem] uppercase tracking-[0.12em] text-[#F2F2F0]/72 transition-colors hover:text-[#2ED3E6]"
        >
          Reservar
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/6 px-8 py-12 md:px-16">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 text-[0.9rem] text-[#F2F2F0]/38 md:flex-row md:items-center md:justify-between">
        <p>© Alain Zulaika</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="/aviso-legal" className="transition-colors hover:text-[#F2F2F0]/62">
            Aviso legal
          </a>
          <a href="/privacidad" className="transition-colors hover:text-[#F2F2F0]/62">
            Privacidad
          </a>
          <a href="/cookies" className="transition-colors hover:text-[#F2F2F0]/62">
            Cookies
          </a>
        </div>
      </div>
    </footer>
  );
}
