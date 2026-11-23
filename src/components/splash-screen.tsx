import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimIntroSession, INTRO_DURATION_MS } from "@/lib/intro-session";
import { computeIntroRoute, introHeading, introPoint, INTRO_ROUTE_DEFAULT, type IntroRoute } from "@/lib/intro-route";

const letters = [
  { name: "R", delay: 0.75, path: "M2 7H48C77 7 91 19 91 41C91 57 83 68 67 73L94 120H68L43 77H23V120H2ZM23 25V59H46C62 59 70 53 70 42S62 25 46 25Z" },
  { name: "T", delay: 0.6, path: "M245 7H339V25H303V120H282V25H245Z" },
  { name: "A", delay: 0.65, path: "M392 7H414L465 120H443L432 94H373L362 120H341ZM381 76H424L402 26Z" },
  { name: "S", delay: 0.7, path: "M556 14L548 32C535 25 523 23 513 23C500 23 492 28 492 36C492 58 561 44 561 87C561 109 544 122 516 122C498 122 480 116 468 106L477 89C489 98 503 103 516 103C531 103 540 98 540 89C540 66 471 81 471 38C471 17 488 5 515 5C531 5 546 8 556 14Z" },
];
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
  const [trail, setTrail] = useState<IntroRoute>(INTRO_ROUTE_DEFAULT);
  // Quadratic arc: tangent-derived heading keeps the plane aligned with its route.
  const x = useTransform(progress, (t) => introPoint(route.current, t).x);
  const y = useTransform(progress, (t) => introPoint(route.current, t).y);
  const rotate = useTransform(progress, (t) => introHeading(route.current, t));
  // Dashed trail is uncovered by the plane's own position, so it never runs ahead of the nose.
  const revealX = useTransform(progress, (t) => introPoint(route.current, t).x + 14 - (route.current.x1 + 47));
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
    route.current = computeIntroRoute(stageRef.current?.getBoundingClientRect(), window.innerWidth);
    setTrail(route.current);
    setReady(true);
    const flight = reduced ? undefined : animate(progress, 1, { duration: 0.5, ease: "linear" });
    const timer = setTimeout(finish, reduced ? 250 : INTRO_DURATION_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      flight?.stop();
    };
  }, [finish, progress, reduced]);

  const clipX = trail.x0 - 20;
  const clipW = trail.x1 + 47 - clipX;
  const trailD = `M${trail.x0} ${trail.y0}Q${trail.cx} ${trail.cy} ${trail.x1} ${trail.y1}`;

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
      transition={{ delay: reduced ? 0 : 0.9, duration: reduced ? 0.25 : 0.3, ease: "easeOut" }}
    >
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-ring" aria-hidden="true" />
      <div className="intro-stage" aria-hidden="true" ref={stageRef}>
        <svg className="intro-logo" viewBox="0 0 568 170">
          <defs>
            <clipPath id="intro-route-reveal"><motion.rect x={clipX} y={-140} width={clipW} height={330} style={{ x: revealX }} /></clipPath>
            <clipPath id="intro-letter-mask">{letters.map((letter) => <path key={letter.name} d={letter.path} fillRule="evenodd" />)}<path d={pin} fillRule="evenodd" /></clipPath>
          </defs>
          <motion.g initial={false} animate={{ opacity: ready && !reduced ? 0 : 1 }} transition={{ duration: 0.08 }}><StaticLogo /></motion.g>
          {ready && !reduced && <>
            <motion.g className="intro-orange" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.6, duration: 0.3 }}>
              <path d={trailD} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 9" clipPath="url(#intro-route-reveal)" />
            </motion.g>
            <motion.g className="intro-orange intro-pin" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 15 }}>
              <circle className="intro-white" cx="173" cy="59" r="36" />
              <path className="intro-pin" d={pin} fillRule="evenodd" />
            </motion.g>
            <motion.ellipse className="intro-orange intro-wave" cx="173" cy="155" rx="52" ry="9" fill="none" stroke="currentColor" strokeWidth="3" initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.65, 0], scale: [1, 1, 2.1] }} transition={{ delay: 0.5, duration: 0.25 }} />
            <motion.ellipse className="intro-orange" cx="173" cy="155" rx="52" ry="9" fill="none" stroke="currentColor" strokeWidth="4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.15 }} />
            {letters.map((letter) => <motion.path className="intro-white" key={letter.name} d={letter.path} fillRule="evenodd" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: letter.delay, duration: 0.15, ease: "easeOut" }} />)}
            <g clipPath="url(#intro-letter-mask)"><motion.path className="intro-shine" d="M-100 -20H-65L15 180H-20Z" initial={{ x: 0, opacity: 0 }} animate={{ x: 760, opacity: [0, 0.6, 0] }} transition={{ delay: 0.9, duration: 0.3, ease: "linear" }} /></g>
          </>}
        </svg>
        {ready && !reduced && <svg className="intro-plane-layer" viewBox="0 0 568 170"><motion.g style={{ x, y, rotate }}>
          <motion.svg className="intro-plane intro-white" x="-16" y="-16" width="32" height="32" viewBox="-16 -16 32 32" initial={{ scale: 1 }} animate={{ scale: 0 }} transition={{ delay: 0.5, duration: 0.15, ease: "easeIn" }}>
            <path d="M15 0L3-3L-5-14H-9L-5-3L-12-2L-15-6H-17L-15 0L-17 6H-15L-12 2L-5 3L-9 14H-5L3 3Z" />
          </motion.svg>
        </motion.g></svg>}
      </div>
    </motion.div>
  );
}
