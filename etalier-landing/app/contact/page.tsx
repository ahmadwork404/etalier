import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Brand, Star } from "../../components/Icons";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { ContactForm } from "../../components/ContactForm";
export const metadata = pageMetadata({
  title: "Contact Etalier | Salon Software Walkthrough",
  description:
    "Ask about Etalier salon management software, discuss your team and locations, or request a product walkthrough.",
  path: "/contact",
});
export default function ContactPage() {
  const portal =
    process.env.NEXT_PUBLIC_APP_URL || "https://portal.etalier.app";
  return (
    <>
      <SiteHeader />
      <main id="main" className="contact-layout">
        <section className="contact-intro">
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
          <h2 id="contact-heading">Tell us a little about you.</h2>
          <p>A few details, and we’ll take it from here.</p>
          <ContactForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
