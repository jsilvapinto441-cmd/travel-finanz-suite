importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // o navegador já exibe notificações com "notification"
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Rotas", { body: d.body || "", icon: "/icon-192.png" });
});

// Clique: abre a tela indicada (recebíveis/despesas com filtro). Sem sessão, o app leva ao login e volta.
self.addEventListener("notificationclick", (event) => {
  const data = (event.notification.data && (event.notification.data.FCM_MSG?.data || event.notification.data)) || {};
  const link = data.link || "/dashboard";
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL(link, self.location.origin).href));
});
