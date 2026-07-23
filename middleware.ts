import { NextResponse } from "next/server";

// All group routes must stay out of search indexes (system-design.md §3.3) —
// a share link is a bearer credential, and search engines indexing /g/*
// would leak it.
export function middleware() {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  matcher: ["/g/:path*"],
};
