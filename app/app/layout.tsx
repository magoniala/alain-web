import type { Metadata } from "next";
import "../admin/admin.css";

// App del cliente de Entrenatzaile (/app/<token>): instalable en el móvil,
// con notificaciones propias (public/app/manifest.json, public/app-sw.js).
export const metadata: Metadata = {
  title: "Entrenatzaile",
  robots: { index: false, follow: false, nocache: true },
  manifest: "/app/manifest.json",
  appleWebApp: { capable: true, title: "Entrenatzaile", statusBarStyle: "default" },
  icons: { apple: "/admin/icon-180.png" },
};

export const viewport = {
  themeColor: "#0F2240",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
