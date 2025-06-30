"use client";

import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

// Store for managing the interactive selection
let selectionResolver: ((value: any) => void) | null = null;

export const setSelectionResult = (result: any) => {
  if (selectionResolver) {
    selectionResolver(result);
    selectionResolver = null;
  }
};

// Create the component
export const SelectDataSourceTool = makeAssistantTool({
  toolName: "selectDataSource",
  description: "Select database tables to analyze",
  parameters: z.object({
    prompt: z.string().optional().describe("Optional prompt to guide the user in selecting tables")
  }),
  execute: async ({ prompt }) => {
    // Return a promise that resolves when the user confirms their selection
    return new Promise((resolve) => {
      selectionResolver = resolve;
      // The UI component will call setSelectionResult when the user confirms
    });
  }
});
