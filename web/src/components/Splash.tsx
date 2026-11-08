import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Orb from "./Orb";
import { messages } from "../data";

/** First-load screen: a pulsing orb and friendly rotating lines. */
export default function Splash({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const rot = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 650);
    const end = setTimeout(onDone, 2400);
    return () => { clearInterval(rot); clearTimeout(end); };
  }, [onDone]);

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5 } }}
    >
      <Orb />
      <h2>Hirely</h2>
      <div style={{ height: 24 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            className="muted"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {messages[i]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
