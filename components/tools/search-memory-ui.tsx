"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Search, Brain, AlertCircle, Loader2, Clock, Lock, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchArgs = {
  query: string;
  limit?: number;
  threshold?: number;
  contentType?: string;
};

type SearchResult = {
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

export const SearchMemoryUI = makeAssistantToolUI<SearchArgs, SearchResult>({
  toolName: "searchMemory",
  render: ({ args, status, result }) => {
    if (status.type === "running") {
      return (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Searching memories...</p>
            <p className="text-sm text-blue-700">Query: "{args.query}"</p>
          </div>
        </div>
      );
    }

    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">Failed to search memories</p>
            <p className="text-sm text-red-700">Please try again</p>
          </div>
        </div>
      );
    }

    if (!result) {
      return null;
    }

    if (!result.success) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">Search failed</p>
            <p className="text-sm text-red-700">{result.message}</p>
          </div>
        </div>
      );
    }

    if (result.memories.length === 0) {
      return (
        <div className="rounded-lg border bg-gray-50 p-6 text-center">
          <Brain className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="font-medium text-gray-900">No memories found</p>
          <p className="text-sm text-gray-600">
            No relevant memories found for "{args.query}". Try a different search term or store some insights first.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Search Header */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Search className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <p className="font-medium text-blue-900">Found {result.memories.length} relevant memories</p>
            <p className="text-sm text-blue-700">Query: "{args.query}"</p>
          </div>
        </div>

        {/* Memory Results */}
        <div className="space-y-3">
          {result.memories.map((memory, index) => (
            <div key={memory.MEMORY_ID || index} className="rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors">
              <div className="space-y-3">
                {/* Content */}
                <div>
                  <p className="text-sm text-gray-900 leading-relaxed">{memory.CONTENT}</p>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500 border-t pt-3">
                  {/* Content Type */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "font-medium uppercase tracking-wider",
                      getTypeColor(memory.CONTENT_TYPE)
                    )}>
                      {memory.CONTENT_TYPE}
                    </span>
                  </div>

                  {/* Access Level */}
                  <div className="flex items-center gap-1.5">
                    {getAccessIcon(memory.ACCESS_LEVEL)}
                    <span>{memory.ACCESS_LEVEL}</span>
                  </div>

                  {/* Similarity Score */}
                  {memory.SIMILARITY_SCORE && (
                    <div className="flex items-center gap-1.5">
                      <span>Relevance: {Math.round(memory.SIMILARITY_SCORE * 100)}%</span>
                    </div>
                  )}

                  {/* Created Date */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(memory.CREATED_AT)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Usage Hint */}
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-sm text-green-900">
            💡 These memories can help inform your current analysis. Reference them in follow-up questions or use them as context for new insights.
          </p>
        </div>
      </div>
    );
  },
});

// Helper functions
function getTypeColor(type: string): string {
  if (!type || typeof type !== 'string') {
    return "text-gray-600";
  }
  
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}
