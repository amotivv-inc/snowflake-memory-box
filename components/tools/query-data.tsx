"use client";

import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

export const QueryDataTool = makeAssistantTool({
  toolName: "queryData",
  description: "Query selected data tables using natural language. Uses Snowflake Cortex Analyst to generate and execute SQL.",
  parameters: z.object({
    query: z.string().describe("Natural language query about the data (e.g., 'show me total donations this year', 'what are the monthly trends?')"),
    selectedTables: z.array(z.string()).describe("Array of selected table names in format 'database.schema.table'")
  }),
  execute: async ({ query, selectedTables }) => {
    try {
      const response = await fetch('/api/data/query-cortex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          selectedTables
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to query data');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error querying data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to query data');
    }
  }
});
