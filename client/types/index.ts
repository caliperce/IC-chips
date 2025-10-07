export interface DuckDbQuery {
  query: string;
  timestamp: string;
  description?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  ownerUid: string;
  userQuery: string;
  assistantStreaming?: string;  // Final system operations for dropdown
  status: 'processing' | 'done' | 'error';
  createdAt: any;
  updatedAt: any;
  finishedAt?: any;
  turnNo: number;
  error: {
    message: string;
    code: string;
    timestamp: string;
  } | null;
  attachments: Attachment[];
  duckDbQueries?: DuckDbQuery[];
  provider?: {
    vendor: string;
    sessionId: string;
    model: string;
    resumeUsed: boolean;
    previousSessionId?: string;
  };
}

export interface Attachment {
  url: string;
  filename: string;
  type: 'webpage' | 'code' | 'data' | 'document' | 'script' | 'config' | 'file' | 'image';
  extractedAt: string;
}

export interface Session {
  id: string;
  title: string | null;
  createdAt: any;
  updatedAt: any;
  lastMessagePreview: string;
  ownerUid: string;
  current: {
    providerSessionId: string;
    model: string;
    updatedAt: any;
  };
  metadata: {
    messageCount: number;
    sessionDuration?: {
      startTime: any;
      endTime: any;
      durationMinutes: number;
    } | null;
    hasActiveSession: boolean;
  };
  latestMessage?: {
    id: string;
    userQuery: string;
    status: string;
    turnNo: number;
    createdAt: any;
    hasAttachments: boolean;
  } | null;
}

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  status: string;
  message: string;
  turnNo?: number;
}

export interface SessionWithMessages {
  session: Session;
  messages: Message[];
}