import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const items = [
  { to: "/dashboard", label: "Home" },
  { to: "/matches", label: "Matches" },
  { to: "/plans", label: "Plan" },
  { to: "/settings", label: "Settings" },
];

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
    </nav>
  );
}
