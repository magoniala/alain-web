import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Librerías de correo del carril charlas: se cargan tal cual desde
  // node_modules en el servidor, sin empaquetar.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "xlsx"],
  // Los PDF del dossier se leen del disco al enviar: que viajen con la función.
  outputFileTracingIncludes: {
    "/api/admin/charlas/bandeja": ["./assets/charlas/**/*"],
    // xlsx se carga como externo: que viaje entero con la función que lo usa.
    "/api/admin/charlas/directorio": ["./node_modules/xlsx/**/*"],
  },
};

export default nextConfig;
