"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setSelectionResult } from "./select-data-source";
import { CheckCircle2, Database } from "lucide-react";

type SelectDataSourceArgs = {
  prompt?: string;
};

type SelectDataSourceResult = {
  selectedTables: string[];
  database: string;
  schema: string;
};

export const SelectDataSourceUI = makeAssistantToolUI<SelectDataSourceArgs, SelectDataSourceResult>({
  toolName: "selectDataSource",
  render: ({ args, result, status }) => {
    const [databases, setDatabases] = useState<string[]>([]);
    const [schemas, setSchemas] = useState<string[]>([]);
    const [tables, setTables] = useState<any[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<string>("");
    const [selectedSchema, setSelectedSchema] = useState<string>("");
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Only fetch databases when the tool is actually running
    useEffect(() => {
      if (status.type === "running" && databases.length === 0) {
        fetchDatabases();
      }
    }, [status.type, databases.length]);

    const fetchDatabases = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/data/databases');
        const data = await res.json();
        setDatabases(data.databases || []);
      } catch (error) {
        console.error('Error fetching databases:', error);
      }
      setLoading(false);
    };

    const fetchSchemas = async (database: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/data/schemas?database=${database}`);
        const data = await res.json();
        setSchemas(data.schemas || []);
      } catch (error) {
        console.error('Error fetching schemas:', error);
      }
      setLoading(false);
    };

    const fetchTables = async (database: string, schema: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/data/tables?database=${database}&schema=${schema}`);
        const data = await res.json();
        setTables(data.tables || []);
      } catch (error) {
        console.error('Error fetching tables:', error);
      }
      setLoading(false);
    };

    const handleDatabaseSelect = (database: string) => {
      setSelectedDatabase(database);
      setSelectedSchema("");
      setSchemas([]);
      setTables([]);
      setSelectedTables(new Set());
      fetchSchemas(database);
    };

    const handleSchemaSelect = (schema: string) => {
      setSelectedSchema(schema);
      setTables([]);
      setSelectedTables(new Set());
      fetchTables(selectedDatabase, schema);
    };

    const toggleTableSelection = (tableName: string) => {
      const newSelection = new Set(selectedTables);
      if (newSelection.has(tableName)) {
        newSelection.delete(tableName);
      } else {
        newSelection.add(tableName);
      }
      setSelectedTables(newSelection);
    };

    const handleConfirmSelection = () => {
      if (selectedTables.size > 0) {
        const result: SelectDataSourceResult = {
          selectedTables: Array.from(selectedTables).map(table => 
            `${selectedDatabase}.${selectedSchema}.${table}`
          ),
          database: selectedDatabase,
          schema: selectedSchema
        };
        setSelectionResult(result);
      }
    };

    // Show completion state
    if (status.type === "complete" && result) {
      return (
        <div className="p-4 border rounded-lg bg-background">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Tables Selected Successfully</span>
          </div>
          <div className="space-y-1">
            {result.selectedTables.map((table) => (
              <div key={table} className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>{table}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 border rounded-lg bg-background">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Select Data Sources</h3>
          {args.prompt && (
            <p className="text-sm text-muted-foreground">{args.prompt}</p>
          )}
        </div>
        
        {/* Database Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Database</label>
          <div className="grid grid-cols-2 gap-2">
            {databases.map((db) => (
              <Button
                key={db}
                variant={selectedDatabase === db ? "default" : "outline"}
                size="sm"
                onClick={() => handleDatabaseSelect(db)}
                className="justify-start"
              >
                {db}
              </Button>
            ))}
          </div>
        </div>

        {/* Schema Selection */}
        {selectedDatabase && schemas.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Schema</label>
            <div className="grid grid-cols-2 gap-2">
              {schemas.map((schema) => (
                <Button
                  key={schema}
                  variant={selectedSchema === schema ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSchemaSelect(schema)}
                  className="justify-start"
                >
                  {schema}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Table Selection */}
        {selectedSchema && tables.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Tables</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tables.map((table) => (
                <div
                  key={table.name}
                  className={cn(
                    "p-3 border rounded cursor-pointer transition-colors",
                    selectedTables.has(table.name)
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleTableSelection(table.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{table.name}</span>
                    {table.rows !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {table.rows.toLocaleString()} rows
                      </span>
                    )}
                  </div>
                  {table.comment && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {table.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Tables Summary */}
        {selectedTables.size > 0 && (
          <div className="mt-4 p-3 bg-muted rounded">
            <p className="text-sm font-medium mb-1">Selected Tables:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedTables).map((table) => (
                <span
                  key={table}
                  className="text-xs bg-background px-2 py-1 rounded"
                >
                  {selectedDatabase}.{selectedSchema}.{table}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Confirm Selection Button */}
        {selectedTables.size > 0 && (
          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleConfirmSelection}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Selection
            </Button>
          </div>
        )}
      </div>
    );
  },
});
