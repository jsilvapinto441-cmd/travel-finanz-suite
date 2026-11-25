import { describe, expect, it } from "vitest";
import { introSpeed, introTimeline } from "./intro-timeline";
import { INTRO_DURATION_MS } from "./intro-session";

describe("intro timeline", () => {
  it("matches the designed 1.5s sequence at speed 1", () => {
    const t = introTimeline(1500);
    expect(t.entryDelay).toBeCloseTo(0.2);
    expect(t.orbitStart).toBeCloseTo(0.45);
    expect(t.orbitStart + t.orbit).toBeCloseTo(1.05);
    expect(t.pinDelay).toBeCloseTo(1.05);
    expect(t.shineDelay).toBeCloseTo(1.25);
    expect(t.letterStagger).toBeCloseTo(0.06);
  });

  it("reveals letters on the right side before the left side (clockwise lap)", () => {
    const t = introTimeline(1500);
    expect(t.rightSide).toBeCloseTo(0.6);
    expect(t.leftSide).toBeCloseTo(0.9);
  });

  it("scales the whole sequence and ends exactly at the total", () => {
    for (const total of [1500, 2200, 3000]) {
      const t = introTimeline(total);
      expect(t.exitDelay + t.exitDuration).toBeCloseTo(total / 1000);
      expect(t.pinStiffness).toBeCloseTo(400 / (total / 1500) ** 2);
    }
  });

  it("uses the project's current total", () => {
    expect(introSpeed()).toBeCloseTo(INTRO_DURATION_MS / 1500);
  });
});
