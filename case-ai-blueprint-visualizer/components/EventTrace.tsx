'use client';

import { useEffect, useRef } from 'react';
import { EventStep, ChatMessage } from '@/lib/types';
import { Play, CheckCircle2, Circle, XCircle, User, Bot, Settings } from 'lucide-react';

interface EventTraceProps {
  events: EventStep[];
  chatMessages: ChatMessage[];
  currentStep: number;
  completedEvents: string[];
  isRealTime?: boolean; // For HealthChat real-time mode
}

export default function EventTrace({ events, chatMessages, currentStep, completedEvents, isRealTime = false }: EventTraceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const userScrolledChatRef = useRef(false);

  // Detect manual scrolling for event timeline
  const handleEventScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      userScrolledRef.current = !isAtBottom;
    }
  };

  // Detect manual scrolling for conversation flow
  const handleChatScroll = () => {
    if (chatScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      userScrolledChatRef.current = !isAtBottom;
    }
  };

  useEffect(() => {
    // Auto-scroll event timeline only if user hasn't manually scrolled
    if (scrollRef.current && !userScrolledRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Auto-scroll conversation flow only if user hasn't manually scrolled
    if (chatScrollRef.current && !userScrolledChatRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentStep, completedEvents]);

  const visibleMessages = chatMessages.filter((msg) => {
    // Real-time mode (HealthChat): Show all messages immediately as they arrive
    if (isRealTime) {
      return true;
    }
    
    // Animation mode (LLM Routing, RAG): Show messages based on animation progress
    if (currentStep === 0) return false;
    const currentEvent = events[Math.min(currentStep - 1, events.length - 1)];
    const currentTiming = currentEvent?.timing || 0;
    
    return msg.timing <= currentTiming;
  });

  const visibleEvents = events.slice(0, currentStep);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl p-6 flex flex-col card-shadow-lg h-full overflow-hidden">
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white text-shadow">Event Trace</h2>
        <p className="text-sm text-gray-400 mt-1">Live flow visualization</p>
      </div>

      {/* Event Timeline */}
      <div 
        ref={scrollRef} 
        onScroll={handleEventScroll}
        className="overflow-y-auto space-y-3 mb-4 pr-2" 
        style={{ flex: '1 1 0', minHeight: 0 }}
      >
        {visibleEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center opacity-50">
              {isRealTime ? (
                <Bot className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white" fill="white" />
              )}
            </div>
            <p className="text-gray-400">
              {isRealTime ? 'Waiting for query...' : 'Press Play to start the simulation'}
            </p>
          </div>
        ) : (
          visibleEvents.map((event) => {
            // An event is running if it has status 'running' (regardless of being current or not)
            const isRunning = event.status === 'running';
            const isSkipped = event.status === 'skipped';
            const isCompleted = event.status === 'completed';
            const isError = event.status === 'error';

            return (
              <div
                key={event.id}
                className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${
                  isRunning
                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-2 border-purple-500/50'
                    : isError
                    ? 'bg-gradient-to-r from-red-600/20 to-rose-600/20 border-2 border-red-500/50'
                    : isSkipped
                    ? 'bg-slate-800/30 border border-slate-700/50 opacity-60'
                    : isCompleted
                    ? 'bg-slate-800/50 border border-slate-700/50'
                    : 'bg-slate-800/30 border border-slate-700/50 opacity-40'
                } card-shadow`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isRunning ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center animate-pulse">
                      <Circle className="w-4 h-4 text-white" fill="white" />
                    </div>
                  ) : isError ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-white" fill="white" />
                    </div>
                  ) : isSkipped ? (
                    <XCircle className="w-6 h-6 text-gray-500" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-600" />
                  )}
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-line ${
                      isSkipped ? 'text-gray-500' : isError ? 'text-red-200' : 'text-gray-100'
                    } ${isRunning ? 'font-semibold' : ''}`}
                  >
                    {event.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500 font-mono">{event.timing}ms</span>
                    {isRunning && (
                      <span className="text-xs text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/20 animate-pulse">
                        ⏳ running
                      </span>
                    )}
                    {isError && (
                      <span className="text-xs text-red-400 font-semibold px-2 py-0.5 rounded bg-red-500/20">
                        ❌ error
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Simulation */}
      {visibleMessages.length > 0 && (
        <div className="border-t border-slate-700 pt-4 flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
          <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2 flex-shrink-0">
            <Bot className="w-4 h-4 text-purple-400" />
            Conversation Flow
          </h3>
          <div 
            ref={chatScrollRef} 
            onScroll={handleChatScroll}
            className="space-y-3 overflow-y-auto pr-2" 
            style={{ flex: '1 1 0', minHeight: 0 }}
          >
            {visibleMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl text-sm leading-relaxed card-shadow transition-all duration-300 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/50 text-gray-100'
                    : msg.role === 'system'
                    ? 'bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/50 text-gray-200'
                    : msg.content.includes('⏳')
                    ? 'bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/50 text-gray-100 animate-pulse'
                    : 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/50 text-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : msg.role === 'system' ? (
                    <Settings className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="text-xs font-bold capitalize">{msg.role}</span>
                  <span className="text-xs text-gray-400 ml-auto font-mono">{msg.timing}ms</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
