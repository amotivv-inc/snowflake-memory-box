import snowflake from 'snowflake-sdk';
import { snowflakeAuth } from './snowflake-auth';

// Configure Snowflake connection using the auth service
function getConnectionOptions() {
  // Check if we're using SPCS identity
  if (process.env.USE_SPCS_IDENTITY === 'true' && snowflakeAuth.isRunningInSPCS()) {
    console.log('=== SNOWFLAKE SDK CONNECTION CONFIG ===');
    console.log('Using SPCS OAuth authentication');
    console.log('Environment variables:');
    console.log('  SNOWFLAKE_ACCOUNT:', process.env.SNOWFLAKE_ACCOUNT);
    console.log('  SNOWFLAKE_USERNAME:', process.env.SNOWFLAKE_USERNAME);
    console.log('  SNOWFLAKE_HOST:', process.env.SNOWFLAKE_HOST);
    console.log('  USE_SPCS_IDENTITY:', process.env.USE_SPCS_IDENTITY);
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    
    // Validate required parameters
    if (!process.env.SNOWFLAKE_ACCOUNT) {
      throw new Error('SNOWFLAKE_ACCOUNT environment variable is not set');
    }
    // Note: Username is not required for OAuth - it's extracted from the token
    
    // Try to get OAuth token with error handling
    let token: string;
    try {
      console.log('Attempting to get SPCS OAuth token...');
      token = snowflakeAuth.getSpcsOAuthToken();
      console.log('Successfully retrieved OAuth token');
    } catch (error) {
      console.error('Failed to get SPCS OAuth token:', error);
      throw new Error(`Failed to get SPCS OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Build config object
    const config: any = {
      account: process.env.SNOWFLAKE_ACCOUNT,
      authenticator: 'OAUTH',
      token: token
      // Note: username is not included - it's extracted from the OAuth token
    };
    
    // Only add host if it's defined and not empty
    if (process.env.SNOWFLAKE_HOST && process.env.SNOWFLAKE_HOST.trim() !== '') {
      config.host = process.env.SNOWFLAKE_HOST;
    }
    
    // Log the final config (with token redacted)
    console.log('Final config:', {
      ...config,
      token: config.token ? `${config.token.substring(0, 20)}...` : 'undefined'
    });
    console.log('Final config keys:', Object.keys(config));
    console.log('Config values defined:');
    Object.keys(config).forEach(key => {
      console.log(`  ${key}: ${config[key] !== undefined ? 'defined' : 'undefined'}`);
    });
    console.log('=== END CONNECTION CONFIG ===');
    
    return config;
  }
  
  // Fall back to JWT for local development
  console.log('Using JWT authentication for local development');
  
  const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SNOWFLAKE_PRIVATE_KEY is not set. This is required for JWT authentication in non-SPCS environments.');
  }
  
  // Handle newline conversion if needed
  const formattedPrivateKey = privateKey.includes('\\n') 
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;
  
  return {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    authenticator: 'SNOWFLAKE_JWT',
    privateKey: formattedPrivateKey,
  };
}

// Create connection pool
let connectionPool: snowflake.Connection | null = null;

export async function getConnection(): Promise<snowflake.Connection> {
  if (connectionPool) {
    return connectionPool;
  }

  return new Promise((resolve, reject) => {
    try {
      const options = getConnectionOptions();
      console.log('Creating Snowflake connection with options:', {
        ...options,
        token: options.token ? `${options.token.substring(0, 20)}...` : undefined,
        privateKey: options.privateKey ? '[REDACTED]' : undefined
      });
      
      connectionPool = snowflake.createConnection(options);
      
      connectionPool.connect((err, conn) => {
        if (err) {
          console.error('Unable to connect to Snowflake:', err);
          console.error('Error details:', {
            message: err.message,
            code: (err as any).code,
            sqlState: (err as any).sqlState,
            stack: err.stack
          });
          connectionPool = null;
          reject(err);
        } else {
          console.log('Successfully connected to Snowflake');
          resolve(conn);
        }
      });
    } catch (error) {
      console.error('Error creating Snowflake connection:', error);
      connectionPool = null;
      reject(error);
    }
  });
}

export async function executeQuery(query: string): Promise<any[]> {
  const connection = await getConnection();
  
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: query,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error('Failed to execute query:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    });
  });
}

// Get all accessible databases
export async function getDatabases(): Promise<string[]> {
  console.log('=== getDatabases called ===');
  
  try {
    console.log('About to execute SHOW DATABASES query...');
    const query = `SHOW DATABASES`;
    const rows = await executeQuery(query);
    
    // Comprehensive logging
    console.log('=== SNOWFLAKE SDK DEBUG ===');
    console.log('Query executed successfully');
    console.log('Total rows returned:', rows.length);
    console.log('Type of rows:', typeof rows);
    console.log('Is rows an array?', Array.isArray(rows));
    
    if (rows.length > 0) {
      console.log('First row type:', typeof rows[0]);
      console.log('First row is array?', Array.isArray(rows[0]));
      console.log('First row structure:', JSON.stringify(rows[0], null, 2));
      
      // If it's an object, show keys
      if (typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
        console.log('First row keys:', Object.keys(rows[0]));
      }
      
      // If it's an array, show length and values
      if (Array.isArray(rows[0])) {
        console.log('First row array length:', rows[0].length);
        console.log('First row array values:', rows[0]);
      }
    }
    console.log('=== END SNOWFLAKE SDK DEBUG ===');
    
    // Try to handle both array and object formats
    const mappedRows = rows.map((row, index) => {
      let dbName;
      
      // If row is an array, the name might be at a specific index
      if (Array.isArray(row)) {
        // Common positions for database name in SHOW DATABASES result
        dbName = row[1] || row[0]; // Usually name is at index 1
        console.log(`Row ${index} (array): position 0=${row[0]}, position 1=${row[1]}`);
      } else if (typeof row === 'object') {
        // Handle object format with various possible column names
        dbName = row.name || row.NAME || row.database_name || row.DATABASE_NAME;
        if (!dbName) {
          console.log(`Row ${index} (object) keys:`, Object.keys(row));
        }
      }
      
      if (!dbName) {
        console.warn(`Row ${index} missing database name:`, JSON.stringify(row, null, 2));
        return null;
      }
      
      return dbName;
    });
    
    console.log('About to filter rows...');
    const filtered = mappedRows.filter(name => {
      console.log('Filtering name:', name);
      // Filter out null values and system databases
      return name && !['SNOWFLAKE', 'SNOWFLAKE_SAMPLE_DATA'].includes(name);
    });
    
    console.log('Filtered databases:', filtered);
    return filtered;
  } catch (error) {
    console.error('Error in getDatabases:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error; // Re-throw to see where it's caught
  }
}

// Get all accessible schemas in a database
export async function getSchemas(database: string): Promise<string[]> {
  try {
    const query = `SHOW SCHEMAS IN DATABASE IDENTIFIER('${database}')`;
    const rows = await executeQuery(query);
    
    // Log the structure for debugging
    if (rows.length > 0) {
      console.log('Schema row structure:', JSON.stringify(rows[0], null, 2));
    }
    
    return rows.map(row => {
      // Handle both uppercase and lowercase column names
      const schemaName = row.name || row.NAME || row.schema_name || row.SCHEMA_NAME;
      
      if (!schemaName) {
        console.warn('Row missing schema name:', JSON.stringify(row, null, 2));
        return null;
      }
      
      return schemaName;
    }).filter(name => 
      // Filter out null values and system schemas
      name && !['INFORMATION_SCHEMA'].includes(name)
    );
  } catch (error) {
    console.error('Error fetching schemas:', error);
    return [];
  }
}

// Get tables in a schema
export async function getTables(database: string, schema: string): Promise<any[]> {
  try {
    const fullSchema = `${database}.${schema}`;
    const query = `SHOW TABLES IN SCHEMA IDENTIFIER('${fullSchema}')`;
    const rows = await executeQuery(query);
    
    // Log the structure for debugging
    if (rows.length > 0) {
      console.log('Table row structure:', JSON.stringify(rows[0], null, 2));
    }
    
    return rows.map(row => {
      // Handle both uppercase and lowercase column names
      const tableName = row.name || row.NAME || row.table_name || row.TABLE_NAME;
      const rowCount = row.rows || row.ROWS || row.row_count || row.ROW_COUNT || 0;
      const createdOn = row.created_on || row.CREATED_ON || row.created || row.CREATED;
      const comment = row.comment || row.COMMENT || '';
      
      if (!tableName) {
        console.warn('Row missing table name:', JSON.stringify(row, null, 2));
        return null;
      }
      
      return {
        name: tableName,
        database: database,
        schema: schema,
        rows: rowCount,
        created: createdOn,
        comment: comment
      };
    }).filter(table => table !== null); // Filter out null values
  } catch (error) {
    console.error('Error fetching tables:', error);
    return [];
  }
}

// Get table preview (first 10 rows)
export async function getTablePreview(database: string, schema: string, table: string): Promise<any[]> {
  try {
    const query = `
      SELECT * FROM ${database}.${schema}.${table}
      LIMIT 10
    `;
    return await executeQuery(query);
  } catch (error) {
    console.error('Error fetching table preview:', error);
    return [];
  }
}

// Get table columns
export async function getTableColumns(database: string, schema: string, table: string): Promise<any[]> {
  try {
    const query = `
      DESCRIBE TABLE ${database}.${schema}.${table}
    `;
    return await executeQuery(query);
  } catch (error) {
    console.error('Error fetching table columns:', error);
    return [];
  }
}

// Execute a custom query on selected tables
export async function queryTables(tables: string[], query: string): Promise<any[]> {
  try {
    // Replace table placeholders in the query
    let processedQuery = query;
    tables.forEach((table, index) => {
      processedQuery = processedQuery.replace(new RegExp(`\\$${index + 1}`, 'g'), table);
    });
    
    return await executeQuery(processedQuery);
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Get authentication token based on environment
function getAuthToken(): string {
  return snowflakeAuth.generateAuthToken();
}

// Get authentication headers based on environment
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const isSpcs = process.env.USE_SPCS_IDENTITY === 'true' && snowflakeAuth.isRunningInSPCS();
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'snowflake-memory-box/1.0',
    // Use OAuth for SPCS, JWT for local
    'X-Snowflake-Authorization-Token-Type': isSpcs ? 'OAUTH' : 'KEYPAIR_JWT'
  };
}

export async function executeSQL(sql: string, database?: string, schema?: string): Promise<any> {
  const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase();
  const isSpcs = process.env.USE_SPCS_IDENTITY === 'true' && snowflakeAuth.isRunningInSPCS();
  
  // Use internal host for SPCS, external for local
  const baseURL = isSpcs && process.env.SNOWFLAKE_HOST
    ? `https://${process.env.SNOWFLAKE_HOST}/api/v2/statements`
    : `https://${account}.snowflakecomputing.com/api/v2/statements`;
  
  const requestBody = {
    statement: sql,
    timeout: 60,
    database: database || process.env.SNOWFLAKE_DATABASE || 'NATIVE_MEMORY_POC',
    schema: schema || process.env.SNOWFLAKE_SCHEMA || 'CORE',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'MEMORY_BOX_WAREHOUSE'
    // Don't specify role when using SPCS identity - it uses the service's owner role
  };
  
  // Add role only for non-SPCS environments
  if (!isSpcs) {
    (requestBody as any).role = 'ACCOUNTADMIN';
  }
  
  console.log('Executing SQL with request body:', JSON.stringify(requestBody, null, 2));
  
  const response = await fetch(baseURL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(requestBody)
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response body:', errorText);
    throw new Error(`Snowflake API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Success response:', JSON.stringify(result, null, 2));
  return result;
}

// Cortex Analyst Operations
export async function queryCortexAnalyst(
  messages: any[], 
  selectedTables: string[]
): Promise<{ 
  success: boolean; 
  answer?: string; 
  sql?: string; 
  data?: any[]; 
  error?: string 
}> {
  console.log('=== CORTEX ANALYST DEBUG ===');
  console.log('Messages:', JSON.stringify(messages, null, 2));
  console.log('Selected tables:', selectedTables);
  
  const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase();
  const isSpcs = process.env.USE_SPCS_IDENTITY === 'true' && snowflakeAuth.isRunningInSPCS();
  
  // Use internal host for SPCS, external for local
  const cortexUrl = isSpcs && process.env.SNOWFLAKE_HOST
    ? `https://${process.env.SNOWFLAKE_HOST}/api/v2/cortex/analyst/message`
    : `https://${account}.snowflakecomputing.com/api/v2/cortex/analyst/message`;
  
  console.log('Cortex URL:', cortexUrl);
  console.log('Is SPCS:', isSpcs);
  
  // Use the existing semantic model file (like v2 implementation)
  const requestBody = {
    messages: messages,
    semantic_model_file: '@"NONPROFIT_POC"."PUBLIC"."SEMANTIC_MODELS"/nonprofit_semantic_model.yaml'
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const headers = getAuthHeaders();
    console.log('Request headers:', {
      ...headers,
      'Authorization': headers.Authorization ? `Bearer ${headers.Authorization.substring(7, 27)}...` : 'missing'
    });
    
    const response = await fetch(cortexUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cortex Analyst API error:', response.status, errorText);
      
      // Try to parse error for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Parsed error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Not JSON, that's ok
      }
      
      return {
        success: false,
        error: `Cortex Analyst API error: ${response.status} - ${errorText}`
      };
    }

    const result = await response.json();
    console.log('Cortex response:', JSON.stringify(result, null, 2));
    
    // Extract the response content
    if (result.message && result.message.content) {
      let answer = '';
      let sql = '';
      
      // Parse the content array
      for (const contentItem of result.message.content) {
        if (contentItem.type === 'text') {
          answer = contentItem.text || '';
        } else if (contentItem.type === 'sql') {
          sql = contentItem.statement || '';
        }
      }

      // If SQL was generated, execute it
      let data = [];
      if (sql) {
        try {
          const sqlResult = await executeSQL(sql);
          data = sqlResult.data || [];
        } catch (sqlError) {
          console.error('Error executing Cortex-generated SQL:', sqlError);
          return {
            success: true,
            answer,
            sql,
            data: [],
            error: `SQL execution failed: ${sqlError instanceof Error ? sqlError.message : 'Unknown error'}`
          };
        }
      }

      return {
        success: true,
        answer,
        sql,
        data
      };
    }

    return {
      success: true,
      answer: JSON.stringify(result),
      sql: '',
      data: []
    };

  } catch (error) {
    console.error('Error calling Cortex Analyst:', error);
    return {
      success: false,
      error: `Error calling Cortex Analyst: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function createDynamicSemanticModel(selectedTables: string[]): any {
  const tables = selectedTables.map(tableFullName => {
    const [database, schema, table] = tableFullName.split('.');
    return {
      name: table,
      base_table: {
        database: database,
        schema: schema,
        table: table
      }
    };
  });

  return {
    name: "dynamic_model",
    tables: tables
  };
}

// Memory Operations (from v2 implementation)
export async function storeMemory(content: string, contentType: string, accessLevel: string = 'PRIVATE'): Promise<any> {
  const escapedContent = content.replace(/'/g, "''");
  const sql = `CALL NATIVE_MEMORY_POC.CORE.STORE_MEMORY('${escapedContent}', '${contentType}', '${accessLevel}')`;
  
  try {
    const result = await executeSQL(sql, 'NATIVE_MEMORY_POC', 'CORE');
    return {
      success: true,
      data: result.data || [],
      message: 'Memory stored successfully',
      memoryId: result.data?.[0]?.MEMORY_ID || `mem_${Date.now()}`
    };
  } catch (error) {
    console.error('Error storing memory:', error);
    return {
      success: false,
      message: `Error storing memory: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function searchMemory(query: string, limit: number = 10, threshold: number = 0.7, contentType?: string): Promise<{ success: boolean; memories: any[]; message: string }> {
  const escapedQuery = query.replace(/'/g, "''");
  const contentTypeFilter = contentType ? `AND m.content_type = '${contentType}'` : '';
  
  // Execute the search query directly without functions or procedures
  const sql = `
    SELECT 
      m.memory_id,
      m.content,
      m.content_type,
      VECTOR_COSINE_SIMILARITY(m.embedding, SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', '${escapedQuery}')) as similarity_score,
      m.owner_user,
      m.access_level,
      m.created_at,
      m.source_database,
      m.source_query
    FROM NATIVE_MEMORY_POC.CORE.MEMORIES m
    WHERE 
      VECTOR_COSINE_SIMILARITY(m.embedding, SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', '${escapedQuery}')) >= ${threshold}
      ${contentTypeFilter}
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `;
  
  console.log('Executing search memory SQL:', sql); // Debug log
  
  try {
    const result = await executeSQL(sql, 'NATIVE_MEMORY_POC', 'CORE');
    
    // Transform array data to objects with expected property names
    const transformedMemories = (result.data || []).map((row: any[]) => ({
      MEMORY_ID: row[0],
      CONTENT: row[1],
      CONTENT_TYPE: row[2],
      SIMILARITY_SCORE: parseFloat(row[3]),
      OWNER_USER: row[4],
      ACCESS_LEVEL: row[5],
      CREATED_AT: row[6],
      SOURCE_DATABASE: row[7],
      SOURCE_QUERY: row[8]
    }));
    
    return {
      success: true,
      memories: transformedMemories,
      message: `Found ${transformedMemories.length} memories`
    };
  } catch (error) {
    console.error('Error searching memories:', error);
    return {
      success: false,
      memories: [],
      message: `Error searching memories: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
