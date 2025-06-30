// Custom server for Next.js API routes in SPCS
// Handles API endpoints directly without Next.js runtime complexity

const { createServer } = require('http');
const { parse } = require('url');

// Get configuration from environment
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

console.log(`> Starting API server on http://${hostname}:${port}`);
console.log(`> Environment: ${process.env.NODE_ENV}`);
console.log(`> Current directory: ${__dirname}`);

// Log environment variables for debugging
console.log('> Environment variables:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - PORT: ${process.env.PORT}`);
console.log(`  - HOSTNAME: ${process.env.HOSTNAME}`);
console.log(`  - USE_SPCS_IDENTITY: ${process.env.USE_SPCS_IDENTITY}`);
console.log(`  - SNOWFLAKE_ACCOUNT: ${process.env.SNOWFLAKE_ACCOUNT}`);
console.log(`  - SNOWFLAKE_DATABASE: ${process.env.SNOWFLAKE_DATABASE}`);
console.log(`  - SNOWFLAKE_SCHEMA: ${process.env.SNOWFLAKE_SCHEMA}`);
console.log(`  - SNOWFLAKE_WAREHOUSE: ${process.env.SNOWFLAKE_WAREHOUSE}`);

// Simple request handler that implements API endpoints directly
const handler = async (req, res) => {
  const parsedUrl = parse(req.url, true);
  const { pathname } = parsedUrl;
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
  
  // Add CORS headers for API routes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  try {
    // Health check endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        isSpcs: process.env.USE_SPCS_IDENTITY === 'true',
        snowflake: {
          account: process.env.SNOWFLAKE_ACCOUNT,
          database: process.env.SNOWFLAKE_DATABASE,
          schema: process.env.SNOWFLAKE_SCHEMA,
          warehouse: process.env.SNOWFLAKE_WAREHOUSE
        }
      }));
      return;
    }
    
    // Test endpoint
    if (pathname === '/api/test' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'API is working',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // For now, return 501 Not Implemented for other endpoints
    // We'll implement these as needed
    if (pathname.startsWith('/api/')) {
      res.statusCode = 501;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Not Implemented',
        message: `Endpoint ${pathname} is not yet implemented`,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Default 404 for non-API routes
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Route ${pathname} not found`,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('Error handling request:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    }));
  }
};

// Create the HTTP server
const server = createServer(handler);

server.listen(port, hostname, () => {
  console.log(`> Server ready on http://${hostname}:${port}`);
  console.log(`> Health check available at: http://${hostname}:${port}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
