importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // o navegador já exibe notificações com "notification"
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Rotas", { body: d.body || "", icon: "/icon-192.png" });
});
