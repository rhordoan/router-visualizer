'use client';

import { useState } from 'react';
import { PayloadInspection } from '@/lib/types';
import { X, ChevronDown, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Shield, Package } from 'lucide-react';

function JsonBlock({ data, maxHeight }: { data: Record<string, unknown>; maxHeight?: string }) {
  const json = JSON.stringify(data, null, 2);
  const lines = json.split('\n');
  return (
    <pre
      className="text-[11px] font-mono leading-relaxed bg-slate-950/80 rounded-lg p-3 overflow-auto"
      style={{ maxHeight: maxHeight || '200px' }}
    >
      {lines.map((line, i) => {
        // Color keys vs values
        const keyMatch = line.match(/^(\s*)"([^"]+)":/);
        if (keyMatch) {
          const indent = keyMatch[1];
          const key = keyMatch[2];
          const rest = line.slice(keyMatch[0].length);
          return (
            <div key={i}>
              <span className="text-gray-600">{indent}</span>
              <span className="text-purple-400">&quot;{key}&quot;</span>
              <span className="text-gray-500">:</span>
              <span className="text-gray-300">{rest}</span>
            </div>
          );
        }
        // String values
        if (line.includes('"')) {
          return <div key={i} className="text-green-400">{line}</div>;
        }
        // Numbers / booleans
        if (/\d/.test(line) || line.includes('true') || line.includes('false')) {
          return <div key={i} className="text-cyan-400">{line}</div>;
        }
        return <div key={i} className="text-gray-500">{line}</div>;
      })}
    </pre>
  );
}

interface PayloadInspectorProps {
  payload: PayloadInspection;
  onClose: () => void;
}

export default function PayloadInspector({ payload, onClose }: PayloadInspectorProps) {
  const [showSchema, setShowSchema] = useState(false);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 shadow-2xl shadow-black/40 overflow-hidden rounded-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white">Payload Inspector</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{payload.toolName}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Input JSON */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Input</span>
          </div>
          <JsonBlock data={payload.inputJson} />
        </div>

        {/* Output JSON */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownToLine className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Output</span>
          </div>
          <JsonBlock data={payload.outputJson} maxHeight="260px" />
        </div>

        {/* Schema Validation toggle */}
        <div>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-2 w-full text-left"
          >
            {showSchema
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            }
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Schema Validation</span>
          </button>
          {showSchema && (
            <div className="mt-2">
              <JsonBlock data={payload.schema} maxHeight="180px" />
            </div>
          )}
        </div>

        {/* MCP Context */}
        {(payload.mcpTool || payload.mcpResource) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">MCP Context</span>
            </div>
            <div className="bg-slate-950/80 rounded-lg p-3 space-y-1.5">
              {payload.mcpTool && (
                <div className="flex gap-2">
                  <span className="text-[10px] text-gray-500 w-16">MCP tool</span>
                  <span className="text-xs font-mono text-cyan-400">{payload.mcpTool}</span>
                </div>
              )}
              {payload.mcpResource && (
                <div className="flex gap-2">
                  <span className="text-[10px] text-gray-500 w-16">Resource</span>
                  <span className="text-xs font-mono text-cyan-400">{payload.mcpResource}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
