export const INTRO_DURATION_MS = 3000;
export const INTRO_SESSION_KEY = "rotas:intro-seen";

type SessionStore = Pick<Storage, "getItem" | "setItem">;

export function claimIntroSession(storage: SessionStore): boolean {
  try {
    if (storage.getItem(INTRO_SESSION_KEY) === "1") return false;
    storage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    // Private browsing can disable storage; the intro must still open.
  }
  return true;
}