import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for frontend build
  output: process.env.BUILD_MODE === 'export' ? 'export' : 'standalone',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  
  // API routes configuration
  async rewrites() {
    // In production, API routes are handled by the backend service
    if (process.env.NODE_ENV === 'production' && process.env.BUILD_MODE === 'export') {
      return [];
    }
    return [];
  },
  
  // Environment variables that should be available in the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
  
  // Production optimizations
  reactStrictMode: true,
  
  // Trailing slash for static export
  trailingSlash: process.env.BUILD_MODE === 'export',
  
  // Disable type checking and linting during build for containerization
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
