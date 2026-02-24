'use client';

import { useState, useEffect } from 'react';
import { ConnectorCard, ConnectorTool } from '@/lib/types';
import { Globe, ChevronDown, ChevronRight, Server, Cpu, Package, RefreshCw, WifiOff } from 'lucide-react';

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
  const hasErrors = tool.errorCount > 0;
  return (
    <div className="border border-slate-700/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${methodColors[tool.method]}`}>
          {tool.method}
        </span>
        <span className="text-xs font-mono text-gray-300 truncate flex-1">{tool.name}</span>
        {tool.requiresConfirmation && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">confirm</span>
        )}
        {tool.callsToday > 0 && (
          <span className={`text-[9px] font-mono flex-shrink-0 ${hasErrors ? 'text-red-400' : 'text-gray-500'}`}>
            {tool.callsToday}×{hasErrors ? ` ${tool.errorCount}✗` : ''}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40">
          {tool.description && (
            <div className="pt-2">
              <p className="text-xs text-gray-400 leading-relaxed">{tool.description}</p>
            </div>
          )}
          <div className={tool.description ? '' : 'pt-2'}>
            <span className="text-[10px] text-gray-500 uppercase font-bold">Endpoint</span>
            <p className="text-xs font-mono text-cyan-400 mt-0.5">{tool.endpoint}</p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold">Input Schema</span>
            <pre className="text-[11px] font-mono text-gray-400 bg-slate-900/60 rounded p-2 mt-0.5 overflow-x-auto">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          </div>
          {tool.callsToday > 0 && (
            <div className="flex gap-4">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Calls today</span>
                <p className="text-xs text-green-400 font-mono mt-0.5">{tool.callsToday}</p>
              </div>
              {tool.errorCount > 0 && (
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Errors</span>
                  <p className="text-xs text-red-400 font-mono mt-0.5">{tool.errorCount}</p>
                </div>
              )}
            </div>
          )}
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
        <div className="flex items-center gap-3">
          {(() => {
            const totalErrors = connector.tools.reduce((s, t) => s + t.errorCount, 0);
            return totalErrors > 0 ? (
              <span className="text-[10px] text-red-400">{totalErrors} err</span>
            ) : null;
          })()}
          <span className="text-[10px] text-gray-500">Calls: <span className="text-gray-300 font-bold">{connector.callsToday.toLocaleString()}</span></span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl overflow-hidden card-shadow-lg animate-pulse">
      <div className="px-5 pt-5 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-700 rounded w-3/4" />
            <div className="h-2.5 bg-slate-800 rounded w-1/2" />
          </div>
        </div>
      </div>
      <div className="px-5 py-3 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-2.5 bg-slate-800 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ConnectorRegistry() {
  const [connectors, setConnectors] = useState<ConnectorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnectors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connectors');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConnectorCard[] = await res.json();
      setConnectors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnectors(); }, []);

  const offlineCount = connectors.filter(c => c.status === 'offline').length;

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white text-shadow">Connector Registry</h2>
          <p className="text-sm text-gray-400 mt-1">Tool Registry — all NeMo function connectors</p>
        </div>
        <button
          onClick={fetchConnectors}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-gray-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Backend status banner */}
      {!loading && offlineCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          ICE-Chat backend unreachable — showing connector stubs. Start the backend to load live tool schemas and call counts.
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          Could not reach /api/connectors: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-6">
        {loading
          ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
          : connectors.map(c => <Card key={c.id} connector={c} />)
        }
      </div>
    </div>
  );
}
