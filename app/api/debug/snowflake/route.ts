// Debug endpoint to test Snowflake connectivity and configuration
import { NextResponse } from 'next/server';
import { snowflakeAuth } from '@/lib/services/snowflake-auth';

export const runtime = "nodejs";
export const maxDuration = 30;

interface DebugResult {
  step: string;
  success: boolean;
  details: any;
  error?: string;
}

export async function GET() {
  const results: DebugResult[] = [];
  
  // Step 1: Check environment variables
  try {
    const envVars = {
      SNOWFLAKE_ACCOUNT: process.env.SNOWFLAKE_ACCOUNT,
      SNOWFLAKE_DATABASE: process.env.SNOWFLAKE_DATABASE,
      SNOWFLAKE_SCHEMA: process.env.SNOWFLAKE_SCHEMA,
      SNOWFLAKE_WAREHOUSE: process.env.SNOWFLAKE_WAREHOUSE,
      USE_SPCS_IDENTITY: process.env.USE_SPCS_IDENTITY,
      SNOWFLAKE_HOST: process.env.SNOWFLAKE_HOST,
      NODE_ENV: process.env.NODE_ENV,
    };
    
    const missingVars = Object.entries(envVars)
      .filter(([key, value]) => !value && key !== 'SNOWFLAKE_HOST')
      .map(([key]) => key);
    
    results.push({
      step: 'Environment Variables',
      success: missingVars.length === 0,
      details: {
        ...envVars,
        missingVars,
        isSpcs: envVars.USE_SPCS_IDENTITY === 'true'
      },
      error: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined
    });
  } catch (error) {
    results.push({
      step: 'Environment Variables',
      success: false,
      details: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // Step 2: Test token generation
  let token = '';
  try {
    console.log('[Debug] Generating auth token...');
    token = snowflakeAuth.generateAuthToken();
    
    // Decode JWT to check structure (without verifying signature)
    let tokenInfo: any = {};
    if (token && !token.startsWith('SPCS_')) {
      // It's a JWT token
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          tokenInfo = {
            type: 'JWT',
            issuer: payload.iss,
            subject: payload.sub,
            issuedAt: new Date(payload.iat * 1000).toISOString(),
            expiresAt: new Date(payload.exp * 1000).toISOString(),
          };
        } catch (e) {
          tokenInfo = { type: 'JWT', error: 'Failed to decode' };
        }
      }
    } else {
      tokenInfo = { type: 'SPCS OAuth Token' };
    }
    
    results.push({
      step: 'Token Generation',
      success: true,
      details: {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        tokenInfo,
        authMode: process.env.USE_SPCS_IDENTITY === 'true' ? 'SPCS OAuth' : 'JWT'
      }
    });
  } catch (error) {
    results.push({
      step: 'Token Generation',
      success: false,
      details: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // Step 3: Test basic Snowflake API connectivity
  if (token) {
    try {
      const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase();
      const isSpcs = process.env.USE_SPCS_IDENTITY === 'true';
      
      // Test with a simple endpoint - list databases
      const apiUrl = isSpcs && process.env.SNOWFLAKE_HOST
        ? `https://${process.env.SNOWFLAKE_HOST}/api/v2/databases`
        : `https://${account}.snowflakecomputing.com/api/v2/databases`;
      
      console.log('[Debug] Testing API connectivity to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Snowflake-Authorization-Token-Type': isSpcs ? 'OAUTH' : 'KEYPAIR_JWT'
        }
      });
      
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { raw: responseText.substring(0, 500) };
      }
      
      results.push({
        step: 'Snowflake API Connectivity',
        success: response.ok,
        details: {
          url: apiUrl,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          response: responseData
        },
        error: !response.ok ? `HTTP ${response.status}: ${response.statusText}` : undefined
      });
    } catch (error) {
      results.push({
        step: 'Snowflake API Connectivity',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Step 4: Test Cortex API
  if (token) {
    try {
      const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase();
      const isSpcs = process.env.USE_SPCS_IDENTITY === 'true';
      
      const cortexUrl = isSpcs && process.env.SNOWFLAKE_HOST
        ? `https://${process.env.SNOWFLAKE_HOST}/api/v2/cortex/inference:complete`
        : `https://${account}.snowflakecomputing.com/api/v2/cortex/inference:complete`;
      
      console.log('[Debug] Testing Cortex API:', cortexUrl);
      
      // Simple test payload
      const payload = {
        model: 'claude-3-5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from Snowflake Cortex!"'
          }
        ],
        max_tokens: 50,
        top_p: 1
      };
      
      const response = await fetch(cortexUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'snowflake-memory-box/1.0',
          'X-Snowflake-Authorization-Token-Type': isSpcs ? 'OAUTH' : 'KEYPAIR_JWT'
        },
        body: JSON.stringify(payload)
      });
      
      const responseText = await response.text();
      let responseData: any;
      try {
        // Try to parse as JSON first
        responseData = JSON.parse(responseText);
      } catch (e) {
        // If not JSON, might be SSE format
        if (responseText.includes('data: ')) {
          responseData = { 
            format: 'SSE',
            preview: responseText.substring(0, 500),
            chunks: responseText.split('\n').filter(line => line.startsWith('data: ')).length
          };
        } else {
          responseData = { raw: responseText.substring(0, 500) };
        }
      }
      
      results.push({
        step: 'Cortex API Test',
        success: response.ok,
        details: {
          url: cortexUrl,
          status: response.status,
          statusText: response.statusText,
          requestPayload: payload,
          response: responseData
        },
        error: !response.ok ? `HTTP ${response.status}: ${response.statusText}` : undefined
      });
    } catch (error) {
      results.push({
        step: 'Cortex API Test',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Summary
  const allSuccess = results.every(r => r.success);
  const summary = {
    overall: allSuccess ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
    results
  };
  
  return NextResponse.json(summary, {
    status: allSuccess ? 200 : 500,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}
