import { NextResponse } from 'next/server';
import { getDatabases } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function GET() {
  console.log('=== /api/data/databases called ===');
  
  try {
    console.log('Calling getDatabases...');
    const databases = await getDatabases();
    console.log('getDatabases returned:', databases);
    return NextResponse.json({ databases });
  } catch (error) {
    console.error('Error in /api/data/databases:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Log the actual error that's happening
    if (error instanceof TypeError) {
      console.error('TypeError details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch databases',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
