// Snowflake Authentication Service with Secrets Management
// Works with both local development and SPCS deployment

import jwt from 'jsonwebtoken';
import fs from 'fs';

export class SnowflakeAuthService {
  /**
   * Get secret from environment with proper error handling
   * In SPCS, these are automatically mounted from Snowflake secrets
   */
  private static getSecretFromEnv(secretName: string): string {
    const value = process.env[secretName];
    if (!value || value.startsWith('<')) {
      throw new Error(
        `Required secret ${secretName} not found or not configured. ` +
        `In SPCS, this would be automatically mounted from Snowflake secrets.`
      );
    }
    return value;
  }

  /**
   * Get SPCS OAuth token from the mounted file
   */
  static getSpcsOAuthToken(): string {
    try {
      const tokenPath = '/snowflake/session/token';
      console.log(`[SPCS Auth] Attempting to read OAuth token from: ${tokenPath}`);
      
      // Check if file exists
      if (!fs.existsSync(tokenPath)) {
        console.error(`[SPCS Auth] Token file does not exist at: ${tokenPath}`);
        throw new Error(`OAuth token file not found at ${tokenPath}`);
      }
      
      // Check if file is readable
      try {
        fs.accessSync(tokenPath, fs.constants.R_OK);
      } catch (accessError) {
        console.error(`[SPCS Auth] Token file exists but is not readable: ${accessError}`);
        throw new Error(`OAuth token file not readable at ${tokenPath}`);
      }
      
      // Read the token
      const token = fs.readFileSync(tokenPath, 'utf8').trim();
      console.log(`[SPCS Auth] Successfully read OAuth token (length: ${token.length})`);
      console.log(`[SPCS Auth] Token preview: ${token.substring(0, 20)}...`);
      
      return token;
    } catch (error) {
      console.error(`[SPCS Auth] Failed to read SPCS OAuth token:`, error);
      throw new Error(`Failed to read SPCS OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate authentication token based on environment
   * Uses SPCS OAuth token when available, otherwise falls back to JWT
   */
  static generateAuthToken(): string {
    console.log('\n=== SNOWFLAKE AUTH TOKEN GENERATION ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('USE_SPCS_IDENTITY:', process.env.USE_SPCS_IDENTITY);
    console.log('Environment:', process.env.NODE_ENV);
    
    // Check if we're using SPCS identity
    if (process.env.USE_SPCS_IDENTITY === 'true') {
      console.log('Using SPCS OAuth token...');
      return this.getSpcsOAuthToken();
    }
    
    // Fall back to JWT for local development
    console.log('Using JWT authentication...');
    return this.generateJWT();
  }

  /**
   * Generate JWT token for Snowflake API authentication
   * Uses secrets that are mounted in SPCS or provided via environment variables
   */
  static generateJWT(): string {
    try {
      // Get configuration from environment (SPCS will mount these automatically)
      const account = this.getSecretFromEnv('SNOWFLAKE_ACCOUNT').toUpperCase();
      const username = this.getSecretFromEnv('SNOWFLAKE_USERNAME');
      let privateKey = this.getSecretFromEnv('SNOWFLAKE_PRIVATE_KEY');
      const publicKeyFingerprint = this.getSecretFromEnv('SNOWFLAKE_PUBLIC_KEY_FP');
      
      // Convert literal \n to actual newlines if needed
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      const qualifiedUsername = `${account}.${username}`;
      
      const payload = {
        iss: `${qualifiedUsername}.${publicKeyFingerprint}`,
        sub: qualifiedUsername,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
      };

      return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    } catch (error) {
      console.error('Error generating JWT:', error);
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get OAuth credentials for Model A (Customer Self-Deploy)
   */
  static getOAuthCredentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: this.getSecretFromEnv('OAUTH_CLIENT_ID'),
      clientSecret: this.getSecretFromEnv('OAUTH_CLIENT_SECRET')
    };
  }

  /**
   * Get Service Account credentials for Model B (Managed Service)
   */
  static getServiceAccountCredentials(): { username: string; password: string } {
    return {
      username: this.getSecretFromEnv('SERVICE_ACCOUNT_USER'),
      password: this.getSecretFromEnv('SERVICE_ACCOUNT_PASSWORD')
    };
  }

  /**
   * Get environment configuration
   */
  static getEnvironmentConfig(): any {
    const configStr = process.env.MEMORY_BOX_CONFIG || '{}';
    try {
      return JSON.parse(configStr);
    } catch {
      return { environment: 'development', debug: false };
    }
  }

  /**
   * Check if running in SPCS environment
   */
  static isRunningInSPCS(): boolean {
    // Simply check if USE_SPCS_IDENTITY is set to 'true'
    // This is an environment variable we control and set in our deployment
    // The other variables (SNOWFLAKE_SERVICE_CONTEXT, SF_CONTEXT_CURRENT_USER) 
    // are actually HTTP headers, not environment variables
    return process.env.USE_SPCS_IDENTITY === 'true';
  }

  /**
   * Get current authentication mode for demo
   */
  static getAuthenticationMode(): 'oauth' | 'service' | 'native' {
    // This can be configured via environment or determined by context
    if (process.env.AUTH_MODE) {
      return process.env.AUTH_MODE as any;
    }
    
    // Default logic based on environment
    if (this.isRunningInSPCS()) {
      return 'service'; // SPCS typically uses service account
    }
    
    return 'oauth'; // Default to OAuth for customer deployments
  }

  /**
   * Validate that all required secrets are configured
   */
  static validateSecrets(): { valid: boolean; missing: string[] } {
    const required = [
      'SNOWFLAKE_ACCOUNT',
      'SNOWFLAKE_USERNAME',
      'SNOWFLAKE_PRIVATE_KEY',
      'SNOWFLAKE_PUBLIC_KEY_FP'
    ];

    const missing: string[] = [];
    
    for (const secret of required) {
      try {
        this.getSecretFromEnv(secret);
      } catch {
        missing.push(secret);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

/**
 * Export a singleton instance for convenience
 */
export const snowflakeAuth = SnowflakeAuthService;
