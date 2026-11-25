// Every timing in the intro is derived from one total, so changing INTRO_DURATION_MS
// slows or speeds the whole sequence instead of only holding the last frame longer.
import { INTRO_DURATION_MS } from "./intro-session";

/** The sequence as designed, before scaling. */
const BASE_MS = 1500;

export function introSpeed(totalMs: number = INTRO_DURATION_MS): number {
  return totalMs / BASE_MS;
}

export function introTimeline(totalMs: number = INTRO_DURATION_MS) {
  const f = introSpeed(totalMs);
  const orbitStart = 0.45 * f, orbit = 0.6 * f;
  return {
    speed: f,
    glow: 0.2 * f,
    entryDelay: 0.2 * f,
    entry: 0.25 * f,
    orbitStart,
    orbit,
    /** Right side of the lap (quarter turn) reveals T, A, S; left side reveals R. */
    rightSide: orbitStart + orbit * 0.25,
    leftSide: orbitStart + orbit * 0.75,
    letterStagger: 0.06 * f,
    letterDuration: 0.18 * f,
    diveDelay: 1.05 * f,
    dive: 0.2 * f,
    pinDelay: 1.05 * f,
    // A spring slows the same way a clock does: stiffness by f^2, damping by f.
    pinStiffness: 400 / (f * f),
    pinDamping: 15 / f,
    waveDelay: 1.1 * f,
    waveDuration: 0.3 * f,
    trailFadeDelay: 1.1 * f,
    trailFadeDuration: 0.15 * f,
    shineDelay: 1.25 * f,
    shineDuration: 0.25 * f,
    exitDelay: 1.25 * f,
    exitDuration: 0.25 * f,
  };
}
