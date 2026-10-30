// Service worker del panel (/admin). Solo recibe notificaciones push y abre
// la tarjeta al tocarlas. No cachea nada: el panel siempre va en vivo.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { title: "Panel", body: event.data ? event.data.text() : "" };
  }
  const titulo = datos.title || "Panel";
  const opciones = {
    body: datos.body || "",
    icon: "/admin/icon-192.png",
    badge: "/admin/icon-192.png",
    tag: datos.tag || "charlas",
    renotify: !!datos.renotify,
    data: { url: datos.url || "/admin?tab=Charlas&app=1" },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin?tab=Charlas&app=1";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
