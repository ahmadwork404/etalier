export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([
    "https://etalier.app",
    "https://etalier-landing.etalier-ahmadwork404.workers.dev",
    ...(process.env.NODE_ENV !== "production"
      ? ["http://localhost:3001", "http://127.0.0.1:3001"]
      : []),
    ...(process.env.SITE_ORIGIN ? [process.env.SITE_ORIGIN] : []),
    ...(process.env.NEXT_PUBLIC_SITE_URL
      ? [process.env.NEXT_PUBLIC_SITE_URL]
      : []),
  ]);
  if (!origin || !allowed.has(origin))
    return Response.json(
      { error: { message: "Invalid request origin." } },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json(
      { error: { message: "Invalid request format." } },
      { status: 415 },
    );
  const backend =
    process.env.BACKEND_API_URL ||
    (process.env.CLOUDFLARE_WORKER === "1"
      ? "https://etalier-api.internal"
      : "") ||
    (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:4000" : "");
  if (!backend)
    return Response.json(
      {
        error: {
          message:
            "Enquiries are temporarily unavailable. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  // Bound the stream rather than trusting the caller's Content-Length header.
  const reader = request.body?.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (!reader)
    return Response.json(
      { error: { message: "Please complete the form." } },
      { status: 400 },
    );
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 20000) {
      await reader.cancel();
      return Response.json(
        { error: { message: "Your message is too long." } },
        { status: 413 },
      );
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const send =
      process.env.CLOUDFLARE_WORKER === "1"
        ? (
            await import(/* webpackIgnore: true */ "cloudflare:workers")
          ).env.API.fetch.bind(
            (await import(/* webpackIgnore: true */ "cloudflare:workers")).env
              .API,
          )
        : fetch;
    const response = await send(
      backend.replace(/\/$/, "") + "/api/v1/contact-leads",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "x-etalier-client-ip":
            request.headers.get("cf-connecting-ip") || "0.0.0.0",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      },
    );
    const payload = await response.json();
    return Response.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: {
          message:
            error instanceof SyntaxError
              ? "Invalid request format."
              : "We couldn’t send your enquiry. Please try again.",
        },
      },
      { status: error instanceof SyntaxError ? 400 : 502 },
    );
  }
}
