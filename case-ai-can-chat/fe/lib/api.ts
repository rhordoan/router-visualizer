import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Auth token storage
const TOKEN_KEY = 'healthchat_auth_token';
const USER_KEY = 'healthchat_user';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SourceDocument {
  document_id: number;
  title: string;
  content_snippet: string;
  relevance_score: number;
  source?: string;
  category?: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  conversation_history?: ChatMessage[];
  use_rag?: boolean;
  stream?: boolean;
}

export interface ChainOfThoughtStep {
  id: string;
  step_type: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  timestamp: string;
}

export interface StreamChunk {
  type: 'cot_step' | 'content' | 'sources' | 'suggestions' | 'done' | 'error';
  data?: any;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  sources: SourceDocument[];
  suggestions?: string[];
  metadata: Record<string, any>;
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  services: Record<string, string>;
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ConversationSummary {
  id: number;
  user_id: number;
  session_id: string;
  title?: string;
  message_count: number;
  document_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentResponse {
  id: number;
  user_id?: number;
  title: string;
  content: string;
  source?: string;
  category?: string;
  metadata?: Record<string, any>;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuth();
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  }

  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
  }

  clearAuth(): void {
    this.clearToken();
    this.clearUser();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Login with email
   */
  async login(email: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', { email });
    const data = response.data;
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  /**
   * Verify token
   */
  async verifyToken(): Promise<boolean> {
    try {
      await this.client.post('/auth/verify-token');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a chat message
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post<ChatResponse>('/chat', request);
    return response.data;
  }

  /**
   * Send a chat message with streaming
   */
  async sendMessageStream(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = ''; // Buffer for incomplete lines

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by newlines to get complete lines
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onChunk(data);
            } catch (e) {
              console.error('Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }

      // Process any remaining buffered data
      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          onChunk(data);
        } catch (e) {
          console.error('Error parsing final SSE data:', e);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Check system health
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * List conversations
   */
  async listConversations(skip: number = 0, limit: number = 50): Promise<ConversationSummary[]> {
    const response = await this.client.get<ConversationSummary[]>('/conversations', {
      params: { skip, limit },
    });
    return response.data;
  }

  /**
   * Create new conversation
   */
  async createConversation(title?: string): Promise<ConversationSummary> {
    const response = await this.client.post<ConversationSummary>('/conversations', { title });
    return response.data;
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string): Promise<any> {
    const response = await this.client.get(`/conversations/${sessionId}`);
    return response.data;
  }

  /**
   * Update conversation
   */
  async updateConversation(sessionId: string, title: string): Promise<ConversationSummary> {
    const response = await this.client.put<ConversationSummary>(
      `/conversations/${sessionId}`,
      { title }
    );
    return response.data;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(sessionId: string): Promise<void> {
    await this.client.delete(`/conversations/${sessionId}`);
  }

  /**
   * Upload document file
   */
  async uploadDocument(file: File, sessionId: string, category?: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    if (category) {
      formData.append('category', category);
    }

    const response = await this.client.post<DocumentResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * List user's documents
   */
  async listUserDocuments(skip: number = 0, limit: number = 100, sessionId?: string): Promise<DocumentResponse[]> {
    const response = await this.client.get<DocumentResponse[]>('/documents/user/list', {
      params: { 
        skip, 
        limit,
        ...(sessionId && { session_id: sessionId }),
      },
    });
    return response.data;
  }

  /**
   * Delete user document
   */
  async deleteUserDocument(documentId: number): Promise<void> {
    await this.client.delete(`/documents/user/${documentId}`);
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<any> {
    const response = await this.client.get('/documents/stats/summary');
    return response.data;
  }
}

export const apiClient = new ApiClient();