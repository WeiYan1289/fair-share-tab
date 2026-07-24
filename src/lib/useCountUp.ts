"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates an integer (sen) from 0 up to `target` over ~400ms ease-out on
 * mount/target-change (Screen Spec P4-01 note: "balance counts up, 400ms
 * ease-out, on load"). Money is still only ever formatted at render time —
 * this just interpolates the raw integer.
 */
export function useCountUp(target: number, durationMs = 400): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
}
