'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Globe,
  Shield,
  Wrench,
  Database,
  FileText,
  ArrowUpDown,
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ChainOfThoughtStep {
  step_type: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  timestamp: string;
}

interface ChainOfThoughtMessageProps {
  steps: ChainOfThoughtStep[];
  isComplete?: boolean;
}

const getStepIcon = (stepType: string) => {
  const iconMap: Record<string, React.ElementType> = {
    analyzing: Brain,
    web_search: Globe,
    checking: Shield,
    validating: Shield,
    augmenting: Wrench,
    building: Wrench,
    searching: Database,
    retrieved: FileText,
    analyzing_document: FileText,
    reranking: ArrowUpDown,
    generating: Sparkles,
    suggestions: Lightbulb,
  };
  
  return iconMap[stepType] || FileText;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'complete':
      return CheckCircle2;
    case 'error':
      return XCircle;
    case 'active':
      return Loader2;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'complete':
      return 'text-green-500';
    case 'error':
      return 'text-red-500';
    case 'active':
      return 'text-blue-500';
    case 'pending':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
};

export default function ChainOfThoughtMessage({
  steps,
  isComplete = true,
}: ChainOfThoughtMessageProps) {
  // Expanded during processing, collapsed when complete
  const [isExpanded, setIsExpanded] = useState(!isComplete);

  // Auto-collapse when thinking is complete
  useEffect(() => {
    if (isComplete) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isComplete]);

  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-health-purple transition-colors duration-200 group"
      >
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 group-hover:text-health-purple" />
        ) : (
          <ChevronDown className="w-4 h-4 group-hover:text-health-purple" />
        )}
        <Brain className="w-4 h-4" />
        <span className="font-medium">
          Chain of Thought
          {!isComplete && ' (Processing...)'}
        </span>
        <span className="text-xs text-gray-500">({steps.length} steps)</span>
      </button>

      {isExpanded && (
        <div className="mt-3 ml-6 border-l-2 border-gray-200 pl-4 space-y-2 animate-in slide-in-from-left duration-300">
          {steps.map((step, index) => {
            const StepIcon = getStepIcon(step.step_type);
            const StatusIcon = getStatusIcon(step.status);
            const statusColor = getStatusColor(step.status);

            return (
              <div
                key={index}
                className="flex items-start space-x-3 group"
              >
                <div className={`mt-1 flex-shrink-0 ${statusColor}`}>
                  <StepIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">
                      {step.label}
                    </span>
                    {StatusIcon && (
                      <StatusIcon
                        className={`w-3 h-3 flex-shrink-0 ${statusColor} ${
                          step.status === 'active' ? 'animate-spin' : ''
                        }`}
                      />
                    )}
                  </div>
                  {step.description && (
                    <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

