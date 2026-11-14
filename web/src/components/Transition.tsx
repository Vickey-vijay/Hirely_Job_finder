import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Page transition: three coloured panels sweep up to cover the screen on exit
 * and peel away on enter, then content rises in with a small stagger.
 * Colours go blue → green → navy so every switch feels like a little moment.
 */
const COLORS = ["#1f5fd1", "#0e9f6e", "#0f2742"];

const panel = (i: number): Variants => ({
  initial: { scaleY: 1, originY: 0 },
  animate: { scaleY: 0, originY: 0, transition: { duration: 0.45, delay: 0.03 + i * 0.06, ease: [0.76, 0, 0.24, 1] } },
  exit: { scaleY: 1, originY: 1, transition: { duration: 0.35, delay: i * 0.05, ease: [0.76, 0, 0.24, 1] } },
});

const content: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export default function Transition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <motion.div initial="initial" animate="animate" exit="exit">
      <div className="curtain" aria-hidden>
        {COLORS.map((c, i) => (
          <motion.div key={c} variants={panel(i)} style={{ background: c }} />
        ))}
      </div>
      <motion.div variants={content}>{children}</motion.div>
    </motion.div>
  );
}

/** Staggered children helper for lists. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.4 } },
};
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
