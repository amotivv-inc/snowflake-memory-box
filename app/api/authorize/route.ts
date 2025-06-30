// Authorization endpoint for SPCS authentication
// Reads the Sf-Context-Current-User header and returns user context

import { NextRequest, NextResponse } from 'next/server';
import { snowflakeAuth } from '@/lib/services/snowflake-auth';

export async function GET(request: NextRequest) {
  try {
    // Get the SPCS user header
    const snowflakeUser = request.headers.get('sf-context-current-user');
    
    if (!snowflakeUser) {
      // In development, allow a default user
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          user: 'development',
          authenticated: true,
          authMethod: 'development',
          isSpcs: false
        });
      }
      
      return NextResponse.json(
        { error: 'No authenticated user found' },
        { status: 401 }
      );
    }

    // For Memory Box, any authenticated Snowflake user can use the app
    // In a production scenario, you might want to check against a users table
    // or validate specific roles
    
    return NextResponse.json({
      user: snowflakeUser,
      authenticated: true,
      authMethod: 'snowflake',
      isSpcs: snowflakeAuth.isRunningInSPCS(),
      // Additional context can be added here based on your needs
      // For example, user preferences, settings, etc.
    });

  } catch (error) {
    console.error('Authorization error:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    );
  }
}

// Also support POST for future extensions
export async function POST(request: NextRequest) {
  return GET(request);
}
