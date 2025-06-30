import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/lib/services/snowflake';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Snowflake API envelope with SELECT 1...');
    
    // Test with a simple SELECT 1 query
    const result = await executeSQL('SELECT 1', 'NATIVE_MEMORY_POC', 'CORE');
    
    console.log('SELECT 1 test successful!');
    
    return NextResponse.json({
      success: true,
      message: 'API envelope test successful',
      result: result
    });
  } catch (error) {
    console.error('SELECT 1 test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'API envelope test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Also test the CALL statement with different NULL handling
export async function POST(request: NextRequest) {
  try {
    const { useNullKeyword } = await request.json();
    
    console.log('Testing CALL statement with NULL handling:', useNullKeyword ? 'NULL' : 'null');
    
    // Test with different NULL handling
    const nullValue = useNullKeyword ? 'NULL' : 'null';
    const sql = `CALL NATIVE_MEMORY_POC.CORE.SEARCH_MEMORY('test', 5, 0.5, ${nullValue})`;
    
    console.log('Executing SQL:', sql);
    
    const result = await executeSQL(sql, 'NATIVE_MEMORY_POC', 'CORE');
    
    console.log('CALL test successful!');
    
    return NextResponse.json({
      success: true,
      message: 'CALL test successful',
      result: result
    });
  } catch (error) {
    console.error('CALL test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'CALL test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
