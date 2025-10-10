'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface VerdictData {
  isAuthentic: string | null;
  reason: string;
  citations: string[];
}

interface VerdictDisplayProps {
  verdictData: VerdictData;
  className?: string;
}

export function VerdictDisplay({ verdictData, className = '' }: VerdictDisplayProps) {
  const getVerdictIcon = () => {
    switch (verdictData.isAuthentic) {
      case 'Authentic':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Counterfeit':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Review Required':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getVerdictBadgeStyle = () => {
    switch (verdictData.isAuthentic) {
      case 'Authentic':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Counterfeit':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Review Required':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className={`p-6 ${className}`}>
      {/* Verdict Badge */}
      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Verdict</h4>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getVerdictBadgeStyle()}`}>
          {getVerdictIcon()}
          <span className="font-semibold text-sm">{verdictData.isAuthentic || 'Unknown'}</span>
        </div>
      </div>

      {/* Reason/Explanation */}
      {verdictData.reason && (
        <div className="mb-4">
          <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {verdictData.reason}
          </p>
        </div>
      )}

      {/* Citations */}
      {verdictData.citations && verdictData.citations.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Citations</h4>
          <div className="space-y-2">
            {verdictData.citations.map((citation, idx) => (
              <a
                key={idx}
                href={citation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors group"
              >
                <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                <span className="break-all">{citation}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}