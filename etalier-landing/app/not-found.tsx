import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="editorial-hero centered missing-page">
        <span className="eyebrow">404 / NOT ON THE CALENDAR</span>
        <h1>
          This page
          <br />
          <em>isn’t here.</em>
        </h1>
        <p>
          The address may have changed. Explore the product or send us a message
          if you need a hand.
        </p>
        <div className="missing-actions">
          <a className="button yellow" href="/">
            Back to Etalier
          </a>
          <a className="button outline" href="/contact">
            Contact us
          </a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
