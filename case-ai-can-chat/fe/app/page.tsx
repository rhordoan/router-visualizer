'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, FileText, Sparkles, Info, Upload, RefreshCw, HeartPulse } from 'lucide-react';
import { apiClient, ChatMessage, SourceDocument, User, ChainOfThoughtStep } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import ScrollingSuggestions from './components/ScrollingSuggestions';
import ChainOfThoughtMessage from './components/ChainOfThoughtMessage';
import Toast from './components/Toast';
import Sidebar from './components/Sidebar';
import UserMenu from './components/UserMenu';
import DocumentUploadModal from './components/DocumentUploadModal';

interface Message extends ChatMessage {
  id: string;
  timestamp: Date;
  sources?: SourceDocument[];
  chainOfThoughtSteps?: ChainOfThoughtStep[];
  suggestions?: string[];
  isStreaming?: boolean;
  hasStartedContent?: boolean; // True when first content token arrives
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'unknown'>('unknown');
  const [healthServices, setHealthServices] = useState<Record<string, string>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Clear any existing toast first to prevent overlap
    setToast(null);
    // Small delay to ensure clean transition
    setTimeout(() => {
      setToast({ message, type });
    }, 50);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      checkHealth();
      if (!sessionId) {
        setSessionId(generateSessionId());
      }
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAuth = async () => {
    setIsAuthChecking(true);
    try {
      // Check if token exists
      if (!apiClient.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Verify token is valid
      const isValid = await apiClient.verifyToken();
      if (!isValid) {
        router.push('/login');
        return;
      }

      // Get user info
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/login');
    } finally {
      setIsAuthChecking(false);
    }
  };

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await apiClient.healthCheck();
      setSystemStatus(health.status as 'healthy' | 'degraded');
      setHealthServices(health.services || {});
      
      // Show toast based on status
      if (health.status === 'healthy') {
        showToast('System status: All services online', 'success');
      } else {
        showToast('System status: Some services unavailable', 'info');
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setSystemStatus('degraded');
      setHealthServices({});
      showToast('Health check failed', 'error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');
    setDynamicSuggestions([]); // Clear suggestions when sending new message

    // Create assistant message placeholder
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      chainOfThoughtSteps: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      await apiClient.sendMessageStream(
        {
          message: userMessage.content,
          session_id: sessionId,
          use_rag: true,
        },
        (chunk) => {
          setMessages(prev => {
            const messages = [...prev];
            const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
            if (msgIndex === -1) return prev;

            const msg = { ...messages[msgIndex] };

            switch (chunk.type) {
              case 'cot_step':
                // Update existing step if same id, otherwise add new one
                const newStep = chunk.data;
                const existingSteps = msg.chainOfThoughtSteps || [];
                const existingStepIndex = existingSteps.findIndex(s => s.id === newStep.id);
                
                if (existingStepIndex >= 0) {
                  // Replace existing step with same id
                  msg.chainOfThoughtSteps = [
                    ...existingSteps.slice(0, existingStepIndex),
                    newStep,
                    ...existingSteps.slice(existingStepIndex + 1)
                  ];
                } else {
                  // Add new step
                  msg.chainOfThoughtSteps = [...existingSteps, newStep];
                }
                break;

              case 'content':
                // Mark that content has started (for CoT collapse)
                if (!msg.hasStartedContent && chunk.data) {
                  msg.hasStartedContent = true;
                }
                msg.content += chunk.data;
                break;

              case 'sources':
                msg.sources = chunk.data;
                break;

              case 'suggestions':
                setDynamicSuggestions(chunk.data);
                break;

              case 'done':
                msg.isStreaming = false;
                msg.timestamp = new Date(); // Update timestamp when response is complete
                setIsLoading(false);
                setSidebarRefreshTrigger(prev => prev + 1);
                break;

              case 'error':
                setError(chunk.data || 'An error occurred');
                msg.isStreaming = false;
                setIsLoading(false);
                break;
            }

            messages[msgIndex] = msg;
            return messages;
          });
        }
      );
    } catch (err: any) {
      console.error('Error sending message:', err);
      
      // Check if it's an auth error
      if (err.message?.includes('401')) {
        router.push('/login');
        return;
      }
      
      setError('Failed to send message. Please try again.');
      
      setMessages(prev => {
        const messages = [...prev];
        const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
        if (msgIndex !== -1) {
          messages[msgIndex] = {
            ...messages[msgIndex],
            content: 'I apologize, but I encountered an error processing your request. Please try again.',
            isStreaming: false,
          };
        }
        return messages;
      });
      
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !input.trim()) return;
    
    // Trigger sidebar refresh after sending message (to update prompt count)
    await sendMessage(input);
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    await sendMessage(suggestion);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(generateSessionId());
    setError('');
  };

