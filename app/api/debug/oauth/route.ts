import { NextResponse } from 'next/server';
import fs from 'fs';
import { snowflakeAuth } from '@/lib/services/snowflake-auth';

export async function GET() {
  const debugInfo: any = {
    environment: {
      USE_SPCS_IDENTITY: process.env.USE_SPCS_IDENTITY,
      SNOWFLAKE_ACCOUNT: process.env.SNOWFLAKE_ACCOUNT,
      SNOWFLAKE_HOST: process.env.SNOWFLAKE_HOST,
      NODE_ENV: process.env.NODE_ENV,
    },
    tokenFile: {
      path: '/snowflake/session/token',
      exists: false,
      readable: false,
      size: 0,
      content: null,
      error: null
    },
    authTest: {
      success: false,
      tokenLength: 0,
      error: null
    }
  };

  // Check token file
  const tokenPath = '/snowflake/session/token';
  try {
    debugInfo.tokenFile.exists = fs.existsSync(tokenPath);
    
    if (debugInfo.tokenFile.exists) {
      // Check if readable
      try {
        fs.accessSync(tokenPath, fs.constants.R_OK);
        debugInfo.tokenFile.readable = true;
      } catch (e) {
        debugInfo.tokenFile.error = `File exists but not readable: ${e}`;
      }
      
      // Get file stats
      const stats = fs.statSync(tokenPath);
      debugInfo.tokenFile.size = stats.size;
      
      // Try to read content
      if (debugInfo.tokenFile.readable) {
        try {
          const content = fs.readFileSync(tokenPath, 'utf8');
          debugInfo.tokenFile.content = {
            length: content.length,
            preview: content.substring(0, 50) + '...',
            hasContent: content.trim().length > 0
          };
        } catch (e) {
          debugInfo.tokenFile.error = `Error reading file: ${e}`;
        }
      }
    }
  } catch (e) {
    debugInfo.tokenFile.error = `Error checking file: ${e}`;
  }

  // Test auth generation
  try {
    const token = snowflakeAuth.generateAuthToken();
    debugInfo.authTest.success = true;
    debugInfo.authTest.tokenLength = token.length;
  } catch (e) {
    debugInfo.authTest.error = e instanceof Error ? e.message : String(e);
  }

  // Check other potential token locations
  debugInfo.alternativeLocations = {
    '/snowflake/session': {
      exists: fs.existsSync('/snowflake/session'),
      contents: []
    },
    '/snowflake': {
      exists: fs.existsSync('/snowflake'),
      contents: []
    }
  };

  // List directory contents if they exist
  try {
    if (fs.existsSync('/snowflake/session')) {
      debugInfo.alternativeLocations['/snowflake/session'].contents = fs.readdirSync('/snowflake/session');
    }
  } catch (e) {
    debugInfo.alternativeLocations['/snowflake/session'].error = String(e);
  }

  try {
    if (fs.existsSync('/snowflake')) {
      debugInfo.alternativeLocations['/snowflake'].contents = fs.readdirSync('/snowflake');
    }
  } catch (e) {
    debugInfo.alternativeLocations['/snowflake'].error = String(e);
  }

  return NextResponse.json(debugInfo, { status: 200 });
}
