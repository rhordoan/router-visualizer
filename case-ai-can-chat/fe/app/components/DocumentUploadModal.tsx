'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, File, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { apiClient, DocumentResponse } from '@/lib/api';
import ConfirmDialog from './ConfirmDialog';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onUploadSuccess?: () => void;
  onShowToast: (message: string) => void;
}

export default function DocumentUploadModal({ isOpen, onClose, sessionId, onUploadSuccess, onShowToast }: DocumentUploadModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [category, setCategory] = useState('');
  const [userDocuments, setUserDocuments] = useState<DocumentResponse[]>([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; docId: number | null }>({
    isOpen: false,
    docId: null,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // Add new files to existing ones
      setUploadedFiles(prev => [...prev, ...acceptedFiles]);
      setUploadSuccess(false);
      setUploadError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: true,
  });

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError('');
    setUploadProgress({current: 0, total: uploadedFiles.length});

    try {
      // Upload files sequentially
      for (let i = 0; i < uploadedFiles.length; i++) {
        setUploadProgress({current: i + 1, total: uploadedFiles.length});
        await apiClient.uploadDocument(uploadedFiles[i], sessionId, category || undefined);
      }
      
      setUploadSuccess(true);
      
      // Trigger sidebar refresh callback
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
      setTimeout(() => {
        setUploadedFiles([]);
        setCategory('');
        setUploadSuccess(false);
        setUploadProgress({current: 0, total: 0});
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(
        err.response?.data?.detail || 
        'Failed to upload document. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setUploadedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const loadUserDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await apiClient.listUserDocuments(0, 100, sessionId);
      setUserDocuments(docs);
      setShowDocuments(true);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setUploadError('Failed to load your documents');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleDeleteDocument = (docId: number) => {
    setDeleteConfirm({ isOpen: true, docId });
  };

  const confirmDeleteDocument = async () => {
    if (!deleteConfirm.docId) return;

    try {
      await apiClient.deleteUserDocument(deleteConfirm.docId);
      setUserDocuments(prev => prev.filter(d => d.id !== deleteConfirm.docId));
      
      // Show success toast
      onShowToast('Document deleted');
      
      // Trigger sidebar refresh to update document count
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
      onShowToast('Failed to delete document');
    } finally {
      setDeleteConfirm({ isOpen: false, docId: null });
    }
  };

  const handleClose = () => {
    setUploadedFiles([]);
    setCategory('');
    setUploadSuccess(false);
    setUploadError('');
    setUploadProgress({current: 0, total: 0});
    setShowDocuments(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Upload className="w-6 h-6 text-health-purple" />
              Upload to Conversation
            </h2>
            <p className="text-xs text-gray-500 mt-1">Uploaded documents are only available in this conversation</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 border border-gray-300 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!showDocuments ? (
            <>
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? 'border-health-purple bg-health-purple/5'
                    : uploadedFiles.length > 0
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-health-purple hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center">
                  {uploadedFiles.length > 0 ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                      <p className="text-base font-medium text-gray-800 mb-1">
                        {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} selected
                      </p>
                      <p className="text-xs text-gray-600">
                        Click or drag to add more files
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-base font-medium text-gray-800 mb-1">
                        {isDragActive ? 'Drop your files here' : 'Drag & drop files here'}
                      </p>
                      <p className="text-xs text-gray-600">
                        or click to browse
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: PDF, DOCX, TXT, MD (Max 10MB each)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Selected Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Selected Files:</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                          title="Remove file"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}

              {/* Success Message */}
              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">Documents uploaded to conversation!</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploadedFiles.length === 0 || isUploading || uploadSuccess}
                  className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    uploadedFiles.length > 0 && !isUploading && !uploadSuccess
                      ? 'bg-gradient-to-r from-health-gradient-start to-health-gradient-end text-white hover:shadow-lg transform hover:scale-105 active:scale-95'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                      <span>Uploading {uploadProgress.current}/{uploadProgress.total}...</span>
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Uploaded!</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Upload {uploadedFiles.length} Document{uploadedFiles.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={loadUserDocuments}
                  disabled={isLoadingDocs}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 flex items-center gap-2"
                >
                  <File className="w-5 h-5" />
                  <span>My Documents</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* User Documents List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Chat Documents</h3>
                  </div>
                  <button
                    onClick={() => setShowDocuments(false)}
                    className="p-2 border border-gray-300  hover:bg-gray-100 hover:border-gray-400 rounded transition-colors text-sm font-bold text-health-gray-text"
                  >
                    ← Back to Upload
                  </button>
                </div>

                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-health-purple rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                ) : userDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No documents uploaded yet in this chat</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {userDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-800 truncate">{doc.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {doc.chunk_count} chunks • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 border border-red-300 hover:bg-red-50 rounded transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteDocument}
        onCancel={() => setDeleteConfirm({ isOpen: false, docId: null })}
        isDangerous={true}
      />
    </div>
  );
}

