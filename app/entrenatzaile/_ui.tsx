import Image from "next/image";
import Link from "next/link";

export const AMBER = "#D4860A";
export const NAVY = "#1C3A5E";
export const DARK_NAVY = "#0F2240";

export const inputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.6,
  color: DARK_NAVY,
  paddingBottom: "0.6rem",
};

export const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "rgba(28,58,94,0.65)",
  display: "block",
  marginBottom: "0.4rem",
};

export const fieldStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(28,58,94,0.25)",
  marginBottom: "2rem",
};

export const proseP: React.CSSProperties = {
  fontSize: "clamp(1.05rem,1.3vw,1.2rem)",
  lineHeight: 1.8,
  color: "rgba(15,34,64,0.80)",
  marginBottom: "2rem",
};

export const sectionTitle: React.CSSProperties = {
  fontSize: "clamp(1.7rem,2.6vw,2.3rem)",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  marginBottom: "1.8rem",
  color: NAVY,
};

export const emphasisP: React.CSSProperties = {
  fontSize: "clamp(1.4rem,2vw,1.75rem)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.35,
  color: NAVY,
  marginBottom: "2rem",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(28,58,94,0.18)",
  background: "rgba(28,58,94,0.04)",
};

export function Lines({ lines, mb = "2.75rem" }: { lines: string[]; mb?: string }) {
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

export function MapaCTA({ label }: { label: string }) {
  return (
    <a
      href="#formulario"
      className="inline-block scale-100 bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
    >
      {label}
    </a>
  );
}

export function LangSwitch({ current }: { current: "eu" | "es" }) {
  const activeStyle: React.CSSProperties = { color: AMBER, background: "rgba(212,134,10,0.08)" };
  const inactiveStyle: React.CSSProperties = { color: "rgba(28,58,94,0.55)" };
  return (
    <div className="flex items-center border border-[#1C3A5E]/20 text-[0.75rem] tracking-[0.1em]">
      <Link
        href="/valoracion"
        style={current === "eu" ? activeStyle : inactiveStyle}
        className="px-2.5 py-1.5 transition-colors hover:text-[#0F2240]"
      >
        EUS
      </Link>
      <span className="w-px self-stretch bg-[#1C3A5E]/15" />
      <Link
        href="/es/valoracion"
        style={current === "es" ? activeStyle : inactiveStyle}
        className="px-2.5 py-1.5 transition-colors hover:text-[#0F2240]"
      >
        ES
      </Link>
    </div>
  );
}

export function Header({ current, showLangSwitch = true }: { current: "eu" | "es"; showLangSwitch?: boolean }) {
  return (
    <header className="border-b border-[#1C3A5E]/12 bg-[#FAF3E8] px-8 py-4 md:px-16">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/entrenatzaile-logo.png" alt="" width={34} height={27} priority />
          <p className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#D4860A]">
            Entrenatzaile
          </p>
        </div>
        {showLangSwitch && <LangSwitch current={current} />}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#1C3A5E]/12 px-8 py-10 md:px-16">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-[0.88rem] text-[#0F2240]/35">© Alain Zulaika</p>
      </div>
    </footer>
  );
}
