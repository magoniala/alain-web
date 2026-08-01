import type { Metadata } from "next";
import { getMagicConfig, isScheduleBlockInDateRange } from "@/lib/magic-config";
import MagicClient from "./MagicClient";

// El flag de admin y la fecha de corte del bloque de horarios pueden
// cambiar en cualquier momento, así que esta página no debe cachearse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Niala — Magician | Corporate events, trade fairs and private celebrations" },
  description:
    "Niala is a magician based in Spain, working in English, Spanish and Basque for corporate events, trade fairs and private celebrations.",
  openGraph: {
    title: "Niala — Magician",
    description:
      "Corporate events, trade fairs and private celebrations. Niala is a magician based in Spain, working in English.",
    type: "website",
  },
};

export default async function MagicPage() {
  const config = await getMagicConfig();
  const showSchedule = isScheduleBlockInDateRange() && !config.hideSchedule;

  return <MagicClient showSchedule={showSchedule} testimonials={config.testimonialsEnabled ? config.testimonials : []} />;
}
