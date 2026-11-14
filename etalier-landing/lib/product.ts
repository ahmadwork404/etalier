export const features = [
  {
    slug: "front-desk",
    number: "01",
    tag: "FRONT DESK",
    title: "From walk-in to paid visit.",
    description:
      "Keep the queue moving without losing the details that make the numbers useful.",
    intro:
      "A customer arrives without an appointment. Choose the services, name the person doing the work, record what was paid, and carry on. Quick Work puts those decisions together.",
    tone: "peach",
    steps: [
      [
        "Find the person",
        "Start a walk-in or search for a returning customer. Their record keeps the visit attached to the right history.",
      ],
      [
        "Build the visit",
        "Select one or more services. Prices fill automatically; an Other service lets you enter a description and price.",
      ],
      [
        "Record the money",
        "Record the amount received, payment method and optional tip. A lower service payment becomes a discount, separate from the tip.",
      ],
      [
        "Close the loop",
        "Open a proper invoice, download the PDF or email a receipt when delivery is configured. Today’s visitors stay visible below the desk.",
      ],
    ],
    detailTitle: "A payment record you can actually explain.",
    details: [
      "Service subtotal, discount, tax and tip are separate figures.",
      "Cash, card and other configured methods describe how payment was received.",
      "Walk-ins appear alongside appointments in Bookings and the calendar.",
    ],
    boundary:
      "Recording a payment documents money already received. It does not charge a bank card or initiate a bank transfer.",
    article: "a-cleaner-end-of-day-close",
  },
  {
    slug: "bookings",
    number: "02",
    tag: "BOOKINGS & CALENDAR",
    title: "One day. The whole picture.",
    description:
      "See planned appointments and completed walk-ins in the same workspace.",
    intro:
      "A calendar is useful when it reflects what the team can actually do. Etalier connects each appointment to a customer, services, location and employee, with working hours and leave taken into account.",
    tone: "mint",
    steps: [
      [
        "Choose the work",
        "Select the customer, location, employee and services. Service durations shape the appointment.",
      ],
      [
        "Choose the time",
        "Working hours, existing appointments and leave help prevent scheduling someone who is unavailable.",
      ],
      [
        "Track the outcome",
        "Move a visit through its actual status. Completed, cancelled and no-show appointments remain distinguishable.",
      ],
      [
        "See the whole day",
        "Use the calendar or the Bookings list. Today is the starting point, with scheduled and walk-in visits together.",
      ],
    ],
    detailTitle: "Less guessing at the front desk.",
    details: [
      "Day, week and month views give different levels of detail.",
      "Advance payment can be recorded when creating a booking.",
      "Appointment outcomes connect to reporting so cancellations do not look like completed work.",
    ],
    boundary:
      "An appointment marked as paid in advance records a payment you have received; it is not an online payment checkout.",
    article: "booking-buffers-that-work",
  },
  {
    slug: "customer-records",
    number: "03",
    tag: "CUSTOMER RECORDS",
    title: "Remember the person. Keep the context.",
    description:
      "Visit history, useful notes and form answers, together in a customer record.",
    intro:
      "The next consultation should not start from zero. A customer profile gives the team somewhere to find previous visits, preferences, photos and the answers a customer has already shared.",
    tone: "butter",
    steps: [
      [
        "Create one record",
        "Keep a customer’s name and contact details together so repeat visits can use the same profile.",
      ],
      [
        "Keep useful context",
        "Add practical notes and a photo where appropriate. Keep records focused on information your team needs.",
      ],
      [
        "Send an intake form",
        "Reuse a form for different customers. Share a time-limited link or send it to selected customers when email is configured.",
      ],
      [
        "Read the answers",
        "Review submissions in a dialog, linked to the customer when known. The form preview lets you check the experience before sharing.",
      ],
    ],
    detailTitle: "Reusable forms. Controlled links.",
    details: [
      "The quick-copy option creates a link with a 24-hour expiry.",
      "Deliveries to selected customers can use the available 48-hour option.",
      "Set allowed uses rather than leaving a form link available indefinitely.",
    ],
    boundary:
      "Collect only the personal information you need. Your salon decides its consent, retention and access practices; a form is not a substitute for that policy.",
    article: "a-better-first-consultation",
  },
  {
    slug: "team-payroll",
    number: "04",
    tag: "TEAM & PAYROLL",
    title: "Know who’s in. Know what’s due.",
    description:
      "Working hours, leave and draft payroll belong beside the people they affect.",
    intro:
      "A team member’s profile connects their contact details, base salary, commission setup, working hours and schedule. That gives the owner a clearer starting point than separate calendars and spreadsheets.",
    tone: "mint",
    steps: [
      [
        "Set up the person",
        "Add name, email, phone and an optional photo. Set the base salary and relevant commission configuration.",
      ],
      [
        "Set the working week",
        "Configure working hours from the employee profile and review the month’s scheduled work.",
      ],
      [
        "Record leave",
        "Add leave from the employee screen or Leave tab. Mark whether it is paid or unpaid.",
      ],
      [
        "Review payroll",
        "Choose daily, weekly, 15-day or monthly periods. Review generated drafts and add bonuses or deductions with a reason before recording payment.",
      ],
    ],
    detailTitle: "A draft is a review step.",
    details: [
      "Base salary and earned commission feed the payroll calculation.",
      "Leave classification keeps paid and unpaid time distinguishable.",
      "Employee access can be activated or deactivated as your team changes.",
    ],
    boundary:
      "Payroll records support your internal review. Etalier does not file taxes, give employment-law advice or transfer salary payments.",
    article: "payroll-review-checklist",
  },
] as const;
export const featureBySlug = (slug: string) =>
  features.find((f) => f.slug === slug);
