import "./globals.css";
import { Inter, DM_Sans } from "next/font/google";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  metadataBase: new URL("https://www.alainzulaika.com"),
  title: {
    default: "Alain Zulaika",
    template: "%s | Alain Zulaika",
  },
  description:
    "Magia eszenikoa enpresa, ostalaritza eta kulturarentzako ekitaldietan. Gertaera bakoitzean publika gogoan geratzen den unea sortzen dugu. Euskal Herria.",
  openGraph: {
    siteName: "Alain Zulaika",
    images: [{ url: "/og.jpg", width: 1200, height: 600, alt: "Alain Zulaika" }],
    locale: "eu_EU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  verification: {
    other: {
      "facebook-domain-verification": "yc33xy85dwb6g9w5x1ll67sqhb00pn",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="eu" className={dmSans.variable}>
      <body className={inter.className}>
        {/* Píxel de Whop (cuenta biz_pvD09VuWBli5OP). El snippet va íntegro,
            tal cual lo entrega Whop, sin tocar un carácter. Como primer hijo del
            body para que se ejecute al parsear el HTML, antes de que cargue
            cualquier bundle de Next. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_pvD09VuWBli5OP");whop.track("page");`,
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
