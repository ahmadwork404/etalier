import Home from "../../page";
import { notFound } from "next/navigation";
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (
    section &&
    (section.length !== 1 ||
      !["shops", "members", "modules", "logs", "jobs", "leads"].includes(
        section[0],
      ))
  )
    notFound();
  return <Home />;
}
