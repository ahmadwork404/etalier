export function GET(request: Request) {
  return Response.redirect(new URL("/robots.txt", request.url), 308);
}
