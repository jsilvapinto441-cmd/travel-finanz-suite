import { useEffect, useRef } from "react";
import { BUILD_ID } from "@/lib/build-id";

const VERSION_URL = "/api/public/version";
const POLL_INTERVAL_MS = 60_000; // 1 min
const RELOAD_FLAG = "produz-auto-reload-at";

type VersionPayload = { buildId: string; ts: number };

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionPayload;
    return data?.buildId ?? null;
  } catch {
    return null;
  }
}

function shouldDeferReload() {
  if (typeof document === "undefined") return true;
  if (document.visibilityState !== "visible") return true;
  // Avoid interrupting form input
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
    return true;
  }
  // Avoid reload loops: cap to once every 30s
  const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? "0");
  if (Date.now() - last < 30_000) return true;
  return false;
}

function performSilentReload(newBuildId: string) {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* ignore */
  }
  // Clear runtime caches if Cache Storage is available (PWA / future SW)
  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => undefined)
      .finally(() => {
        console.info(`[version] Reloading: ${BUILD_ID} → ${newBuildId}`);
        window.location.reload();
      });
    return;
  }
  console.info(`[version] Reloading: ${BUILD_ID} → ${newBuildId}`);
  window.location.reload();
}

export function useAutoUpdate() {
  const initialBuildIdRef = useRef<string>(BUILD_ID);
  const pendingBuildIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.info(`[version] Build ${BUILD_ID}`);

    let cancelled = false;

    const check = async () => {
      const remote = await fetchRemoteBuildId();
      if (cancelled || !remote) return;
      if (remote === initialBuildIdRef.current) {
        pendingBuildIdRef.current = null;
        return;
      }
      pendingBuildIdRef.current = remote;
      if (!shouldDeferReload()) {
        performSilentReload(remote);
      } else {
        console.info(`[version] New build ${remote} pending — waiting for idle/visible tab`);
      }
    };

    // Try right away, then on interval
    check();
    const id = window.setInterval(check, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    const onFocus = () => check();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    // Also try to apply a pending update once the tab becomes idle/visible
    const idleId = window.setInterval(() => {
      const pending = pendingBuildIdRef.current;
      if (pending && !shouldDeferReload()) {
        performSilentReload(pending);
      }
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearInterval(idleId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
