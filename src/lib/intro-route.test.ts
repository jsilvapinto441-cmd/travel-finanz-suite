import { describe, expect, it } from "vitest";
import { computeIntroRoute, introHeading, introPoint, INTRO_ORBIT_R, INTRO_PIN } from "./intro-route";

const phone = { left: 39, top: 380, width: 312 };
const desktop = { left: 400, top: 380, width: 480 };

describe("intro route", () => {
  it("starts off the top-left of the screen on phone and desktop", () => {
    for (const rect of [phone, desktop]) {
      const r = computeIntroRoute(rect);
      const s = rect.width / 568;
      const p = introPoint(r, 0);
      expect(rect.left + p.x * s).toBeLessThan(0);
      expect(rect.top + p.y * s).toBeLessThan(0);
    }
  });

  it("enters tangent to the pin head, heading right, with no corner", () => {
    const r = computeIntroRoute(phone);
    expect(introPoint(r, 1).y).toBeCloseTo(INTRO_PIN.y - INTRO_ORBIT_R);
    expect(introHeading(r, 1)).toBeCloseTo(0);
    expect(introHeading(r, 1.0001)).toBeCloseTo(0, 0);
  });

  it("laps clockwise: right side at a quarter, left side at three quarters", () => {
    const r = computeIntroRoute(desktop);
    expect(introPoint(r, 1.25).x).toBeCloseTo(INTRO_PIN.x + INTRO_ORBIT_R);
    expect(introPoint(r, 1.75).x).toBeCloseTo(INTRO_PIN.x - INTRO_ORBIT_R);
    expect(introPoint(r, 2).y).toBeCloseTo(INTRO_PIN.y - INTRO_ORBIT_R);
  });

  it("ends at the pin centre", () => {
    const p = introPoint(computeIntroRoute(phone), 3);
    expect(p.x).toBeCloseTo(INTRO_PIN.x);
    expect(p.y).toBeCloseTo(INTRO_PIN.y);
  });
});
