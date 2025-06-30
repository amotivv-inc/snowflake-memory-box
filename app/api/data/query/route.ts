import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { query, tables } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // If tables are provided, we can add context or validation
    // For now, we'll execute the query as-is
    const results = await executeQuery(query);
    
    return NextResponse.json({ 
      results,
      rowCount: results.length,
      query: query
    });
  } catch (error: any) {
    console.error('Error in /api/data/query:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute query',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
