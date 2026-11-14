import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./auth";
import { useAccount } from "./account";
import Aurora from "./components/Aurora";
import Nav from "./components/Nav";
import Splash from "./components/Splash";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Plans from "./pages/Plans";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import Tailored from "./pages/Tailored";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import { Contact, Privacy, Refunds, Terms } from "./pages/Legal";

/** Signed-in pages. People who have not told us what they want yet are sent to the set-up steps first. */
function Private({ children, setup = false }: { children: JSX.Element; setup?: boolean }) {
  const { user, loading } = useAuth();
  const { account, loading: accLoading } = useAccount();
  if (loading || (user && accLoading)) return null; // checks in flight; avoids bouncing signed-in users around
  if (!user) return <Navigate to="/login" replace />;
  if (!setup && account && !account.profile.onboardedAt) return <Navigate to="/welcome" replace />;
  return children;
}

const APP_PATHS = ["/dashboard", "/matches", "/plans", "/settings"];

export default function App() {
  const [booting, setBooting] = useState(true);
  const done = useCallback(() => setBooting(false), []);
  const location = useLocation();
  const { user } = useAuth();
  const { config } = useAccount();
  const showNav = !!user && APP_PATHS.some((p) => location.pathname === p);

  return (
    <>
      <Aurora />
      {config?.billingMode === "mock" && <div className="testbar">Test mode: payments are simulated and no money is charged.</div>}
      <AnimatePresence>{booting && <Splash key="splash" onDone={done} />}</AnimatePresence>
      {!booting && (
        <>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/welcome" element={<Private setup><Onboarding /></Private>} />
              <Route path="/profile" element={<Private setup><Onboarding edit /></Private>} />
              <Route path="/plans" element={<Private><Plans /></Private>} />
              <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
              <Route path="/matches" element={<Private><Matches /></Private>} />
              <Route path="/matches/:id/resume" element={<Private><Tailored /></Private>} />
              <Route path="/settings" element={<Private><Settings /></Private>} />
              <Route path="/admin" element={<Private setup><Admin /></Private>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
          {showNav && <Nav />}
        </>
      )}
    </>
  );
}
