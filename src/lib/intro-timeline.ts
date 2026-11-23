// Every timing in the intro is derived from one total, so changing INTRO_DURATION_MS
// slows or speeds the whole sequence instead of only holding the last frame longer.
import { INTRO_DURATION_MS } from "./intro-session";

/** The sequence as originally designed, in seconds, before any scaling. */
const BASE_MS = 1200;

export function introSpeed(totalMs: number = INTRO_DURATION_MS): number {
  return totalMs / BASE_MS;
}

export function introTimeline(totalMs: number = INTRO_DURATION_MS) {
  const f = introSpeed(totalMs);
  return {
    /** Multiplier for the per-letter base delays. */
    speed: f,
    flight: 0.5 * f,
    pinDelay: 0.5 * f,
    // A spring slows the same way a clock does: stiffness by f^2, damping by f.
    pinStiffness: 400 / (f * f),
    pinDamping: 15 / f,
    waveDelay: 0.5 * f,
    waveDuration: 0.25 * f,
    baseDelay: 0.5 * f,
    baseDuration: 0.15 * f,
    trailFadeDelay: 0.6 * f,
    trailFadeDuration: 0.3 * f,
    letterDuration: 0.15 * f,
    shineDelay: 0.9 * f,
    shineDuration: 0.3 * f,
    exitDelay: 0.9 * f,
    exitDuration: 0.3 * f,
    planeOutDelay: 0.5 * f,
    planeOutDuration: 0.15 * f,
  };
}
