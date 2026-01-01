// static/sw.js

self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  const title = data.title || "🔔 Notification";
  const options = {
    body: data.body,
    icon: data.icon || "/images/default.png",
    badge: data.badge || "/images/default.png",
    data: data.url || "/",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", evt => {
  evt.notification.close();
  evt.waitUntil(clients.openWindow(evt.notification.data));
});

