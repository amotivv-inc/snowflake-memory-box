import { NextResponse } from 'next/server';
import { snowflakeAuth } from '@/lib/services/snowflake-auth';

export const runtime = "nodejs";

export async function GET() {
  try {
    const validation = snowflakeAuth.validateSecrets();
    
    return NextResponse.json({
      success: true,
      valid: validation.valid,
      missing: validation.missing,
      message: validation.valid 
        ? 'All secrets are properly configured!' 
        : `Missing secrets: ${validation.missing.join(', ')}`
    });
  } catch (error) {
    console.error('Error validating secrets:', error);
    return NextResponse.json({
      success: false,
      valid: false,
      missing: [],
      message: `Error validating secrets: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
