'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, X, Menu, Edit2, Check } from 'lucide-react';
import { apiClient, ConversationSummary } from '@/lib/api';
import ConfirmDialog from './ConfirmDialog';

interface SidebarProps {
  currentSessionId: string | null;
  onConversationSelect: (sessionId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
  onShowToast: (message: string) => void;
}

export default function Sidebar({
  currentSessionId,
  onConversationSelect,
  onNewChat,
  isOpen,
  onToggle,
  refreshTrigger,
  onShowToast,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sessionId: string | null }>({
    isOpen: false,
    sessionId: null,
  });

  useEffect(() => {
    // Load conversations on mount and when refresh is triggered
    loadConversations();
  }, [refreshTrigger]);
  
  useEffect(() => {
    // Also reload when sidebar is opened (for mobile)
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const convs = await apiClient.listConversations();
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, sessionId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.sessionId) return;

    try {
      await apiClient.deleteConversation(deleteConfirm.sessionId);
      
      // Update conversations list
      const updatedConversations = conversations.filter(c => c.session_id !== deleteConfirm.sessionId);
      setConversations(updatedConversations);
      
      // If deleting current conversation, navigate to another conversation or create new chat
      if (deleteConfirm.sessionId === currentSessionId) {
        if (updatedConversations.length > 0) {
          // Navigate to the first available conversation
          onConversationSelect(updatedConversations[0].session_id);
        } else {
          // No conversations left, create a new chat
          onNewChat();
        }
      }

      // Show success toast
      onShowToast('Conversation deleted');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      onShowToast('Failed to delete conversation');
    } finally {
      setDeleteConfirm({ isOpen: false, sessionId: null });
    }
  };

  const handleEdit = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.session_id);
    setEditTitle(conv.title ?? '');
  };

  const handleSaveEdit = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const updated = await apiClient.updateConversation(sessionId, editTitle);
      setConversations(prev =>
        prev.map(c => (c.session_id === sessionId ? updated : c))
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update conversation:', err);
      alert('Failed to update conversation title');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg z-50 transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } w-80`}
      >
        {/* Header - matching main header height (~84px total) */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm" style={{ minHeight: '84px' }}>
          <div className="px-4 h-full flex items-center">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-health-purple" />
                Conversations
              </h2>
              <button
                onClick={onToggle}
                className="lg:hidden p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-health-gradient-start via-health-gradient-mid to-health-gradient-end text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold">New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.session_id}
                onClick={() => {
                  if (editingId !== conv.session_id) {
                    onConversationSelect(conv.session_id);
                  }
                }}
                className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  conv.session_id === currentSessionId
                    ? 'bg-health-purple/5 border-health-purple/40'
                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-health-purple/30'
                }`}
              >
                {editingId === conv.session_id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-health-purple/30 rounded focus:outline-none focus:ring-2 focus:ring-health-purple/50 focus:border-health-purple min-w-0"
                      style={{ maxWidth: 'calc(100% - 50px)' }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(conv.session_id, e as any);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit(e as any);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => handleSaveEdit(conv.session_id, e)}
                      className="p-1.5 border border-green-300 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                    >
                      <Check className="w-3 h-3 text-green-600" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 border border-gray-300 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-800 truncate">
                          {conv.title ?? 'New Chat'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {conv.message_count} prompt{conv.message_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEdit(conv, e)}
                            className="p-1.5 border border-blue-300 hover:bg-blue-50 rounded transition-colors"
                            title="Edit title"
                          >
                            <Edit2 className="w-3 h-3 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(conv.session_id, e)}
                            className="p-1.5 border border-red-300 hover:bg-red-50 rounded transition-colors"
                            title="Delete conversation"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-400">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </p>
                      {(conv.document_count ?? 0) > 0 && (
                        <p className="text-xs text-gray-400">
                          {conv.document_count} document{conv.document_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer - matching main footer height (~114px total) */}
        <div className="border-t border-gray-200 bg-white/80 backdrop-blur-lg shadow-lg" style={{ minHeight: '114px' }}>
          <div className="px-4 py-3 h-full flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-gray-800">Summary</h3>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-health-purple mr-2"></span>
                <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-health-purple mr-2"></span>
                <span>{conversations.reduce((sum, conv) => sum + conv.message_count, 0)} total prompt{conversations.reduce((sum, conv) => sum + conv.message_count, 0) !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-health-purple mr-2"></span>
                <span>{conversations.reduce((sum, conv) => sum + (conv.document_count ?? 0), 0)} uploaded document{conversations.reduce((sum, conv) => sum + (conv.document_count ?? 0), 0) !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile toggle button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="lg:hidden fixed top-20 left-4 z-30 p-3 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-200"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, sessionId: null })}
        isDangerous={true}
      />
    </>
  );
}

