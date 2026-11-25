// Intro flight path in logo viewBox units: a smooth arc from the top-left screen
// corner that lands tangent on the pin head, one clockwise lap around it, then a
// short dive to the pin's centre. Derived from the rendered logo box so the
// plane always starts off-screen on phones and desktops alike.

export const INTRO_VIEWBOX_WIDTH = 568;
export const INTRO_PIN = { x: 173, y: 59 };
export const INTRO_ORBIT_R = 58;

export type IntroRoute = { x0: number; y0: number; cx: number; cy: number };
type Point = { x: number; y: number };

const TOP = { x: INTRO_PIN.x, y: INTRO_PIN.y - INTRO_ORBIT_R };
const OFFSCREEN_PX = 30;

export const INTRO_ROUTE_DEFAULT: IntroRoute = { x0: -300, y0: -260, cx: -63, cy: TOP.y };

type Rect = { left: number; top: number; width: number };

export function computeIntroRoute(rect: Rect | undefined): IntroRoute {
  if (!rect || rect.width <= 0) return INTRO_ROUTE_DEFAULT;
  const scale = rect.width / INTRO_VIEWBOX_WIDTH;
  const x0 = Math.max(-1200, -(rect.left + OFFSCREEN_PX) / scale);
  const y0 = Math.max(-900, -(rect.top + OFFSCREEN_PX) / scale);
  // Control point on the tangent line y = TOP.y makes the arc meet the circle tangentially.
  return { x0, y0, cx: (x0 + TOP.x) / 2, cy: TOP.y };
}

/** Phase 0..1 entry arc, 1..2 clockwise lap, 2..3 dive to the centre. */
export function introPoint(r: IntroRoute, p: number): Point {
  if (p <= 1) {
    const t = Math.max(0, p), u = 1 - t;
    return { x: u * u * r.x0 + 2 * u * t * r.cx + t * t * TOP.x, y: u * u * r.y0 + 2 * u * t * r.cy + t * t * TOP.y };
  }
  if (p <= 2) {
    const a = -Math.PI / 2 + (p - 1) * 2 * Math.PI;
    return { x: INTRO_PIN.x + INTRO_ORBIT_R * Math.cos(a), y: INTRO_PIN.y + INTRO_ORBIT_R * Math.sin(a) };
  }
  const t = Math.min(1, p - 2);
  return { x: TOP.x, y: TOP.y + (INTRO_PIN.y - TOP.y) * t };
}

/** Nose direction in degrees (0 = pointing right), following the curve tangent. */
export function introHeading(r: IntroRoute, p: number): number {
  if (p <= 1) {
    const t = Math.max(0, p);
    const dx = 2 * (1 - t) * (r.cx - r.x0) + 2 * t * (TOP.x - r.cx);
    const dy = 2 * (1 - t) * (r.cy - r.y0) + 2 * t * (TOP.y - r.cy);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  if (p <= 2) return (p - 1) * 360;
  return 90;
}
