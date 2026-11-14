import Home from "../page";
import { workspaceRoutes } from "../components/workspaceRoutes";
import { notFound } from "next/navigation";
export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspacePage: string }>;
}) {
  const { workspacePage } = await params;
  if (!Object.values(workspaceRoutes).includes("/" + workspacePage)) notFound();
  return <Home />;
}
