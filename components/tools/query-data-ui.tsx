"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Database, TrendingUp, DollarSign, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type QueryDataArgs = {
  query: string;
  selectedTables: string[];
};

type QueryDataResult = {
  success: boolean;
  answer?: string;
  sql?: string;
  data?: any[];
  rowCount?: number;
  selectedTables: string[];
};

export const QueryDataUI = makeAssistantToolUI<QueryDataArgs, QueryDataResult>({
  toolName: "queryData",
  render: ({ args, status, result }) => {
    if (status.type === "running") {
      return (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Analyzing data with Cortex Analyst...</p>
            <p className="text-sm text-blue-700">{args.query}</p>
            <p className="text-xs text-blue-600 mt-1">
              Using tables: {args.selectedTables?.join(', ') || 'Loading...'}
            </p>
          </div>
        </div>
      );
    }

    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-900">Failed to query data</p>
          <p className="text-sm text-red-700">Please try rephrasing your question</p>
        </div>
      );
    }

    if (!result || !result.success) {
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Query Header */}
        <div className="flex items-start gap-3 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          <Database className="mt-0.5 h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">Data Analysis Results</p>
            <p className="text-sm text-gray-600">{args.query}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {result.selectedTables.map((table) => (
                <span
                  key={table}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                >
                  {table.split('.').pop()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Answer from Cortex Analyst */}
        {result.answer && (
          <div className="rounded-lg border bg-green-50 p-4">
            <h4 className="font-medium text-green-900 mb-2">Analysis Summary</h4>
            <p className="text-sm text-green-800">{result.answer}</p>
          </div>
        )}

        {/* Data Table */}
        {result.data && result.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(result.data[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {result.data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.entries(row).map(([key, value], cellIdx) => (
                        <td key={cellIdx} className="whitespace-nowrap px-4 py-3 text-sm">
                          {formatCellValue(key, value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.data.length > 10 && (
              <div className="bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
                Showing 10 of {result.data.length} rows
              </div>
            )}
          </div>
        )}

        {/* SQL Query */}
        {result.sql && (
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-700">View Generated SQL</span>
              <span className="text-xs text-gray-500">Click to expand</span>
            </summary>
            <div className="border-t bg-gray-900 p-4">
              <pre className="overflow-x-auto text-xs text-gray-100">
                <code>{result.sql}</code>
              </pre>
            </div>
          </details>
        )}

        {/* Summary Stats */}
        {result.rowCount !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
            <span className="text-sm text-gray-600">Total Results</span>
            <span className="font-medium text-gray-900">{result.rowCount} rows</span>
          </div>
        )}
      </div>
    );
  },
});

// Helper function to format cell values
function formatCellValue(key: string, value: any): string {
  if (value === null || value === undefined) return '-';
  
  // Format currency fields
  if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total')) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    }
  }
  
  // Format dates
  if (key.toLowerCase().includes('date') || key.toLowerCase().includes('month')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      // Not a valid date
    }
  }
  
  // Format booleans
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  
  // Format numbers
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  return String(value);
}
