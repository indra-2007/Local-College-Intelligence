"use client";

import TitleLetters from "@/components/TitleLetters";

import { useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { preload } from "react-dom";
import { useRouter } from "next/navigation";
import { chatPath, PrepareChatFade } from "@/components/DoorwayTransition";
import { chatArtwork } from "@/lib/chat-artwork";
import LoginForm from "./LoginForm";
import PorchScene, { EmberCursor } from "./PorchScene";
import styles from "./entry.module.css";

// The CSS camera and this clock use the same durations.
const cues = {
  revealing: { ms: 1100, next: "porch" },
  porch: { ms: 130, next: "entering" },
  entering: { ms: 620, next: "black" },
  black: { ms: 70, next: null },
} as const;
export type Phase = "login" | keyof typeof cues;
const cameraDurations = {
  "--reveal-time": `${cues.revealing.ms}ms`,
  "--door-time": `${cues.entering.ms}ms`,
} as CSSProperties;

const motionQuery = "(prefers-reduced-motion: reduce)";
function watchMotion(update: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
const systemReducesMotion = () => window.matchMedia(motionQuery).matches;
const reduceBeforeHydration = () => true;

export default function EntrySequence({ captchaCode, expired }: { captchaCode: string; expired?: boolean }) {
  const router = useRouter();
  const prepareChatFade = useContext(PrepareChatFade);
  const [phase, setPhase] = useState<Phase>("login");
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(watchMotion, systemReducesMotion, reduceBeforeHydration);
  const motion = !reduced && !paused;
  const entry = useRef<HTMLElement>(null);
  const skip = useRef<HTMLButtonElement>(null);

  function acceptLogin() {
    preload(chatArtwork.ask, { as: "image" });
    router.prefetch(chatPath);
    setPhase(motion ? "revealing" : "black");
  }

  useEffect(() => {
    if (phase === "login") return;
    const { ms, next } = cues[phase];
    const timer = window.setTimeout(() => {
      if (motion && next) {
        setPhase(next);
      } else {
        prepareChatFade(motion);
        router.replace(chatPath);
      }
    }, motion ? ms : 0);
    return () => window.clearTimeout(timer);
  }, [phase, motion, prepareChatFade, router]);

  useEffect(() => {
    if (phase === "revealing") skip.current?.focus({ preventScroll: true });
    if (phase === "black") entry.current?.focus({ preventScroll: true });
  }, [phase]);

  const formVisible = phase === "login" || phase === "revealing";
  return (
    <main ref={entry} className={styles.entry} data-phase={phase} data-motion={motion ? "on" : "off"}
      style={cameraDurations} tabIndex={-1} aria-label="C-GPT entry">
      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {phase !== "login" && "Prototype sign-in accepted. Opening AI chat."}
      </span>
      {phase !== "black" && <>
        <PorchScene phase={phase} motion={motion} />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.shell}>
          <header className={styles.masthead}>
            <div className={styles.institute}>
              <span className={styles.doorMark} aria-hidden="true"><i /></span>
              <span>RV College of Engineering</span>
            </div>
            {phase === "login" ? (
              <button className={styles.utility} type="button" role="switch" aria-label="Scene motion"
                aria-checked={motion} disabled={reduced} onClick={() => setPaused(value => !value)}>
                <span className={styles.levels} aria-hidden="true"><i /><i /><i /><i /></span>
                {motion ? "Motion on" : "Motion off"}
              </button>
            ) : (
              <button ref={skip} className={styles.utility} type="button"
                onClick={() => { setPaused(true); setPhase("black"); }}>Skip sequence</button>
            )}
          </header>

          {formVisible && (
            <div className={styles.composition} inert={phase !== "login"}>
              <div className={styles.titleBlock}>
                <div className={styles.titleRule} aria-hidden="true"><i /><i /><i /></div>
                <h1 aria-label="C-GPT"><TitleLetters text="C-GPT" /></h1>
                <p className={styles.subtitle}>Local College Intelligence</p>
                <p className={styles.summary}>A private, offline AI assistant for campus data and documents.</p>
              </div>
              <LoginForm captchaCode={captchaCode} expired={expired} onSuccess={acceptLogin} />
            </div>
          )}

          <footer className={styles.foot}><span className={styles.campus}>Bengaluru, India</span></footer>
        </div>
        {motion && phase === "login" && <EmberCursor />}
      </>}
    </main>
  );
}
