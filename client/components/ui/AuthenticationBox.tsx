'use client';

import React, { useState } from 'react';
import { Play, ArrowRight } from 'lucide-react';
import { Button } from './button';
import { TabToggle } from './TabToggle';
import { StructuredToolActivityView } from './StructuredToolActivityView';
import { VerdictDisplay } from './VerdictDisplay';

interface VerdictData {
  isAuthentic: string | null;
  reason: string;
  citations: string[];
}

interface ToolUse {
  id: string;
  name: string;
  input?: any;
}

interface AuthenticationBoxProps {
  status: 'idle' | 'processing' | 'complete';
  toolUses?: ToolUse[];
  assistantText?: string;
  verdictData?: VerdictData | null;
  onStartAuthentication: () => void;
  onNext?: () => void;
  className?: string;
}

export function AuthenticationBox({
  status,
  toolUses = [],
  assistantText = '',
  verdictData = null,
  onStartAuthentication,
  onNext,
  className = '',
}: AuthenticationBoxProps) {
  const [activeTab, setActiveTab] = useState<string>('Tool Activity');

  // Update tab options based on status
  const getTabOptions = () => {
    if (status === 'complete' && verdictData) {
      return ['Tool Activity', 'Verdict'];
    } else if (status === 'processing') {
      return ['Tool Activity'];
    }
    return [];
  };

  const tabOptions = getTabOptions();

  // Get background color based on verdict
  const getBackgroundColor = () => {
    if (status === 'complete' && verdictData && activeTab === 'Verdict') {
      switch (verdictData.isAuthentic) {
        case 'Counterfeit':
          return 'bg-red-900/30';
        case 'Authentic':
        case 'Review Required':
        case 'Indeterminate':
        default:
          return 'bg-[#111728]';
      }
    }
    return 'bg-[#111728]';
  };

  // Pre-authentication state (idle)
  if (status === 'idle') {
    return (
      <div className={`bg-[#111728] rounded-2xl p-8 ${className}`}>
        <h2 className="text-xl font-semibold text-white mb-6">Authentication</h2>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700/50 border border-gray-600">
            <Play className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-base font-medium text-gray-200">Start Authentication Process</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-md">
            Click the button below to begin the web research and data comparison for the uploaded chip image.
          </p>
          <Button
            onClick={onStartAuthentication}
            size="lg"
            className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Authentication
          </Button>
        </div>
      </div>
    );
  }

  // Processing or Complete state
  return (
    <div className={`${getBackgroundColor()} rounded-2xl ${className}`}>
      <div className="p-6 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Authentication</h2>
        {tabOptions.length > 0 && (
          <TabToggle
            options={tabOptions}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </div>

      <div className="min-h-[300px]">
        {/* Tool Activity View - shows tools used + agent response */}
        {activeTab === 'Tool Activity' && (
          <StructuredToolActivityView
            toolUses={toolUses}
            assistantText={assistantText}
            isProcessing={status === 'processing'}
          />
        )}

        {/* Verdict View */}
        {activeTab === 'Verdict' && status === 'complete' && verdictData && (
          <VerdictDisplay verdictData={verdictData} />
        )}
      </div>

      {/* Next Button (only show when complete) */}
      {status === 'complete' && onNext && (
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <Button
            onClick={onNext}
            size="lg"
            className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white"
          >
            Next
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}