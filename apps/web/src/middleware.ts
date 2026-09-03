import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy API v1 requests to the Express API server
  if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') {
    const apiUpstream =
      process.env.API_UPSTREAM_URL || 'http://127.0.0.1:4000';
    const url = new URL(pathname, apiUpstream);
    url.search = request.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/:path*', '/api/v1'],
};
