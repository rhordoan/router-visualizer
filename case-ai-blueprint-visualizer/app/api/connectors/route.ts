import { NextResponse } from 'next/server';
import type { ConnectorCard, ConnectorTool } from '@/lib/types';

const ICE_CHAT_URL = process.env.ICE_CHAT_BACKEND_URL ?? 'http://localhost:8000';

// ── Tool → system mapping ────────────────────────────────────────────────────

type SystemId = 'servicenow' | 'jira' | 'msgraph' | 'itdocs';

function systemForTool(name: string): SystemId {
  if (name.startsWith('jira_')) return 'jira';
  if (
    name.startsWith('get_recent_emails') ||
    name.startsWith('get_calendar') ||
    name.startsWith('search_emails') ||
    name.startsWith('get_email') ||
    name.startsWith('extract_email') ||
    name.startsWith('get_meeting') ||
    name.startsWith('send_email') ||
    name.startsWith('create_draft_email') ||
    name.startsWith('reply_to_email') ||
    name.startsWith('create_calendar_event') ||
    name.startsWith('update_calendar_event') ||
    name.startsWith('cancel_calendar_event')
  )
    return 'msgraph';
  if (
    name.startsWith('search_knowledge') ||
    name.startsWith('search_it_docs') ||
    name.startsWith('run_knowledge') ||
    name.startsWith('suggest_runbook') ||
    name.startsWith('propose_resolution')
  )
    return 'itdocs';
  return 'servicenow';
}

// ── Static platform metadata ─────────────────────────────────────────────────

const PLATFORM_META: Record<
  SystemId,
  Omit<ConnectorCard, 'id' | 'tools' | 'status' | 'callsToday' | 'lastUsed'>
> = {
  servicenow: {
    name: 'ServiceNow ITSM Connector',
    platform: 'ServiceNow',
    icon: 'globe',
    version: '1.2.0',
    domain: 'IT',
    capability: 'full',
    intents: ['incident_lookup', 'incident_create', 'change_request'],
    runtime: {
      invoke: 'HTTP handler (normalized results)',
      delegateAgent: 'Now Assist Virtual Agent',
    },
    mcpMapping: {
      toolName: 'servicenow.incidents.list',
      resourceUri: 'servicenow://incidents',
    },
  },
  jira: {
    name: 'Atlassian Jira Connector',
    platform: 'Atlassian',
    icon: 'globe',
    version: '1.4.2',
    domain: 'IT',
    capability: 'full',
    intents: ['issue_search', 'issue_create', 'issue_transition'],
    runtime: {
      invoke: 'HTTP handler (normalized results)',
      delegateAgent: 'Atlassian Intelligence (UX-only)',
    },
    mcpMapping: {
      toolName: 'atlassian.issues.search',
      resourceUri: 'atlassian://jira/issues',
    },
  },
  msgraph: {
    name: 'Microsoft Graph Connector',
    platform: 'Microsoft',
    icon: 'globe',
    version: '3.1.0',
    domain: 'IT',
    capability: 'full',
    intents: ['email_search', 'calendar_read', 'email_send'],
    runtime: {
      invoke: 'HTTP handler (normalized results)',
      delegateAgent: 'M365 Copilot (bidirectional plugin)',
    },
    mcpMapping: {
      toolName: 'microsoft.graph.mail',
      resourceUri: 'microsoft://graph/me/messages',
    },
  },
  itdocs: {
    name: 'IT Knowledge Base Connector',
    platform: 'Internal',
    icon: 'globe',
    version: '1.0.0',
    domain: 'IT',
    capability: 'read-only',
    intents: ['kb_search', 'runbook_suggest', 'doc_gap_check'],
    runtime: {
      invoke: 'RAG pipeline (ChromaDB + embedder)',
    },
    mcpMapping: {
      toolName: 'internal.kb.search',
      resourceUri: 'internal://it-docs',
    },
  },
};

// ── Endpoint hint lookup (best-effort) ───────────────────────────────────────

