import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const items = [
  { to: "/dashboard", label: "Home" },
  { to: "/matches", label: "Matches" },
  { to: "/plans", label: "Plan" },
  { to: "/settings", label: "Settings" },
];

type Mode = "system" | "light" | "dark";
const THEME_KEY = "hirely-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The saved choice. Anything unreadable (private mode, blocked storage) counts as "match the device". */
function readMode(): Mode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* the choice still applies for this visit */
  }
}

function deviceIsDark() {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "Theme: match device", light: "Theme: light", dark: "Theme: dark" };

/** Sun or moon button that cycles device, light and dark, and remembers the choice. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(readMode);
  const [sysDark, setSysDark] = useState(deviceIsDark);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const onChange = () => setSysDark(deviceIsDark());
    try {
      mq = window.matchMedia(DARK_QUERY);
      mq.addEventListener("change", onChange);
    } catch {
      /* no media query support: the icon simply stays as it was */
    }
    return () => mq?.removeEventListener("change", onChange);
  }, []);

  const dark = mode === "dark" || (mode === "system" && sysDark);
  const cycle = () => {
    const next = NEXT[mode];
    setMode(next);
    applyMode(next);
  };

  return (
    <button type="button" className="theme-btn" onClick={cycle} aria-label={`${LABEL[mode]}. Click to change.`} title={LABEL[mode]}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}

export default function Nav() {
  const { pathname } = useLocation();
  return (
    <nav className="nav noprint" aria-label="Main">
      {items.map((it) => {
        const on = pathname.startsWith(it.to);
        return (
          <NavLink key={it.to} to={it.to} className={on ? "on" : ""}>
            {on && <motion.span layoutId="navpill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
            {it.label}
          </NavLink>
        );
      })}
      <ThemeToggle />
    </nav>
  );
}
