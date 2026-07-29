"use client";

import { useEffect, useState } from "react";
import { type MotionStyle, motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(true);

  const rawX = useMotionValue(-100);
  const rawY = useMotionValue(-100);

  const dotX = useSpring(rawX, { stiffness: 1000, damping: 50, mass: 0.1 });
  const dotY = useSpring(rawY, { stiffness: 1000, damping: 50, mass: 0.1 });

  const ringX = useSpring(rawX, { stiffness: 150, damping: 20, mass: 0.5 });
  const ringY = useSpring(rawY, { stiffness: 150, damping: 20, mass: 0.5 });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setIsTouch(false);

    function onMove(e: MouseEvent) {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
      if (!visible) setVisible(true);
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isTouch) return null;

  const base: MotionStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    pointerEvents: "none",
    borderRadius: "50%",
    opacity: visible ? 1 : 0,
    translateX: "-50%",
    translateY: "-50%",
  };

  return (
    <>
      <motion.div
        style={{ ...base, x: dotX, y: dotY, width: 8, height: 8, backgroundColor: "var(--site-fg)", zIndex: 9999 }}
      />
      <motion.div
        style={{ ...base, x: ringX, y: ringY, width: 34, height: 34, border: "1.5px solid var(--site-fg)", zIndex: 9998 }}
      />
    </>
  );
}
