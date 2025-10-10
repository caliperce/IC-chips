'use client';

import React from 'react';
import { Globe, Loader2 } from 'lucide-react';

interface ToolActivityViewProps {
  toolActivity: string[];
  isProcessing?: boolean;
  className?: string;
}

export function ToolActivityView({ toolActivity, isProcessing = false, className = '' }: ToolActivityViewProps) {
  if (!toolActivity || toolActivity.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Globe className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No tool activity yet</p>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {isProcessing ? (
          <Globe className="h-5 w-5 text-blue-500 animate-pulse" />
        ) : (
          <Globe className="h-5 w-5 text-blue-500" />
        )}
        <h3 className="text-sm font-semibold text-gray-300">Web Search & Tool Activity</h3>
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      <div className="rounded-md p-4 bg-black/30 border border-gray-700">
        <pre className="text-xs font-mono leading-relaxed text-gray-300 whitespace-pre-wrap">
          {toolActivity.join('\n')}
          {isProcessing && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1 rounded-sm"></span>
          )}
        </pre>
      </div>
    </div>
  );
}