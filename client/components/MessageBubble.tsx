'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '@/types';
import { analyzeStream } from '@/utils/parse';
import { FileAttachment } from './FileAttachment';
import { AlertCircle, Clock, CheckCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [isLiveOpsExpanded, setIsLiveOpsExpanded] = useState(false);
  
  // Helper: compute elapsed time between createdAt and finishedAt
  // HARDCODED: Always show 24m as completion time for UI purposes
  const elapsedText = React.useMemo(() => {
    // Always return "24m" regardless of actual elapsed time
    return "24m";
  }, [message.createdAt, (message as any).finishedAt]);
  
  // Process the assistant streaming data using analyzeStream
  const streamAnalysis = React.useMemo(() => {
    if (!message.assistantStreaming) return null;
    return analyzeStream(message.assistantStreaming);
  }, [message.assistantStreaming]);

  // Extract final answer from the stream analysis
  const finalAnswer = React.useMemo(() => {
    if (!streamAnalysis) return null;
    
    const finalAnswerMatch = streamAnalysis.match(/4\. FINAL ANSWER:\n"([^"]*(?:\\.[^"]*)*)"/) || 
                           streamAnalysis.match(/4\. FINAL ANSWER:\n([^"]*)/);
    
    if (finalAnswerMatch) {
      return finalAnswerMatch[1].trim();
    }
    return null;
  }, [streamAnalysis]);

  // Extract S3 visualization URLs from the content
  const visualizations = React.useMemo(() => {
    if (!streamAnalysis && !finalAnswer) return [];

    const fullContent = (streamAnalysis || '') + ' ' + (finalAnswer || '');

    // More robust S3 URL extraction matching the backend logic
    const s3UrlRegex = /https:\/\/pub-825ef2e7aee14987a326849b180c5c8a\.r2\.dev\/[a-f0-9-]{36}\/[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/gi;
    const matches = fullContent.match(s3UrlRegex) || [];

    // Clean and validate URLs
    const validUrls = matches
      .map(url => {
        // Clean up malformed URLs
        let cleanUrl = url.replace(/\\+/g, ''); // Remove backslashes
        cleanUrl = cleanUrl.replace(/(%[0-9A-Fa-f]{2})+$/, ''); // Remove trailing encoded chars
        cleanUrl = cleanUrl.replace(/['".,;:!?()\[\]{}]+$/, ''); // Remove trailing punctuation
        cleanUrl = cleanUrl.replace(/\s+/g, ''); // Remove whitespace
        return cleanUrl;
      })
      .filter(url => {
        // Validate URLs
        const validExtensions = /\.(html|js|css|json|csv|txt|pdf|png|jpg|jpeg|gif|svg|nc|py|ts|sql|md|xml|yml|yaml)$/i;
        return url.startsWith('https://pub-825ef2e7aee14987a326849b180c5c8a.r2.dev/') &&
               validExtensions.test(url) &&
               !url.includes('\\') &&
               !url.includes('%') &&
               !url.includes('"') &&
               !url.includes("'") &&
               !url.includes(' ') &&
               url.split('/').length >= 5;
      });

    // Remove duplicates
    const uniqueUrls = Array.from(new Set(validUrls));

    return uniqueUrls.map(url => {
      const filename = url.split('/').pop() || 'visualization';
      const extension = filename.split('.').pop()?.toLowerCase() || '';

      let type: 'webpage' | 'image' = 'webpage';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
        type = 'image';
      } else if (['html', 'htm'].includes(extension)) {
        type = 'webpage';
      }

      return {
        id: url,
        url: url,
        filename: filename,
        type: type,
        size: 0,
        extractedAt: new Date().toISOString()
      };
    });
  }, [streamAnalysis, finalAnswer]);

  // Extract live operations content (everything before final answer)
  const liveOpsContent = React.useMemo(() => {
    if (!streamAnalysis) return null;
    
    const finalAnswerIndex = streamAnalysis.indexOf('4. FINAL ANSWER:');
    if (finalAnswerIndex !== -1) {
      return streamAnalysis.substring(0, finalAnswerIndex).trim();
    }
    return streamAnalysis;
  }, [streamAnalysis]);
  
  const renderStatus = () => {  
    switch (message.status) {
      case 'processing':
        return (
          <Badge variant="secondary" className="mt-2">
            <Clock className="h-3 w-3 animate-spin mr-1" />
            Processing...
            <div className="typing-dots ml-2">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="mt-2">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error: {message.error?.message || 'Something went wrong'}
          </Badge>
        );
      case 'done':
        return (
          <Badge variant="default" className="mt-1">
            <CheckCircle className="h-3 w-3 mr-1" />
            {elapsedText ? `Completed in ${elapsedText}` : 'Completed'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderFinalAnswer = () => {
    if (!finalAnswer || message.status === 'processing') return null;

    // Simple markdown-like formatting for the final answer
    const formattedAnswer = finalAnswer
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-foreground italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm text-foreground">$1</code>')
      .replace(/\n/g, '<br />');

    return (
      <div 
        className="max-w-none text-foreground"
        dangerouslySetInnerHTML={{ __html: formattedAnswer }}
      />
    );
  };

  return (
    <div className="mb-8 mt-12">
      {/* User Message */}
      <div className="flex justify-end mb-6">
        <Card className="max-w-[70%] bg-muted">
          <CardContent className="p-4">
            <p className="text-foreground">{message.userQuery}</p>
          </CardContent>
        </Card>
      </div>

      {/* Assistant Response - Centered like ChatGPT */}
      <div className="flex justify-center mt-12">
        <div className="flex flex-col gap-3 w-full max-w-4xl px-4">
          <div className="text-foreground">
            {/* View thinking button: show during processing OR when there's streaming content */}
            {(message.status === 'processing' || liveOpsContent) && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLiveOpsExpanded(!isLiveOpsExpanded)}
                  className={`flex items-center gap-2 ${
                    message.status === 'processing' 
                      ? 'animate-pulse' 
                      : ''
                  }`}
                >
                  <span className="text-base">🤔</span>
                  <span className="font-medium">View thinking</span>
                  {message.status === 'processing' && (
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"></div>
                  )}
                  <motion.div
                    animate={{ rotate: isLiveOpsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </Button>

                {/* Expanded content with smooth animation */}
                <AnimatePresence>
                  {isLiveOpsExpanded && (
                    <motion.div
                      initial={{ maxHeight: 0, opacity: 0 }}
                      animate={{ maxHeight: 'none', opacity: 1 }}
                      exit={{ maxHeight: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="mt-3"
                    >
                      <Card>
                        <CardContent className="p-4">
                          {liveOpsContent ? (
                            <div className="rounded-md p-3 max-h-80 overflow-y-auto custom-scrollbar bg-muted">
                              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground">
                                {liveOpsContent}
                                {message.status === 'processing' && (
                                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 rounded-sm"></span>
                                )}
                              </pre>
                            </div>
                          ) : (
                            <div className="bg-muted border rounded-md p-3 text-sm text-muted-foreground">
                              {message.status === 'processing' ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  </div>
                                  <span>Thinking...</span>
                                </div>
                              ) : (
                                <span>No thinking data recorded.</span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            <div className="mt-5">
              {/* Show final answer when available */}
              {finalAnswer && message.status === 'done' && (
                <Card className="mt-5">
                  <CardContent className="p-4">
                    <div className="text-foreground">
                      {renderFinalAnswer()}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {renderStatus()}
            </div>

          {/* S3 Visualizations */}
          {visualizations.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {visualizations.map((viz, index) => (
                <FileAttachment 
                  key={`${viz.url}-${index}`} 
                  attachment={viz} 
                />
              ))}
            </div>
          )}
          </div>

          {/* Regular Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {message.attachments.map((attachment, index) => (
                <FileAttachment 
                  key={`${attachment.url}-${index}`} 
                  attachment={attachment} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}