import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";

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
    <main className="centered-page">
      <section className="empty-state" aria-labelledby="not-found-title">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">That page is not in the deck.</h1>
        <p>Return home to create a room or join one with a valid room code.</p>
        <Link className="button button-primary" to="/">
          Back home
        </Link>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <ScrollToTop />
      <Suspense
        fallback={
          <main className="centered-page" id="main-content">
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden="true" />
              <p>Loading Planning Poker…</p>
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
    </>
  );
}