const ENDPOINT_HINTS: Record<string, string> = {
  // ServiceNow
  get_incidents: '/api/now/table/incident',
  get_incident_by_number: '/api/now/table/incident/{number}',
  search_similar_tickets: '/api/now/table/incident',
  create_incident: '/api/now/table/incident',
  update_incident: '/api/now/table/incident/{number}',
  add_work_note: '/api/now/table/incident/{number}',
  link_kb_to_incident: '/api/now/table/incident/{number}',
  get_incident_timeline: '/api/now/table/sys_journal_field',
  create_change_request: '/api/now/table/change_request',
  // Jira
  jira_get_projects: '/rest/api/3/project',
  jira_search_issues: '/rest/api/3/search',
  jira_get_my_issues: '/rest/api/3/search',
  jira_get_recent_issues: '/rest/api/3/search',
  jira_get_issue: '/rest/api/3/issue/{issueKey}',
  jira_create_issue: '/rest/api/3/issue',
  jira_update_issue: '/rest/api/3/issue/{issueKey}',
  jira_transition_issue: '/rest/api/3/issue/{issueKey}/transitions',
  jira_add_comment: '/rest/api/3/issue/{issueKey}/comment',
  jira_get_comments: '/rest/api/3/issue/{issueKey}/comment',
  // Microsoft Graph
  get_recent_emails: '/v1.0/me/messages',
  get_calendar_events: '/v1.0/me/calendarview',
  search_emails: '/v1.0/me/messages',
  get_email_by_id: '/v1.0/me/messages/{messageId}',
  extract_email_entities: '(local NLP)',
  get_meeting_context: '/v1.0/me/calendarview',
  send_email: '/v1.0/me/sendMail',
  create_draft_email: '/v1.0/me/messages',
  reply_to_email: '/v1.0/me/messages/{messageId}/reply',
  create_calendar_event: '/v1.0/me/events',
  update_calendar_event: '/v1.0/me/events/{eventId}',
  cancel_calendar_event: '/v1.0/me/events/{eventId}/cancel',
  // IT Docs
  search_knowledge_base: '/api/now/table/kb_knowledge',
  search_it_docs: '(ChromaDB vector search)',
  run_knowledge_gap_check: '(ChromaDB vector search)',
  suggest_runbook: '(ChromaDB vector search)',
  propose_resolution_steps: '(LLM synthesis)',
};

// ── Backend tool shape ───────────────────────────────────────────────────────

interface BackendTool {
  name: string;
  description: string;
  parameters: { properties?: Record<string, unknown>; required?: string[] };
  requires_confirmation: boolean;
  mutating: boolean;
  calls_today: number;
  error_count: number;
}

function toConnectorTool(bt: BackendTool): ConnectorTool {
  const method = bt.mutating ? 'POST' : 'GET';
  const endpoint = ENDPOINT_HINTS[bt.name] ?? `/${bt.name.replace(/_/g, '/')}`;
  return {
    name: bt.name,
    method,
    endpoint,
    inputSchema: bt.parameters.properties ?? {},
    outputSchema: {},
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  let tools: BackendTool[] = [];
  let backendOnline = false;

  try {
    const res = await fetch(`${ICE_CHAT_URL}/api/v1/chat/agent/registry`, {
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.enabled && Array.isArray(data.tools)) {
        tools = data.tools as BackendTool[];
        backendOnline = true;
      }
    }
  } catch {
    // backend unreachable — fall through with empty tools + offline status
  }

  // Group tools by system
  const grouped: Record<SystemId, BackendTool[]> = {
    servicenow: [],
    jira: [],
    msgraph: [],
    itdocs: [],
  };
  for (const t of tools) {
    grouped[systemForTool(t.name)].push(t);
  }

  // Aggregate call counts per system
  const callsPerSystem: Record<SystemId, number> = {
    servicenow: 0,
    jira: 0,
    msgraph: 0,
    itdocs: 0,
  };
  for (const [sys, ts] of Object.entries(grouped) as [SystemId, BackendTool[]][]) {
    callsPerSystem[sys] = ts.reduce((sum, t) => sum + t.calls_today, 0);
  }

  const cards: ConnectorCard[] = (Object.keys(PLATFORM_META) as SystemId[]).map((sys) => {
    const meta = PLATFORM_META[sys];
    const sysTools = grouped[sys];
    return {
      ...meta,
      id: sys,
      tools: sysTools.map(toConnectorTool),
      status: backendOnline ? 'healthy' : 'offline',
      callsToday: callsPerSystem[sys],
      lastUsed: sysTools.length > 0 ? 'live' : '—',
    };
  });

  return NextResponse.json(cards);
}
