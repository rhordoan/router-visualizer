'use client';

import { useEffect, useRef } from 'react';
import { EventStep, ChatMessage } from '@/lib/types';
import { Play, CheckCircle2, Circle, XCircle, User, Bot, Settings, Globe, Search, Hand, Cpu, Activity, Server, FileCode, Share2, GitBranch, ArrowRightLeft } from 'lucide-react';

// Determine event category color based on message content keywords
const getEventColor = (message: string): { bg: string; border: string; badge: string; badgeText: string; icon: React.ComponentType<{ className?: string }> | null } => {
  const msg = message.toLowerCase();
  // Approval / high-risk → amber
  if (msg.includes('approval') || msg.includes('confirm') || msg.includes('high-risk') || msg.includes('awaiting')) {
    return { bg: 'from-amber-600/20 to-yellow-600/20', border: 'border-amber-500/50', badge: 'bg-amber-500/20', badgeText: 'text-amber-400', icon: Hand };
  }
  // REST/API call → slate
  if (msg.includes('get ') || msg.includes('post ') || msg.includes('rest') || msg.includes('200 ok') || msg.includes('/api/')) {
    return { bg: 'from-slate-600/20 to-gray-600/20', border: 'border-slate-400/50', badge: 'bg-slate-500/20', badgeText: 'text-slate-400', icon: Globe };
  }
  // Native agent call → indigo
  if (msg.includes('now assist') || msg.includes('agentforce') || msg.includes('copilot') || msg.includes('harbor pilot') || msg.includes('native agent') || msg.includes('evidence')) {
    return { bg: 'from-indigo-600/20 to-violet-600/20', border: 'border-indigo-500/50', badge: 'bg-indigo-500/20', badgeText: 'text-indigo-400', icon: Bot };
  }
  // RAG / vector / embedding → cyan
  if (msg.includes('vector') || msg.includes('rag') || msg.includes('embed') || msg.includes('passage') || msg.includes('kb article')) {
    return { bg: 'from-cyan-600/20 to-teal-600/20', border: 'border-cyan-500/50', badge: 'bg-cyan-500/20', badgeText: 'text-cyan-400', icon: Search };
  }
  // LLM call → purple 
  if (msg.includes('llm') || msg.includes('summariz') || msg.includes('orchestration call') || msg.includes('generating')) {
    return { bg: 'from-purple-600/20 to-pink-600/20', border: 'border-purple-500/50', badge: 'bg-purple-500/20', badgeText: 'text-purple-400', icon: Cpu };
  }
  // Intent / classification → cyan
  if (msg.includes('intent') || msg.includes('classified')) {
    return { bg: 'from-cyan-600/20 to-blue-600/20', border: 'border-cyan-500/50', badge: 'bg-cyan-500/20', badgeText: 'text-cyan-400', icon: Share2 };
  }
  // Tool selection → cyan
  if (msg.includes('selected tool') || msg.includes('tool select')) {
    return { bg: 'from-cyan-600/20 to-blue-600/20', border: 'border-cyan-500/50', badge: 'bg-cyan-500/20', badgeText: 'text-cyan-400', icon: GitBranch };
  }
  // A2A delegation → purple
  if (msg.includes('delegat') || msg.includes('a2a')) {
    return { bg: 'from-purple-600/20 to-pink-600/20', border: 'border-purple-500/50', badge: 'bg-purple-500/20', badgeText: 'text-purple-400', icon: ArrowRightLeft };
  }
  // OpenTelemetry / profiler → gray
  if (msg.includes('opentelemetry') || msg.includes('span') || msg.includes('profiler')) {
    return { bg: 'from-gray-600/20 to-slate-600/20', border: 'border-gray-500/50', badge: 'bg-gray-500/20', badgeText: 'text-gray-400', icon: Activity };
  }
  // Config loaded → gray
  if (msg.includes('config') || msg.includes('yaml') || msg.includes('loaded workflow')) {
    return { bg: 'from-gray-600/20 to-slate-600/20', border: 'border-gray-500/50', badge: 'bg-gray-500/20', badgeText: 'text-gray-400', icon: FileCode };
  }
  // nat serve → gray
  if (msg.includes('nat serve') || msg.includes('nat_serve')) {
    return { bg: 'from-gray-600/20 to-slate-600/20', border: 'border-gray-500/50', badge: 'bg-gray-500/20', badgeText: 'text-gray-400', icon: Server };
  }
  // Response delivered → green
  if (msg.includes('delivered') || msg.includes('response ready') || msg.includes('summary generated') || msg.includes('provisioned') || msg.includes('found')) {
    return { bg: 'from-green-600/20 to-emerald-600/20', border: 'border-green-500/50', badge: 'bg-green-500/20', badgeText: 'text-green-400', icon: CheckCircle2 };
  }
  // Default → purple (orchestrator activity)
  return { bg: 'from-purple-600/20 to-pink-600/20', border: 'border-purple-500/50', badge: 'bg-purple-500/20', badgeText: 'text-purple-400', icon: null };
};

// Determine system message sub-color based on content
const getSystemMessageStyle = (content: string): { bg: string; border: string } => {
  const c = content.toLowerCase();
  if (c.includes('approval') || c.includes('confirm') || c.includes('high-risk') || c.includes('⚠️')) {
    return { bg: 'from-amber-600/20 to-yellow-600/20', border: 'border-amber-500/50' };
  }
  if (c.includes('servicenow') || c.includes('jira') || c.includes('sailpoint') || c.includes('processunity') || c.includes('oracle') || c.includes('get ') || c.includes('rest')) {
    return { bg: 'from-slate-600/20 to-gray-600/20', border: 'border-slate-400/50' };
  }
  if (c.includes('rag') || c.includes('vector') || c.includes('kb article') || c.includes('embed')) {
    return { bg: 'from-cyan-600/20 to-teal-600/20', border: 'border-cyan-500/50' };
  }
  // Default system → purple
  return { bg: 'from-purple-600/20 to-pink-600/20', border: 'border-purple-500/50' };
};

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
            const eventColor = getEventColor(event.message);
            const EventIcon = eventColor.icon;

            return (
              <div
                key={event.id}
                className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${isRunning
                  ? `bg-gradient-to-r ${eventColor.bg} border-2 ${eventColor.border}`
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
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${eventColor.bg} flex items-center justify-center animate-pulse`}>
                      {EventIcon ? <EventIcon className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-white" fill="white" />}
                    </div>
                  ) : isError ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-white" fill="white" />
                    </div>
                  ) : isSkipped ? (
                    <XCircle className="w-6 h-6 text-gray-500" />
                  ) : isCompleted ? (
                    EventIcon ? <EventIcon className={`w-6 h-6 ${eventColor.badgeText}`} /> : <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-600" />
                  )}
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-line ${isSkipped ? 'text-gray-500' : isError ? 'text-red-200' : 'text-gray-100'
                      } ${isRunning ? 'font-semibold' : ''}`}
                  >
                    {event.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500 font-mono">{event.timing}ms</span>
                    {isRunning && (
                      <span className={`text-xs ${eventColor.badgeText} font-semibold px-2 py-0.5 rounded ${eventColor.badge} animate-pulse`}>
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
            {visibleMessages.map((msg, index) => {
              const sysStyle = msg.role === 'system' ? getSystemMessageStyle(msg.content) : null;
              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl text-sm leading-relaxed card-shadow transition-all duration-300 ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/50 text-gray-100'
                    : msg.role === 'system'
                      ? `bg-gradient-to-br ${sysStyle!.bg} border ${sysStyle!.border} text-gray-200`
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
                  <p className="text-sm whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
