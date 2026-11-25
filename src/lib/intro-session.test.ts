import { describe, expect, it } from "vitest";
import { claimIntroSession, INTRO_DURATION_MS } from "./intro-session";

describe("intro", () => {
  it("never exceeds the agreed total", () => {
    expect(INTRO_DURATION_MS).toBe(2200);
  });
  it("runs only once in the same session", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(claimIntroSession(storage)).toBe(true);
    expect(claimIntroSession(storage)).toBe(false);
  });
  it("runs again in a new session", () => {
    const storage = () => {
      const values = new Map<string, string>();
      return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    };
    expect(claimIntroSession(storage())).toBe(true);
    expect(claimIntroSession(storage())).toBe(true);
  });
});