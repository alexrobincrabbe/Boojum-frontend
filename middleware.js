/**
 * Legacy Django room URLs: /rooms/:slug/ → /rooms/guest/:slug/
 * Skips /rooms/guest/... (current format).
 */
export default function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/rooms" || pathname === "/rooms/") {
    return Response.redirect(new URL("/lobby", url), 301);
  }

  const match = pathname.match(/^\/rooms\/([^/]+)\/?$/);
  if (match && match[1] !== "guest") {
    return Response.redirect(new URL(`/rooms/guest/${match[1]}/`, url), 301);
  }

  return;
}

export const config = {
  matcher: ["/rooms", "/rooms/", "/rooms/:slug", "/rooms/:slug/"],
};
