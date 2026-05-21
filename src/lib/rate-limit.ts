// Proteção client-side contra força bruta e abuso.
// Complementa o rate limiting nativo do Supabase Auth (server-side por IP/email).

type Attempts = { count: number; firstAt: number; lockUntil?: number };

const LOGIN_KEY = "rl:login:";
const RESET_KEY = "rl:reset:";

const LOGIN_WINDOW_MS = 15 * 60_000; // janela de 15min
const LOGIN_MAX = 5;                  // 5 tentativas
const LOGIN_LOCK_MS = 15 * 60_000;    // bloqueia 15min

const RESET_COOLDOWN_MS = 60_000;     // 1 envio por minuto
const RESET_DAILY_MAX = 5;            // máx 5 envios por 24h
const RESET_DAILY_WINDOW_MS = 24 * 60 * 60_000;

function read(key: string): Attempts | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Attempts) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: Attempts) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}
function clear(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function norm(email: string) {
  return email.trim().toLowerCase();
}

// ===== LOGIN =====
export function checkLoginAllowed(email: string): { allowed: true } | { allowed: false; secondsLeft: number } {
  const key = LOGIN_KEY + norm(email);
  const a = read(key);
  if (!a) return { allowed: true };
  const now = Date.now();
  if (a.lockUntil && now < a.lockUntil) {
    return { allowed: false, secondsLeft: Math.ceil((a.lockUntil - now) / 1000) };
  }
  if (a.lockUntil && now >= a.lockUntil) {
    clear(key);
    return { allowed: true };
  }
  return { allowed: true };
}

export function registerLoginFailure(email: string): { lockUntil?: number; remaining: number } {
  const key = LOGIN_KEY + norm(email);
  const now = Date.now();
  const a = read(key);
  if (!a || now - a.firstAt > LOGIN_WINDOW_MS) {
    const next: Attempts = { count: 1, firstAt: now };
    write(key, next);
    return { remaining: LOGIN_MAX - 1 };
  }
  const count = a.count + 1;
  if (count >= LOGIN_MAX) {
    const lockUntil = now + LOGIN_LOCK_MS;
    write(key, { count, firstAt: a.firstAt, lockUntil });
    return { lockUntil, remaining: 0 };
  }
  write(key, { count, firstAt: a.firstAt });
  return { remaining: LOGIN_MAX - count };
}

export function registerLoginSuccess(email: string) {
  clear(LOGIN_KEY + norm(email));
}

// ===== RESET PASSWORD =====
export function checkResetAllowed(email: string): { allowed: true } | { allowed: false; secondsLeft: number; reason: "cooldown" | "daily" } {
  const key = RESET_KEY + norm(email);
  const a = read(key);
  const now = Date.now();
  if (!a) return { allowed: true };

  // cooldown entre envios
  const lastAt = a.lockUntil ?? 0;
  if (now < lastAt + RESET_COOLDOWN_MS) {
    return { allowed: false, secondsLeft: Math.ceil((lastAt + RESET_COOLDOWN_MS - now) / 1000), reason: "cooldown" };
  }
  // limite diário
  if (now - a.firstAt <= RESET_DAILY_WINDOW_MS && a.count >= RESET_DAILY_MAX) {
    const secondsLeft = Math.ceil((a.firstAt + RESET_DAILY_WINDOW_MS - now) / 1000);
    return { allowed: false, secondsLeft, reason: "daily" };
  }
  return { allowed: true };
}

export function registerResetSent(email: string) {
  const key = RESET_KEY + norm(email);
  const now = Date.now();
  const a = read(key);
  if (!a || now - a.firstAt > RESET_DAILY_WINDOW_MS) {
    write(key, { count: 1, firstAt: now, lockUntil: now });
  } else {
    write(key, { count: a.count + 1, firstAt: a.firstAt, lockUntil: now });
  }
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m} min`;
}
