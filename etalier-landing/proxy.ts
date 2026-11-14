import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.hostname === "www.etalier.app") {
    const canonical = new URL(url.pathname + url.search, "https://etalier.app");
    return NextResponse.redirect(canonical, 308);
  }
  if (
    url.pathname !== "/" &&
    url.pathname.endsWith("/") &&
    !url.pathname.startsWith("/api/")
  )
    return NextResponse.redirect(
      new URL(url.pathname.replace(/\/+$/, "") + url.search, url.origin),
      308,
    );
  const preview = url.hostname.endsWith(".workers.dev");
  if (preview && url.pathname === "/robots.txt")
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  const response = NextResponse.next();
  if (preview) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|social.png).*)"],
};
