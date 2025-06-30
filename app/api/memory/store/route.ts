import { NextRequest, NextResponse } from 'next/server';
import { storeMemory } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      content, 
      contentType = 'insight',
      accessLevel = 'PRIVATE'
    }: { 
      content: string; 
      contentType?: string; 
      accessLevel?: string; 
    } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await storeMemory(content, contentType, accessLevel);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Memory store API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Memory store API is running' },
    { status: 200 }
  );
}
