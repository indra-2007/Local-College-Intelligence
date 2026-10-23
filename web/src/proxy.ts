import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Simple mock authentication for demonstration
  // In a real app, you would check for a valid session cookie
  const isAuthenticated = request.cookies.has('auth-session');
  
  // If the user is on the login page and IS authenticated, redirect to dashboard
  if (request.nextUrl.pathname.startsWith('/login') && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // If the user is on any other page and IS NOT authenticated, redirect to login
  if (!request.nextUrl.pathname.startsWith('/login') && !isAuthenticated) {
    // Exclude static assets and api routes
    if (!request.nextUrl.pathname.match(/\.(.*)$/) && !request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
