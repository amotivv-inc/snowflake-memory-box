"use client";

import { useAssistantToolUI, ThreadPrimitive } from "@assistant-ui/react";
import type { FC } from "react";

interface DynamicSuggestionsProps {
  // This component uses the hook pattern to register dynamic suggestions
}

export const DynamicSuggestions: FC<DynamicSuggestionsProps> = () => {
  // Use the hook pattern to register a dynamic suggestion tool UI
  // This will be triggered when the assistant calls a "showSuggestions" tool
  useAssistantToolUI({
    toolName: "showSuggestions",
    render: ({ args, status, result }) => {
      if (status.type === "running") {
        return (
          <div className="mt-3 flex w-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading suggestions...</div>
          </div>
        );
      }

      if (status.type === "complete" && result?.suggestions) {
        return (
          <div className="mt-3 flex w-full items-stretch justify-center gap-4 flex-wrap">
            {result.suggestions.map((suggestion: any) => (
              <ThreadPrimitive.Suggestion
                key={suggestion.id}
                className="hover:bg-muted/80 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in min-w-0"
                prompt={suggestion.prompt}
                method="replace"
                autoSend
              >
                <span className="line-clamp-2 text-ellipsis text-sm font-semibold text-center">
                  {suggestion.text}
                </span>
              </ThreadPrimitive.Suggestion>
            ))}
          </div>
        );
      }

      return null;
    },
  });

  // This component doesn't render anything directly
  // The UI is rendered through the tool UI registration above
  return null;
};
