import { describe, expect, it } from "vitest";
import {
  computeIntroRoute,
  introHeading,
  introPoint,
  INTRO_PIN,
  INTRO_ROUTE_DEFAULT,
  toScreenX,
} from "./intro-route";

// Phone: logo box is 80vw wide and centred.
const PHONE = { rect: { x: 39, width: 312 }, viewport: 390 };
// Desktop: logo box is capped at 480px and centred.
const DESKTOP = { rect: { x: 400, width: 480 }, viewport: 1280 };

describe("intro route", () => {
  it("starts the plane off the left screen edge on a phone", () => {
    const route = computeIntroRoute(PHONE.rect, PHONE.viewport);
    expect(toScreenX(PHONE.rect, route.x0)).toBeLessThan(0);
  });

  it("starts the plane off the left screen edge on a PC", () => {
    const route = computeIntroRoute(DESKTOP.rect, DESKTOP.viewport);
    expect(toScreenX(DESKTOP.rect, route.x0)).toBeLessThan(0);
  });

  it("has the plane inside the screen a quarter of the way through the flight, on both", () => {
    for (const { rect, viewport } of [PHONE, DESKTOP]) {
      const route = computeIntroRoute(rect, viewport);
      const screenX = toScreenX(rect, introPoint(route, 0.25).x);
      expect(screenX).toBeGreaterThan(0);
      expect(screenX).toBeLessThan(viewport);
    }
  });

  it("keeps a phone flight long enough to read", () => {
    const route = computeIntroRoute(PHONE.rect, PHONE.viewport);
    const travel = toScreenX(PHONE.rect, route.x1) - toScreenX(PHONE.rect, route.x0);
    expect(travel).toBeGreaterThanOrEqual(0.35 * PHONE.viewport);
  });

  it("lands on the pin that forms the O", () => {
    for (const { rect, viewport } of [PHONE, DESKTOP]) {
      const route = computeIntroRoute(rect, viewport);
      expect(introPoint(route, 1)).toEqual({ x: INTRO_PIN.x, y: INTRO_PIN.y });
    }
  });

  it("keeps a finite heading the whole way", () => {
    const route = computeIntroRoute(PHONE.rect, PHONE.viewport);
    for (const t of [0, 0.25, 0.5, 0.999, 1]) {
      expect(Number.isFinite(introHeading(route, t))).toBe(true);
    }
  });

  it("falls back to the built-in arc before the logo is laid out", () => {
    expect(computeIntroRoute(undefined, 390)).toEqual(INTRO_ROUTE_DEFAULT);
    expect(computeIntroRoute({ x: 0, width: 0 }, 390)).toEqual(INTRO_ROUTE_DEFAULT);
  });

  it("caps the arc on ultra-wide screens", () => {
    const route = computeIntroRoute({ x: 1040, width: 480 }, 2560);
    expect(route.x0).toBe(-1200);
  });
});
