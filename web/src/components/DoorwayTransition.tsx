"use client";

import { createContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./doorway-transition.module.css";

export const chatPath = "/ai-assistant";
export const PrepareChatFade = createContext<(animate: boolean) => void>(() => {});

// The root layout survives the route change. Hold the same black frame until
// the destination renders, so a slow navigation cannot reveal a flash of UI.
export default function DoorwayTransition({ children }: { children: ReactNode }) {
  const [covered, setCovered] = useState(false);
  const pathname = usePathname();
  return (
    <PrepareChatFade.Provider value={setCovered}>
      {children}
      {covered && <div
        aria-hidden="true"
        className={styles.curtain}
        data-arrived={pathname !== "/login" || undefined}
        onAnimationEnd={() => setCovered(false)}
      />}
    </PrepareChatFade.Provider>
  );
}
