'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircleIcon, ImageIcon, UploadIcon, XIcon, ChevronDown, ScanIcon, Loader2, PanelLeftOpen, CheckCircle } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { db } from '@/lib/firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import { FrontendStreamParser } from '@/utils/frontend-stream-parser';
import { SessionSidebar } from './SessionSidebar';
import { getSession } from '@/utils/api';

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
      const imageAttachments = await Promise.all(
        files.map(async (fileItem) => {
          const file = fileItem.file as File;
          return new Promise<{ url: string; type: string; filename: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                url: reader.result as string,
                type: 'image',
                filename: file.name,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery: '[IC_CHIP_SCAN]',
          ownerUid: 'anonymous',
          attachments: imageAttachments,
        }),
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

        if (rawStream && parser) {
          parser.processChunk(rawStream);
          const state = parser.getState();

          setScanResults(prev =>
            prev.map(result =>
              result.id === messageId
                ? {
                    ...result,
                    status: messageData.status || 'processing',
                    agentThinking: state.thinking || state.assistantText || result.agentThinking,
                    assistantText: state.assistantText,
                    finalAnswer: messageData.assistantResponse || state.assistantText,
                    error: messageData.error?.message,
                    toolsUsed: state.toolUses,
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

  const renderScanResult = (result: ScanResult) => {
    const isExpanded = expandedThinking === result.id;

    return (
      <div key={result.id} className="mb-6">
        <Card>
          <CardContent className="p-6">
            {result.agentThinking && (
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
                      <div className="rounded-md p-4 max-h-80 overflow-y-auto bg-muted/30 border">
                        <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-foreground/80">
                          {result.agentThinking}
                          {result.status === 'processing' && (
                            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 rounded-sm"></span>
                          )}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {result.finalAnswer && result.status === 'done' && (
              <div className="mt-4">
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground whitespace-pre-wrap">{result.finalAnswer}</p>
                </div>
              </div>
            )}

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
                {scanResults.map(renderScanResult)}
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
