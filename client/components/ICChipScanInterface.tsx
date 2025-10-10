'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircleIcon, ImageIcon, UploadIcon, XIcon, ChevronDown, ScanIcon, Loader2, PanelLeftOpen, CheckCircle, Globe } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { db } from '@/lib/firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import { FrontendStreamParser, parseCompleteLog, formatResults } from '../utils/stream-parser';
import { SessionSidebar } from './SessionSidebar';
import { getSession } from '@/utils/api';

interface VerdictData {
  isAuthentic: string | null; // 'Authentic' | 'Counterfeit' | 'Review Required' | 'Indeterminate'
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
  toolActivity?: string[]; // Array of tool activity log entries
  verdictData?: VerdictData | null; // Parsed verdict data
}

export function ICChipScanInterface() {
  const maxSizeMB = 10;
  const maxSize = maxSizeMB * 1024 * 1024;
  const maxFiles = 6;
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null);
  const parsersRef = useRef<Map<string, FrontendStreamParser>>(new Map());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

  const handleScan = async () => {
    if (files.length === 0) return;

    setIsScanning(true);

    try {
      // Create FormData to upload actual files to R2
      const formData = new FormData();
      formData.append('userQuery', 'scan');

      // Add all image files to FormData
      files.forEach((fileItem) => {
        const file = fileItem.file as File;
        formData.append('images', file);
      });

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        body: formData, // Send as multipart/form-data (multer will handle it)
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

      setScanResults(prev => [newScanResult, ...prev]);
      setupMessageListener(data.messageId);
      setCurrentSessionId(data.sessionId);

    } catch (error) {
      console.error('Scan error:', error);
      setIsScanning(false);
    }
  };

  const setupMessageListener = (messageId: string) => {
    const messageRef = doc(db, 'messages', messageId);
    let lastProcessedLength = 0; // Track how much we've already processed

    const parser = new FrontendStreamParser({
      onTextUpdate: (_newText: string, fullText: string) => {
        setScanResults(prev =>
          prev.map(result =>
            result.id === messageId ? { ...result, assistantText: fullText } : result
          )
        );
      },
      onThinkingUpdate: (_newThinking: string, fullThinking: string) => {
        setScanResults(prev =>
          prev.map(result =>
            result.id === messageId ? { ...result, agentThinking: fullThinking } : result
          )
        );
      },
      onToolUse: (toolInfo: any) => {
        setScanResults(prev =>
          prev.map(result =>
            result.id === messageId
              ? { ...result, toolsUsed: [...(result.toolsUsed || []), toolInfo] }
              : result
          )
        );
      },
    });

    parsersRef.current.set(messageId, parser);

    const unsubscribe = onSnapshot(messageRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const messageData = docSnapshot.data();
        const rawStream = messageData.assistantStreaming || '';

        // Only process NEW data (not the entire stream again)
        if (rawStream && parser && rawStream.length > lastProcessedLength) {
          const newChunk = rawStream.slice(lastProcessedLength);
          parser.processChunk(newChunk);
          lastProcessedLength = rawStream.length;
          const state = parser.getState();

          // Debug logging
          console.log('[Parser State]', {
            assistantTextLength: state.assistantText?.length || 0,
            toolActivityCount: state.toolActivity?.length || 0,
            toolUsesCount: state.toolUses?.length || 0,
            thinkingLength: state.thinking?.length || 0
          });

          // Build a meaningful thinking summary from tool activity
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

          setScanResults(prev =>
            prev.map(result =>
              result.id === messageId
                ? {
                    ...result,
                    status: messageData.status || 'processing',
                    agentThinking: thinkingSummary,
                    assistantText: state.assistantText,
                    finalAnswer: messageData.assistantResponse,
                    error: messageData.error?.message,
                    toolsUsed: state.toolUses,
                    toolActivity: state.toolActivity, // Add tool activity tracking
                    verdictData: state.verdictData, // Add parsed verdict data
                  }
                : result
            )
          );
        }

        if (messageData.status === 'done') {
          const allText = (messageData.assistantResponse || '') + ' ' + (messageData.assistantStreaming || '');
          const urlRegex = /https?:\/\/[^\s)"'\]]+/g;
          const foundUrls = allText.match(urlRegex) || [];
          const uniqueCitations = Array.from(new Set(foundUrls));

          setScanResults(prev =>
            prev.map(result =>
              result.id === messageId
                ? { ...result, citations: uniqueCitations, status: 'done' }
                : result
            )
          );

          setIsScanning(false);
          parsersRef.current.delete(messageId);
          unsubscribe();
        }

        if (messageData.status === 'error') {
          setIsScanning(false);
          parsersRef.current.delete(messageId);
          unsubscribe();
        }
      }
    });
  };

  const handleSessionSelect = async (sessionId: string) => {
    try {
      const sessionData = await getSession(sessionId);
      setCurrentSessionId(sessionId);

      const results: ScanResult[] = sessionData.messages.map((msg: any) => ({
        id: msg.id,
        sessionId: sessionId,
        status: msg.status,
        agentThinking: msg.assistantStreaming,
        assistantText: msg.assistantResponse,
        finalAnswer: msg.assistantResponse,
        error: msg.error?.message,
        citations: extractCitations(msg.assistantResponse || msg.assistantStreaming || ''),
      }));

      setScanResults(results);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const handleNewScan = () => {
    setCurrentSessionId(null);
    setScanResults([]);
    clearFiles();
  };

  const extractCitations = (text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s)"'\]]+/g;
    const foundUrls = text.match(urlRegex) || [];
    return Array.from(new Set(foundUrls));
  };

  const renderScanResult = (result: ScanResult, uploadedImages?: Array<{ preview?: string }>) => {
    const isExpanded = expandedThinking === result.id;

    // Helper function to extract final answer without diagnostics
    const getFinalAnswer = (text: string | undefined) => {
      if (!text) return '';
      const diagnosticsIndex = text.indexOf('=== Diagnostics ===');
      if (diagnosticsIndex !== -1) {
        return text.substring(0, diagnosticsIndex).trim();
      }
      return text;
    };

    // Determine what to show in the answer section
    const finalAnswerText = result.status === 'done'
      ? getFinalAnswer(result.finalAnswer || result.assistantText)
      : '';

    return (
      <div key={result.id} className="mb-6">
        <Card>
          <CardContent className="p-6">
            {(result.agentThinking || result.toolActivity || result.assistantText) && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedThinking(isExpanded ? null : result.id)}
                  className={`flex items-center gap-2 ${result.status === 'processing' ? 'animate-pulse' : ''}`}
                >
                  <span className="text-base">🔍</span>
                  <span className="font-medium">Agent Working</span>
                  {result.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </Button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ maxHeight: 0, opacity: 0 }}
                      animate={{ maxHeight: 'none', opacity: 1 }}
                      exit={{ maxHeight: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="mt-3"
                    >
                      <div className="rounded-md p-4 max-h-96 overflow-y-auto bg-muted/30 border">
                        {/* Tool Activity with Web Search Icon */}
                        {result.toolActivity && result.toolActivity.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold mb-2 text-foreground/90 flex items-center gap-2">
                              {result.status === 'processing' ? (
                                <Globe className="h-4 w-4 text-blue-500 animate-pulse" />
                              ) : (
                                <Globe className="h-4 w-4 text-blue-500" />
                              )}
                              Web Search & Tool Activity
                              {result.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            </h4>
                            <div className="rounded-md p-3 bg-black/10 dark:bg-black/30">
                              <pre className="text-xs font-mono leading-relaxed text-foreground/70 whitespace-pre-wrap">
                                {result.toolActivity.join('\n')}
                                {result.status === 'processing' && (
                                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 rounded-sm"></span>
                                )}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Assistant Streaming Text (Thinking) */}
                        {result.assistantText && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2 text-foreground/90 flex items-center gap-2">
                              💭 Agent Thinking
                              {result.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            </h4>
                            <div className="rounded-md p-3 bg-black/10 dark:bg-black/30">
                              <div className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
                                {result.assistantText}
                                {result.status === 'processing' && (
                                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 rounded-sm"></span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Show verdict card when done */}
            {result.status === 'done' && result.verdictData && (
              <div className="mt-4">
                <div className="rounded-lg border p-6 bg-card">
                  {/* Images preview (if we have uploaded images) */}
                  {uploadedImages && uploadedImages.length > 0 && (
                    <div className="mb-6 grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {uploadedImages.slice(0, 2).map((file, idx) => (
                        file.preview && (
                          <div key={idx} className="relative">
                            <div className="aspect-video rounded-lg overflow-hidden border-2 border-muted">
                              <img
                                src={file.preview}
                                alt={idx === 0 ? "Original Image" : "Analyzed Image"}
                                className="w-full h-full object-contain bg-muted/30"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              {idx === 0 ? "Original Image" : "Analyzed Image"}
                            </p>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Authentication</h3>

                  <h4 className="text-sm font-medium text-foreground/70 mb-2">Verdict</h4>

                  {/* Verdict Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm ${
                      result.verdictData.isAuthentic === 'Authentic'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : result.verdictData.isAuthentic === 'Counterfeit'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : result.verdictData.isAuthentic === 'Review Required'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {result.verdictData.isAuthentic === 'Authentic' && '✓'}
                      {result.verdictData.isAuthentic === 'Counterfeit' && '✕'}
                      {result.verdictData.isAuthentic === 'Review Required' && '⚠'}
                      {result.verdictData.isAuthentic === 'Indeterminate' && '?'}
                      <span>{result.verdictData.isAuthentic || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  {result.verdictData.reason && (
                    <div className="mb-4 p-3 bg-muted/20 rounded-md">
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {result.verdictData.reason}
                      </p>
                    </div>
                  )}

                  {/* Citations */}
                  {result.verdictData.citations && result.verdictData.citations.length > 0 && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-md border">
                      <h4 className="text-sm font-semibold mb-2 text-foreground">Citations</h4>
                      <div className="flex flex-col gap-2">
                        {result.verdictData.citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex items-start gap-2"
                          >
                            <span className="text-blue-400 shrink-0">•</span>
                            <span>{citation}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback: Show final answer when done but no verdict data parsed */}
            {finalAnswerText && result.status === 'done' && !result.verdictData && (
              <div className="mt-4">
                <div className="prose prose-sm max-w-none">
                  <div className="text-foreground whitespace-pre-wrap">{finalAnswerText}</div>
                </div>

                {/* Show citations if they exist in fallback mode */}
                {result.citations && result.citations.length > 0 && (
                  <div className="mt-4 p-3 bg-muted/30 rounded-md border">
                    <h4 className="text-sm font-semibold mb-2 text-foreground">Citations</h4>
                    <div className="flex flex-col gap-1">
                      {result.citations.map((citation, idx) => (
                        <a
                          key={idx}
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
                        >
                          {citation}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.status === 'processing' && (
              <Badge variant="secondary" className="mt-3">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Processing...
              </Badge>
            )}
            {result.status === 'done' && (
              <Badge variant="default" className="mt-3 bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
            {result.status === 'error' && (
              <Badge variant="destructive" className="mt-3">
                Error: {result.error || 'Something went wrong'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex">
      <SessionSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewScan}
      />

      <div className="flex-1 flex flex-col bg-background">
        {!isSidebarOpen && (
          <PanelLeftOpen
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 z-20 h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
          />
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-light text-foreground mb-2">
                IC Chip Top Marking Verification
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload images of IC chip top markings for automated verification
              </p>
            </div>

            {scanResults.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-foreground">Scan Results</h2>
                {scanResults.map((result) => renderScanResult(result, files))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-background/95 backdrop-blur-sm p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col gap-4">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                data-dragging={isDragging || undefined}
                data-files={files.length > 0 || undefined}
                className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-[180px] flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px] bg-card"
              >
                <input {...getInputProps()} className="sr-only" aria-label="Upload IC chip image" />
                {files.length > 0 ? (
                  <div className="flex w-full flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-medium text-foreground">
                        Uploaded Files ({files.length})
                      </h3>
                      <Button variant="outline" size="sm" onClick={openFileDialog} disabled={files.length >= maxFiles}>
                        <UploadIcon className="-ms-0.5 size-3.5 opacity-60" aria-hidden="true" />
                        Add more
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
                      {files.map((file) => (
                        <div key={file.id} className="bg-muted/30 relative aspect-square rounded-md border">
                          <img src={file.preview} alt={file.file.name} className="size-full rounded-[inherit] object-cover" />
                          <Button
                            onClick={() => removeFile(file.id)}
                            size="icon"
                            className="border-background focus-visible:border-background absolute -top-2 -right-2 size-6 rounded-full border-2 shadow-sm bg-destructive hover:bg-destructive/90"
                            aria-label="Remove image"
                          >
                            <XIcon className="size-3.5 text-white" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                    <div className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border" aria-hidden="true">
                      <ImageIcon className="size-4 opacity-60" />
                    </div>
                    <p className="mb-1.5 text-sm font-medium text-foreground">Drop your IC chip images here</p>
                    <p className="text-muted-foreground text-xs">PNG or JPG (max. {maxSizeMB}MB per file)</p>
                    <Button variant="outline" className="mt-4" onClick={openFileDialog}>
                      <UploadIcon className="-ms-1 opacity-60" aria-hidden="true" />
                      Select images
                    </Button>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="text-destructive flex items-center gap-1 text-xs" role="alert">
                  <AlertCircleIcon className="size-3 shrink-0" />
                  <span>{errors[0]}</span>
                </div>
              )}

              <Button onClick={handleScan} disabled={files.length === 0 || isScanning} size="lg" className="w-full">
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <ScanIcon className="mr-2 h-5 w-5" />
                    SCAN {files.length > 0 && `(${files.length} image${files.length > 1 ? 's' : ''})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
