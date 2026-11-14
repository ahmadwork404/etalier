import { articleMarkdown, markdownResponse } from "@/lib/llms";
import { siteOrigin } from "@/lib/seo";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const text = articleMarkdown(slug);
  return text
    ? markdownResponse(text, siteOrigin + "/blogs/" + slug)
    : new Response("Article not found", { status: 404 });
}