  const handleNewChat = async () => {
    try {
      // Create new conversation on backend
      const newConversation = await apiClient.createConversation('New Chat');
      
      // Clear current messages and set new session ID
      setMessages([]);
      setSessionId(newConversation.session_id);
      setError('');
      
      // Trigger sidebar refresh to show the new conversation
      setSidebarRefreshTrigger(prev => prev + 1);
      setIsSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create new conversation:', err);
      // Fallback to generating local session ID
      handleClearChat();
      setIsSidebarOpen(false);
    }
  };

  const handleConversationSelect = async (selectedSessionId: string) => {
    try {
      const conversation = await apiClient.getConversation(selectedSessionId);
      setSessionId(selectedSessionId);
      
      // Convert conversation messages to UI messages
      const uiMessages: Message[] = conversation.messages.map((msg: any, idx: number) => ({
        id: `msg_${selectedSessionId}_${idx}`,
        role: msg.role,
        content: msg.content || '', // Ensure content is never undefined
        timestamp: new Date(msg.created_at || Date.now()), // Use created_at from backend
        sources: msg.sources || [],
        chainOfThoughtSteps: msg.chain_of_thought_steps || undefined, // Load CoT steps from DB
        suggestions: msg.suggestions || undefined, // Load suggestions from DB
        isStreaming: false, // Historical messages are already complete
        hasStartedContent: true, // Historical messages with content should have CoT collapsed
      }));
      
      setMessages(uiMessages);
      
      // Update dynamic suggestions with the last assistant message's suggestions
      const lastAssistantMessage = uiMessages.filter(msg => msg.role === 'assistant').pop();
      if (lastAssistantMessage?.suggestions && lastAssistantMessage.suggestions.length > 0) {
        setDynamicSuggestions(lastAssistantMessage.suggestions);
      } else {
        setDynamicSuggestions([]);
      }
      
      setIsSidebarOpen(false);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    }
  };

