import "./globals.css";
import { Inter, DM_Sans } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata = {
  title: "Alain Zulaika",
  description: "Intervenciones escénicas con magia para eventos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
