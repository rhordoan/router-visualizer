'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface YamlLine {
  text: string;
  nodeId?: string;
  indent: number;
  isSection?: boolean;
  isComment?: boolean;
}

const yamlLines: YamlLine[] = [
  { text: '# meta_orchestrator.yml', indent: 0, isComment: true },
  { text: '# NeMo Agent Toolkit — Meta-Orchestrator Config', indent: 0, isComment: true },
  { text: '', indent: 0 },
  { text: 'workflow_type: react_agent', indent: 0, nodeId: 'react-agent' },
  { text: 'port: 8001', indent: 0, nodeId: 'nat-serve' },
  { text: '', indent: 0 },
  { text: 'llms:', indent: 0, isSection: true },
  { text: 'orchestration_llm:', indent: 1, nodeId: 'llm-orchestration' },
  { text: '  model: llama3.2-70b', indent: 2 },
  { text: '  provider: nim', indent: 2, nodeId: 'nim-services' },
  { text: '  temperature: 0.1', indent: 2 },
  { text: 'summarization_llm:', indent: 1, nodeId: 'llm-summarize' },
  { text: '  model: llama3.1-8b', indent: 2 },
  { text: '  provider: nim', indent: 2 },
  { text: '  temperature: 0.3', indent: 2 },
  { text: '', indent: 0 },
  { text: 'embedders:', indent: 0, isSection: true },
  { text: 'nim_embedder:', indent: 1, nodeId: 'embedder' },
  { text: '  model: e5-large-v2', indent: 2 },
  { text: '  provider: nim', indent: 2 },
  { text: '', indent: 0 },
  { text: 'functions:', indent: 0, isSection: true },
  { text: 'servicenow_rest_get_incidents:', indent: 1, nodeId: 'snow-rest' },
  { text: '  method: GET', indent: 2 },
  { text: '  endpoint: /api/now/table/incident', indent: 2 },
  { text: '  description: "Fetch active incidents from ServiceNow"', indent: 2 },
  { text: 'servicenow_now_assist:', indent: 1, nodeId: 'snow-nowassist' },
  { text: '  method: POST', indent: 2 },
  { text: '  endpoint: /virtual_agent/invoke', indent: 2 },
  { text: '  delegate_agent: true', indent: 2 },
  { text: 'jira_rest_search:', indent: 1, nodeId: 'atl-rest' },
  { text: '  method: GET', indent: 2 },
  { text: '  endpoint: /rest/api/3/search', indent: 2 },
  { text: '  description: "Search Jira issues by JQL"', indent: 2 },
  { text: 'processunity_get_vendor_risk:', indent: 1, nodeId: 'pu-rest' },
  { text: '  method: GET', indent: 2 },
  { text: '  endpoint: /api/v2/vendors/risk-summary', indent: 2 },
  { text: '  description: "Fetch vendor risk summary"', indent: 2 },
  { text: 'sailpoint_provision_access:', indent: 1, nodeId: 'sailpoint-rest' },
  { text: '  method: POST', indent: 2 },
  { text: '  endpoint: /v3/access-requests', indent: 2 },
  { text: '  description: "Provision identity access"', indent: 2 },
  { text: 'rag_search:', indent: 1, nodeId: 'rag-tool' },
  { text: '  method: vector_search', indent: 2 },
  { text: '  index: enterprise_kb', indent: 2, nodeId: 'vectordb' },
  { text: '  description: "RAG retrieval from vector store"', indent: 2 },
];

function colorize(line: YamlLine, isHovered: boolean) {
  const text = line.text;
  const hoverBg = isHovered ? 'bg-purple-500/15 border-l-2 border-purple-500' : 'border-l-2 border-transparent';

  if (line.isComment) {
    return <span className="text-slate-600">{text}</span>;
  }
  if (!text.trim()) {
    return <span>&nbsp;</span>;
  }

  const indentStr = '  '.repeat(line.indent);

  if (line.isSection) {
    return (
      <span className={hoverBg}>
        <span className="text-amber-400 font-bold">{indentStr}{text}</span>
      </span>
    );
  }

  if (text.includes(':')) {
    const colonIdx = text.indexOf(':');
    const key = text.substring(0, colonIdx);
    const value = text.substring(colonIdx);

    const hasStringVal = value.includes('"');
    const hasNumVal = /:\s*[\d.]+$/.test(text);
    const hasBoolVal = /:\s*(true|false)$/.test(text);

    return (
      <span className={hoverBg}>
        <span className="text-cyan-400">{indentStr}{key.trim()}</span>
        <span className="text-gray-500">:</span>
        {hasStringVal ? (
          <span className="text-green-400">{value.substring(1)}</span>
        ) : hasNumVal ? (
          <span className="text-purple-300">{value.substring(1)}</span>
        ) : hasBoolVal ? (
          <span className="text-amber-300">{value.substring(1)}</span>
        ) : (
          <span className="text-gray-300">{value.substring(1)}</span>
        )}
      </span>
    );
  }

  return <span className="text-gray-300">{indentStr}{text}</span>;
}

interface YamlEditorProps {
  onHighlightNode: (nodeId: string | null) => void;
  onClose: () => void;
}

export default function YamlEditor({ onHighlightNode, onClose }: YamlEditorProps) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const handleLineEnter = (index: number) => {
    setHoveredLine(index);
    const line = yamlLines[index];
    if (line.nodeId) {
      onHighlightNode(line.nodeId);
    } else {
      onHighlightNode(null);
    }
  };

  const handleLineLeave = () => {
    setHoveredLine(null);
    onHighlightNode(null);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
      <div className="w-[520px] max-h-[90%] flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs font-mono text-gray-400">meta_orchestrator.yml</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* Hint */}
        <div className="px-5 py-2 bg-purple-500/10 border-b border-purple-500/20 flex-shrink-0">
          <p className="text-[11px] text-purple-300">Hover over function or LLM entries to highlight the corresponding node on the map</p>
        </div>

        {/* Code */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-3 font-mono text-[12px] leading-[1.65]">
            {yamlLines.map((line, i) => {
              const isHovered = hoveredLine === i;
              const hasNodeId = !!line.nodeId;
              return (
                <div
                  key={i}
                  className={`flex items-stretch ${hasNodeId ? 'cursor-pointer' : ''} ${
                    isHovered && hasNodeId ? 'bg-purple-500/10' : 'hover:bg-slate-800/40'
                  } transition-colors duration-150`}
                  onMouseEnter={() => handleLineEnter(i)}
                  onMouseLeave={handleLineLeave}
                >
                  <span className="w-8 text-right pr-3 text-slate-600 select-none flex-shrink-0 text-[11px] leading-[1.65]">
                    {i + 1}
                  </span>
                  <div className={`flex-1 pl-1 ${isHovered && hasNodeId ? 'border-l-2 border-purple-500' : 'border-l-2 border-transparent'}`}>
                    {colorize(line, isHovered && !!hasNodeId)}
                  </div>
                  {isHovered && hasNodeId && (
                    <span className="text-[9px] text-purple-400 font-mono px-2 flex items-center flex-shrink-0 opacity-70">
                      {line.nodeId}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
