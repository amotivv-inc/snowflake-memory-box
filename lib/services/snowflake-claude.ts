// Snowflake Claude 3.5 Integration Service
// Based on Streamlit POC patterns for SPCS deployment

import { snowflakeAuth } from './snowflake-auth';

interface SnowflakeMessage {
  role: 'user' | 'assistant';
  content: string;
  content_list?: Array<{
    type: 'text' | 'tool_use' | 'tool_results';
    text?: string;
    tool_use?: {
      tool_use_id: string;
      name: string;
      input: any;
    };
    tool_results?: {
      tool_use_id: string;
      name: string;
      content: Array<{
        type: 'text';
        text: string;
      }>;
    };
  }>;
}

interface SnowflakeToolSpec {
  tool_spec: {
    type: 'generic';
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      required: string[];
      properties: Record<string, any>;
    };
  };
}

interface SnowflakeResponse {
  success: boolean;
  content?: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  error?: string;
}

const API_ENDPOINT = "/api/v2/cortex/inference:complete";
const CLAUDE_MODEL = "claude-3-5-sonnet";
const API_TIMEOUT = 60000; // 60 seconds


/**
 * Transform Anthropic-style messages to Snowflake format
 * Based on working Streamlit code - ALL messages need content AND content_list
 */
export function transformMessagesToSnowflakeFormat(
  messages: any[]
): SnowflakeMessage[] {
  return messages.map(msg => {
    // Handle tool result messages (AI SDK sends these with role "tool")
    if (msg.role === 'tool') {
      console.log('Processing tool result message:', JSON.stringify(msg, null, 2));
      
      // AI SDK sends tool results with content array containing tool-result objects
      let toolName = 'unknown_tool';
      let toolCallId = 'unknown_id';
      let resultText = '';
      
      // Handle AI SDK format where content is an array of tool results
      if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'tool-result') {
            toolCallId = item.toolCallId;
            toolName = item.toolName;
            resultText = typeof item.result === 'string' ? item.result : JSON.stringify(item.result);
            console.log('Extracted tool result:', { toolName, toolCallId, resultText });
            break; // Use the first tool result
          }
        }
      } else if (typeof msg.content === 'string' && msg.content.startsWith('[')) {
        // Legacy format handling
        try {
          const parsed = JSON.parse(msg.content);
          console.log('Parsed tool result content:', parsed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const toolResult = parsed[0];
            toolCallId = toolResult.toolCallId || toolCallId;
            toolName = toolResult.toolName || toolName;
            resultText = toolResult.result || JSON.stringify(toolResult);
          }
        } catch (e) {
          console.warn('Failed to parse tool result content:', e);
          resultText = msg.content;
        }
      } else {
        // Fallback to direct properties
        console.log('Using fallback properties for tool result');
        toolName = msg.toolName || toolName;
        toolCallId = msg.toolCallId || msg.tool_call_id || toolCallId;
        resultText = msg.result || msg.content || '{}';
      }
      
      console.log('Tool result transformation:', { toolName, toolCallId, resultText });
      
      return {
        role: 'user',
        content: `Tool result for ${toolName}`,
        content_list: [
          {
            type: 'tool_results',
            tool_results: {
              tool_use_id: toolCallId,
              name: toolName,
              content: [
                {
                  type: 'text',
                  text: typeof resultText === 'string' ? resultText : JSON.stringify(resultText)
                }
              ]
            }
          }
        ]
      };
    }
    
    // Handle assistant messages that might have tool calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      const textContent = msg.content || "I'll help you with that.";
      const content_list: any[] = [
        {
          type: "text",
          text: textContent
        }
      ];
      
      // Add tool use to content_list
      for (const toolCall of msg.tool_calls) {
        content_list.push({
          type: "tool_use",
          tool_use: {
            tool_use_id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments || toolCall.input
          }
        });
      }
      
      return {
        role: 'assistant',
        content: textContent,
        content_list
      };
    }
    
    // Handle regular messages
    let textContent = "";
    const content_list: any[] = [];
    
    if (typeof msg.content === 'string') {
      // Simple string content
      textContent = msg.content;
      content_list.push({
        type: "text",
        text: textContent
      });
    } else if (Array.isArray(msg.content)) {
      // AI SDK format with content blocks
      for (const block of msg.content) {
        if (block.type === 'text') {
          textContent += block.text || '';
          content_list.push({
            type: "text",
            text: block.text || ''
          });
        } else if (block.type === 'tool-call') {
          // Handle AI SDK tool calls
          console.log('Found tool-call in assistant message:', block);
          content_list.push({
            type: "tool_use",
            tool_use: {
              tool_use_id: block.toolCallId,
              name: block.toolName,
              input: block.args || {}
            }
          });
        }
      }
    } else {
      textContent = "Processing request...";
      content_list.push({
        type: "text",
        text: textContent
      });
    }
    
    // Ensure content is never empty
    if (!textContent) {
      textContent = "Processing request...";
    }
    
    // Every message needs both content and content_list based on Streamlit example
    const baseMessage: SnowflakeMessage = {
      role: msg.role === 'system' ? 'assistant' : msg.role, // Snowflake doesn't have system role
      content: textContent,  // Always a string
      content_list: content_list
    };

    return baseMessage;
  });
}

