"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Save, CheckCircle, AlertCircle, Loader2, Lock, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type StoreArgs = {
  content: string;
  contentType: "conversation" | "insight" | "sql_query" | "analysis" | "fact";
  accessLevel?: "PRIVATE" | "SHARED" | "PUBLIC";
};

type StoreResult = {
  success: boolean;
  memoryId?: string;
  message: string;
};

export const StoreMemoryUI = makeAssistantToolUI<StoreArgs, StoreResult>({
  toolName: "storeMemory",
  render: ({ args, status, result }) => {
    if (status.type === "running") {
      return (
        <div className="flex items-center gap-3 rounded-lg border bg-green-50 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          <div>
            <p className="font-medium text-green-900">Storing memory...</p>
            <p className="text-sm text-green-700">Type: {args.contentType}</p>
          </div>
        </div>
      );
    }

    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">Failed to store memory</p>
            <p className="text-sm text-red-700">Please try again</p>
          </div>
        </div>
      );
    }

    if (!result || !result.success) {
      return null;
    }

    return (
      <div className="space-y-3">
        {/* Success Header */}
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-900">Memory stored successfully</p>
            {result.memoryId && (
              <p className="text-sm text-green-700">ID: {result.memoryId}</p>
            )}
          </div>
        </div>

        {/* Memory Details */}
        <div className="rounded-lg border bg-white p-4">
          <div className="space-y-3">
            {/* Content Preview */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Content</p>
              <p className="text-sm text-gray-700 line-clamp-3">{args.content}</p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 border-t pt-3">
              {/* Type Badge */}
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  getTypeColor(args.contentType)
                )}>
                  {args.contentType}
                </span>
              </div>

              {/* Access Level */}
              <div className="flex items-center gap-1.5">
                {getAccessIcon(args.accessLevel || "PRIVATE")}
                <span className="text-xs text-gray-600">
                  {args.accessLevel || "PRIVATE"}
                </span>
              </div>

              {/* Timestamp */}
              <div className="ml-auto text-xs text-gray-500">
                Stored just now
              </div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            💡 This memory is now searchable and will be used to provide context in future conversations.
          </p>
        </div>
      </div>
    );
  },
});

// Helper functions
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    conversation: "text-blue-600",
    insight: "text-purple-600",
    sql_query: "text-green-600",
    analysis: "text-orange-600",
    fact: "text-gray-600",
  };
  return colors[type.toLowerCase()] || "text-gray-600";
}

function getAccessIcon(level: string) {
  switch (level) {
    case "PRIVATE":
      return <Lock className="h-3 w-3 text-gray-500" />;
    case "SHARED":
      return <Users className="h-3 w-3 text-blue-500" />;
    case "PUBLIC":
      return <Globe className="h-3 w-3 text-green-500" />;
    default:
      return <Lock className="h-3 w-3 text-gray-500" />;
  }
}
