import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const renamed = url.pathname.replace(/^\/blog(?=\/|$)/, "/blogs");
  const path = renamed.startsWith("/api/")
    ? renamed
    : renamed.replace(/\/+$/, "") || "/";
  if (path !== url.pathname || url.hostname === "www.etalier.app") {
    const origin =
      url.hostname === "www.etalier.app" ? "https://etalier.app" : url.origin;
    const canonical = new URL(origin);
    canonical.pathname = path;
    canonical.search = url.search;
    return NextResponse.redirect(canonical, 308);
  }
  const preview = url.hostname.endsWith(".workers.dev");
  if (preview && url.pathname === "/robots.txt")
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  const response = NextResponse.next();
  if (!url.pathname.endsWith("/index.md")) {
    const alternate = /^\/(blogs|features)\/[^/]+$/.test(url.pathname)
      ? `<https://etalier.app${url.pathname}/index.md>; rel="alternate"; type="text/markdown", `
      : "";
    response.headers.set(
      "Link",
      alternate + '<https://etalier.app/llms.txt>; rel="describedby"',
    );
  }
  if (preview) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|social.png).*)"],
};
