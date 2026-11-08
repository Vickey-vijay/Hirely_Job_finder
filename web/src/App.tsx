import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./auth";
import Aurora from "./components/Aurora";
import Nav from "./components/Nav";
import Splash from "./components/Splash";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import Settings from "./pages/Settings";

function Private({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const done = useCallback(() => setBooting(false), []);
  const location = useLocation();
  const { user } = useAuth();
  const showNav = !!user && ["/dashboard", "/matches", "/settings"].includes(location.pathname);

  return (
    <>
      <Aurora />
      <AnimatePresence>{booting && <Splash key="splash" onDone={done} />}</AnimatePresence>
      {!booting && (
        <>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
              <Route path="/matches" element={<Private><Matches /></Private>} />
              <Route path="/settings" element={<Private><Settings /></Private>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
          {showNav && <Nav />}
        </>
      )}
    </>
  );
}
