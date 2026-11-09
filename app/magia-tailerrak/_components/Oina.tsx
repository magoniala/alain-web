import Link from "next/link";
import { K } from "./estiloa";

export default function Oina() {
  return (
    <footer style={{ textAlign: "center", padding: "2rem 1.25rem", borderTop: "1px solid rgba(242,242,240,0.06)", fontSize: "0.8rem", color: "rgba(242,242,240,0.3)" }}>
      © 2026 Alain Zulaika · Niala magoa ·{" "}
      <Link href="/privacidad" style={{ color: K.muy }}>Pribatutasuna</Link>
    </footer>
  );
}
