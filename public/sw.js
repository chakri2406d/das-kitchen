/* Das Kitchen service worker — makes the site installable and delivers
   push notifications even when the app is completely closed. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// A fetch handler is required for the browser to treat this as an installable
// app. We deliberately don't cache anything: orders and the menu must always be
// live, and stale food data would be worse than a slow load.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "New order — Das Kitchen";
  const options = {
    body: data.body || "Open the dashboard to accept it.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "new-order",
    renotify: true,
    requireInteraction: true, // stays on screen until tapped
    vibrate: [300, 120, 300, 120, 300],
    data: { url: data.url || "/admin/orders" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
