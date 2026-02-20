'use client';

import { useState } from 'react';
import { connectors } from '@/lib/connectorData';
import { ConnectorCard, ConnectorTool } from '@/lib/types';
import { Globe, ChevronDown, ChevronRight, Server, Cpu, Package } from 'lucide-react';

const methodColors: Record<string, string> = {
  GET: 'bg-green-600/30 text-green-400 border-green-500/40',
  POST: 'bg-blue-600/30 text-blue-400 border-blue-500/40',
  PUT: 'bg-amber-600/30 text-amber-400 border-amber-500/40',
  DELETE: 'bg-red-600/30 text-red-400 border-red-500/40',
};

const statusColors: Record<string, { dot: string; text: string }> = {
  healthy: { dot: 'bg-green-400', text: 'text-green-400' },
  degraded: { dot: 'bg-amber-400', text: 'text-amber-400' },
  offline: { dot: 'bg-red-400', text: 'text-red-400' },
};

function ToolRow({ tool }: { tool: ConnectorTool }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-700/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodColors[tool.method]}`}>
          {tool.method}
        </span>
        <span className="text-xs font-mono text-gray-300 truncate">{tool.name}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40">
          <div className="pt-2">
            <span className="text-[10px] text-gray-500 uppercase font-bold">Endpoint</span>
            <p className="text-xs font-mono text-cyan-400 mt-0.5">{tool.endpoint}</p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold">Input</span>
            <pre className="text-[11px] font-mono text-gray-400 bg-slate-900/60 rounded p-2 mt-0.5 overflow-x-auto">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold">Output</span>
            <pre className="text-[11px] font-mono text-gray-400 bg-slate-900/60 rounded p-2 mt-0.5 overflow-x-auto">
              {JSON.stringify(tool.outputSchema, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ connector }: { connector: ConnectorCard }) {
  const sc = statusColors[connector.status];
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl overflow-hidden card-shadow-lg flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate">{connector.name}</h3>
            <p className="text-xs text-gray-500">{connector.platform}</p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-5 py-3 border-b border-slate-700/40 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Version</span>
          <span className="text-xs text-gray-300 font-mono">{connector.version}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Domain</span>
          <span className="text-xs text-gray-300">{connector.domain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Capability</span>
          <span className="text-xs text-gray-300">{connector.capability}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Status</span>
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${sc.text}`}>
            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
            {connector.status}
          </span>
        </div>
      </div>

      {/* Intents */}
      <div className="px-5 py-3 border-b border-slate-700/40">
        <span className="text-[10px] text-gray-500 uppercase font-bold">Supported Intents</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {connector.intents.map(intent => (
            <span key={intent} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 font-mono">
              {intent}
            </span>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="px-5 py-3 border-b border-slate-700/40 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500 uppercase font-bold">Tools (NeMo functions)</span>
        </div>
        <div className="space-y-1.5">
          {connector.tools.map(tool => (
            <ToolRow key={tool.name} tool={tool} />
          ))}
        </div>
      </div>

      {/* Runtime */}
      <div className="px-5 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Server className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500 uppercase font-bold">Runtime</span>
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="text-[10px] text-gray-500 w-14">invoke</span>
            <span className="text-xs text-gray-300">{connector.runtime.invoke}</span>
          </div>
          {connector.runtime.delegateAgent && (
            <div className="flex gap-2">
              <span className="text-[10px] text-gray-500 w-14">delegate</span>
              <span className="text-xs text-indigo-400">{connector.runtime.delegateAgent}</span>
            </div>
          )}
        </div>
      </div>

      {/* MCP Mapping */}
      <div className="px-5 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Package className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500 uppercase font-bold">MCP Mapping</span>
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="text-[10px] text-gray-500 w-14">tool</span>
            <span className="text-xs font-mono text-cyan-400">{connector.mcpMapping.toolName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] text-gray-500 w-14">resource</span>
            <span className="text-xs font-mono text-cyan-400">{connector.mcpMapping.resourceUri}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex justify-between items-center">
        <span className="text-[10px] text-gray-500">Last used: <span className="text-gray-400">{connector.lastUsed}</span></span>
        <span className="text-[10px] text-gray-500">Calls today: <span className="text-gray-300 font-bold">{connector.callsToday.toLocaleString()}</span></span>
      </div>
    </div>
  );
}

export default function ConnectorRegistry() {
  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white text-shadow">Connector Registry</h2>
        <p className="text-sm text-gray-400 mt-1">Tool Registry — all NeMo function connectors</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-6">
        {connectors.map(c => (
          <Card key={c.id} connector={c} />
        ))}
      </div>
    </div>
  );
}
