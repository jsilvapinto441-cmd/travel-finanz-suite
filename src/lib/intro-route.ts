// Intro flight path: a quadratic arc that starts just off the left edge of the
// *screen* (not of the logo box) and lands on the pin that forms the "O".
// Deriving it from the rendered logo width keeps the entry readable on phones
// and on ultra-wide monitors with the same 0.5s timing.

export const INTRO_VIEWBOX_WIDTH = 568;
export const INTRO_PIN = { x: 173, y: 59 };

export type IntroRoute = {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
};

/** How far left of the screen edge the plane starts, in CSS px. */
const OFFSCREEN_PX = 20;
/** Safety bound so ultra-wide screens do not stretch the arc forever. */
const MIN_X0 = -1200;
/** Fraction of the horizontal span where the arc's control point sits. */
const CONTROL_AT = 0.5;

export const INTRO_ROUTE_DEFAULT: IntroRoute = {
  x0: -350,
  y0: 125,
  cx: -90,
  cy: -100,
  x1: INTRO_PIN.x,
  y1: INTRO_PIN.y,
};

type Box = { x: number; width: number };

export function computeIntroRoute(rect: Box | undefined, viewportWidth: number): IntroRoute {
  if (!rect || rect.width <= 0 || !Number.isFinite(rect.width) || !Number.isFinite(viewportWidth)) {
    return INTRO_ROUTE_DEFAULT;
  }
  const scale = rect.width / INTRO_VIEWBOX_WIDTH;
  const x0 = Math.max(MIN_X0, (-OFFSCREEN_PX - rect.x) / scale);
  return {
    x0,
    y0: INTRO_ROUTE_DEFAULT.y0,
    cx: x0 + (INTRO_PIN.x - x0) * CONTROL_AT,
    cy: INTRO_ROUTE_DEFAULT.cy,
    x1: INTRO_PIN.x,
    y1: INTRO_PIN.y,
  };
}

/** Position along the arc at t in [0,1]. */
export function introPoint(route: IntroRoute, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * route.x0 + 2 * u * t * route.cx + t * t * route.x1,
    y: u * u * route.y0 + 2 * u * t * route.cy + t * t * route.y1,
  };
}

/** Plane heading in degrees, following the arc's tangent. */
export function introHeading(route: IntroRoute, t: number): number {
  const u = 1 - t;
  const dx = 2 * (u * (route.cx - route.x0) + t * (route.x1 - route.cx));
  const dy = 2 * (u * (route.cy - route.y0) + t * (route.y1 - route.cy));
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Convert an arc x (viewBox units) to a screen x in CSS px. */
export function toScreenX(rect: Box, x: number): number {
  return rect.x + x * (rect.width / INTRO_VIEWBOX_WIDTH);
}
