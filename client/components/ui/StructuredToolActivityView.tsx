'use client';

import React from 'react';
import { Search, FileText, Image as ImageIcon, Loader2, Globe } from 'lucide-react';

interface ToolUse {
  id: string;
  name: string;
  input?: any;
}

interface StructuredToolActivityViewProps {
  toolUses: ToolUse[];
  assistantText?: string;
  isProcessing?: boolean;
  className?: string;
}

export function StructuredToolActivityView({
  toolUses,
  assistantText = '',
  isProcessing = false,
  className = ''
}: StructuredToolActivityViewProps) {

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'WebSearch':
      case 'web_search':
        return <Search className="h-4 w-4 text-blue-400" />;
      case 'WebFetch':
      case 'web_fetch':
        return <FileText className="h-4 w-4 text-purple-400" />;
      case 'ImageAnalysis':
      case 'image_analysis':
        return <ImageIcon className="h-4 w-4 text-green-400" />;
      default:
        return <Globe className="h-4 w-4 text-gray-400" />;
    }
  };

  const getToolDescription = (tool: ToolUse) => {
    if (!tool.input) return 'Processing...';

    if (tool.name === 'WebSearch' || tool.name === 'web_search') {
      return `${tool.input.query || tool.input.search_term || 'Searching...'}`;
    }

    if (tool.name === 'WebFetch' || tool.name === 'web_fetch') {
      const url = tool.input.url || '';
      return url.length > 80 ? url.substring(0, 80) + '...' : url;
    }

    if (tool.input.prompt) {
      const prompt = tool.input.prompt;
      return prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt;
    }

    return JSON.stringify(tool.input).substring(0, 80);
  };

  const getToolDisplayName = (toolName: string) => {
    switch (toolName) {
      case 'WebSearch':
      case 'web_search':
        return 'WebSearch';
      case 'WebFetch':
      case 'web_fetch':
        return 'WebFetch';
      case 'ImageAnalysis':
      case 'image_analysis':
        return 'Image Analysis';
      default:
        return toolName;
    }
  };

  // Show empty state if no content yet
  if ((!toolUses || toolUses.length === 0) && (!assistantText || assistantText.trim().length === 0)) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Globe className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          {isProcessing ? 'Initializing...' : 'No activity yet'}
        </p>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {/* Agent Response - Main Content */}
        <div className="bg-black/20 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💭</span>
            <h3 className="text-sm font-semibold text-white">Agent Response</h3>
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
          </div>

          {/* Assistant Text */}
          <div className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap mb-4">
            {assistantText || 'Analyzing...'}
            {isProcessing && assistantText && (
              <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1 rounded-sm"></span>
            )}
          </div>

          {/* Tool Activity embedded within response */}
          {toolUses && toolUses.length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-600/50">
              {toolUses.map((tool, index) => {
                const isLastTool = index === toolUses.length - 1;
                const isActiveProcessing = isProcessing && isLastTool && !tool.input;
                const isCompleted = tool.input !== null && tool.input !== undefined;

                return (
                  <div key={tool.id} className="flex items-start gap-3 bg-gray-800/30 rounded p-2.5">
                    {/* Tool Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getToolIcon(tool.name)}
                    </div>

                    {/* Tool Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-300">
                          {getToolDisplayName(tool.name)}
                        </span>
                        {isActiveProcessing && (
                          <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 break-all leading-relaxed">
                        {getToolDescription(tool)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
