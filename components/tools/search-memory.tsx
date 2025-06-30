import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

type SearchMemoryArgs = {
  query: string;
  limit?: number;
  threshold?: number;
  contentType?: string;
};

type SearchMemoryResult = {
  success: boolean;
  memories: Array<{
    MEMORY_ID?: string;
    CONTENT: string;
    CONTENT_TYPE: string;
    ACCESS_LEVEL: string;
    CREATED_AT: string;
    SIMILARITY_SCORE?: number;
  }>;
  message: string;
};

export const SearchMemoryTool = makeAssistantTool<SearchMemoryArgs, SearchMemoryResult>({
  toolName: "searchMemory",
  description: "Search previous insights, analysis, and stored information using semantic similarity",
  parameters: z.object({
    query: z.string().describe("Search query to find relevant memories"),
    limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    threshold: z.number().optional().describe("Similarity threshold 0-1 (default: 0.7)"),
    contentType: z.string().optional().describe("Filter by content type (conversation, insight, sql_query, analysis, fact)")
  }),
  execute: async ({ query, limit = 10, threshold = 0.7, contentType }) => {
    try {
      const response = await fetch('/api/memory/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit,
          threshold,
          contentType
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: result.success,
        memories: result.memories || [],
        message: result.message || `Found ${result.memories?.length || 0} memories`
      };
    } catch (error) {
      console.error('Error searching memories:', error);
      return {
        success: false,
        memories: [],
        message: `Error searching memories: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});
