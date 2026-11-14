import Landing from "@/components/Landing";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "Salon Management Software for Bookings & Teams | Etalier",
  description:
    "Manage salon bookings, walk-ins, customer records, team schedules and payroll in one workspace. Explore Etalier and request a walkthrough.",
  path: "/",
});
export default function Home() {
  return <Landing />;
}
