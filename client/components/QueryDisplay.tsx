'use client';

import React from 'react';
import { Database, Clock, Copy, Play } from 'lucide-react';

interface DuckDbQuery {
  query: string;
  timestamp: string;
  description?: string;
}

interface QueryDisplayProps {
  queries: DuckDbQuery[];
}

export function QueryDisplay({ queries }: QueryDisplayProps) {
  if (!queries || queries.length === 0) {
    return null;
  }

  const copyToClipboard = async (query: string) => {
    try {
      await navigator.clipboard.writeText(query);
    } catch (err) {
      console.error('Failed to copy query:', err);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatQuery = (query: string) => {
    // Simple SQL formatting
    return query
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, 'FROM')
      .replace(/\bWHERE\b/gi, 'WHERE')
      .replace(/\bGROUP BY\b/gi, 'GROUP BY')
      .replace(/\bORDER BY\b/gi, 'ORDER BY')
      .replace(/\bLIMIT\b/gi, 'LIMIT')
      .replace(/\bJOIN\b/gi, 'JOIN')
      .replace(/\bINNER JOIN\b/gi, 'INNER JOIN')
      .replace(/\bLEFT JOIN\b/gi, 'LEFT JOIN')
      .replace(/\bRIGHT JOIN\b/gi, 'RIGHT JOIN')
      .replace(/\bAND\b/gi, 'AND')
      .replace(/\bOR\b/gi, 'OR');
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
        <Database className="h-4 w-4 text-blue-400" />
        <span>DuckDB Queries Executed ({queries.length})</span>
      </div>
      
      {queries.map((queryData, index) => (
        <div 
          key={index}
          className="bg-gray-800/60 border border-gray-600/40 rounded-xl overflow-hidden backdrop-blur-sm hover:border-gray-500/50 transition-all duration-200"
        >
          {/* Query Header */}
          <div className="bg-gray-900/80 px-4 py-3 border-b border-gray-600/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-3 w-3 text-green-400" />
                <span className="text-xs font-semibold text-gray-200">
                  Query #{index + 1}
                </span>
                {queryData.description && (
                  <span className="text-xs text-gray-400">
                    • {queryData.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(queryData.timestamp)}
                </div>
                <button
                  onClick={() => copyToClipboard(queryData.query)}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition-all duration-200"
                  title="Copy query"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Query Content */}
          <div className="p-4">
            <pre className="text-sm font-mono text-gray-100 whitespace-pre-wrap overflow-x-auto">
              <code className="language-sql">
                {formatQuery(queryData.query)}
              </code>
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}