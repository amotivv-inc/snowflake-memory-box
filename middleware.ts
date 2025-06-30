import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  // Log incoming request details
  console.log('=== INCOMING REQUEST ===');
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  console.log('Path:', request.nextUrl.pathname);
  console.log('Search params:', request.nextUrl.searchParams.toString());
  
  // Log all headers
  console.log('Headers:');
  request.headers.forEach((value, key) => {
    // Mask sensitive headers but show they exist
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')) {
      console.log(`  ${key}: [PRESENT - length: ${value.length}]`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });
  
  // Log cookies
  const cookies = request.cookies.getAll();
  if (cookies.length > 0) {
    console.log('Cookies:');
    cookies.forEach(cookie => {
      console.log(`  ${cookie.name}: [PRESENT]`);
    });
  }
  
  // Check for Snowflake-specific headers
  const sfHeaders = [
    'sf-context-current-user',
    'x-snowflake-authorization-token-type',
    'x-forwarded-for',
    'x-real-ip'
  ];
  
  console.log('Snowflake Headers:');
  sfHeaders.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      console.log(`  ${header}: ${value}`);
    } else {
      console.log(`  ${header}: [NOT PRESENT]`);
    }
  });
  
  // Create response and add timing header
  const response = NextResponse.next();
  
  // Log response timing
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
  
  // Add request ID for tracking
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);
  console.log(`Request ID: ${requestId}`);
  console.log('=== END REQUEST DETAILS ===\n');
  
  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match all pages except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
