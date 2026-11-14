import { researchedArticles } from "./researched-journal";
export type Article = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  tone: string;
  publishedAt?: string;
  modifiedAt?: string;
  sources?: { title: string; url: string }[];
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    list?: string[];
  }[];
  takeaway: string;
};
export const articles: Article[] = [
  ...researchedArticles,
  {
    slug: "a-cleaner-end-of-day-close",
    category: "Front desk",
    title: "Close the day without chasing the numbers.",
    summary:
      "A repeatable close that separates service revenue, discounts, tips and payment methods — with an example you can use tonight.",
    readTime: "5 min read",
    tone: "peach",
    sections: [
      {
        id: "start-with-visits",
        title: "Start with the visits, not the cash drawer.",
        paragraphs: [
          "Before counting money, account for the work. Compare the appointments marked completed with the walk-ins recorded that day. Look for a finished appointment that still says confirmed, a visit entered twice, or a walk-in that never made it into the system.",
          "Do not mark a no-show completed just to clear the calendar. The outcome describes what happened. Changing it to make a report look tidy makes the next report less useful.",
        ],
      },
      {
        id: "separate-the-amounts",
        title: "Keep four amounts separate.",
        paragraphs: [
          "A service price is not always the amount received. Keep the listed service value, any discount, any tax and the tip as distinct figures. That makes a price adjustment explainable and stops a generous tip from hiding a discount.",
          "For example: a €65 service, a €5 discount and a €4 tip means €64 received before any separately applied tax. Service revenue after discount is €60. The €4 tip should remain visible as a tip. Do not quietly change the service price to €64.",
        ],
        list: [
          "Check discounts against the reason or agreement made at the desk.",
          "Review tips separately from service payments.",
          "Check that a deposit or advance payment has not been counted twice.",
        ],
      },
      {
        id: "reconcile-methods",
        title: "Reconcile each payment method on its own.",
        paragraphs: [
          "Compare recorded cash with the cash actually received, allowing separately for the opening float and any documented cash movements. Compare recorded card payments with the processor’s transaction record. A settlement arriving in your bank later is a different event from a customer paying today.",
          "If a card payment was only recorded in your salon software, confirm that it actually succeeded on the payment terminal. Recording a payment is not the same as charging the card. Investigate the mismatch while the team can still remember the visit.",
        ],
      },
      {
        id: "leave-a-note",
        title: "Leave a short exception list.",
        paragraphs: [
          "A useful close can finish with an open question. Write down the amount, visit, payment method and person following up. “€20 difference — check Clara’s advance payment tomorrow” is more actionable than changing an unrelated payment to force the totals to match.",
          "Keep one owner for the final review and a clear handover when they are away. In Etalier, today’s visitors and each visit’s invoice give you the starting records; your till and processor provide the independent comparison.",
        ],
      },
    ],
    takeaway:
      "Account for the visits, separate the amounts, reconcile by payment method, and leave unresolved differences visible.",
  },
  {
    slug: "booking-buffers-that-work",
    category: "Scheduling",
    title: "Leave room for the work between appointments.",
    summary:
      "How to set service duration and buffers without turning the calendar into a guessing game.",
    readTime: "4 min read",
    tone: "mint",
    sections: [
      {
        id: "name-the-time",
        title: "Name the time you are actually reserving.",
        paragraphs: [
          "A haircut listed as 45 minutes can occupy an hour when consultation, finishing and resetting the station are included. Decide what your service duration covers, then use that definition consistently. Otherwise two people booking the same service can reserve different amounts of time.",
          "A buffer is useful for predictable work around the service. It should not be a vague allowance that hides an unrealistic service duration. If every appointment overruns by 20 minutes, start by checking the duration rather than adding a smaller buffer and hoping.",
        ],
      },
      {
        id: "observe-a-week",
        title: "Observe a normal week before changing everything.",
        paragraphs: [
          "Ask the team to note the actual start, finish and reset time for a small sample of common services. Include ordinary days and busy days. You are looking for recurring pressure, not judging an employee from one difficult appointment.",
          "Use the observations to agree a starting duration for each service. Colour work, consultations and appointments involving several services may need individual review. Treat a published duration as a working rule that can be corrected when the evidence changes.",
        ],
      },
      {
        id: "protect-breaks",
        title: "Protect breaks and leave explicitly.",
        paragraphs: [
          "Do not represent an employee’s break by hoping nobody books that slot. Configure the working day around the time they are available and record leave in the schedule. Keep this separate from a service buffer: a buffer belongs to the work, while a break belongs to the person.",
        ],
        list: [
          "Check opening and closing duties before offering the first and last slots.",
          "Review appointments affected by a change to working hours.",
          "Check who can perform the service at the chosen location.",
        ],
      },
      {
        id: "review-before-booking",
        title: "Review the full appointment before promising a time.",
        paragraphs: [
          "When several services share one visit, check their combined duration and the employee assigned. Ask whether any processing time actually frees the employee for another task; do not assume that it does. A simple calendar is safer than a complicated overlap nobody can explain.",
          "Etalier checks an appointment against employee hours, existing appointments and leave. Those checks work best when the underlying setup reflects the week your team has agreed to work. Review the rules after a change in staffing or your service menu.",
        ],
      },
    ],
    takeaway:
      "Use realistic service durations, explicit working hours and visible leave. Review the setup when the work changes.",
  },
  {
    slug: "a-better-first-consultation",
    category: "Customer care",
    title: "Ask less. Learn what matters.",
    summary:
      "A practical structure for an intake form that helps the consultation instead of repeating it.",
    readTime: "4 min read",
    tone: "butter",
    sections: [
      {
        id: "start-with-a-decision",
        title: "Start with the decisions the answers will change.",
        paragraphs: [
          "Before adding a question, finish this sentence: “If the customer answers this, we will…” If you cannot name a useful action, the question may not belong on the form. A shorter form is easier to complete and easier for the stylist to review.",
          "For a first hair consultation, useful context might include the result the customer wants, recent treatments they want to discuss, and the time they can spend on maintenance. The exact questions should reflect your services and your professional responsibilities.",
        ],
      },
      {
        id: "make-it-readable",
        title: "Use one idea per question.",
        paragraphs: [
          "“Tell us about your hair, routine, history and expectations” is hard to answer well. Split those ideas into short questions with a clear purpose. Where a customer may not know an answer, give them a way to say so rather than forcing a guess.",
          "Explain specialist words in ordinary language. Avoid using a long required-text field where a few choices plus an optional note would make the answer more readable. Test the form on a phone, including the keyboard and the final submit button.",
        ],
      },
      {
        id: "collect-carefully",
        title: "Collect personal information deliberately.",
        paragraphs: [
          "A form can make it easy to collect far more information than the team needs. Decide who can read answers, how long they should be kept, and how customers can ask about their records. Tell customers why you are asking for information.",
          "Sensitive health or treatment information deserves particular care. Use the rules and professional guidance that apply to your service and location. A generic template does not establish a lawful basis or replace professional screening.",
        ],
      },
      {
        id: "review-in-person",
        title: "Make the answers part of the conversation.",
        paragraphs: [
          "Assign someone to review the answers before the appointment. Start the consultation by confirming the details that matter today, especially if the customer’s situation or preferences may have changed. A submitted form is context, not a conversation already completed.",
          "In Etalier, reusable forms can be shared through expiring links, and answers stay connected to the customer when known. Preview the form before sending it, choose the link’s expiry and allowed uses, and use the answers to prepare a better handover.",
        ],
        list: [
          "Remove questions nobody uses.",
          "Check the mobile preview.",
          "Agree who reviews new answers.",
          "Confirm important details with the customer.",
        ],
      },
    ],
    takeaway:
      "Every question should support a decision. Keep the form readable, collect carefully, and review the answers before the visit.",
  },
  {
    slug: "payroll-review-checklist",
    category: "Team operations",
    title: "What to check before approving payroll.",
    summary:
      "A review checklist for base salary, commission, leave and adjustments — before a draft becomes a payment record.",
    readTime: "5 min read",
    tone: "mint",
    sections: [
      {
        id: "confirm-the-period",
        title: "Confirm the period and the people.",
        paragraphs: [
          "Start with the dates. Daily, weekly, 15-day and monthly periods are different choices; a 15-day period is not identical to every two weeks. Agree which rule you use and check the start and end dates on the draft.",
          "Confirm who belongs in the run. A new starter, someone leaving, or an employee who changed schedule may need a specific review. Deactivating a profile should not be treated as evidence that nothing is owed for work already done.",
        ],
      },
      {
        id: "review-components",
        title: "Review each component before the total.",
        paragraphs: [
          "Check the base salary against the agreed amount and period. Review the commission rate and the work used to calculate commission. If a service was discounted or refunded, follow the rule you agreed with the employee rather than making an unexplained adjustment at the end.",
          "Review paid and unpaid leave separately. Check the dates and classification before relying on a deduction. Local employment and payroll requirements can affect how pay and leave must be calculated; internal software settings do not decide those requirements for you.",
        ],
      },
      {
        id: "explain-adjustments",
        title: "Give every adjustment a readable reason.",
        paragraphs: [
          "A bonus or deduction needs more than an amount. Record what it relates to and which period it belongs to. “Approved performance bonus — November” can be understood later. “Adjustment” cannot.",
          "Check a negative adjustment especially carefully. Confirm the supporting record, authorization and any local rules before approving it. Do not use deductions to hide a missing commission entry or a leave record that was classified incorrectly.",
        ],
        list: [
          "Base salary and the dates it covers.",
          "Commission rate and the underlying completed work.",
          "Paid and unpaid leave.",
          "Bonus amounts and reasons.",
          "Deduction amounts, reasons and approval.",
          "Any carry-forward or prior-period correction.",
        ],
      },
      {
        id: "record-payment-separately",
        title: "Keep approval and payment distinct.",
        paragraphs: [
          "A reviewed draft does not mean the employee has received money. Use a consistent approval step, make the payment through your chosen bank or payroll process, and record payment only when it has happened. Keep a way to identify the payment without storing unnecessary banking information in general notes.",
          "Etalier prepares drafts from configured salary, commission and leave, with room for explained adjustments. Use the detail screen to inspect the calculation. Tax filings, statutory deductions and salary transfers need the appropriate external process and professional review.",
        ],
      },
    ],
    takeaway:
      "Check the period, inspect each component, explain adjustments, and record payment only after the money has been paid.",
  },
];
export const articleBySlug = (slug: string) =>
  articles.find((a) => a.slug === slug);
