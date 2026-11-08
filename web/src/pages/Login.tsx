import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../auth";
import Transition, { rise, stagger } from "../components/Transition";

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();

  // Placeholder: real Google OAuth arrives with the backend (PRD 6.1).
  const go = () => {
    signIn("Vickey");
    nav("/dashboard");
  };

  return (
    <Transition>
      <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <motion.div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} className="brand" style={{ justifyContent: "center" }}><i /> Hirely</motion.div>
          <motion.h2 variants={rise} style={{ margin: "18px 0 6px" }}>Welcome in.</motion.h2>
          <motion.p variants={rise} className="muted">One tap and we're set. No passwords to remember.</motion.p>
          <motion.div variants={rise} style={{ marginTop: 22 }}>
            <button className="btn" onClick={go}>Continue with Google</button>
          </motion.div>
          <motion.p variants={rise} className="muted" style={{ fontSize: 12, marginTop: 16 }}>
            Demo sign-in for now. Real Google login is coming with the backend.
          </motion.p>
        </motion.div>
      </main>
    </Transition>
  );
}
