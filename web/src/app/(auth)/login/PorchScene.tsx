"use client";

import { useEffect, useRef } from "react";
import type { Phase } from "./EntrySequence";
import styles from "./porch.module.css";

export default function PorchScene({ phase, motion }: { phase: Phase; motion: boolean }) {
  return (
    <div className={styles.scene} data-phase={phase} data-motion={motion ? "on" : "off"} aria-hidden="true">
      <div className={styles.cover}>
        <div className={styles.push}>
          <div className={styles.focus}>
            <div className={styles.drift}>
              <div className={styles.plate}>
                <div className={`${styles.lamp} ${styles.leftLamp}`} />
                <div className={`${styles.lamp} ${styles.rightLamp}`} />
                <div className={`${styles.patch} ${styles.ankle}`} />
                <div className={`${styles.patch} ${styles.fingers}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.dark} />
    </div>
  );
}

// A small light follows beside the native cursor only over non-interactive space.
export function EmberCursor() {
  const ember = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dot = ember.current;
    if (!dot) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let x = 0;
    let y = 0;
    function hide() {
      if (dot) dot.style.opacity = "0";
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    function move(event: PointerEvent) {
      if (!dot || !fine.matches || event.pointerType !== "mouse" ||
          (event.target instanceof Element && event.target.closest("form, button, a, input, textarea, select"))) {
        hide();
        return;
      }
      x = event.clientX + 9;
      y = event.clientY + 10;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        dot.style.opacity = "0.75";
        frame = 0;
      });
    }
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return <span className={styles.ember} ref={ember} aria-hidden="true" />;
}
