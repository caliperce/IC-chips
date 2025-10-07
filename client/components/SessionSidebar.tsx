'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Edit3, AlertCircle, PanelLeftClose, Upload, Search, X } from 'lucide-react';
import { Session } from '@/types';
import { getSessions, searchMessages } from '@/utils/api';
import { useRouter } from 'next/navigation';

interface SessionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export function SessionSidebar({
  isOpen,
  onClose,
  currentSessionId,
  onSessionSelect,
  onNewChat
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSessions();
      setSessions(response.sessions);
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    
    // If search term is empty, clear search results and show all sessions
    if (!term.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const results = await searchMessages(term);
      setSearchResults(results);
    } catch (err) {
      setError('Failed to search messages');
      console.error('Error searching messages:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setIsSearching(false);
  };

  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId);
    onClose();
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  const handleUploadFiles = () => {
    router.push('/upload-files');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sidebar-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '256px', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          className="h-full shadow-xl flex flex-col flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: '#f9f9f9', backdropFilter: 'blur(10px)' }}
        >
            {/* Header */}
            <div className="mb-8">
              {/* Close Button */}
              <div className="flex justify-start p-2 mx-2 mt-3 mb-6">
                <PanelLeftClose 
                  onClick={onClose}
                  className="h-6 w-6 text-gray-600 hover:text-gray-800 cursor-pointer transition-colors duration-200"
                />
              </div>
              
              {/* New Chat Button */}
              <div
                className="p-2 mx-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                onClick={handleNewChat}
              >
                <div className="flex items-center gap-2 text-gray-800 hover:bg-[#dadada] py-2 px-2 text-sm font-open-sans-medium rounded-lg">
                  <Edit3 className="h-4 w-4" />
                  New chat
                </div>
              </div>

              {/* Upload Files Button */}
              <div
                className="p-2 mx-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                onClick={handleUploadFiles}
              >
                <div className="flex items-center gap-2 text-gray-800 hover:bg-[#dadada] py-2 px-2 text-sm font-open-sans-medium rounded-lg">
                  <Upload className="h-4 w-4" />
                  Upload Files
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Chats Section */}
            <div className="px-2 ml-3 mb-2">
              <h3 className="text-xs font-open-sans-medium text-gray-600 uppercase tracking-wider px-2">
                {searchResults ? `Search Results (${searchResults.uniqueSessions} sessions)` : 'Chats'}
              </h3>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {(loading || isSearching) ? (
                <div className="p-4 text-center text-gray-800">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  {isSearching ? 'Searching...' : 'Loading sessions...'}
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                  {error}
                </div>
              ) : searchResults && searchResults.sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-800">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No results found</p>
                  <p className="text-sm">Try a different search term</p>
                </div>
              ) : sessions.length === 0 && !searchResults ? (
                <div className="p-4 text-center text-gray-800">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No chat sessions yet</p>
                  <p className="text-sm">Start a new conversation!</p>
                </div>
              ) : (
                <div className="px-2 space-y-1">
                  {(searchResults ? searchResults.sessions : sessions).map((session: any) => {
                    return (
                      <motion.div
                        key={session.id}
                        className={`group px-3 py-3 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                          currentSessionId === session.id
                            ? 'text-gray-900'
                            : 'text-gray-800'
                        }`}
                        style={{ 
                          backgroundColor: currentSessionId === session.id ? '#dadada' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (currentSessionId !== session.id) {
                            e.currentTarget.style.backgroundColor = '#dadada';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentSessionId !== session.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        onClick={() => handleSessionClick(session.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70 text-gray-600" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-open-sans text-base leading-relaxed text-gray-800">
                              {session.title || session.id}
                            </p>
                            {searchResults && session.matchCount && (
                              <p className="text-xs text-gray-500 mt-1">
                                {session.matchCount} matching {session.matchCount === 1 ? 'message' : 'messages'}
                              </p>
                            )}
                          </div>
                        </div>
                        {searchResults && session.matchingMessages && session.matchingMessages.length > 0 && (
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            {session.matchingMessages.slice(0, 2).map((msg: any) => (
                              <div key={msg.id} className="truncate pl-7 italic">
                                "{msg.userQuery.substring(0, 60)}..."
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}