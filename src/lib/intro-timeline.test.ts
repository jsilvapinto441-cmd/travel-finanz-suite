import { describe, expect, it } from "vitest";
import { introSpeed, introTimeline } from "./intro-timeline";
import { INTRO_DURATION_MS } from "./intro-session";

describe("intro timeline", () => {
  it("keeps the original sequence when the total is the designed 1.2s", () => {
    const t = introTimeline(1200);
    expect(introSpeed(1200)).toBe(1);
    expect(t.flight).toBeCloseTo(0.5);
    expect(t.shineDelay).toBeCloseTo(0.9);
    expect(t.exitDuration).toBeCloseTo(0.3);
    expect(t.letterDuration).toBeCloseTo(0.15);
  });

  it("scales the whole sequence with the total, not just the wait", () => {
    const t = introTimeline(2200);
    expect(introSpeed(2200)).toBeCloseTo(2200 / 1200);
    expect(t.flight).toBeCloseTo(0.5 * (2200 / 1200));
    expect(t.shineDelay).toBeCloseTo(0.9 * (2200 / 1200));
    expect(t.pinStiffness).toBeCloseTo(400 / (2200 / 1200) ** 2);
    expect(t.pinDamping).toBeCloseTo(15 / (2200 / 1200));
  });

  it("finishes the exit exactly when the total ends", () => {
    for (const total of [1200, 2200, 3000, 4000]) {
      const t = introTimeline(total);
      expect(t.exitDelay + t.exitDuration).toBeCloseTo(total / 1000);
    }
  });

  it("uses the project's current total", () => {
    expect(introSpeed()).toBeCloseTo(INTRO_DURATION_MS / 1200);
  });
});
