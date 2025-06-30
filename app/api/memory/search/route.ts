import { NextRequest, NextResponse } from 'next/server';
import { searchMemory } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      limit = 10, 
      threshold = 0.7, 
      contentType 
    }: { 
      query: string; 
      limit?: number; 
      threshold?: number; 
      contentType?: string; 
    } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await searchMemory(query, limit, threshold, contentType);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Memory search API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        memories: [], 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Memory search API is running' },
    { status: 200 }
  );
}
