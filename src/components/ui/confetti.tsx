"use client";

import { useEffect, useState } from "react";

const COLORS = ["#B08D00", "#C9A227", "#EFE3B8", "#5C4033", "#22c55e"];

/**
 * Lightweight celebration confetti — pure CSS, no dependency, no canvas.
 * Renders once then removes itself. Respects prefers-reduced-motion via globals.css.
 */
export function Confetti({ count = 60, duration = 3200 }: { count?: number; duration?: number }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (gone) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.9;
        const dur = 2 + Math.random() * 1.4;
        const size = 6 + Math.random() * 7;
        const color = COLORS[i % COLORS.length];
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            className="animate-confetti absolute top-[-12px] block"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 0.5}px`,
              backgroundColor: color,
              transform: `rotate(${rotate}deg)`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              borderRadius: "1px",
            }}
          />
        );
      })}
    </div>
  );
}
