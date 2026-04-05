import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://alainzulaika.com";

  const routes = [
    { path: "/", esPath: "/es/", priority: 1.0 },
    { path: "/empresa", esPath: "/es/empresa", priority: 0.9 },
    { path: "/hosteleria", esPath: "/es/hosteleria", priority: 0.9 },
    { path: "/cultura", esPath: "/es/cultura", priority: 0.9 },
    { path: "/contacto", esPath: "/es/contacto", priority: 0.8 },
    { path: "/eguzkilore", esPath: "/es/eguzkilore", priority: 0.7 },
    { path: "/twobascos-prentsa", esPath: "/es/twobascos-prentsa", priority: 0.5 },
  ];

  return routes.flatMap(({ path, esPath, priority }) => [
    { url: `${base}${path}`, priority, changeFrequency: "monthly" as const },
    { url: `${base}${esPath}`, priority, changeFrequency: "monthly" as const },
  ]);
}
