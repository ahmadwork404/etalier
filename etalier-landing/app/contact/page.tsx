import type { Metadata } from "next";
import { Brand, Star } from "../../components/Icons";
import { ContactForm } from "../../components/ContactForm";
export const metadata: Metadata = {
  title: "Contact us — Etalier",
  description:
    "Ask about Etalier, discuss your salon’s needs, or arrange a walkthrough.",
  alternates: { canonical: "/contact" },
};
export default function ContactPage() {
  const portal =
    process.env.NEXT_PUBLIC_APP_URL || "https://portal.etalier.app";
  return (
    <>
      <a href="#contact" className="skip-link">
        Skip to contact form
      </a>
      <header className="site-header">
        <a className="brand-link" href="/" aria-label="Etalier home">
          <Brand />
        </a>
        <nav className="contact-nav" aria-label="Main navigation">
          <a href="/#product">The product</a>
          <a href={portal + "/login"}>Sign in ↗</a>
        </nav>
      </header>
      <main id="contact" className="contact-layout">
        <section className="contact-intro">
          <span className="eyebrow">LET’S TALK SALON.</span>
          <h1>
            A good day
            <br />
            starts with
            <br />
            <em>a hello.</em>
          </h1>
          <p>
            Exploring Etalier for your salon? Tell us what you need. We’ll help
            you find the right way to get started.
          </p>
          <div className="contact-note">
            <Star />
            <span>
              Questions, a walkthrough,
              <br />
              or a little help getting set up.
            </span>
          </div>
          <a className="contact-back" href="/">
            ← Back to the product
          </a>
        </section>
        <section className="contact-card" aria-labelledby="contact-heading">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2 id="contact-heading">Tell us a little about you.</h2>
          <p>A few details, and we’ll take it from here.</p>
          <ContactForm />
        </section>
      </main>
      <footer className="contact-footer">
        <Brand />
        <span>© {new Date().getFullYear()} Etalier.</span>
        <a href={portal + "/login"}>Already with us? Open your workspace ↗</a>
      </footer>
    </>
  );
}