/**
 * Transform tools to Snowflake tool_spec format
 */
export function transformToolsToSnowflakeFormat(tools: any[]): SnowflakeToolSpec[] {
  return tools.map(tool => {
    // CRITICAL: The tool name MUST match exactly what's registered in the component
    // The AI SDK passes the tool with a specific structure
    let toolName = '';
    
    // Check for the AI SDK structure first
    if (tool.toolName) {
      toolName = tool.toolName;
    } else if (tool.name) {
      toolName = tool.name;
    }
    
    // Log the tool structure to debug
    console.log('Transforming tool:', {
      toolName,
      hasDescription: !!tool.description,
      hasParameters: !!tool.parameters
    });
    
    // Fallback to a generic name if still no name
    if (!toolName) {
      console.warn('Tool has no name, generating one from description:', tool.description);
      toolName = `tool_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Extract input schema - handle jsonSchema wrapper from frontend tools
    let inputSchema = tool.parameters || tool.input_schema || {};
    
    // If the schema is wrapped in jsonSchema, unwrap it
    if (inputSchema.jsonSchema) {
      inputSchema = inputSchema.jsonSchema;
    }
    
    return {
      tool_spec: {
        type: "generic",
        name: toolName,
        description: tool.description || '',
        input_schema: inputSchema
      }
    };
  });
}

/**
 * Call Snowflake Claude 3.5 API with tool support
 * Uses the same JWT authentication patterns as existing Snowflake service
 */
export async function callSnowflakeClaude(
  messages: SnowflakeMessage[],
  tools?: SnowflakeToolSpec[]
): Promise<SnowflakeResponse> {
  const callStart = Date.now();
  console.log('\n=== SNOWFLAKE CLAUDE API CALL START ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    // Use the same model name as in Streamlit code
    const payload = {
      model: CLAUDE_MODEL,  // Just "claude-3-5-sonnet"
      messages: messages,
      max_tokens: 4096,
      top_p: 1
    };
    
    // Only add tools if they exist and are not empty
    if (tools && tools.length > 0) {
      (payload as any).tools = tools;
    }

    console.log('Snowflake Claude API Request:', {
      model: payload.model,
      message_count: messages.length,
      tool_count: tools?.length || 0
    });
    
    // Debug: Log the full payload
    console.log('Full request payload:', JSON.stringify(payload, null, 2));

    // Use secrets-aware authentication service
    console.log('[Snowflake Claude] Generating auth token...');
    console.log('[Snowflake Claude] USE_SPCS_IDENTITY:', process.env.USE_SPCS_IDENTITY);
    
    const token = snowflakeAuth.generateAuthToken();
    const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase();
    const isSpcs = process.env.USE_SPCS_IDENTITY === 'true';
    
    console.log('[Snowflake Claude] Auth mode:', isSpcs ? 'SPCS OAuth' : 'JWT');
    console.log('[Snowflake Claude] Token length:', token.length);
    
    // Use internal host for SPCS, external for local
    const cortexUrl = isSpcs && process.env.SNOWFLAKE_HOST
      ? `https://${process.env.SNOWFLAKE_HOST}${API_ENDPOINT}`
      : `https://${account}.snowflakecomputing.com${API_ENDPOINT}`;
    
    console.log('[Snowflake Claude] Cortex URL:', cortexUrl);
    
    // Log request headers (masking auth token)
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'snowflake-memory-box/1.0',
      'X-Snowflake-Authorization-Token-Type': isSpcs ? 'OAUTH' : 'KEYPAIR_JWT'
    };
    
    console.log('[Snowflake Claude] Request headers:', {
      ...headers,
      'Authorization': `Bearer [${token.length} chars]`
    });

    console.log('[Snowflake Claude] Making API request...');
    const fetchStart = Date.now();
    
    const response = await fetch(cortexUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const fetchTime = Date.now() - fetchStart;
    console.log(`[Snowflake Claude] Response received in ${fetchTime}ms`);
    console.log('Snowflake Claude API Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Snowflake Claude API Error:', response.status, errorText);
      return {
        success: false,
        error: `Snowflake Claude API Error: ${response.status} - ${errorText}`
      };
    }

    // Get response as text first to handle SSE format
    const responseText = await response.text();
    console.log('Snowflake Claude API Response (raw):', responseText.substring(0, 500) + '...');

    // Parse SSE format - split by "data: " and parse each chunk
    const chunks = responseText
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => {
        try {
          return JSON.parse(line.substring(6)); // Remove "data: " prefix
        } catch (e) {
          console.warn('Failed to parse chunk:', line);
          return null;
        }
      })
      .filter(chunk => chunk !== null);

    console.log('Parsed chunks:', chunks.length);
    return parseSnowflakeResponse(chunks);

  } catch (error) {
    console.error('Error calling Snowflake Claude:', error);
    return {
      success: false,
      error: `Error calling Snowflake Claude: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse Snowflake Claude response - EXACTLY matching the Streamlit pattern
 */
function parseSnowflakeResponse(response: any): SnowflakeResponse {
  try {
    let text = "";
    let tool_calls: Array<{ id: string; name: string; input: any }> = [];
    
    // Debug the raw response
    console.log('Parsing Snowflake response chunks:', response.length);
    
    // Extract text and tool use from response (streaming format)
    // This follows the EXACT pattern from the Streamlit code
    if (Array.isArray(response)) {
      // Track tool use information across chunks
      let tool_use_id: string | null = null;
      let tool_name: string | null = null;
      let tool_input = '';
      
      console.log(`Processing ${response.length} chunks`);
      
      // EXACTLY match the Streamlit pattern for extracting tool use
      for (const chunk of response) {
        const data = chunk.data || chunk;
        
        // Log the full chunk for debugging
        console.log('Processing chunk:', JSON.stringify(data, null, 2).substring(0, 500));
        
        for (const choice of data.choices || []) {
          const delta = choice.delta || {};
          
          // Check if this is a tool_use chunk
          if (delta.type === 'tool_use') {
            // Extract tool information from the delta
            if (delta.tool_use_id) {
              tool_use_id = delta.tool_use_id;
            }
            if (delta.name) {
              tool_name = delta.name;
            }
            
            // Accumulate input chunks
            if (delta.input) {
              tool_input += delta.input;
            }
            
            console.log(`Tool use chunk - id: ${tool_use_id}, name: ${tool_name}, input chunk: ${delta.input}`);
          }
          
          // Also check content_list for compatibility
          const content_list = delta.content_list || [];
          
          for (const content of content_list) {
            if (content.type === 'text') {
              // Accumulate text content
              text += content.text || '';
            } else if (content.type === 'tool_use') {
              // Handle tool_use in content_list format
              const toolUse = content.tool_use || {};
              if (toolUse.tool_use_id) {
                tool_use_id = toolUse.tool_use_id;
              }
              if (toolUse.name) {
                tool_name = toolUse.name;
              }
              if (toolUse.input) {
                tool_input += typeof toolUse.input === 'string' 
                  ? toolUse.input 
                  : JSON.stringify(toolUse.input);
              }
              
              console.log(`Found tool_use in content_list: ${tool_name} (${tool_use_id})`);
            } else if (content.input && delta.type === 'tool_use') {
              // This is a tool_use chunk with input in content_list
              // Don't duplicate - it's already handled above
              continue;
            } else if (content.tool_use_id || content.name) {
              // Direct fields in content (for initial tool declaration)
              if (content.tool_use_id) {
                tool_use_id = content.tool_use_id;
              }
              if (content.name) {
                tool_name = content.name;
              }
              
              console.log(`Found direct tool fields in content: ${tool_name} (${tool_use_id})`);
            }
          }
        }
      }
      
      // Note: Removed forced tool detection for explore_data as it doesn't exist in main branch
      
      // If we collected a complete tool call, add it
      if (tool_use_id && tool_name) {
        console.log('Found tool call:', { 
          id: tool_use_id, 
          name: tool_name,
          inputLength: tool_input.length
        });
        
        // Parse the input if it's a JSON string
        let parsedInput = null;
        try {
          parsedInput = JSON.parse(tool_input);
          console.log('Parsed tool input:', parsedInput);
        } catch (e) {
          console.warn('Failed to parse tool input, using as-is:', tool_input);
          parsedInput = tool_input;
        }
        
        tool_calls.push({
          id: tool_use_id,
          name: tool_name,
          input: parsedInput
        });
      }
    } else {
      // Handle non-streaming response (unlikely with Snowflake Claude)
      console.log('Non-streaming response detected');
      text = response.content || '';
      
      if (response.tool_calls) {
        tool_calls = response.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          input: tc.input
        }));
      }
    }
    
    console.log('Parsed response:', { 
      textLength: text.length,
      toolCallCount: tool_calls.length
    });
    
    return {
      success: true,
      content: text,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined
    };
  } catch (error) {
    console.error('Error parsing Snowflake response:', error);
    return {
      success: false,
      error: `Error parsing response: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Create tool result message in Snowflake format
 * CRITICAL: Must include non-empty content field
 */
export function createToolResultMessage(
  toolUseId: string,
  toolName: string,
  result: any
): SnowflakeMessage {
  return {
    role: 'user',
    content: `Tool result for ${toolName}`, // REQUIRED non-empty content
    content_list: [
      {
        type: 'tool_results',
        tool_results: {
          tool_use_id: toolUseId,
          name: toolName,
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result)
            }
          ]
        }
      }
    ]
  };
}

/**
 * Memory Box tool specification for Snowflake
 */
export const MEMORY_BOX_TOOL_SPEC: SnowflakeToolSpec = {
  tool_spec: {
    type: "generic",
    name: "memory_box",
    description: "Memory Box stores and recalls information using semantic search within Snowflake. Supports store, search, and load_all modes.",
    input_schema: {
      type: "object",
      required: ["mode"],
      properties: {
        mode: {
          type: "string",
          enum: ["store", "search", "load_all"],
          description: "Operation mode for Memory Box"
        },
        query: {
          type: "string",
          description: "Search query for finding memories (required for search mode)"
        },
        content: {
          type: "string",
          description: "Content to store in memory (required for store mode)"
        },
        content_type: {
          type: "string",
          description: "Type of content being stored (e.g., 'insight', 'fact', 'analysis')"
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return (default: 10)"
        },
        threshold: {
          type: "number",
          description: "Minimum similarity threshold for search results (default: 0.7)"
        }
      }
    }
  }
};

// Note: Removed DATA_EXPLORATION_TOOL_SPEC as explore_data doesn't exist in main branch
