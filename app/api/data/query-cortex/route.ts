import { NextRequest, NextResponse } from 'next/server';
import { queryCortexAnalyst } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { query, selectedTables } = await request.json();

    if (!query || !selectedTables || !Array.isArray(selectedTables)) {
      return NextResponse.json(
        { error: 'Query and selectedTables are required' },
        { status: 400 }
      );
    }

    // Build messages array for Cortex Analyst
    const cortexMessages = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: query }]
      }
    ];

    const result = await queryCortexAnalyst(cortexMessages, selectedTables);

    if (result.success) {
      return NextResponse.json({
        success: true,
        answer: result.answer,
        sql: result.sql,
        data: result.data,
        rowCount: result.data?.length || 0,
        selectedTables
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to query data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in query-cortex API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
