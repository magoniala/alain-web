import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Panel — Alain Zulaika",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  // Instalable como app en el móvil (Añadir a pantalla de inicio) con
  // notificaciones push: ver public/admin/manifest.json y public/admin-sw.js.
  manifest: "/admin/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Panel",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/admin/icon-180.png",
  },
};

export const viewport = {
  themeColor: "#0F2240",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
