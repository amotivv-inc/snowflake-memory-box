"use client";

import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

// Store for managing the interactive suggestions
let suggestionsResolver: ((value: any) => void) | null = null;

export const setSuggestionsResult = (result: any) => {
  if (suggestionsResolver) {
    suggestionsResolver(result);
    suggestionsResolver = null;
  }
};

// Create the tool
export const ShowSuggestionsTool = makeAssistantTool({
  toolName: "showSuggestions",
  description: "Display context-aware suggestions to help the user with their next action",
  parameters: z.object({
    context: z.string().optional().describe("Current conversation context to generate relevant suggestions")
  }),
  execute: async ({ context }) => {
    try {
      // Fetch suggestions from our API
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: [], // We'll need to get actual messages from context
          context: context || 'initial'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch suggestions: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        suggestions: data.suggestions || [
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
        ]
      };
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      
      // Return fallback suggestions
      return {
        suggestions: [
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
        ]
      };
    }
  }
});
