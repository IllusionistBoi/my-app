import { ArrowUpRight } from "@phosphor-icons/react";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <p className="footer-kicker">Built by Ronit Dahiya</p>
          <p className="footer-statement">
            Better estimates. Fewer meetings that should have been a message.
          </p>
        </div>
        <nav className="footer-links" aria-label="Project links">
          <a href="https://illusionistboi.github.io/" rel="noreferrer" target="_blank">
            Portfolio <ArrowUpRight aria-hidden="true" size={16} weight="bold" />
          </a>
          <a
            href="https://github.com/IllusionistBoi/my-app"
            rel="noreferrer"
            target="_blank"
          >
            Source <ArrowUpRight aria-hidden="true" size={16} weight="bold" />
          </a>
        </nav>
      </div>
      <div className="footer-meta">
        <p>Occasionally estimates responsibly.</p>
        <p>© 2026 Ronit Dahiya</p>
      </div>
    </footer>
  );
}
