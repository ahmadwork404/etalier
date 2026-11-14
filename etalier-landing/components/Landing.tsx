"use client";
import { useEffect, useState } from "react";
import { Brand, Icon, Star } from "./Icons";
import { ProductPreview } from "./ProductPreview";
const app = (
  process.env.NEXT_PUBLIC_APP_URL || "https://portal.etalier.app"
).replace(/\/$/, "");
const faqs = [
  [
    "Who is Etalier for?",
    "Etalier brings the day-to-day work of hair salons, barber shops, and beauty studios into one workspace. It works for independent professionals and teams with more than one location.",
  ],
  [
    "Can we manage appointments and walk-ins together?",
    "Yes. Scheduled bookings and completed Quick Work visits appear together in Bookings. Walk-ins also appear on the calendar as completed visits, so you can see the whole day.",
  ],
  [
    "How does payroll work?",
    "Choose daily, weekly, 15-day, or monthly payroll periods. Etalier prepares drafts from monthly base salary and accrued commission, with paid or unpaid leave, bonuses, and explained deductions. You review the calculation before recording it as paid.",
  ],
  [
    "Can I keep customer preferences and form answers?",
    "Customer profiles bring together visit history, preferences, photos, and intake form responses. Reusable intake forms let you collect answers through time-limited links and review them in your workspace.",
  ],
  [
    "Can I manage multiple salon locations?",
    "Yes. Each location has its own team, bookings, and performance view. Location availability and team access follow your workspace configuration and plan.",
  ],
  [
    "Does recording a payment charge the customer?",
    "Payment records track money you have already received, including payments made in advance. Recording a visit or an invoice does not itself charge a card or transfer money.",
  ],
];
function ArrowLink({
  children,
  href = "/contact",
  className = "button yellow",
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <a className={className} href={href}>
      {children}
      <Icon name="arrow" size={20} />
    </a>
  );
}
export default function Landing() {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document
      .querySelectorAll("[data-reveal]")
      .forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand-link" href="#" aria-label="Etalier home">
          <Brand />
        </a>
        <nav
          aria-label="Main navigation"
          className={menu ? "main-nav open" : "main-nav"}
        >
          <a href="#product" onClick={() => setMenu(false)}>
            The product
            <Icon name="chevron" size={14} />
          </a>
          <a href="#your-day" onClick={() => setMenu(false)}>
            Your day, in sync
          </a>
          <a href="#for-you" onClick={() => setMenu(false)}>
            For your salon
          </a>
          <a href="#questions" onClick={() => setMenu(false)}>
            Questions?
          </a>
          <a href="/contact">Contact us</a>
        </nav>
        <div className="header-actions">
          <a className="sign-in" href={app + "/login"}>
            Log in
            <Icon name="arrow" size={16} />
          </a>
          <ArrowLink className="button small yellow">Get started</ArrowLink>
          <button
            className="menu-toggle"
            aria-expanded={menu}
            aria-label={menu ? "Close menu" : "Open menu"}
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-label">
            <Star />A GOOD DAY STARTS HERE
          </div>
          <div className="hero-heading-wrap">
            <span className="hero-doodle doodle-left">
              <Star />
            </span>
            <h1>
              Your salon.
              <br />
              <span>
                All together.
                <svg
                  viewBox="0 0 640 38"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M8 23C153 5 425 7 627 21M31 31c197-13 365-12 563-1" />
                </svg>
              </span>
            </h1>
            <svg
              className="hero-doodle doodle-right"
              viewBox="0 0 100 130"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M19 10c67 19 80 54 27 63-32 6-41-34-14-32 28 3 20 49-2 76m-10-15 8 17 19-10"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="hero-description">
            Bookings, walk-ins, your people, and all the little details.
            <br className="desktop-break" /> A beautifully joined-up workspace
            for your salon.
          </p>
          <div className="hero-actions">
            <ArrowLink>Bring your salon together</ArrowLink>
            <a className="text-action" href="/contact">
              <span className="play-circle">
                <Icon name="play" size={13} />
              </span>
              Take a little look
            </a>
          </div>
          <p className="hero-note">
            <Icon name="check" size={14} />
            Built around the way salons work.
          </p>
          <ProductPreview />
        </section>
        <section className="made-for" aria-label="Made for your business">
          <span>
            GREAT HAIR.
            <br />
            GOOD COMPANY.
          </span>
          <div>
            <Icon name="scissors" size={25} />
            Hair studios
          </div>
          <div>
            <Icon name="sparkle" size={25} />
            Beauty spaces
          </div>
          <div>
            <Icon name="sun" size={25} />
            Barber shops
          </div>
          <div>
            <Icon name="people" size={25} />
            Growing teams
          </div>
        </section>
        <section id="product" className="features section-space">
          <div className="section-heading" data-reveal>
            <div>
              {/* <span className="eyebrow">
                LESS RUNNING AROUND. MORE RUNNING YOUR SALON.
              </span> */}
              <h2>
                Everything clicks.
                <br />
                Your day just flows.
              </h2>
            </div>
            <p>
              From the first appointment to the last invoice,
              <br className="desktop-break" /> give every part of your business
              a place to belong.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card" data-reveal>
              <div className="feature-art art-yellow">
                <div className="mini-walkin-card">
                  <div>
                    <span className="mini-square">
                      <Icon name="bolt" size={20} />
                    </span>
                    <span>
                      A new face?<strong>You’re ready.</strong>
                    </span>
                  </div>
                  <div className="mini-walkin-services">
                    <span>
                      <Icon name="check" size={12} />
                      Cut & finish
                    </span>
                    <span>
                      <Icon name="plus" size={12} />
                      Add a service
                    </span>
                  </div>
                  <div className="mini-walkin-bottom">
                    <span>
                      Total received<strong>€65.00</strong>
                    </span>
                    <span className="round-arrow">
                      <Icon name="arrow" size={20} />
                    </span>
                  </div>
                </div>
                <Star className="feature-star" />
              </div>
              {/* <span className="feature-number">01 / THE FRONT DESK</span> */}
              <h3>Keep the good days moving.</h3>
              <p>
                Welcome a walk-in, choose the services, record the payment. A
                few thoughtful taps, and you’re back with your customer.
              </p>
              <a href="/contact" className="feature-link">
                Meet Quick Work
                <Icon name="arrow" size={18} />
              </a>
            </article>
            <article className="feature-card" data-reveal>
              <div className="feature-art art-mint">
                <div className="mini-client-card">
                  <div className="client-photo">
                    <img
                      src="https://images.unsplash.com/photo-1552334949-51934e5f2d38?fm=jpg&w=200&h=200&fit=crop&q=80"
                      alt="Illustrative customer portrait"
                      loading="lazy"
                    />
                    <span className="client-heart">
                      <Icon name="heart" size={14} />
                    </span>
                  </div>
                  <strong>Emma Laurent</strong>
                  <small>A little more personal.</small>
                  <div>
                    <span>Warm tones</span>
                    <span>Soft finish</span>
                  </div>
                  <p>
                    <Icon name="check" size={13} />
                    Consultation complete
                  </p>
                </div>
                <span className="hand-note">
                  Remember the
                  <br />
                  little things.
                </span>
              </div>
              {/* <span className="feature-number">
                02 / THE CUSTOMER EXPERIENCE
              </span> */}
              <h3>Make every visit feel personal.</h3>
              <p>
                Preferences, past visits, photos, and form answers. Keep the
                details close, so your customers always feel remembered.
              </p>
              <a href="/contact" className="feature-link">
                A closer look at customers
                <Icon name="arrow" size={18} />
              </a>
            </article>
            <article className="feature-card" data-reveal>
              <div className="feature-art art-peach">
                <div className="mini-payroll-card">
                  <div>
                    <span>YOUR TEAM, TAKEN CARE OF</span>
                    <span className="draft-pill">Draft</span>
                  </div>
                  <h4>Good work adds up.</h4>
                  <p>
                    <span>Base salary</span>
                    <strong>€2,800</strong>
                  </p>
                  <p>
                    <span>Commission</span>
                    <strong>+ €185</strong>
                  </p>
                  <div className="mini-payroll-line" />
                  <p className="mini-payroll-total">
                    <span>Ready to review</span>
                    <strong>€2,985</strong>
                  </p>
                </div>
                <svg
                  className="little-squiggle"
                  viewBox="0 0 90 90"
                  aria-hidden="true"
                >
                  <path d="M10 72C15 5 89 8 66 50 49 82 22 30 74 14m-9-4 15 1-4 14" />
                </svg>
              </div>
              {/* <span className="feature-number">03 / THE PEOPLE BEHIND IT</span> */}
              <h3>Look after your team, too.</h3>
              <p>
                Working hours, leave, commission, and payroll drafts. Give the
                people who make your salon a clear picture of their day.
              </p>
              <a href="/contact" className="feature-link">
                Bring the team together
                <Icon name="arrow" size={18} />
              </a>
            </article>
          </div>
        </section>
        <section className="day-story" id="your-day">
          <div className="day-story-top" data-reveal>
            {/* <span className="eyebrow">LITTLE MOMENTS. ONE HAPPY FLOW.</span> */}
            <h2>
              From “hello”
              <br />
              to “see you next time.”
              <Star />
            </h2>
            <p>
              One connected journey.
              <br />
              Every part of the visit.
            </p>
          </div>
          <div className="journey-grid">
            {[
              {
                icon: "calendar",
                title: "Make room.",
                text: "Plan appointments and see walk-ins in the same calendar.",
              },
              {
                icon: "heart",
                title: "Know your people.",
                text: "Have the customer’s preferences and answers close at hand.",
              },
              {
                icon: "scissors",
                title: "Do your thing.",
                text: "Keep your team, services, and working hours in sync.",
              },
              {
                icon: "receipt",
                title: "Wrap it up.",
                text: "Record payments and create a clear, complete invoice.",
              },
            ].map((step, index) => (
              <article key={step.title} data-reveal>
                <div className="journey-icon">
                  <Icon name={step.icon} size={30} />
                  <small>0{index + 1}</small>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="human-section section-space">
          <div className="salon-photo" data-reveal>
            <img
              src="https://images.unsplash.com/photo-1675034743339-0b0747047727?fm=jpg&fit=crop&w=1200&q=85"
              alt="A stylist caring for a client’s hair in a salon"
              loading="lazy"
            />
            <span className="photo-sticker">
              <Star />
              <span>
                MADE FOR
                <br />
                YOUR KIND
                <br />
                OF BUSY.
              </span>
            </span>
            <div className="photo-label">
              <Icon name="sun" size={17} />A little more space to do what you
              love.
            </div>
          </div>
          <div className="human-copy" data-reveal>
            {/* <span className="eyebrow">YOUR CRAFT. YOUR SPACE. YOUR PACE.</span> */}
            <h2>
              You make
              <br />
              people feel
              <br />
              <em>their best.</em>
            </h2>
            <p>
              Your workspace should feel good, too. Etalier brings the practical
              side of your salon together, so you can stay close to the work you
              love.
            </p>
            <ul>
              <li>
                <Icon name="check" />A clear view of each location.
              </li>
              <li>
                <Icon name="check" />A place for every customer detail.
              </li>
              <li>
                <Icon name="check" />A day your whole team can follow.
              </li>
            </ul>
            <ArrowLink className="button ink">Find your flow</ArrowLink>
          </div>
        </section>
        <section className="fit-section section-space" id="for-you">
          <div className="center-heading" data-reveal>
            {/* <span className="eyebrow">THERE’S ROOM FOR YOU HERE.</span> */}
            <h2>
              Your next chapter.
              <br />
              Your kind of setup.
            </h2>
            <p>One chair or a whole team of them. Build around your salon.</p>
          </div>
          <div className="fit-grid">
            {[
              {
                label: "THE INDEPENDENT",
                title: "You + your craft.",
                icon: "sun",
                description:
                  "A clear home for your clients, bookings, and daily work.",
                items: [
                  "Your calendar, in one place",
                  "Customer profiles & preferences",
                  "Quick visits & complete invoices",
                ],
                cta: "Make it your space",
              },
              {
                label: "THE TEAM",
                title: "Better, together.",
                icon: "people",
                description:
                  "A shared rhythm for the people who make your salon.",
                items: [
                  "Shared bookings & employee schedules",
                  "Working hours & paid or unpaid leave",
                  "Commission & payroll drafts",
                ],
                cta: "Bring your team",
                featured: true,
              },
              {
                label: "THE NEXT CHAPTER",
                title: "Room to grow.",
                icon: "location",
                description:
                  "Keep the bigger picture close as your business expands.",
                items: [
                  "Individual location detail screens",
                  "Teams and bookings by location",
                  "Salon and team performance insights",
                ],
                cta: "Explore the possibilities",
              },
            ].map((fit) => (
              <article
                className={"fit-card " + (fit.featured ? "featured" : "")}
                key={fit.label}
                data-reveal
              >
                <div className="fit-card-top">
                  <span>{fit.label}</span>
                  <Icon name={fit.icon} size={26} />
                </div>
                <h3>{fit.title}</h3>
                <p>{fit.description}</p>
                <ul>
                  {fit.items.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <ArrowLink
                  className={"button " + (fit.featured ? "ink" : "outline")}
                >
                  {fit.cta}
                </ArrowLink>
              </article>
            ))}
          </div>
          {/* <p className="fit-note">
            Available features and location limits follow your workspace
            configuration.
          </p> */}
        </section>
        <section className="faq-section section-space" id="questions">
          <div data-reveal>
            <h2>
              A few things
              <br />
              you might
              <br />
              be wondering.
            </h2>
            <Star className="faq-star" />
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <details
                key={question}
                name="etalier-faq"
                open={index === 0}
                data-reveal
              >
                <summary>
                  {question}
                  <span>
                    <Icon name="plus" size={19} />
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta" data-reveal>
          <div>
            {/* <span className="eyebrow">YOUR BEST DAYS ARE AHEAD.</span> */}
            <h2>
              Make room
              <br />
              for a good day.
            </h2>
            <ArrowLink className="button cream">
              Let’s bring it together
            </ArrowLink>
          </div>
          <Star className="cta-star" />
          <span className="cta-note">
            A little less admin.
            <br />A lot more salon.
          </span>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a href="#" aria-label="Etalier home">
            <Brand />
          </a>
          <p>
            A little more together.
            <br />A lot more possibility.
          </p>
          <nav aria-label="Footer navigation">
            <a href="#product">The product</a>
            <a href="#for-you">For your salon</a>
            <a href="#questions">FAQs</a>
            <a href="/contact">Contact us</a>
            <a href={app + "/login"}>
              Open Etalier
              <Icon name="arrow" size={16} />
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Etalier.</span>
          <span>
            Made around your craft.
            <Star />
          </span>
          <a href="#main">Back to the good stuff ↑</a>
        </div>
      </footer>
    </>
  );
}
