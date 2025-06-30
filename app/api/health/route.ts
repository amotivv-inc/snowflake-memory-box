// Health check endpoint for SPCS readiness probes
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check response
    const health = {
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
    };

    // Simple health check - just verify the service is running
    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
