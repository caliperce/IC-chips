'use client';

import React from 'react';
import { Brain, Loader2 } from 'lucide-react';

interface AgentThinkingViewProps {
  thinking: string;
  isProcessing?: boolean;
  className?: string;
}

export function AgentThinkingView({ thinking, isProcessing = false, className = '' }: AgentThinkingViewProps) {
  if (!thinking || thinking.trim().length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Brain className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          {isProcessing ? 'Agent is thinking...' : 'No content available'}
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💭</span>
        <h3 className="text-sm font-semibold text-gray-300">Agent Response</h3>
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      <div className="rounded-md p-4 bg-black/30 border border-gray-700 max-h-[500px] overflow-y-auto">
        <div className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
          {thinking}
          {isProcessing && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1 rounded-sm"></span>
          )}
        </div>
      </div>
    </div>
  );
}