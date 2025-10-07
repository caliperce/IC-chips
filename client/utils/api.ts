import { ChatResponse, Session, SessionWithMessages } from '@/types';

const API_BASE_URL = 'http://localhost:8000';

export async function createNewChat(userQuery: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userQuery }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  return response.json();
}

export async function continueChat(sessionId: string, userQuery: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, userQuery }),
  });

  if (!response.ok) {
    throw new Error(`Failed to continue chat: ${response.statusText}`);
  }

  return response.json();
}

export async function getSessions(page = 1, limit = 1000): Promise<{ sessions: Session[]; pagination: any }> {
  const response = await fetch(`${API_BASE_URL}/sessions?page=${page}&limit=${limit}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }

  return response.json();
}

export async function getSession(sessionId: string): Promise<SessionWithMessages> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.statusText}`);
  }

  return response.json();
}

export async function searchMessages(searchTerm: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchTerm)}`);

  if (!response.ok) {
    throw new Error(`Failed to search messages: ${response.statusText}`);
  }

  return response.json();
}