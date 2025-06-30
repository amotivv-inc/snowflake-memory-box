import { NextRequest, NextResponse } from 'next/server';
import { getSchemas } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const database = searchParams.get('database');
    
    if (!database) {
      return NextResponse.json(
        { error: 'Database parameter is required' },
        { status: 400 }
      );
    }
    
    const schemas = await getSchemas(database);
    return NextResponse.json({ schemas });
  } catch (error) {
    console.error('Error in /api/data/schemas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schemas' },
      { status: 500 }
    );
  }
}
