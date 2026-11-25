import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimIntroSession, INTRO_DURATION_MS } from "@/lib/intro-session";
import { computeIntroRoute, introHeading, introPoint, INTRO_ROUTE_DEFAULT, type IntroRoute } from "@/lib/intro-route";

const ORBIT_D = "M173 1A58 58 0 1 1 173 117A58 58 0 1 1 173 1";
import { introTimeline } from "@/lib/intro-timeline";

const timeline = introTimeline();

const letters = [
  { name: "R", side: "left", path: "M2 7H48C77 7 91 19 91 41C91 57 83 68 67 73L94 120H68L43 77H23V120H2ZM23 25V59H46C62 59 70 53 70 42S62 25 46 25Z" },
  { name: "T", side: "right", path: "M245 7H339V25H303V120H282V25H245Z" },
  { name: "A", side: "right", path: "M392 7H414L465 120H443L432 94H373L362 120H341ZM381 76H424L402 26Z" },
  { name: "S", side: "right", path: "M556 14L548 32C535 25 523 23 513 23C500 23 492 28 492 36C492 58 561 44 561 87C561 109 544 122 516 122C498 122 480 116 468 106L477 89C489 98 503 103 516 103C531 103 540 98 540 89C540 66 471 81 471 38C471 17 488 5 515 5C531 5 546 8 556 14Z" },
] as const;

function letterDelay(index: number, side: "left" | "right") {
  return side === "left" ? timeline.leftSide : timeline.rightSide + (index - 1) * timeline.letterStagger;
}
const pin = "M173 2C141 2 115 27 115 59C115 91 173 151 173 151S231 91 231 59C231 27 205 2 173 2ZM173 23A36 36 0 1 1 173 95A36 36 0 1 1 173 23ZM173 42A17 17 0 1 0 173 76A17 17 0 1 0 173 42Z";

function StaticLogo() {
  return <g><g className="intro-white">{letters.map((letter) => <path key={letter.name} d={letter.path} fillRule="evenodd" />)}<circle cx="173" cy="59" r="36" /></g><g className="intro-orange"><path d={pin} fillRule="evenodd" /><ellipse cx="173" cy="155" rx="52" ry="9" fill="none" stroke="currentColor" strokeWidth="4" /></g></g>;
}

