import { featureMarkdown, markdownResponse } from "@/lib/llms";
import { siteOrigin } from "@/lib/seo";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const text = featureMarkdown(slug);
  return text
    ? markdownResponse(text, siteOrigin + "/features/" + slug)
    : new Response("Feature not found", { status: 404 });
}
