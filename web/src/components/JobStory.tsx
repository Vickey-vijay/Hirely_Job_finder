import { createContext, useContext } from "react";
import { motion, motionValue, useAnimationFrame, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";

/*
 * A 13 second looping story, drawn as one inline SVG with Framer Motion.
 * Beats: a tired job seeker at a desk at night, a 9/10 alert arrives, the
 * seeker smiles, walks to an office door marked "Interview", and gets hired.
 * One clock (a motion value, set every frame) drives every track, so the loop is
 * exact and reproducible for recording. Colours are CSS variables (styles.css),
 * so the story follows dark mode. With reduced motion on, the still frame at
 * STILL is shown with every caption listed.
 */

/** Length of one loop, in seconds. */
const LOOP = 13;
/** The moment shown instead of the animation when the visitor prefers reduced motion. */
const STILL = 11.2;

const CAPTIONS: [string, number, number][] = [
  ["Hundreds of listings. None feel right.", 0, 2.6],
  ["Hirely finds one that fits.", 2.6, 5.2],
  ["Scored 9/10, with the reasons.", 5.2, 7.4],
  ["Applies the same day.", 7.4, 10],
  ["Gets the job.", 10, 13],
];

type Value = number | string;
type Pts = [number, Value][];

/** Makes a track run from 0 to the loop length, holding its end values. */
function fill(pts: Pts): Pts {
  const out: Pts = [...pts];
  if (out[0][0] > 0) out.unshift([0, out[0][1]]);
  const last = out[out.length - 1];
  if (last[0] < LOOP) out.push([LOOP, last[1]]);
  return out;
}

/** The value of a track at time t. Numbers move in a straight line between points; text steps. */
function valueAt(pts: Pts, t: number): Value {
  let prev = pts[0];
  for (const next of pts.slice(1)) {
    if (next[0] > t) {
      if (typeof prev[1] === "number" && typeof next[1] === "number" && next[0] > prev[0]) {
        return prev[1] + ((next[1] - prev[1]) * (t - prev[0])) / (next[0] - prev[0]);
      }
      return prev[1];
    }
    prev = next;
  }
  return prev[1];
}

/** Opacity track: hidden until `a`, fully shown from `a + fade` to `b - fade`, hidden at `b`. */
function on(a: number, b: number, fade = 0.3): Pts {
  return a === 0 ? [[0, 1], [b - fade, 1], [b, 0]] : [[0, 0], [a, 0], [a + fade, 1], [b - fade, 1], [b, 0]];
}

/** The loop clock, in seconds from 0 to LOOP. Shared by every element in the story. */
const ClockCtx = createContext<MotionValue<number>>(motionValue(STILL));

/** Live values for a set of tracks. Each one is a motion value that follows the clock. */
function useLive(tracks: Record<string, Pts>): Record<string, MotionValue<Value>> {
  const clock = useContext(ClockCtx);
  const out: Record<string, MotionValue<Value>> = {};
  for (const key of Object.keys(tracks)) {
    const pts = fill(tracks[key]);
    // The same keys are passed on every render, so the hook order never changes.
    out[key] = useTransform(clock, (t) => valueAt(pts, t));
  }
  return out;
}

const r2 = (n: number) => n.toFixed(2);

/* ---- Walk cycle ------------------------------------------------------- */

const HIP_Y = -60;
const LEG = 60;
const SHOULDER_Y = -106;
const SLEEVE = 12;
const FOREARM = 18;

/** Limb positions for a point p in the walk cycle (0 to 1). Coordinates are relative to the feet. */
function walkPose(p: number) {
  const a = 0.42 * Math.sin(2 * Math.PI * p);
  const leg = (hx: number, ang: number) => `M ${hx} ${HIP_Y} L ${r2(hx + LEG * Math.sin(ang))} ${r2(HIP_Y + LEG * Math.cos(ang))}`;
  const arm = (sx: number, ang: number) => {
    const ex = sx + SLEEVE * Math.sin(ang);
    const ey = SHOULDER_Y + SLEEVE * Math.cos(ang);
    const hx = ex + FOREARM * Math.sin(ang + 0.6);
    const hy = ey + FOREARM * Math.cos(ang + 0.6);
    return { sleeve: `M ${sx} ${SHOULDER_Y} L ${r2(ex)} ${r2(ey)}`, fore: `M ${r2(ex)} ${r2(ey)} L ${r2(hx)} ${r2(hy)}` };
  };
  const l = arm(-22, -0.8 * a);
  const rr = arm(22, 0.8 * a);
  return { legL: leg(-9, a), legR: leg(9, -a), sleeveL: l.sleeve, foreL: l.fore, sleeveR: rr.sleeve, foreR: rr.fore };
}

/** Two full strides over the walking beat, sampled 12 times per stride. */
const WALK_SAMPLES = Array.from({ length: 25 }, (_, i) => ({ t: 7.4 + (i * 2.6) / 24, ...walkPose((i / 12) % 1) }));
function walkTrack(k: keyof ReturnType<typeof walkPose>): Pts {
  return WALK_SAMPLES.map((s) => [s.t, s[k]] as [number, Value]);
}

/* ---- Figures ---------------------------------------------------------- */

/** Anime-style head, centred on (0, 0). The face is an oval with big eyes and a fringe. */
function Head({ mood, hair = "js-hair", bun = false }: { mood: "open" | "tired" | "smile" | "excited"; hair?: string; bun?: boolean }) {
  return (
    <g>
      {bun && <circle cx={0} cy={-41} r={10} className={hair} />}
      <path className={hair} d="M-34 2 C-40 -40 -18 -43 0 -43 C18 -43 40 -40 34 2 L32 40 L-32 40 Z" />
      <ellipse className="js-skin" cx={-27} cy={6} rx={4.5} ry={6.5} />
      <ellipse className="js-skin" cx={27} cy={6} rx={4.5} ry={6.5} />
      <ellipse className="js-skin" cx={0} cy={0} rx={27} ry={29} />
      <path className={hair} d="M-29 4 C-31 -26 -10 -36 6 -31 C14 -29 22 -22 29 4 C22 -8 14 -14 4 -16 C-6 -10 -18 -8 -29 4 Z" />
      {[-10, 10].map((cx) => {
        if (mood === "tired") {
          return (
            <g key={cx}>
              <ellipse className="js-eye" cx={cx} cy={5} rx={4.6} ry={3.6} />
              <rect className="js-skin" x={cx - 5.5} y={0.5} width={11} height={3.6} />
            </g>
          );
        }
        if (mood === "smile" || mood === "excited") {
          return <path key={cx} className="js-l-eye" d={`M${cx - 5.5} 6 Q${cx} 0 ${cx + 5.5} 6`} />;
        }
        return (
          <g key={cx}>
            <ellipse className="js-eye" cx={cx} cy={4} rx={4.6} ry={6.2} />
            <circle cx={cx + 1.4} cy={1.6} r={1.8} fill="#ffffff" />
          </g>
        );
      })}
      {(mood === "smile" || mood === "excited") && (
        <>
          <ellipse className="js-blush" cx={-16} cy={12} rx={4.5} ry={2.6} />
          <ellipse className="js-blush" cx={16} cy={12} rx={4.5} ry={2.6} />
        </>
      )}
      {mood === "tired" && <path className="js-l-mouth" d="M-3.5 15 L3.5 15" />}
      {mood === "open" && <path className="js-l-mouth" d="M-3 13 Q0 15.5 3 13" />}
      {mood === "smile" && <path className="js-l-mouth" d="M-6 12 Q0 19 6 12" />}
      {mood === "excited" && <path className="js-eye" d="M-7 11 Q0 22 7 11 Z" />}
    </g>
  );
}

/** The seated figure at the desk: tired, then smiling. The head is swapped by opacity. */
function Sitter() {
  const tired = useLive({ opacity: on(0, 5.25, 0.05) });
  const smile = useLive({ opacity: on(5.25, 7.4, 0.1) });
  return (
    <>
      <path className="js-shirt" d="M166 214 L170 160 Q170 150 182 150 L218 150 Q230 150 230 160 L234 214 Z" />
      <rect className="js-skin" x={194} y={140} width={12} height={16} />
      <motion.g style={{ opacity: tired.opacity }}>
        <g transform="translate(200 124)"><Head mood="tired" /></g>
      </motion.g>
      <motion.g style={{ opacity: smile.opacity }}>
        <g transform="translate(200 124)"><Head mood="smile" /></g>
      </motion.g>
    </>
  );
}

/** A figure that stands still, with one arm reaching toward the other person. Feet at (0, 0). */
function StandingBody({ mood, hair, bun, arm, suit }: { mood: "smile" | "excited"; hair?: string; bun?: boolean; arm: "left" | "right"; suit?: boolean }) {
  const body = suit ? "js-suit" : "js-shirt";
  const line = suit ? "js-l-suit" : "js-l-shirt";
  const s = arm === "right" ? 1 : -1; // the reaching arm's side
  return (
    <>
      <path className={suit ? "js-l-suit" : "js-l-pants"} d={suit ? "M-8 -60 L-8 0 M8 -60 L8 0" : "M-9 -60 L-9 0 M9 -60 L9 0"} />
      <rect className={body} x={-22} y={-112} width={44} height={60} rx={14} />
      <rect className="js-skin" x={-6} y={-118} width={12} height={12} />
      <g transform="translate(0 -140)"><Head mood={mood} hair={hair} bun={bun} /></g>
      {suit && <path className="js-paper" d="M-7 -112 L0 -98 L7 -112 Z" />}
      {suit && <path className="js-accent" d="M-2.5 -110 L2.5 -110 L3.5 -92 L0 -88 L-3.5 -92 Z" />}
      {/* relaxed arm at the side */}
      <path className={line} d={`M${-22 * s} -106 L${-26 * s} -82`} />
      <path className="js-l-skin" d={`M${-26 * s} -82 L${-24 * s} -58`} />
      {/* reaching arm: sleeve, then forearm to the handshake */}
      <path className={line} d={`M${22 * s} -106 L${34 * s} -106`} />
      <path className="js-l-skin" d={`M${34 * s} -106 L${52 * s} -104`} />
      <circle className="js-skin" cx={52 * s} cy={-104} r={5.5} />
    </>
  );
}

/** The walking figure, drawn from its feet. Limbs follow the walk cycle, and the figure moves across the street. */
function Walker() {
  const pose = useLive({
    legL: walkTrack("legL"), legR: walkTrack("legR"), sleeveL: walkTrack("sleeveL"),
    foreL: walkTrack("foreL"), sleeveR: walkTrack("sleeveR"), foreR: walkTrack("foreR"),
  });
  const move = useLive({ opacity: on(7.4, 10, 0.3), x: [[7.4, 40], [10, 236]] });
  return (
    <motion.g style={{ opacity: move.opacity, x: move.x }}>
      <g transform="translate(0 238)">
        <motion.path className="js-l-pants" d={pose.legL} />
        <motion.path className="js-l-pants" d={pose.legR} />
        <rect className="js-shirt" x={-22} y={-112} width={44} height={60} rx={14} />
        <rect className="js-skin" x={-6} y={-118} width={12} height={12} />
        <g transform="translate(0 -140)"><Head mood="open" /></g>
        <motion.path className="js-l-shirt" d={pose.sleeveL} />
        <motion.path className="js-l-skin" d={pose.foreL} />
        <motion.path className="js-l-shirt" d={pose.sleeveR} />
        <motion.path className="js-l-skin" d={pose.foreR} />
      </g>
    </motion.g>
  );
}

/* ---- Scenes ----------------------------------------------------------- */

function DeskScene() {
  const desk = useLive({ opacity: on(0, 7.4) });
  const buzz = useLive({ x: [[2.6, 0], [2.7, -3], [2.8, 3], [2.9, -3], [3.0, 3], [3.1, 0]] });
  const card = useLive({ opacity: [[0, 0], [2.6, 0], [3.0, 1], [5.0, 1], [5.3, 0]], y: [[0, -30], [2.6, -30], [3.0, 0], [5.0, 0], [5.3, -14]] });
  const sparkles = useLive({ opacity: on(5.3, 7.4, 0.2) });
  return (
    <motion.g style={{ opacity: desk.opacity }}>
      <rect className="js-wall" width={420} height={280} />
      {/* night window with a moon */}
      <rect className="js-frame" x={24} y={14} width={84} height={66} rx={8} />
      <rect className="js-sky" x={30} y={20} width={72} height={54} rx={4} />
      <circle className="js-moon" cx={84} cy={38} r={8} />
      <circle className="js-moon" cx={44} cy={34} r={1.5} />
      <circle className="js-moon" cx={56} cy={60} r={1.2} />
      {/* desk lamp */}
      <circle className="js-glow" cx={86} cy={150} r={52} opacity={0.22} />
      <path className="js-l-metal" d="M60 140 L46 200" />
      <path className="js-accent" d="M54 128 L84 116 L92 134 L62 142 Z" />
      <rect className="js-metal" x={36} y={198} width={24} height={6} rx={2} />

      <Sitter />

      {/* laptop lid, seen from behind, in front of the body */}
      <rect className="js-phone" x={172} y={160} width={56} height={40} rx={5} />
      <circle className="js-glow" cx={200} cy={180} r={4} />
      {/* the tired arm propped on the laptop, hand on the cheek */}
      <path className="js-l-shirt" d="M170 166 L160 194" />
      <path className="js-l-skin" d="M160 194 L182 138" />
      <circle className="js-skin" cx={183} cy={136} r={6} />

      {/* desk top and legs */}
      <rect className="js-wood" x={30} y={204} width={370} height={12} rx={4} />
      <rect className="js-wood-dark" x={44} y={216} width={10} height={60} />
      <rect className="js-wood-dark" x={376} y={216} width={10} height={60} />
      <rect className="js-paper" x={118} y={186} width={18} height={18} rx={3} />

      {/* the pile of applications */}
      <rect className="js-paper" x={344} y={180} width={44} height={6} />
      <rect className="js-paper" x={336} y={186} width={54} height={6} />
      <rect className="js-paper" x={340} y={192} width={52} height={12} />

      {/* the phone buzzes at 2.6 seconds */}
      <motion.g style={{ x: buzz.x }}>
        <rect className="js-phone" x={292} y={150} width={26} height={54} rx={6} />
        <rect className="js-screen" x={296} y={156} width={18} height={40} rx={3} />
      </motion.g>

      <motion.g style={{ opacity: sparkles.opacity }}>
        {[[250, 100], [152, 104], [240, 74]].map(([x, y]) => (
          <path key={`${x}-${y}`} className="js-accent" transform={`translate(${x} ${y})`} d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" />
        ))}
      </motion.g>

      {/* the notification slides in */}
      <motion.g style={{ opacity: card.opacity, y: card.y }}>
        <rect className="js-card" x={24} y={10} width={372} height={74} rx={14} />
        <circle className="js-badge" cx={52} cy={47} r={17} />
        <text className="js-badge-text" x={52} y={53.5}>9</text>
        <text className="js-ink story-text" x={84} y={34} fontSize={15} fontWeight={800}>Hirely · 9/10 match</text>
        <text className="js-ink story-text" x={84} y={53} fontSize={14} fontWeight={700}>Frontend Developer</text>
        <text className="js-ink-soft story-text" x={84} y={71} fontSize={12.5} fontWeight={500}>Northwind Labs, Bengaluru</text>
      </motion.g>
    </motion.g>
  );
}

const DOOR = "M316 238 V176 Q316 156 340 156 Q364 156 364 176 V238 Z";

function StreetScene() {
  const street = useLive({ opacity: on(7.4, 12.9) });
  const road = useLive({ opacity: on(7.4, 10, 0.3), x: [[7.4, 0], [10, -60]] });
  return (
    <motion.g style={{ opacity: street.opacity }}>
      <rect className="js-sky-dusk" width={420} height={240} />
      <rect className="js-building" x={250} y={36} width={150} height={202} rx={4} />
      {[[266, 64], [266, 100], [366, 64], [366, 100]].map(([x, y]) => (
        <rect key={`${x}-${y}`} className="js-window" x={x} y={y} width={28} height={22} rx={3} />
      ))}
      <path className="js-door" d={DOOR} />
      <rect className="js-sign" x={292} y={128} width={96} height={22} rx={11} />
      <text className="js-sign-text story-text" x={340} y={143} textAnchor="middle" fontSize={12} fontWeight={700}>Interview</text>
      <rect className="js-ground" x={0} y={238} width={420} height={42} />

      {/* road markings slide past while the seeker walks */}
      <motion.g style={{ opacity: road.opacity, x: road.x }}>
        {Array.from({ length: 9 }, (_, i) => i * 60).map((x) => (
          <rect key={x} className="js-dash" x={x} y={258} width={26} height={3} rx={1.5} />
        ))}
      </motion.g>

      <Walker />
    </motion.g>
  );
}

/** One confetti piece: bursts out from the handshake, then falls. */
function ConfettiPiece({ dx, dy, color }: { dx: number; dy: number; color: number }) {
  const p = useLive({
    x: [[10.6, 0], [11.7, dx], [12.6, dx * 1.05]],
    y: [[10.6, 0], [11.4, dy], [12.6, dy + 70]],
    opacity: [[0, 0], [10.55, 0], [10.6, 1], [11.9, 1], [12.6, 0]],
  });
  return (
    <motion.g style={{ x: p.x, y: p.y, opacity: p.opacity }}>
      <rect className={`js-c${color}`} x={-3} y={-4.5} width={6} height={9} rx={1.5} />
    </motion.g>
  );
}

function LobbyScene() {
  const lobby = useLive({ opacity: on(10, 12.9) });
  const hired = useLive({ opacity: on(10.5, 12.9, 0.25), y: [[10.5, 12], [10.9, 0]] });
  const pieces = Array.from({ length: 14 }, (_, i) => {
    const th = -Math.PI + ((i + 0.5) * Math.PI) / 14;
    const dist = 60 + (i % 3) * 18;
    return { dx: Math.cos(th) * dist, dy: Math.sin(th) * dist - 10, color: (i % 4) + 1 };
  });
  return (
    <motion.g style={{ opacity: lobby.opacity }}>
      {/* the office door is open, with light inside */}
      <path className="js-lobby" d={DOOR} />
      <g transform="translate(236 238)"><StandingBody mood="excited" arm="right" /></g>
      <g transform="translate(340 238)"><StandingBody mood="smile" hair="js-hair-alt" bun suit arm="left" /></g>
      <motion.g style={{ opacity: hired.opacity, y: hired.y }}>
        <rect className="js-hired" x={132} y={20} width={160} height={38} rx={19} />
        <text className="js-hired-text story-text" x={212} y={45} textAnchor="middle" fontSize={18} fontWeight={800}>{"You're hired!"}</text>
      </motion.g>
      <g transform="translate(288 134)">
        {pieces.map((p, i) => <ConfettiPiece key={i} dx={p.dx} dy={p.dy} color={p.color} />)}
      </g>
    </motion.g>
  );
}

/** One caption. All of them share one grid cell, so the tallest sets the height and nothing jumps. */
function StoryCaption({ text, a, b }: { text: string; a: number; b: number }) {
  const cap = useLive({ opacity: on(a, b, 0.25) });
  return <motion.p className="story-cap" style={{ opacity: cap.opacity }}>{text}</motion.p>;
}

/* ---- Component -------------------------------------------------------- */

export default function JobStory({ bare = false }: { bare?: boolean }) {
  const still = !!useReducedMotion();
  const clock = useMotionValue(still ? STILL : 0);
  // Set the clock from the frame time, so the loop follows the screen's animation frames.
  useAnimationFrame((ms) => {
    if (!still) clock.set((ms / 1000) % LOOP);
  });

  return (
    <ClockCtx.Provider value={clock}>
      <div className={`story${bare ? " story-bare" : ""}`}>
        <div className="story-frame">
          <svg
            className="story-svg"
            viewBox="0 0 420 280"
            role="img"
            aria-label="Animated story: a tired job seeker gets a 9 out of 10 match, walks to an interview and is hired."
          >
            <DeskScene />
            <StreetScene />
            <LobbyScene />
          </svg>
        </div>

        {still ? (
          <ol className="story-caps-still">
            {CAPTIONS.map(([text]) => <li key={text}>{text}</li>)}
          </ol>
        ) : (
          <>
            <div className="story-caps" aria-hidden="true">
              {CAPTIONS.map(([text, a, b]) => <StoryCaption key={text} text={text} a={a} b={b} />)}
            </div>
            <ul className="sr">
              {CAPTIONS.map(([text]) => <li key={text}>{text}</li>)}
            </ul>
          </>
        )}
      </div>
    </ClockCtx.Provider>
  );
}
