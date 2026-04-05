import "./globals.css";
import { Inter, DM_Sans } from "next/font/google";
import type { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://alain-web-six.vercel.app"
  ),
  title: {
    default: "Alain Zulaika",
    template: "%s | Alain Zulaika",
  },
  description:
    "Magia eszenikoa enpresa, ostalaritza eta kulturarentzako ekitaldietan. Gertaera bakoitzean publika gogoan geratzen den unea sortzen dugu. Euskal Herria.",
  openGraph: {
    siteName: "Alain Zulaika",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Alain Zulaika" }],
    locale: "eu_EU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="eu" className={dmSans.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
