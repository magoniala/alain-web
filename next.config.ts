import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Librerías de correo del carril charlas: se cargan tal cual desde
  // node_modules en el servidor, sin empaquetar.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  // Los PDF del dossier se leen del disco al enviar: que viajen con la función.
  outputFileTracingIncludes: {
    "/api/admin/charlas/bandeja": ["./assets/charlas/**/*"],
  },
};

export default nextConfig;
