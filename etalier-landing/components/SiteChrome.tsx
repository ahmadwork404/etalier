import { Brand, Icon, Star } from "./Icons";
import { PortalLink } from "./PortalLink";
export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header website-header">
        <a className="brand-link" href="/" aria-label="Etalier home">
          <Brand />
        </a>
        <nav className="website-nav" aria-label="Main navigation">
          <details className="product-menu">
            <summary>
              Product <Icon name="chevron" size={14} />
            </summary>
            <div className="product-dropdown">
              <a href="/product">
                Explore Etalier <span>The whole workspace</span>
              </a>
              <a href="/features/front-desk">
                Front desk <span>Walk-ins, payments & receipts</span>
              </a>
              <a href="/features/bookings">
                Bookings <span>Appointments & calendar</span>
              </a>
              <a href="/features/customer-records">
                Customers <span>Profiles & intake forms</span>
              </a>
              <a href="/features/team-payroll">
                Your team <span>Hours, leave & payroll</span>
              </a>
            </div>
          </details>
          <a href="/about">About</a>
          <a href="/blogs">Journal</a>
          <a href="/pricing">Getting started</a>
        </nav>
        <div className="header-actions">
          <PortalLink className="sign-in">
            Log in <Icon name="arrow" size={16} />
          </PortalLink>
          <a className="button small yellow" href="/contact">
            Let’s talk <Icon name="arrow" size={16} />
          </a>
        </div>
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer website-footer">
      <div className="website-footer-grid">
        <div>
          <a href="/" aria-label="Etalier home">
            <Brand />
          </a>
          <p>
            The workspace behind
            <br />a well-run salon.
          </p>
        </div>
        <nav aria-label="Product links">
          <strong>The workspace</strong>
          <a href="/product">Product overview</a>
          <a href="/features/front-desk">Front desk</a>
          <a href="/features/bookings">Bookings & calendar</a>
          <a href="/features/customer-records">Customer records</a>
          <a href="/features/team-payroll">Team & payroll</a>
        </nav>
        <nav aria-label="Company links">
          <strong>Etalier</strong>
          <a href="/about">About us</a>
          <a href="/blogs">The salon journal</a>
          <a href="/pricing">Getting started</a>
          <a href="/security">Security & data</a>
          <a href="/contact">Contact us</a>
        </nav>
        <div className="footer-note">
          <Star />
          <p>
            More time for the chair.
            <br />A clearer view of the business.
          </p>
          <PortalLink>Open your workspace ↗</PortalLink>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Etalier.</span>
        <span>Made around your craft.</span>
        <a href="#main">Back to top ↑</a>
      </div>
    </footer>
  );
}
export function ContactCTA({
  title = "See how it fits your salon.",
  text = "Bring your real workflow. We’ll walk through bookings, customers and the team with you.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="editorial-cta">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
        <a className="button yellow" href="/contact">
          Arrange a walkthrough <Icon name="arrow" />
        </a>
      </div>
      <Star />
    </section>
  );
}
