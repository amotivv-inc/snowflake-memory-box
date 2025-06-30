import { useState, useEffect } from 'react';

interface Suggestion {
  id: string;
  text: string;
  prompt: string;
  category: 'discovery' | 'analysis' | 'drill-down' | 'memory' | 'export';
  priority: number;
}

interface UseDynamicSuggestionsResult {
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
}

export function useDynamicSuggestions(messages: any[]): UseDynamicSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const generateSuggestions = async () => {
      if (!messages || messages.length === 0) {
        // Default suggestions for empty conversation
        setSuggestions([
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
        ]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate suggestions: ${response.status}`);
        }

        const data = await response.json();
        
        if (!isCancelled) {
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error generating suggestions:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          
          // Fallback to default suggestions on error
          setSuggestions([
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
          ]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    // Debounce the suggestion generation to avoid too many API calls
    const timeoutId = setTimeout(generateSuggestions, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [messages]);

  return { suggestions, loading, error };
}
