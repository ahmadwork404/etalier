import type { Article } from "./journal";
export const researchedArticles: Article[] = [
  {
    slug: "salon-cancellation-policy",
    category: "Bookings",
    title: "Write a salon cancellation policy customers can understand.",
    summary:
      "Decide what counts as late, explain how to cancel, and give your team a consistent way to handle exceptions.",
    readTime: "4 min read",
    tone: "peach",
    publishedAt: "2026-11-15",
    sources: [
      {
        title: "NHBF: No-shows & Late Cancellations Policy",
        url: "https://www.nhbf.co.uk/nhf-shop/230112773-no-shows-late-cancellations-policy/",
      },
    ],
    sections: [
      {
        id: "make-the-rule-clear",
        title: "A policy starts before anyone misses an appointment.",
        paragraphs: [
          "A customer should not first learn about your cancellation rule when the salon sends a charge. Put the practical information where the booking is made and make it easy to find again. The National Hair & Beauty Federation provides an adaptable cancellation-policy resource for salons and barbershops; a policy needs to fit the services a business actually offers.",
          "Before writing customer-facing copy, agree the answers internally: how much notice you ask for, which channel the customer should use, who receives the message, and what the team does when that message arrives. A beautifully written policy still fails if cancellation requests sit unread in an inbox.",
        ],
      },
      {
        id: "define-the-cutoff",
        title: "Use a time the customer can work out.",
        paragraphs: [
          "“Cancel well in advance” leaves room for two reasonable people to disagree. If your salon chooses a notice period, express it clearly and show the actual appointment date and time alongside it. Check the timezone on confirmations, especially if customers book while travelling.",
          "For example, a request to contact the salon at least 24 hours before a Tuesday 14:00 appointment means Monday 14:00. That is an illustration of a deadline, not a recommendation that every service should use the same period. Longer colour appointments and brief consultations may create different scheduling problems.",
        ],
      },
      {
        id: "explain-the-process",
        title: "Say how to cancel, not just when.",
        paragraphs: [
          "Give the customer a channel the team actually checks. If you accept a phone call, include the number. If they should reply to a confirmation or use a booking link, say so. Decide how a message arriving outside opening hours will be handled.",
          "Keep a short written acknowledgement for the team to send: “Your appointment on Tuesday at 14:00 has been cancelled. If you would like another time, contact us and we’ll check the calendar.” This confirms what changed without making a promise about an unavailable slot.",
        ],
      },
      {
        id: "handle-money-carefully",
        title:
          "Keep any payment decision separate from the appointment status.",
        paragraphs: [
          "A cancellation describes the visit. A deposit, refund or fee describes money. Record the outcome accurately even when a payment question is still being resolved. Otherwise the calendar and the invoice can tell different stories.",
          "Any customer charge or retained payment needs terms that are appropriate for the business and the rules that apply to it. Get suitable local advice before using a charge policy. Do not treat a sample message, software setting or this operational guide as permission to take money.",
        ],
      },
      {
        id: "review-exceptions",
        title: "Give exceptions an owner and a reason.",
        paragraphs: [
          "A consistent process can still accommodate a genuine emergency. Agree who can approve an exception, write a short reason, and let the team see the decision. Avoid leaving one receptionist to invent the rule while a queue builds behind the customer.",
          "At the end of the month, review late cancellations and no-shows separately. Look at which services and times are affected, whether customers knew how to cancel, and whether the team saw their messages promptly. Start by fixing those gaps before making the policy more complicated.",
        ],
        list: [
          "Show the notice period before booking.",
          "Give one reliable cancellation route.",
          "Confirm that the cancellation was received.",
          "Keep the appointment outcome and payment decision distinct.",
          "Record exceptions so the next team member has context.",
        ],
      },
    ],
    takeaway:
      "A useful policy gives the customer a clear deadline, a working cancellation route and a predictable response from the team.",
  },
  {
    slug: "salon-rebooking-rate",
    category: "Customer care",
    title: "Measure salon rebooking without flattering the numbers.",
    summary:
      "Define the denominator, separate a reserved appointment from a completed return, and use a small weekly review to improve the checkout conversation.",
    readTime: "4 min read",
    tone: "mint",
    publishedAt: "2026-11-15",
    sources: [
      {
        title: "Fresha: Salon client retention strategies",
        url: "https://www.fresha.com/blog/4-simple-salon-client-retention-strategies",
      },
    ],
    sections: [
      {
        id: "two-different-questions",
        title: "A rebooking and a return visit answer different questions.",
        paragraphs: [
          "Rebooking tells you whether another appointment was reserved. Retention tells you whether the customer came back within a period you define. A reserved appointment can later be cancelled or missed, so the two measures should not be used interchangeably.",
          "Fresha’s client-retention guidance highlights the checkout rebooking conversation as one practical habit. For an individual salon, the useful next step is to define what the team will count and follow the same definition every week, rather than borrowing a target from a different business.",
        ],
      },
      {
        id: "choose-the-denominator",
        title: "Write the counting rule before looking at the result.",
        paragraphs: [
          "One workable checkout measure is: completed visits that had a future appointment reserved by the end of checkout, divided by eligible completed visits. Decide what “eligible” excludes and document it. Do not remove every customer who declined, because that would make the result look better without changing the experience.",
          "Suppose a week has 40 eligible completed visits, and 18 finish with another appointment booked. The checkout rebooking rate is 18 ÷ 40 × 100 = 45%. That is an illustrative calculation, not an industry benchmark or an Etalier customer result.",
          "Keep a customer-level measure separately if one customer has multiple visits during the review period. Mixing visits in one week and unique people in another produces a trend that cannot be compared.",
        ],
      },
      {
        id: "avoid-double-counting",
        title: "Keep changes from becoming extra bookings.",
        paragraphs: [
          "Moving an existing future appointment is not a second rebooking. A duplicate customer profile can also make one person appear to be two people. Agree how the team searches for returning customers before creating another record.",
          "When reviewing the next period, check what happened to the reserved visits. Some will have been rescheduled, cancelled or missed. A high checkout rate with many later cancellations may mean the team is reserving times customers were never confident they could attend.",
        ],
      },
      {
        id: "make-the-offer-useful",
        title: "Make the next appointment a useful choice.",
        paragraphs: [
          "Give the customer the timing advice appropriate to their service, then ask whether they want to reserve. A simple, original checkout prompt is: “Would you like us to check a time for your next visit, or would you prefer to book later?” Make either answer easy.",
          "If they want to book, confirm the service, person, location and time before saving it. If they do not, finish the current visit properly rather than keeping them in a sales conversation while other customers wait.",
        ],
      },
      {
        id: "review-with-context",
        title: "Use a weekly sample, not a league table.",
        paragraphs: [
          "Review a small set of records together. Were customers offered an appropriate next visit? Could the team find a suitable slot? Was the service duration accurate? Did a customer leave without being asked because the desk was busy?",
          "These questions identify changes you can make. A single percentage without context can penalise employees who see different service mixes or customers visiting from out of town. Compare like with like and keep the definitions beside the report.",
        ],
        list: [
          "Record the exact measure and period.",
          "Count completed eligible visits consistently.",
          "Deduplicate customers and rescheduled appointments.",
          "Track whether reserved visits were later completed.",
          "Use the review to improve the process, not pressure the customer.",
        ],
      },
    ],
    takeaway:
      "Define the rate, keep reservations separate from completed returns, and use real visit records to understand what changed.",
  },
  {
    slug: "google-business-profile-salon-booking-link",
    category: "Salon website",
    title: "Check your salon’s Google booking link from the customer’s side.",
    summary:
      "Add the correct appointment link, test the location and booking flow, and avoid sending customers to a staff login or an old provider.",
    readTime: "4 min read",
    tone: "butter",
    publishedAt: "2026-11-15",
    sources: [
      {
        title: "Google Business Profile: Manage your local business links",
        url: "https://support.google.com/business/answer/6218037?hl=en",
      },
      {
        title:
          "Google Business Profile: Business links policies and guidelines",
        url: "https://support.google.com/business/answer/13769188?hl=en",
      },
    ],
    sections: [
      {
        id: "start-with-destination",
        title: "Test the destination before editing the profile.",
        paragraphs: [
          "Open the link you intend to publish in a private browser window on a phone. You should see the customer’s route to an appointment, not the employee login, the software vendor’s homepage or a link that works only because you are already signed in.",
          "Write down the salon name, location and service you expect to see. Follow the flow far enough to check the available information without creating a false appointment. If a genuine test booking is necessary, label it and remove it from the live diary afterwards.",
        ],
      },
      {
        id: "add-the-link",
        title: "Use the booking area in your Business Profile.",
        paragraphs: [
          "Google’s help instructions direct profile managers to the relevant transaction area, such as Booking, to add and save a link. In Maps, the route is through editing the profile and selecting the transaction type. The available controls depend on the profile and eligibility.",
          "If the profile has more than one suitable link, Google also documents a preferred-link setting. Check which one is shown to customers after your change. Do not assume the link you most recently added automatically replaced an older provider.",
        ],
      },
      {
        id: "check-location",
        title: "Match the link to the location.",
        paragraphs: [
          "Google’s business-link guidelines require a relevant destination where the customer can complete the intended action. For a multi-location business, the link should lead to the specific location. Its guidelines also cover accessibility to the systems that verify links.",
          "For your own check, compare the location name, address and contact number with the profile the customer opened. Then check that the appointment would be placed with the intended team. A correct-looking page can still send work to the wrong branch.",
        ],
      },
      {
        id: "review-old-links",
        title: "Check for an old provider as well as your new link.",
        paragraphs: [
          "An appointment button may have been supplied by a third-party booking provider. Google documents a separate removal process for those provider links, which can require contacting the provider rather than deleting a manually added link.",
          "Take a screenshot of the customer-facing profile and note where each button goes before making changes. This gives you a record if an old destination remains visible. Keep access to the old provider long enough to check any future appointments that were already made there.",
        ],
      },
      {
        id: "repeat-the-check",
        title: "Repeat the customer test after the edit.",
        paragraphs: [
          "Search for the salon again without relying on your saved management screen. Open the appointment link and check it on a second device if you can. If you receive an error, capture the exact address and message rather than repeatedly saving a different link at random.",
          "Do the same check whenever you change software, website domains or locations. Include it in the handover when someone new takes responsibility for the salon’s online profiles. A short recurring check is more useful than discovering a broken link from a customer at the desk.",
        ],
        list: [
          "Correct salon and location.",
          "Customer-facing booking destination.",
          "Readable service and appointment information on a phone.",
          "No expired link or staff-login destination.",
          "Old provider links reviewed.",
          "A clear way for customers to contact the salon if they need help.",
        ],
      },
    ],
    takeaway:
      "Test the entire path a customer takes, not just whether a URL can be saved in the management screen.",
  },
];
