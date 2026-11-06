import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/arreta"] },
    sitemap: "https://alainzulaika.com/sitemap.xml",
  };
}
