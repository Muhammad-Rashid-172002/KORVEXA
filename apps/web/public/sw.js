/* Web push service worker: shows the notification and opens the linked page on click. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'New notification', {
      body: data.body || undefined,
      data: { url: data.url || '/' },
      tag: data.url || undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) if (w.url === url && 'focus' in w) return w.focus();
      return self.clients.openWindow(url);
    }),
  );
});
