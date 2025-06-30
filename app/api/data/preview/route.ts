import { NextRequest, NextResponse } from 'next/server';
import { getTablePreview, getTableColumns } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const database = searchParams.get('database');
    const schema = searchParams.get('schema');
    const table = searchParams.get('table');
    
    if (!database || !schema || !table) {
      return NextResponse.json(
        { error: 'Database, schema and table parameters are required' },
        { status: 400 }
      );
    }
    
    const [preview, columns] = await Promise.all([
      getTablePreview(database, schema, table),
      getTableColumns(database, schema, table)
    ]);
    
    return NextResponse.json({ 
      preview,
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: col['null?'] === 'Y',
        comment: col.comment || ''
      }))
    });
  } catch (error) {
    console.error('Error in /api/data/preview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table preview' },
      { status: 500 }
    );
  }
}
