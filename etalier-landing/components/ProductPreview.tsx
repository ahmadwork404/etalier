"use client";
import { useState } from "react";
import { Icon, Star } from "./Icons";
const euro = (amount: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
const tabs = [
  { id: "calendar", icon: "calendar", label: "Your calendar" },
  { id: "quick", icon: "bolt", label: "Quick Work" },
  { id: "team", icon: "people", label: "Your team" },
];
const appointments = [
  {
    name: "Camille Martin",
    service: "Cut & finish",
    time: "09:00",
    stylist: "Juliette",
    tone: "mint",
  },
  {
    name: "Emma Laurent",
    service: "Balayage & gloss",
    time: "10:30",
    stylist: "Sofia",
    tone: "peach",
  },
  {
    name: "Oliver Reed",
    service: "Gentlemen’s cut",
    time: "11:00",
    stylist: "Lucas",
    tone: "butter",
  },
  {
    name: "Léa Bernard",
    service: "Blow-dry & style",
    time: "12:00",
    stylist: "Juliette",
    tone: "butter",
  },
  {
    name: "Anna Schmidt",
    service: "Scalp ritual",
    time: "13:00",
    stylist: "Sofia",
    tone: "mint",
  },
  {
    name: "Inès Costa",
    service: "Cut & finish",
    time: "14:00",
    stylist: "Lucas",
    tone: "peach",
  },
];
export function ProductPreview() {
  const [active, setActive] = useState("calendar"),
    [selected, setSelected] = useState<(typeof appointments)[number] | null>(
      null,
    );
  return (
    <div className="product-stage" id="workspace">
      <div className="product-float float-note">
        <span className="pin" />
        <span>
          Less juggling.
          <br />
          More <em>you</em>.
        </span>
        <svg viewBox="0 0 110 46" aria-hidden="true">
          <path d="M5 36q50-31 91-9m-12-8 14 8-13 10" />
        </svg>
      </div>
      <div className="product-float float-booking">
        <span className="float-icon">
          <Icon name="check" />
        </span>
        <div>
          Another lovely day.<small>Everything in its place.</small>
        </div>
        <Star />
      </div>
      <div className="product-window">
        <div className="window-top">
          <div className="window-dots">
            <i />
            <i />
            <i />
          </div>
          <span>
            Maison Élan <span className="muted">/ demo workspace</span>
          </span>
          <span className="preview-label">
            <span />
            Interactive preview
          </span>
        </div>
        <div className="product-layout">
          <aside className="preview-sidebar">
            <div className="preview-logo">
              <Star />
              etalier
            </div>
            <span className="sidebar-caption">YOUR SPACE</span>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={active === tab.id ? "selected" : ""}
                onClick={() => {
                  setActive(tab.id);
                  setSelected(null);
                }}
                aria-pressed={active === tab.id}
              >
                <Icon name={tab.icon} size={18} />
                {tab.label}
              </button>
            ))}
            <div className="preview-sidebar-bottom">
              <span className="avatar tiny avocado">JM</span>
              <span>
                Juliette<small>Salon owner</small>
              </span>
              <Icon name="chevron" size={14} />
            </div>
          </aside>
          <div className="preview-main">
            <div
              className="preview-mobile-tabs"
              role="tablist"
              aria-label="Product preview"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active === tab.id}
                  onClick={() => setActive(tab.id)}
                >
                  <Icon name={tab.icon} size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="preview-heading">
              <div>
                <span className="small-eyebrow">A LITTLE ROOM TO BREATHE</span>
                <h3>
                  {active === "calendar"
                    ? "A good day, all lined up."
                    : active === "quick"
                      ? "Hello, walk-in."
                      : "Good people. Great teamwork."}
                </h3>
              </div>
              <div className="avatar-stack">
                <span className="avatar mint">JM</span>
                <span className="avatar peach">SR</span>
                <span className="avatar butter">LB</span>
              </div>
            </div>
            {active === "calendar" ? (
              <>
                <div className="preview-toolbar">
                  <span>
                    <Icon name="calendar" size={16} />
                    Friday, 13 November
                  </span>
                  <div>
                    <span className="toolbar-pill">Day</span>
                    <span>Week</span>
                    <span>Month</span>
                  </div>
                  <span className="mini-primary">
                    <Icon name="plus" size={13} />
                    New booking
                  </span>
                </div>
                <div className="mini-calendar">
                  <div className="calendar-times">
                    <span />
                    {["09:00", "10:00", "11:00", "12:00", "13:00"].map(
                      (time) => (
                        <small key={time}>{time}</small>
                      ),
                    )}
                  </div>
                  {["Juliette", "Sofia", "Lucas"].map((name, index) => (
                    <div className="calendar-column" key={name}>
                      <div className="calendar-person">
                        <span
                          className={
                            "avatar tiny " + ["mint", "peach", "butter"][index]
                          }
                        >
                          {name.slice(0, 1)}
                        </span>
                        {name}
                      </div>
                      <div className={"calendar-lane lane-" + index}>
                        {appointments
                          .filter((a) => a.stylist === name)
                          .map((a, i) => (
                            <button
                              className={"mini-event " + a.tone + " event-" + i}
                              key={a.name}
                              onClick={() => setSelected(a)}
                            >
                              <small>
                                {a.time} <span>↗</span>
                              </small>
                              <strong>{a.name}</strong>
                              <span>{a.service}</span>
                              {i === 0 && (
                                <em>
                                  <i />
                                  Confirmed
                                </em>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="preview-footer">
                  <span>
                    <i />
                    Your team, on the same page.
                  </span>
                  <span>
                    Click a booking to explore <Icon name="arrow" size={14} />
                  </span>
                </div>
              </>
            ) : active === "quick" ? (
              <QuickPreview />
            ) : (
              <TeamPreview />
            )}
            {selected && (
              <div
                className="sample-booking"
                role="dialog"
                aria-modal="false"
                aria-label="Sample booking"
              >
                <button
                  className="sample-close"
                  aria-label="Close sample booking"
                  onClick={() => setSelected(null)}
                >
                  <Icon name="close" size={15} />
                </button>
                <span className="small-eyebrow">SAMPLE BOOKING</span>
                <h4>{selected.name}</h4>
                <p>
                  {selected.service} with {selected.stylist}
                </p>
                <div>
                  <Icon name="clock" size={15} />
                  {selected.time} · Friday 13 November
                </div>
                <span className="sample-confirmed">
                  <Icon name="check" size={14} />
                  All set for a good visit
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* <p className="product-caption">
        <span className="caption-dot" />
        Sample data. Real possibilities. Try the tabs and click around.
      </p> */}
    </div>
  );
}
function QuickPreview() {
  const services = [
    { name: "Cut & finish", amount: 65, icon: "scissors" },
    { name: "Blow-dry", amount: 40, icon: "sun" },
    { name: "Scalp ritual", amount: 55, icon: "sparkle" },
  ];
  const [selected, setSelected] = useState<number[]>([0]),
    [returning, setReturning] = useState(false),
    [recorded, setRecorded] = useState(false);
  const amount = selected.reduce((sum, i) => sum + services[i].amount, 0);
  return (
    <div className="quick-preview">
      <div>
        <div className="quick-people">
          <button aria-pressed={!returning} onClick={() => setReturning(false)}>
            <Icon name="sun" />
            Walk-in guest
          </button>
          <button aria-pressed={returning} onClick={() => setReturning(true)}>
            <Icon name="people" />
            Returning client
          </button>
        </div>
        {returning && (
          <label className="demo-client">
            Who’s visiting?
            <select aria-label="Sample returning client">
              <option>Camille Martin</option>
              <option>Emma Laurent</option>
              <option>Léa Bernard</option>
            </select>
          </label>
        )}
        <span className="small-eyebrow quick-label">WHAT DID WE DO?</span>
        <div className="demo-service-list">
          {services.map((service, i) => (
            <button
              key={service.name}
              aria-pressed={selected.includes(i)}
              onClick={() => {
                setRecorded(false);
                setSelected((previous) =>
                  previous.includes(i)
                    ? previous.filter((value) => value !== i)
                    : [...previous, i],
                );
              }}
            >
              <span className="demo-service-icon">
                <Icon name={service.icon} size={25} />
              </span>
              <strong>{service.name}</strong>
              <span>{euro(service.amount)}</span>
              {selected.includes(i) && (
                <span className="service-tick">
                  <Icon name="check" size={12} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="demo-helper">
          Tap a service. The total takes care of itself.
        </p>
      </div>
      <div className="demo-checkout">
        <span className="small-eyebrow">THE WRAP-UP</span>
        <h4>One lovely visit.</h4>
        <div>
          <span>Services</span>
          <strong>{selected.length} selected</strong>
        </div>
        <div>
          <span>Recorded payment</span>
          <strong>Cash</strong>
        </div>
        <div className="demo-total">
          <span>Total</span>
          <strong>{euro(amount)}</strong>
        </div>
        <button
          className="demo-record"
          disabled={!selected.length}
          onClick={() => setRecorded(true)}
        >
          {recorded ? (
            <>
              <Icon name="check" size={16} />
              Demo visit recorded
            </>
          ) : (
            <>
              Record demo visit
              <Icon name="arrow" size={16} />
            </>
          )}
        </button>
        <p role="status">
          {recorded
            ? "Preview only. No payment was processed."
            : "A finished visit, ready for its invoice."}
        </p>
      </div>
    </div>
  );
}
function TeamPreview() {
  const [cycle, setCycle] = useState("Monthly");
  const days: { [key: string]: number } = {
    Daily: 1,
    Weekly: 7,
    "15 days": 15,
    Monthly: 30,
  };
  const base = Math.round((2800 / 30) * days[cycle]);
  return (
    <div className="team-preview">
      <div className="demo-team-list">
        {[
          {
            name: "Juliette Moreau",
            role: "Creative director",
            initials: "JM",
            tone: "mint",
          },
          {
            name: "Sofia Rossi",
            role: "Colour specialist",
            initials: "SR",
            tone: "peach",
          },
          {
            name: "Lucas Bernard",
            role: "Senior stylist",
            initials: "LB",
            tone: "butter",
          },
        ].map((person, i) => (
          <div key={person.name} className={i === 1 ? "team-highlight" : ""}>
            <span className={"avatar " + person.tone}>{person.initials}</span>
            <span>
              <strong>{person.name}</strong>
              <small>{person.role}</small>
            </span>
            <span className="team-active">Active</span>
          </div>
        ))}
        <div className="team-hours">
          <Icon name="clock" size={19} />
          <span>
            Working hours, leave, and monthly schedules.
            <strong>Everyone has their place.</strong>
          </span>
        </div>
      </div>
      <div className="demo-payroll">
        <div className="payroll-title">
          <span>SOFIA’S PAYROLL</span>
          <span className="draft-pill">Draft</span>
        </div>
        <div
          className="payroll-frequency"
          aria-label="Sample payroll frequency"
        >
          {Object.keys(days).map((value) => (
            <button
              aria-pressed={value === cycle}
              key={value}
              onClick={() => setCycle(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div>
          <span>Prorated base</span>
          <strong>{euro(base)}</strong>
        </div>
        <div>
          <span>Sample commission</span>
          <strong>€85</strong>
        </div>
        <div>
          <span>Bonus</span>
          <strong>€50</strong>
        </div>
        <div className="payroll-sample-total">
          <span>Draft total</span>
          <strong>{euro(base + 135)}</strong>
        </div>
        <p>
          <Icon name="lock" size={13} />
          Ready for your review.
        </p>
      </div>
    </div>
  );
}
