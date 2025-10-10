'use client';

import React, { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { UploadSection } from './ui/UploadSection';
import { ImagePreview } from './ui/ImagePreview';
import { AuthenticationBox } from './ui/AuthenticationBox';
import { db } from '@/lib/firebase';
import { onSnapshot, doc } from 'firebase/firestore';
// @ts-ignore
import { FrontendStreamParser } from '../utils/stream-parser';

interface VerdictData {
  isAuthentic: string | null;
  reason: string;
  citations: string[];
}

interface ScanResult {
  id: string;
  sessionId?: string;
  status: 'processing' | 'done' | 'error';
  agentThinking?: string;
  assistantText?: string;
  finalAnswer?: string;
  citations?: string[];
  error?: string;
  toolsUsed?: Array<{ id: string; name: string }>;
  toolActivity?: string[];
  verdictData?: VerdictData | null;
}

type AuthStatus = 'idle' | 'processing' | 'complete';

export function ChipAuthenticator() {
  const maxSizeMB = 10;
  const maxSize = maxSizeMB * 1024 * 1024;
  const maxFiles = 6;

  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [currentScanResult, setCurrentScanResult] = useState<ScanResult | null>(null);
  const parsersRef = useRef<Map<string, any>>(new Map());

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
      clearFiles,
    },
  ] = useFileUpload({
    accept: 'image/png,image/jpeg,image/jpg',
    maxSize,
    multiple: true,
    maxFiles,
  });

  const handleStartAuthentication = async () => {
    if (files.length === 0) return;

    setAuthStatus('processing');

    try {
      const formData = new FormData();
      formData.append('userQuery', 'scan');

      files.forEach((fileItem) => {
        const file = fileItem.file as File;
        formData.append('images', file);
      });

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to initiate scan');
      }

      const data = await response.json();

      const newScanResult: ScanResult = {
        id: data.messageId,
        sessionId: data.sessionId,
        status: 'processing',
        agentThinking: 'Initializing scan...',
      };

      setCurrentScanResult(newScanResult);
      setupMessageListener(data.messageId);
    } catch (error) {
      console.error('Scan error:', error);
      setAuthStatus('idle');
    }
  };

  const setupMessageListener = (messageId: string) => {
    const messageRef = doc(db, 'messages', messageId);
    let lastProcessedLength = 0;

    const parser = new FrontendStreamParser({
      onTextUpdate: (_newText: string, fullText: string) => {
        setCurrentScanResult((prev) =>
          prev ? { ...prev, assistantText: fullText } : prev
        );
      },
      onThinkingUpdate: (_newThinking: string, fullThinking: string) => {
        setCurrentScanResult((prev) =>
          prev ? { ...prev, agentThinking: fullThinking } : prev
        );
      },
      onToolUse: (toolInfo: any) => {
        setCurrentScanResult((prev) =>
          prev
            ? { ...prev, toolsUsed: [...(prev.toolsUsed || []), toolInfo] }
            : prev
        );
      },
    });

    parsersRef.current.set(messageId, parser);

    const unsubscribe = onSnapshot(messageRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const messageData = docSnapshot.data();
        const rawStream = messageData.assistantStreaming || '';

        if (rawStream && parser && rawStream.length > lastProcessedLength) {
          const newChunk = rawStream.slice(lastProcessedLength);
          parser.processChunk(newChunk);
          lastProcessedLength = rawStream.length;
          const state = parser.getState();

          let thinkingSummary = '';
          if (state.toolActivity && state.toolActivity.length > 0) {
            thinkingSummary = state.toolActivity.join('\n');
          } else if (state.thinking) {
            thinkingSummary = state.thinking;
          } else if (state.assistantText) {
            thinkingSummary = 'Agent is generating response...';
          } else {
            thinkingSummary = 'Processing...';
          }

          setCurrentScanResult((prev) =>
            prev
              ? {
                  ...prev,
                  status: messageData.status || 'processing',
                  agentThinking: thinkingSummary,
                  assistantText: state.assistantText,
                  finalAnswer: messageData.assistantResponse,
                  error: messageData.error?.message,
                  toolsUsed: state.toolUses,
                  toolActivity: state.toolActivity,
                  verdictData: state.verdictData,
                }
              : prev
          );
        }

        if (messageData.status === 'done') {
          setAuthStatus('complete');
          parsersRef.current.delete(messageId);
          unsubscribe();
        }

        if (messageData.status === 'error') {
          setAuthStatus('idle');
          parsersRef.current.delete(messageId);
          unsubscribe();
        }
      }
    });
  };

  const handleNext = () => {
    setAuthStatus('idle');
    setCurrentScanResult(null);
    clearFiles();
  };

  const hasUploadedFiles = files.length > 0;

  // Get page background color based on verdict
  const getPageBackgroundColor = () => {
    if (authStatus === 'complete' && currentScanResult?.verdictData) {
      switch (currentScanResult.verdictData.isAuthentic) {
        case 'Counterfeit':
          return 'bg-red-950';
        case 'Review Required':
          return 'bg-[#3d8548]';
        case 'Indeterminate':
          return 'bg-[#3d8548]';
        case 'Authentic':
          return 'bg-[#3d8548]';
        default:
          return 'bg-[#3d8548]';
      }
    }
    return 'bg-[#3d8548]';
  };

  return (
    <div className={`min-h-screen w-full ${getPageBackgroundColor()}`}>
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#5b8def] rounded-lg p-2">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Chip Authenticator</h1>
          </div>

          <nav className="flex items-center gap-6">
            <button className="text-sm font-medium text-white hover:text-gray-300 transition-colors">
              Dashboard
            </button>
            <button className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              History
            </button>
            <button className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              Settings
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center ml-2">
              <User className="h-5 w-5 text-gray-300" />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-semibold text-white">Chip Authentication</h2>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-[#5b8def] hover:bg-[#4a7dd8] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            New Session
          </button>
        </div>

        <div className="space-y-6">
          {/* Upload Section or Image Preview */}
          {!hasUploadedFiles || authStatus === 'idle' ? (
            <UploadSection
              files={files}
              isDragging={isDragging}
              maxFiles={maxFiles}
              maxSizeMB={maxSizeMB}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onRemoveFile={removeFile}
              onOpenFileDialog={openFileDialog}
              getInputProps={getInputProps}
            />
          ) : (
            <ImagePreview
              images={files.map(f => f.preview || '')}
            />
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-400">{errors[0]}</p>
            </div>
          )}

          {/* Authentication Box */}
          {hasUploadedFiles && (
            <AuthenticationBox
              status={authStatus}
              toolUses={currentScanResult?.toolsUsed}
              assistantText={currentScanResult?.assistantText}
              verdictData={currentScanResult?.verdictData}
              onStartAuthentication={handleStartAuthentication}
              onNext={handleNext}
            />
          )}
        </div>
      </main>
    </div>
  );
}