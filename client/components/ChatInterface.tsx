'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { Message, SessionWithMessages } from '@/types';
import { createNewChat, continueChat, getSession } from '@/utils/api';
import { db } from '@/lib/firebase';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SessionSidebar } from './SessionSidebar';
import BlurText from './BlurText';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent } from './ui/card';
import FloatingSiri from './FloatingSiri';

export function ChatInterface() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Only auto-scroll when a new message is added, not during streaming updates
  useEffect(() => {
    // Check if this is a new message (not just a streaming update)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.status !== 'processing') {
      scrollToBottom();
    }
  }, [messages.length]); // Only depend on length, not the full messages array

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const setupMessageListener = (sessionId: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Set up real-time listener for messages in this session
    const messagesQuery = query(
      collection(db, 'messages'),
      where('sessionId', '==', sessionId),
      orderBy('turnNo', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const updatedMessages: Message[] = [];
        snapshot.forEach((doc) => {
          updatedMessages.push({
            id: doc.id,
            ...doc.data()
          } as Message);
        });
        setMessages(updatedMessages);
      },
      (error) => {
        console.error('Error listening to messages:', error);
      }
    );

    unsubscribeRef.current = unsubscribe;
  };

  const handleSendMessage = async (messageText: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let response;
      
      if (currentSessionId) {
        // Continue existing session
        response = await continueChat(currentSessionId, messageText);
      } else {
        // Create new session
        response = await createNewChat(messageText);
        setCurrentSessionId(response.sessionId);
        setupMessageListener(response.sessionId);
      }

      // Fetch the session data to get all messages
      const sessionData = await getSession(response.sessionId);
      setMessages(sessionData.messages);

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionSelect = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionData = await getSession(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(sessionData.messages);
      setupMessageListener(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
      setError('Failed to load session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
  };

  // Show centered input only for completely new sessions with no messages
  const isFirstTime = !currentSessionId && messages.length === 0;
  
  console.log('Debug - currentSessionId:', currentSessionId, 'messages.length:', messages.length, 'isFirstTime:', isFirstTime);

  return (
    <div className="h-screen w-full flex">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 overflow-hidden border-r border-gray-200`}>
        <SessionSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentSessionId={currentSessionId || undefined}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-background">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-muted/30 to-transparent z-0"></div>
        {/* Sidebar Toggle Button */}
        {!isSidebarOpen && (
          <PanelLeftOpen 
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 z-20 h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
          />
        )}
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          {isFirstTime ? (
            <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4" style={{ height: 'calc(100vh - 200px)' }}>
              <BlurText
                text="Let's get kraken on some ocean data!"
                delay={150}
                animateBy="words"
                direction="bottom"
                className="text-2xl font-light text-foreground mb-12"
              />
              {/* Input Area - in the center for new sessions */}
              <div className="w-full">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isLoading}
                  placeholder="Ask any question"
                />
              </div>
            </div>
          ) : (
            <div className="w-full mx-auto px-4 py-6 pb-24">
              {error && (
                <Alert variant="destructive" className="mb-4 max-w-4xl mx-auto">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Sticky Input Area - Only when there are messages */}
        {!isFirstTime && (
          <div className="p-4 relative z-10 bg-background/90 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading}
                placeholder="Ask anything"
              />
            </div>
          </div>
        )}
        
        {/* Floating Siri Animation - Only in ChatInterface */}
        <FloatingSiri />
      </div>
    </div>
  );
}