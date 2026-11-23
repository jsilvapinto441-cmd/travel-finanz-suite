import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY || "AIzaSyC2Zag07VSh72LjwViXF7u4iIeCj49WcIQ",
  authDomain: "rotas-e877c.firebaseapp.com",
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID || "rotas-e877c",
  storageBucket: "rotas-e877c.firebasestorage.app",
  messagingSenderId: "68855420558",
  appId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID || "1:68855420558:web:c998a50fc074c175e91bdf",
  measurementId: "G-VLHTLTF0L6",
};

const VAPID_KEY =
  import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY ||
  "BAu16FhGhSVmVNFyzr7IgWY5q5dx1ILRh_zjwMjyWGGUpfqnL9CsaM4VlCcUb_3lwniAzHjBQC2xGrkkx_vHjGU";

let analyticsStarted = false;

/** Inicializa o Firebase (e o Analytics) apenas no navegador. */
export async function getFirebaseApp(): Promise<FirebaseApp> {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  if (!analyticsStarted) {
    analyticsStarted = true;
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  }
  return app;
}

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "unsupported" | "open-in-new-tab" | "denied" };

/** Chamar a partir de um clique: pede permissão e gera o token FCM. */
export async function enablePush(): Promise<PushResult> {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const { measurementId: _m, ...swConfig } = firebaseConfig;
  const query = new URLSearchParams(swConfig).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  const messaging = getMessaging(await getFirebaseApp());
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}
