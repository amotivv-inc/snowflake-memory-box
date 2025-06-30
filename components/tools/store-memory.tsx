import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

type StoreMemoryArgs = {
  content: string;
  contentType: "conversation" | "insight" | "sql_query" | "analysis" | "fact";
  accessLevel?: "PRIVATE" | "SHARED" | "PUBLIC";
};

type StoreMemoryResult = {
  success: boolean;
  memoryId?: string;
  message: string;
};

export const StoreMemoryTool = makeAssistantTool<StoreMemoryArgs, StoreMemoryResult>({
  toolName: "storeMemory",
  description: "Save important insights, analysis results, or information to memory for future reference",
  parameters: z.object({
    content: z.string().describe("The content to store in memory"),
    contentType: z.enum(["conversation", "insight", "sql_query", "analysis", "fact"]).describe("Type of content being stored"),
    accessLevel: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional().describe("Access level for the memory (default: PRIVATE)")
  }),
  execute: async ({ content, contentType, accessLevel = "PRIVATE" }) => {
    try {
      const response = await fetch('/api/memory/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          contentType,
          accessLevel
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          memoryId: result.memoryId,
          message: result.message || 'Memory stored successfully'
        };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to store memory'
        };
      }
    } catch (error) {
      console.error('Error storing memory:', error);
      return {
        success: false,
        message: `Error storing memory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});