  // Show loading screen while checking auth
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-health-gray-beige">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-50 rounded-xl mb-6 shadow-lg border-2 border-health-purple">
            <HeartPulse className="w-10 h-10 text-health-purple animate-pulse" />
          </div>
          <div className="flex space-x-1 justify-center">
            <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render main UI if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-health-gray-beige relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-health-purple/5 rounded-full blur-3xl -top-48 -left-48 animate-pulse-slow"></div>
        <div className="absolute w-96 h-96 bg-health-purple/5 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse-slow" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Sidebar */}
      <Sidebar
        currentSessionId={sessionId}
        onConversationSelect={handleConversationSelect}
        onNewChat={handleNewChat}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        refreshTrigger={sidebarRefreshTrigger}
        onShowToast={showToast}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="relative z-[1000] bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm overflow-visible">
          {/* Toast Notifications positioned in header */}
          {error && (
            <div className="absolute top-2 right-4 z-[200]">
              <Toast
                message={error}
                type="error"
                onClose={() => setError('')}
                duration={3000}
              />
            </div>
          )}
          {toast && (
            <div className="absolute top-2 right-4 z-[200]">
              <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
                duration={3000}
              />
            </div>
          )}
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-health-purple rounded-lg blur opacity-40 animate-pulse"></div>
                  <div className="relative bg-gradient-to-r from-health-gradient-start to-health-gradient-end p-2.5 rounded-lg shadow-lg">
                    <HeartPulse className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-health-gray-text flex items-center gap-2">
                    HealthChat
                    <Sparkles className="w-5 h-5 text-health-purple animate-pulse" />
                  </h1>
                  <p className="text-sm text-gray-600">Powered by NVIDIA NeMo & NIM</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    systemStatus === 'healthy' ? 'bg-green-500 shadow-lg shadow-green-400/50 animate-pulse' :
                    systemStatus === 'degraded' ? 'bg-yellow-500 shadow-lg shadow-yellow-400/50' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-sm text-gray-600 hidden sm:inline">
                    {systemStatus === 'healthy' ? 'Online' :
                     systemStatus === 'degraded' ? 'Limited' : 'Checking...'}
                  </span>
                  {systemStatus !== 'unknown' && (
                    <div className="relative group z-[2000]">
                      <Info className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-2xl shadow-black/50 z-[2000] border border-gray-700">
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                        <div>
                          <div className="font-bold mb-2 text-center border-b border-gray-700 pb-2">
                            {systemStatus === 'healthy' ? 'System Status: Online' : 'System Status: Limited'}
                          </div>
                          <div className="space-y-1.5">
                            {healthServices.database && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300">Database:</span>
                                <span className={`font-medium ${
                                  healthServices.database.includes('healthy') 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>{healthServices.database}</span>
                              </div>
                            )}
                            {healthServices.vector_store && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300">Vector Store:</span>
                                <span className={`font-medium ${
                                  healthServices.vector_store.includes('healthy') 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>{healthServices.vector_store}</span>
                              </div>
                            )}
                            {healthServices.llm && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300">LLM:</span>
                                <span className={`font-medium ${
                                  healthServices.llm.includes('connected') 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>{healthServices.llm}</span>
                              </div>
                            )}
                            {healthServices.embeddings && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300">Embeddings:</span>
                                <span className={`font-medium ${
                                  healthServices.embeddings.includes('connected') 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>{healthServices.embeddings}</span>
                              </div>
                            )}
                          </div>
                          {systemStatus === 'degraded' && (
                            <div className="mt-3 pt-2 border-t border-gray-700 text-center text-gray-400">
                              Some components are down. Contact administrators.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Refresh Health Check Button */}
                  <div className="relative group">
                    <button
                      onClick={checkHealth}
                      disabled={isCheckingHealth}
                      className={`p-1.5 border rounded-lg transition-all duration-200 ${
                        isCheckingHealth 
                          ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-[2000]">
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                      Refresh status
                    </div>
                  </div>
                </div>

                {/* User Menu */}
                <UserMenu userName={user.name} userEmail={user.email} />
              </div>
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-12 animate-in fade-in duration-500">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-50 rounded-xl mb-6 shadow-lg border-2 border-health-purple">
                  <HeartPulse className="w-10 h-10 text-health-purple" />
                </div>
                <h2 className="text-3xl font-bold text-health-gray-text mb-3">
                  Welcome back, {user.name}!
                </h2>
                <p className="text-gray-600 mb-12 max-w-lg mx-auto leading-relaxed">
                  Your intelligent healthcare assistant powered by NVIDIA Nemotron. Ask me about medical services, health systems, and patient care.
                </p>
                
                {/* Auto-scrolling suggestions - 3 rows for welcome screen */}
                <ScrollingSuggestions onSuggestionClick={handleSuggestionClick} useThreeRows={true} />
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={`${message.id}-${message.timestamp.getTime()}`}>
                  {/* Chain of Thought for assistant messages */}
                  {message.role === 'assistant' && message.chainOfThoughtSteps && message.chainOfThoughtSteps.length > 0 && (
                    <ChainOfThoughtMessage
                      steps={message.chainOfThoughtSteps}
                      isComplete={message.hasStartedContent || false}
                    />
                  )}
                  
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom duration-300`}
                    style={{animationDelay: `${index * 50}ms`}}
                  >
                    <div
                      className={`max-w-3xl relative ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-health-gradient-start via-health-gradient-mid to-health-gradient-end text-white rounded-lg rounded-tr-sm shadow-lg shadow-health-purple/20 border border-health-purple/20'
                          : 'bg-gradient-to-r from-gray-100 to-white border border-health-purple/20 text-gray-800 rounded-lg rounded-tl-sm shadow-lg'
                      } px-6 py-4`}
                    >
                      {message.role === 'assistant' && (
                        <HeartPulse className="absolute -top-2 -left-2 w-6 h-6 text-health-purple" />
                      )}
                      <div className={message.role === 'user' ? 'markdown-content-user' : 'markdown-content-assistant'}>
                        {message.isStreaming && !message.content ? (
                          // Show "Thinking..." while streaming and no content yet
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                              <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                            <span className="text-gray-600">Thinking...</span>
                          </div>
                        ) : (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        )}
                      </div>
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-health-purple/20">
                        <div className="flex items-center space-x-2 mb-3">
                          <FileText className="w-4 h-4 text-health-purple" />
                          <span className="text-sm font-medium text-health-gray-text">Sources</span>
                        </div>
                        <div className="space-y-2">
                          {message.sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs p-3 bg-health-gray-light rounded-lg border border-health-purple/20 hover:border-health-purple/40 transition-all duration-200"
                            >
                              <div className="font-medium text-health-gray-text mb-1.5">
                                {source.title}
                              </div>
                              <div className="text-gray-600 mb-2 line-clamp-2">
                                {source.content_snippet}
                              </div>
                              <div className="flex items-center justify-between text-gray-500">
                                {source.category && (
                                  <span className="bg-health-purple text-white px-2 py-0.5 rounded-md text-xs font-medium">
                                    {source.category}
                                  </span>
                                )}
                                <span className="text-xs">
                                  {(source.relevance_score * 100).toFixed(0)}% match
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                </div>
              ))
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Dynamic Suggestions - at bottom of chat, ABOVE input form */}
        {messages.length > 0 && dynamicSuggestions.length > 0 && !isLoading && (
          <div className="bg-health-gray-beige py-4 px-4">
            <ScrollingSuggestions 
              onSuggestionClick={handleSuggestionClick}
              suggestions={dynamicSuggestions}
              useThreeRows={false}
            />
          </div>
        )}


        {/* Input Form */}
        <div className="bg-white/80 backdrop-blur-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              {/* Upload Button */}
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-3.5 text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center"
                title="Upload Document"
              >
                <Upload className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me about healthcare services..."
                className="flex-1 px-5 py-3.5 bg-white border border-health-purple/30 rounded-lg text-health-gray-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-health-purple/50 focus:border-health-purple transition-all duration-200"
              />
              <button
                type="submit"
                title={
                  isLoading 
                    ? "Wait until the current request is processed." 
                    : !input.trim() 
                      ? "Please type a message before sending a request." 
                      : ""
                }
                className={`px-6 py-3.5 bg-gradient-to-r from-health-gradient-start to-health-gradient-end text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-health-purple/50 focus:ring-offset-2 transition-all duration-200 flex items-center space-x-2 shadow-lg ${
                  isLoading || !input.trim()
                    ? 'cursor-not-allowed' 
                    : 'hover:shadow-health-purple/40 transform hover:scale-105 active:scale-95 cursor-pointer'
                }`}
              >
                <Send className={`w-5 h-5 ${isLoading ? 'animate-pulse' : ''}`} />
                <span className="font-bold hidden sm:inline">Send</span>
              </button>
            </form>
            
            <p className="text-xs text-gray-600 mt-3 text-center">
              NVIDIA Nemotron 70B • Private & Secure • No cloud dependencies
            </p>
          </div>
        </div>
      </div>

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sessionId={sessionId}
        onUploadSuccess={() => setSidebarRefreshTrigger(prev => prev + 1)}
        onShowToast={showToast}
      />
    </div>
  );
}