export function SplashScreen() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const target = useRef<"/dashboard" | "/login">("/login");
  const sessionReady = useRef<Promise<void> | null>(null);
  const finished = useRef(false);
  const progress = useMotionValue(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const route = useRef<IntroRoute>(INTRO_ROUTE_DEFAULT);
  // One progress value drives position, heading and the orange contour, so they stay in sync.
  const x = useTransform(progress, (p) => introPoint(route.current, p).x);
  const y = useTransform(progress, (p) => introPoint(route.current, p).y);
  const rotate = useTransform(progress, (p) => introHeading(route.current, p));
  const planeOpacity = useTransform(progress, (p) => (p <= 0 ? 0 : 1));
  const trailOffset = useTransform(progress, (p) => 1 - Math.min(1, Math.max(0, p - 1)));
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    void (async () => {
      await sessionReady.current;
      await navigate({ to: target.current, replace: true });
    })();
  }, [navigate]);

  useEffect(() => {
    let active = true;
    sessionReady.current = supabase.auth.getSession().then(({ data }) => {
      if (active) target.current = data.session ? "/dashboard" : "/login";
    }).catch(() => { target.current = "/login"; });
    let showIntro = true;
    try { showIntro = claimIntroSession(sessionStorage); } catch { /* Storage may be unavailable on iOS. */ }
    if (!showIntro) {
      finish();
      return () => { active = false; };
    }
    route.current = computeIntroRoute(stageRef.current?.getBoundingClientRect());
    setReady(true);
    const end = timeline.diveDelay + timeline.dive;
    const flight = reduced ? undefined : animate(progress, [0, 0, 1, 2, 3], {
      duration: end,
      times: [0, timeline.entryDelay / end, timeline.orbitStart / end, timeline.diveDelay / end, 1],
      ease: ["linear", "easeOut", "linear", "easeIn"],
    });
    const timer = setTimeout(finish, reduced ? 250 : INTRO_DURATION_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      flight?.stop();
    };
  }, [finish, progress, reduced]);

  const animated = ready && !reduced;

  return (
    <motion.div
      className="splash-screen"
      role="button"
      tabIndex={0}
      aria-label="Pular animação de entrada Rotas"
      onClick={finish}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") finish(); }}
      initial={false}
      animate={ready ? { opacity: 0, scale: reduced ? 1 : 1.05 } : { opacity: 1, scale: 1 }}
      transition={{ delay: reduced ? 0 : timeline.exitDelay, duration: reduced ? 0.25 : timeline.exitDuration, ease: "easeOut" }}
    >
      <motion.div className="splash-glow" aria-hidden="true" initial={false} animate={animated ? { opacity: [0, 0.6] } : { opacity: 0.6 }} transition={{ duration: timeline.glow }} />
      <div className="splash-ring" aria-hidden="true" />
      <div className="intro-stage" aria-hidden="true" ref={stageRef}>
        <svg className="intro-logo" viewBox="0 0 568 170">
          <defs>
            <clipPath id="intro-letter-mask">{letters.map((letter) => <path key={letter.name} d={letter.path} fillRule="evenodd" />)}<path d={pin} fillRule="evenodd" /></clipPath>
          </defs>
          <motion.g initial={false} animate={{ opacity: animated ? 0 : 1 }} transition={{ duration: 0.08 }}><StaticLogo /></motion.g>
          {animated && <>
            <motion.g className="intro-orange" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: timeline.trailFadeDelay, duration: timeline.trailFadeDuration }}>
              <motion.path d={ORBIT_D} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: trailOffset }} />
            </motion.g>
            <motion.g className="intro-orange intro-pin" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: timeline.pinDelay, type: "spring", stiffness: timeline.pinStiffness, damping: timeline.pinDamping }}>
              <circle className="intro-white" cx="173" cy="59" r="36" />
              <path className="intro-pin" d={pin} fillRule="evenodd" />
            </motion.g>
            <motion.ellipse className="intro-orange intro-wave" cx="173" cy="155" rx="52" ry="9" fill="none" stroke="currentColor" strokeWidth="3" initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.65, 0], scale: [1, 1, 2.1] }} transition={{ delay: timeline.waveDelay, duration: timeline.waveDuration }} />
            <motion.ellipse className="intro-orange" cx="173" cy="155" rx="52" ry="9" fill="none" stroke="currentColor" strokeWidth="4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: timeline.pinDelay, duration: timeline.dive }} />
            {letters.map((letter, index) => <motion.path className="intro-white" key={letter.name} d={letter.path} fillRule="evenodd" initial={{ opacity: 0, x: letter.side === "left" ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: letterDelay(index, letter.side), duration: timeline.letterDuration, ease: "easeOut" }} />)}
            <g clipPath="url(#intro-letter-mask)"><motion.path className="intro-shine" d="M-100 -20H-65L15 180H-20Z" initial={{ x: 0, opacity: 0 }} animate={{ x: 760, opacity: [0, 0.6, 0] }} transition={{ delay: timeline.shineDelay, duration: timeline.shineDuration, ease: "linear" }} /></g>
          </>}
        </svg>
        {animated && <svg className="intro-plane-layer" viewBox="0 0 568 170"><motion.g style={{ x, y, rotate, opacity: planeOpacity }}>
          <motion.svg className="intro-plane intro-white" x="-14" y="-14" width="28" height="28" viewBox="-16 -16 32 32" initial={{ scale: 1 }} animate={{ scale: 0 }} transition={{ delay: timeline.diveDelay, duration: timeline.dive, ease: "easeIn" }}>
            <path d="M15 0L3-3L-5-14H-9L-5-3L-12-2L-15-6H-17L-15 0L-17 6H-15L-12 2L-5 3L-9 14H-5L3 3Z" />
          </motion.svg>
        </motion.g></svg>}
      </div>
    </motion.div>
  );
}
