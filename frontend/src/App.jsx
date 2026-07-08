import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import SiteFooter from "./components/SiteFooter.jsx";
import WelcomeIntro from "./components/WelcomeIntro.jsx";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const RoomPage = lazy(() => import("./pages/RoomPage.jsx"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function NotFoundPage() {
  return (
    <div className="state-shell">
      <main className="centered-page">
        <section className="empty-state" aria-labelledby="not-found-title">
          <p className="error-code" aria-hidden="true">
            404
          </p>
          <p className="eyebrow">A card went rogue</p>
          <h1 id="not-found-title">This page folded early.</h1>
          <p>Nothing sinister. It is simply not in this deck.</p>
          <Link className="button button-primary" to="/">
            Return to the table
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const [showWelcome] = useState(() => pathname === "/");

  return (
    <>
      {showWelcome ? <WelcomeIntro /> : null}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <ScrollToTop />
      <Suspense
        fallback={
          <main className="centered-page" id="main-content">
            <div className="route-loading" role="status">
              Taking your seat…
            </div>
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/:sessionId" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Analytics />
    </>
  );
}
