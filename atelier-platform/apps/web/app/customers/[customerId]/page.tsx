import Home from "../../page";
import { notFound } from "next/navigation";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      customerId,
    )
  )
    notFound();
  return <Home />;
}
