import type { PointerEvent } from "react";

// Move light on the artwork alone. Text and controls stay still.
export function placeReadingLight(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse" ||
      !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;

  const surface = event.currentTarget;
  const bounds = surface.getBoundingClientRect();
  surface.style.setProperty("--light-x", `${Math.round(event.clientX - bounds.left)}px`);
  surface.style.setProperty("--light-y", `${Math.round(event.clientY - bounds.top)}px`);
}
