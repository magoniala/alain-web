import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Librerías de correo del carril charlas: se cargan tal cual desde
  // node_modules en el servidor, sin empaquetar.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  // Sharp (binarios de imagen, ~47 MB) no hace falta en las funciones: Vercel
  // optimiza las imágenes por su cuenta. Sin esto, cada deployment pesaba ~160 MB.
  outputFileTracingExcludes: {
    "*": ["node_modules/@img/**", "node_modules/sharp/**"],
  },
  // Los PDF del dossier se leen del disco al enviar: que viajen con la función.
  outputFileTracingIncludes: {
    "/api/admin/charlas/bandeja": ["./assets/charlas/**/*"],
  },
  redirects() {
    return [
      // QR impreso en los librillos de los talleres de Mirariak (sáb 14-nov-2026).
      // Temporal (307, no se cachea): hasta que exista la plataforma de magia,
      // lleva al regalo de /tumision (euskera por defecto; hay botón ES).
      {
        source: "/magia-tailerrak",
        destination: "/tumision?e=librillo",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
