import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "produz-pwa-dismissed-at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari doesn't fire beforeinstallprompt — show manual hint
    if (isIOS()) {
      const t = setTimeout(() => setShowIOS(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
    setShowIOS(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred && !showIOS) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm">
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-prestige">
        <div className="flex items-start gap-3">
          <div className="size-10 shrink-0 rounded-lg gradient-orange flex items-center justify-center">
            <Download className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm">Instalar PRODUZ Hub</div>
            {deferred ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Acesse mais rápido instalando o app na sua tela inicial.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Para instalar no iPhone/iPad: toque em <Share className="inline size-3.5 mx-0.5" /> e depois em
                <span className="font-medium"> "Adicionar à Tela de Início"</span>.
              </p>
            )}
            {deferred && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="h-8">
                  Instalar
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                  Agora não
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
