import { NextRequest, NextResponse } from 'next/server';
import { getTables } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const database = searchParams.get('database');
    const schema = searchParams.get('schema');
    
    if (!database || !schema) {
      return NextResponse.json(
        { error: 'Database and schema parameters are required' },
        { status: 400 }
      );
    }
    
    const tables = await getTables(database, schema);
    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Error in /api/data/tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
