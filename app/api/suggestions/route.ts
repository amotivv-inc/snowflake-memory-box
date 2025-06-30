import { NextRequest, NextResponse } from 'next/server';

interface Suggestion {
  id: string;
  text: string;
  prompt: string;
  category: 'discovery' | 'analysis' | 'drill-down' | 'memory' | 'export';
  priority: number;
}

interface SuggestionContext {
  stage: 'initial' | 'tables-selected' | 'results-shown' | 'drilling-down';
  selectedTables?: string[];
  lastQuery?: string;
  lastResults?: any[];
  hasToolCalls?: boolean;
  toolCallTypes?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // Analyze conversation context
    const context = analyzeConversationContext(messages);
    
    // Generate suggestions based on context
    const suggestions = generateContextualSuggestions(context);
    
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

function analyzeConversationContext(messages: any[]): SuggestionContext {
  if (!messages || messages.length === 0) {
    return { stage: 'initial' };
  }

  // Look for tool calls and results in all messages
  let hasToolCalls = false;
  let toolCallTypes: string[] = [];
  let selectedTables: string[] = [];
  let lastQuery = '';
  let lastResults: any[] = [];

  for (const message of messages) {
    // Check assistant messages for tool calls
    if (message.role === 'assistant' && message.content) {
      // Handle both string and array content
      const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
      
      for (const contentItem of content) {
        if (contentItem.type === 'tool-call') {
          hasToolCalls = true;
          const toolName = contentItem.toolCall?.toolName;
          if (toolName) {
            toolCallTypes.push(toolName);
            
            // Extract context from selectDataSource tool
            if (toolName === 'selectDataSource' && contentItem.toolCall?.result) {
              const result = contentItem.toolCall.result;
              if (result.selectedTables) {
                selectedTables = [...selectedTables, ...result.selectedTables];
              }
            }
            
            // Extract context from queryData tool
            if (toolName === 'queryData') {
              if (contentItem.toolCall?.args?.query) {
                lastQuery = contentItem.toolCall.args.query;
              }
              if (contentItem.toolCall?.result) {
                lastResults = contentItem.toolCall.result.data || [];
              }
            }
          }
        }
      }
      
      // Also check for table mentions in text content
      const textContent = content.find((item: any) => item.type === 'text')?.text || '';
      const tableMatches = textContent.match(/(\w+\.\w+\.\w+)/g);
      if (tableMatches) {
        selectedTables = [...selectedTables, ...tableMatches];
      }
    }
    
    // Check user messages for queries
    if (message.role === 'user' && typeof message.content === 'string') {
      lastQuery = message.content;
    }
  }

  // Remove duplicates from selectedTables
  selectedTables = [...new Set(selectedTables)];

  // Determine stage based on tool calls and context
  let stage: SuggestionContext['stage'] = 'initial';
  
  if (toolCallTypes.includes('queryData') && lastResults.length > 0) {
    stage = 'results-shown';
  } else if (toolCallTypes.includes('selectDataSource') || selectedTables.length > 0) {
    stage = 'tables-selected';
  } else if (hasToolCalls) {
    stage = 'drilling-down';
  }

  return {
    stage,
    selectedTables: selectedTables.length > 0 ? selectedTables : undefined,
    lastQuery: lastQuery || undefined,
    lastResults: lastResults.length > 0 ? lastResults : undefined,
    hasToolCalls,
    toolCallTypes
  };
}

function generateContextualSuggestions(context: SuggestionContext): Suggestion[] {
  const suggestions: Suggestion[] = [];

  switch (context.stage) {
    case 'initial':
      suggestions.push(
        {
          id: 'discover-data',
          text: 'Show my available data sources',
          prompt: 'Show me what data sources I have access to',
          category: 'discovery',
          priority: 1
        },
        {
          id: 'data-overview',
          text: 'Give me a data overview',
          prompt: 'Give me an overview of my data',
          category: 'discovery',
          priority: 2
        }
      );
      break;

    case 'tables-selected':
      if (context.selectedTables && context.selectedTables.length > 0) {
        const tableNames = context.selectedTables.map(table => 
          table.split('.').pop() || table
        );
        
        // Generate context-aware suggestions based on table names
        const tableName = tableNames[0].toLowerCase();
        
        if (tableName.includes('donation')) {
          suggestions.push(
            {
              id: 'donation-trends',
              text: 'Analyze donation trends over time',
              prompt: 'Show me donation trends and patterns over time',
              category: 'analysis',
              priority: 1
            },
            {
              id: 'total-donations',
              text: 'Show total donation amounts',
              prompt: 'What are the total donation amounts?',
              category: 'analysis',
              priority: 2
            },
            {
              id: 'donor-analysis',
              text: 'Analyze donor patterns',
              prompt: 'Show me patterns in donor behavior and giving',
              category: 'analysis',
              priority: 3
            }
          );
        } else if (tableName.includes('disbursement')) {
          suggestions.push(
            {
              id: 'disbursement-trends',
              text: 'Analyze disbursement patterns',
              prompt: 'Show me disbursement trends and patterns',
              category: 'analysis',
              priority: 1
            },
            {
              id: 'total-disbursements',
              text: 'Show total disbursement amounts',
              prompt: 'What are the total disbursement amounts?',
              category: 'analysis',
              priority: 2
            },
            {
              id: 'recipient-analysis',
              text: 'Analyze recipient patterns',
              prompt: 'Show me patterns in disbursement recipients',
              category: 'analysis',
              priority: 3
            }
          );
        } else {
          // Generic suggestions for other table types
          suggestions.push(
            {
              id: 'analyze-trends',
              text: `Analyze ${tableNames[0]} trends`,
              prompt: `Show me trends and patterns in the ${tableNames[0]} data`,
              category: 'analysis',
              priority: 1
            },
            {
              id: 'summary-stats',
              text: `Show ${tableNames[0]} summary`,
              prompt: `Give me a summary of the ${tableNames[0]} data`,
              category: 'analysis',
              priority: 2
            }
          );
        }

        // Add comparison suggestion if multiple tables
        if (tableNames.length > 1) {
          suggestions.push({
            id: 'compare-tables',
            text: `Compare ${tableNames[0]} vs ${tableNames[1]}`,
            prompt: `Compare the data between ${tableNames[0]} and ${tableNames[1]}`,
            category: 'analysis',
            priority: 4
          });
        }
      }
      break;

    case 'results-shown':
      suggestions.push(
        {
          id: 'drill-down',
          text: 'Drill down into details',
          prompt: 'Show me more detailed breakdown of this data',
          category: 'drill-down',
          priority: 1
        },
        {
          id: 'time-breakdown',
          text: 'Show by time period',
          prompt: 'Break down this data by time period',
          category: 'drill-down',
          priority: 2
        },
        {
          id: 'save-analysis',
          text: 'Save this analysis',
          prompt: 'Save this analysis to Memory Box for future reference',
          category: 'memory',
          priority: 3
        }
      );
      break;

    case 'drilling-down':
      suggestions.push(
        {
          id: 'export-data',
          text: 'Export these results',
          prompt: 'Export this data analysis',
          category: 'export',
          priority: 1
        },
        {
          id: 'create-viz',
          text: 'Create visualization',
          prompt: 'Create a chart or visualization of this data',
          category: 'analysis',
          priority: 2
        }
      );
      break;
  }

  // Always add memory-enhanced suggestions if we have context
  if (context.stage !== 'initial') {
    suggestions.push({
      id: 'similar-analysis',
      text: 'Find similar analyses',
      prompt: 'Show me similar analyses I\'ve done before',
      category: 'memory',
      priority: 4
    });
  }

  // Sort by priority and return top 4
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}
