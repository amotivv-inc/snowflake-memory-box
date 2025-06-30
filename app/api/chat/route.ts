import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { 
  callSnowflakeClaude, 
  transformMessagesToSnowflakeFormat,
  transformToolsToSnowflakeFormat,
  MEMORY_BOX_TOOL_SPEC
} from "@/lib/services/snowflake-claude";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const requestStart = Date.now();
  console.log('\n=== CHAT API HANDLER START ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  // Log request headers
  console.log('Request Headers:');
  req.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')) {
      console.log(`  ${key}: [PRESENT - length: ${value.length}]`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });
  
  try {
    console.log('Parsing request body...');
    const { messages, system, tools } = await req.json();

    console.log('Chat API Request:', {
      messageCount: messages?.length || 0,
      toolCount: tools?.length || 0,
      hasSystem: !!system,
      requestTime: `${Date.now() - requestStart}ms`
    });

    // Debug: Log all messages to understand the conversation flow
    console.log('Raw messages from AI SDK:');
    messages.forEach((msg: any, index: number) => {
      console.log(`Message ${index}:`, {
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content.substring(0, 100) : msg.content,
        hasToolCalls: !!msg.tool_calls,
        toolCalls: msg.tool_calls
      });
    });

    // Transform messages to Snowflake format
    const snowflakeMessages = transformMessagesToSnowflakeFormat(messages || []);
    
    // Always add system message - use provided one or default
    snowflakeMessages.unshift({
      role: 'assistant',
      content: system || DEFAULT_SYSTEM_PROMPT
    });

    // Debug: Log transformed Snowflake messages
    console.log('Transformed Snowflake messages:');
    snowflakeMessages.forEach((msg: any, index: number) => {
      console.log(`Snowflake Message ${index}:`, {
        role: msg.role,
        content: msg.content.substring(0, 100),
        hasContentList: !!msg.content_list,
        contentListTypes: msg.content_list?.map((c: any) => c.type)
      });
    });

    // Transform tools to Snowflake format and add our native tools
    const frontendToolsObject = tools ? frontendTools(tools) : {};
    const frontendToolsArray = Object.entries(frontendToolsObject).map(([toolName, tool]) => ({
      ...tool,
      toolName // Add the tool name from the object key
    }));
    
    // Debug: Log the structure of frontend tools
    if (frontendToolsArray.length > 0) {
      console.log('Frontend tools structure:', JSON.stringify(frontendToolsArray[0], null, 2));
    }
    
    const frontendToolsTransformed = transformToolsToSnowflakeFormat(frontendToolsArray);
    const snowflakeTools = [
      ...frontendToolsTransformed,
      MEMORY_BOX_TOOL_SPEC
    ];

    // Call Snowflake Claude API
    const response = await callSnowflakeClaude(snowflakeMessages, snowflakeTools);

    if (!response.success) {
      console.error('Snowflake Claude API Error:', response.error);
      return new Response(
        JSON.stringify({ error: response.error }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a streaming response in AI SDK format
    // This is the format expected by the AI SDK's useChatRuntime
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First send the text content
          if (response.content) {
            // Format: 0:"text content"
            // Use JSON.stringify to properly escape all special characters
            const escapedContent = JSON.stringify(response.content);
            const textChunk = `0:${escapedContent}\n`;
            controller.enqueue(encoder.encode(textChunk));
          }

          // Then send tool calls if present
          if (response.tool_calls && response.tool_calls.length > 0) {
            for (const toolCall of response.tool_calls) {
              // Make sure we have all required fields
              if (!toolCall.id || !toolCall.name) {
                console.warn('Incomplete tool call:', toolCall);
                continue;
              }
              
              // Format: 9:{"toolCallId":"id","toolName":"name","args":{...}}
              const toolArgs = toolCall.input || {};
              
              const toolChunk = `9:${JSON.stringify({
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                args: toolArgs
              })}\n`;
              controller.enqueue(encoder.encode(toolChunk));
            }
          }

          // Finally send finish reason
          controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
          controller.close();
        } catch (error) {
          console.error('Error creating streaming response:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1'
      }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Chat API error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Default system prompt for Snowflake Claude - matching main branch
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant specialized in data analysis. You have access to Snowflake databases and can help users explore and analyze their data using Cortex Analyst.

## Workflow:

**Step 1: Table Selection**
- When users ask about data, use the selectDataSource tool to help them browse and select tables
- The tool is interactive - users will browse databases, schemas, and tables, then confirm their selection
- Wait for them to confirm their table selection

**Step 2: Data Analysis**
- Once tables are selected, use the queryData tool to analyze the data
- Pass the selected tables and the user's natural language query to Cortex Analyst
- Cortex Analyst will generate SQL and execute it automatically
- Present the results in a beautiful, formatted display

**Step 3: Smart Suggestions**
- After completing analysis or at key moments, use the showSuggestions tool to provide context-aware next steps
- This helps users discover what they can do next with their data
- Suggestions adapt based on conversation context and selected data sources

## Available Tools:
- **selectDataSource**: Interactive table selection from Snowflake databases
- **queryData**: Natural language querying using Snowflake Cortex Analyst
- **showSuggestions**: Display context-aware suggestions for next actions

## Example Flow:
1. User: "Show me total donations this year"
2. Assistant: Uses selectDataSource tool
3. User: Selects DONATIONS table and confirms
4. Assistant: Uses queryData tool with query "total donations this year" and selected tables
5. Cortex Analyst generates SQL, executes it, and returns formatted results
6. Assistant: Uses showSuggestions tool to show relevant next steps like "Break down by month" or "Compare to last year"

Always provide clear, helpful responses and guide users through the complete data analysis process. Use suggestions strategically to help users discover new insights.`;
