# Meta-Orchestrator Visualizer — Full Visual Design

Based on: *Unified Enterprise AI Orchestration — A Meta-Orchestrator Architecture Built on NVIDIA NeMo*

This document specifies **exactly what every NeMo Agent Toolkit concept looks like** in the visualizer: nodes, icons, colors, connections, animations, tooltips, panels, and layout coordinates.

---

## 1. Canvas Layout — 4-Layer Horizontal Bands

The SVG canvas is divided into four labeled horizontal bands. Each band has a faint background tint and a label pinned to the left edge.

| Band | Y range | Background tint | Left-edge label |
|---|---|---|---|
| **Layer 1 — HelpBot UI** | y: 0–120 | `rgba(59,130,246,0.04)` (blue) | "Layer 1: HelpBot UI" |
| **Layer 2 — NeMo Orchestrator** | y: 140–320 | `rgba(168,85,247,0.04)` (purple) | "Layer 2: NeMo Orchestrator" |
| **Layer 3 — Domain & Platform Agents** | y: 340–620 | `rgba(234,179,8,0.04)` (amber) | "Layer 3: Domain & Platform Agents" |
| **Layer 4 — Data & Models** | y: 640–800 | `rgba(6,182,212,0.04)` (cyan) | "Layer 4: Data & Models" |

Band labels rendered as `<text>` at `x: 10`, centered vertically in each band, font: 11px bold uppercase, fill `#475569`.

---

## 2. Every Node — Exact Visual Specification

Each node is a 110×110 rounded-2xl box with a 3px colored border, transparent background, and a centered Lucide icon (48×48). Label text below at y+135, 15px bold, `#e5e7eb`.

### 2.1 Layer 1 — HelpBot UI

| Node ID | Label | Icon (lucide) | x | y | Tooltip description |
|---|---|---|---|---|---|
| `helpbot-chat` | HelpBot Chat | `message-square` | 50 | 30 | "Single conversational entry point. User types natural-language requests here." |
| `helpbot-todo` | My To-Do | `list-todo` | 200 | 30 | "Aggregated tasks from all connected platforms (Jira, ServiceNow, M365)." |
| `helpbot-approvals` | My Approvals | `shield-check` | 350 | 30 | "Pending human-in-the-loop approval actions queued by the orchestrator." |
| `helpbot-updates` | IT Updates | `bell` | 500 | 30 | "Real-time incident and change notifications from ServiceNow and M365." |
| `helpbot-vendor` | Vendor Tasks | `clipboard-list` | 650 | 30 | "Third-party risk tasks from ProcessUnity and SailPoint." |
| `helpbot-calendar` | My Day | `calendar` | 800 | 30 | "Calendar view aggregated from M365 Graph and Oracle." |

### 2.2 Layer 2 — NeMo Orchestrator (Meta-Agent)

These nodes represent the core NeMo Agent Toolkit runtime concepts: the workflow itself, its YAML config, intent classification, tool selection, the approval policy engine, and A2A delegation.

| Node ID | Label | Icon | x | y | Tooltip description | NeMo concept |
|---|---|---|---|---|---|---|
| `nat-serve` | nat serve | `server` | 50 | 170 | "NeMo Agent Toolkit long-lived HTTP service (`nat serve --config_file config.yml --port 8001`). Exposes all workflows as REST endpoints." | `nat serve` runtime |
| `state-store` | Session State | `database` | 50 | 280 | "Robust session-state abstraction layer to pause and resume meta-workflows without breaking the conversational UI. Handles asynchronous step-up auth (OTP)." | Session Management |
| `workflow-config` | Workflow YAML | `file-code` | 200 | 170 | "Declarative YAML config listing functions, LLMs, embedders, and workflow type. This is the single source of truth for the meta-orchestrator." | YAML workflow config |
| `react-agent` | react_agent | `brain` | 400 | 170 | "NeMo `react_agent` workflow — the meta-orchestrator. Receives user intents, reasons over available tools, calls domain agents, and enforces governance." | Workflow type: react_agent |
| `thought-loop` | Thought/Action Loop | `rotate-cw` | 400 | 100 | "Internal ReAct cycle: Thought -> Action -> Observation. Visualized as a small rotating ring around the brain node during processing." | ReAct reasoning cycle |
| `intent-classify` | Intent Classifier | `share-2` | 400 | 280 | "LLM-based intent detection. Determines domain (IT, HR, Finance, Vendor Risk, Identity) and selects which NeMo functions/tools to invoke." | LLM reasoning within workflow |
| `tool-select` | Tool Selector | `git-branch` | 600 | 220 | "Selects specific NeMo function(s) to call based on classified intent. Each function has a JSON schema and natural-language description controlling tool use." | Functions as tools |
| `a2a-delegate` | A2A Delegation | `arrow-right-left` | 800 | 220 | "Agent-to-Agent delegation. Meta-agent calls domain agent workflows as if they were tools. NeMo Agent Toolkit connects agents together transparently." | A2A delegation |
| `approval-gate` | Approval Gate | `hand` | 600 | 280 | "Policy engine tags high-risk actions (e.g. sensitive access grants) and forces a Confirm step in the UI before NeMo executes the tool." | Approvals / Human-in-the-Loop |
| `observability` | Observability | `activity` | 200 | 280 | "OpenTelemetry + NeMo Profiler integration. Traces every LLM call, tool invocation, and agent delegation with latency and quality metrics." | Observability & Profiling |

#### Approval Gate — special visual behavior

When the approval gate is **active (waiting)**, it uses a unique style:
- Border: `border-amber-500` (pulsing)
- Icon color: `text-amber-400`
- Glow: true, amber
- A **"Confirm / Deny" overlay** appears on the node (two small buttons rendered inside the foreignObject)
- The incoming connection to the gate is animated dashed amber
- The outgoing connection stays dormant until the user confirms

### 2.3 Layer 3 — Domain & Platform Agents

Layer 3 is organized as **domain columns**, each containing a domain agent node (NeMo workflow with limited tool set) and below it the platform-specific nodes.

#### Domain Agent Nodes (NeMo workflows)

| Node ID | Label | Icon | x | y | Tooltip | NeMo concept |
|---|---|---|---|---|---|---|
| `domain-it` | IT Agent | `monitor` | 50 | 370 | "NeMo workflow for IT operations. Tools: ServiceNow ITSM, M365 admin, Atlassian Jira." | Domain workflow |
| `domain-hr` | HR Agent | `users` | 250 | 370 | "NeMo workflow for HR operations. Tools: ServiceNow HR, M365 People." | Domain workflow |
| `domain-finance` | Finance Agent | `dollar-sign` | 450 | 370 | "NeMo workflow for Finance. Tools: Oracle Expenses REST API." | Domain workflow |
| `domain-vendor` | Vendor Risk Agent | `shield-alert` | 650 | 370 | "NeMo workflow for third-party risk. Tools: ProcessUnity API, SailPoint API." | Domain workflow |
| `domain-identity` | Identity Agent | `fingerprint` | 850 | 370 | "NeMo workflow for identity security. Tools: SailPoint SCIM/REST, Harbor Pilot." | Domain workflow |

#### Platform Nodes (NeMo HTTP tools / native agent wrappers)

Each platform has **two visual sub-rows**: a "Native AI Agent" row (if applicable) and a "REST API" row. Both are separate nodes connected to the domain agent above.

| Node ID | Label | Icon | x | y | Domain parent | Tooltip | NeMo concept |
|---|---|---|---|---|---|---|---|
| `snow-nowassist` | Now Assist | `bot` | 20 | 490 | domain-it | "ServiceNow Now Assist — native AI agent. NeMo tool `servicenow_now_assist` calls the Virtual Agent entrypoint for ITSM generative skills." | Native agent as NeMo tool |
| `snow-rest` | SN REST API | `globe` | 120 | 490 | domain-it | "ServiceNow REST Table API (`/api/now/table/incident`). NeMo HTTP tool for explicit operations: read incidents, create tickets, manage approvals." | HTTP endpoint as NeMo function |
| `sf-agentforce` | Agentforce | `bot` | 220 | 490 | domain-hr | "Salesforce Agentforce — native AI agent. NeMo tool calls Agentforce API for CRM triage, case resolution, and sales planning via Atlas Reasoning Engine." | Native agent as NeMo tool |
| `sf-rest` | SF REST/SOQL | `globe` | 320 | 490 | domain-hr | "Salesforce REST and SOQL APIs. NeMo HTTP tools for direct CRM data access. Used for cross-system flows instead of recursive AI delegation." | HTTP endpoint as NeMo function |
| `atl-intelligence` | Atlassian Intel | `bot` | 220 | 590 | domain-it | "Atlassian Intelligence — embedded AI for Jira/Confluence generation and summarization. Treated as UX augmentation; NeMo integrates via REST APIs." | Native agent (UX-only) |
| `atl-rest` | Jira/Confluence API | `globe` | 120 | 590 | domain-it | "Atlassian REST APIs for Jira issues and Confluence pages. NeMo HTTP tools for cross-system reasoning and summarization." | HTTP endpoint as NeMo function |
| `m365-copilot` | M365 Copilot | `bot` | 420 | 490 | domain-it | "Microsoft 365 Copilot — the meta-orchestrator can be exposed as a Copilot plugin. Graph connectors map to security groups." | Bidirectional: NeMo ↔ Copilot |
| `m365-graph` | Graph API | `globe` | 520 | 490 | domain-it | "Microsoft Graph REST endpoints for emails, calendar, Teams, files. NeMo HTTP tools consume Graph as data source." | HTTP endpoint as NeMo function |
| `oracle-expense` | Expense Assistant | `bot` | 420 | 590 | domain-finance | "Oracle Fusion Expense Assistant — conversational skill within FA Digital Assistant. Handles create/modify/check expenses." | Native agent |
| `oracle-rest` | Oracle Expenses API | `globe` | 520 | 590 | domain-finance | "Oracle Fusion Expenses REST APIs. NeMo routes expense intents directly here to mirror supported flows. Step-up auth (OTP) requires session-state abstraction." | HTTP endpoint as NeMo function |
| `sailpoint-harbor` | Harbor Pilot | `bot` | 820 | 490 | domain-identity | "SailPoint Harbor Pilot — AI agent for exploring identity data and building workflows. In-product agent; meta-orchestrator focuses on workflow APIs." | Native agent (in-product) |
| `sailpoint-rest` | SailPoint API | `globe` | 920 | 490 | domain-identity | "SailPoint REST and SCIM APIs. NeMo HTTP tools for cross-system identity provisioning. AI risk scores stored as metadata on identities." | HTTP endpoint as NeMo function |
| `pu-ai` | PU Evidence AI | `bot` | 620 | 490 | domain-vendor | "ProcessUnity Evidence Evaluator and Predictive Analytics. AI-powered vendor risk assessment using Global Risk Exchange content." | Native agent |
| `pu-rest` | ProcessUnity API | `globe` | 720 | 490 | domain-vendor | "ProcessUnity TPRM API. NeMo tool `processunity_get_vendor_risk` returns normalized risk summaries, correlating with tickets and access rights." | HTTP endpoint as NeMo function |

#### Visual distinction: native agent vs. REST API

| Aspect | Native AI Agent (`bot` icon) | REST API (`globe` icon) |
|---|---|---|
| Border default color | `border-indigo-400` | `border-slate-400` |
| Icon color | `text-indigo-400` | `text-slate-400` |
| Active border | `border-purple-500` (pulsing glow) | `border-purple-500` (pulsing glow) |
| Connection label | "AI delegation" | "REST call" |
| Connection style when active | Dashed animated purple (same as current `flow-animation`) | Solid animated purple |

### 2.4 Layer 4 — Data & Models (NeMo Microservices / NIM)

| Node ID | Label | Icon | x | y | Tooltip | NeMo concept |
|---|---|---|---|---|---|---|
| `vectordb` | Vector DB | `database` | 200 | 680 | "Enterprise vector store with curated embeddings. Combines transactional data (tickets, cases, expenses, identities), content data (articles, policies, contracts), and agent-generated content (Now Assist summaries, Agentforce plans)." | RAG data layer |
| `rag-tool` | RAG Search | `search` | 350 | 680 | "NeMo RAG function — runs vector similarity search and returns relevant passages to orchestrator workflows. Defined in the `functions` section of YAML config." | RAG tool as NeMo function |
| `llm-orchestration` | Orchestration LLM | `cpu` | 500 | 680 | "Primary LLM used by the react_agent workflow for reasoning, intent classification, and tool selection. Hosted via NeMo Microservices / NIM." | LLMs section in YAML |
| `llm-summarize` | Summarization LLM | `cpu` | 650 | 680 | "Secondary LLM used for response summarization and cross-platform data synthesis. May be a smaller, faster model." | LLMs section in YAML |
| `embedder` | Embedder | `zap` | 350 | 780 | "NIM-hosted embedding model pointed to by the `embedders` section in YAML config. Generates vectors for RAG indexing and query encoding." | Embedders section in YAML |
| `nim-services` | NeMo Microservices | `layers` | 500 | 780 | "NeMo Microservices / NIM runtime hosting LLMs and embedders. Provides low-latency inference endpoints consumed by nat serve workflows." | NeMo Microservices / NIM |
| `tool-registry` | Tool Registry | `package` | 800 | 680 | "Central registry of all NeMo functions (tools). Connectors are promoted here after the AI-assisted onboarding pipeline passes `nat eval` testing." | Tool Registry |

---

## 3. Connections — What Every Arrow Means

### 3.1 Layer 1 → Layer 2

| From | To | Meaning | Style when active |
|---|---|---|---|
| `helpbot-chat` | `nat-serve` | User message enters the NeMo service | Animated dashed purple, glow |

### 3.2 Within Layer 2 (orchestrator internals)

| From | To | Meaning | Style |
|---|---|---|---|
| `nat-serve` | `workflow-config` | Service loads YAML config | Thin cyan (one-time on init) |
| `nat-serve` | `react-agent` | Service dispatches request to workflow | Animated purple when active |
| `react-agent` | `intent-classify` | Workflow begins LLM reasoning | Animated purple |
| `intent-classify` | `tool-select` | Intent resolved, selecting tools | Solid cyan when completed |
| `tool-select` | `a2a-delegate` | Delegating to domain agent(s) | Animated purple (fan-out) |
| `tool-select` | `approval-gate` | High-risk action detected, needs confirmation | Animated dashed amber |
| `approval-gate` | `a2a-delegate` | User confirmed, proceeding | Solid green when approved |
| `react-agent` | `observability` | Every step emits OpenTelemetry spans | Thin dotted gray (always visible) |

### 3.3 Layer 2 → Layer 3 (A2A delegation)

| From | To | Meaning | Style |
|---|---|---|---|
| `a2a-delegate` | `domain-it` | Meta-agent delegates to IT Agent workflow | Animated purple; label "A2A" |
| `a2a-delegate` | `domain-hr` | Meta-agent delegates to HR Agent workflow | Same |
| `a2a-delegate` | `domain-finance` | Meta-agent delegates to Finance Agent workflow | Same |
| `a2a-delegate` | `domain-vendor` | Meta-agent delegates to Vendor Risk Agent workflow | Same |
| `a2a-delegate` | `domain-identity` | Meta-agent delegates to Identity Agent workflow | Same |

Only the **chosen** domain agent(s) connection turns active; others stay dormant or are skipped.

### 3.4 Within Layer 3 (domain agent → platform tools)

Each domain agent connects down to its platform nodes. Example for IT:

| From | To | Style when active |
|---|---|---|
| `domain-it` | `snow-nowassist` | Dashed purple (AI delegation) |
| `domain-it` | `snow-rest` | Solid purple (REST call) |
| `domain-it` | `atl-rest` | Solid purple |
| `domain-it` | `m365-graph` | Solid purple |

Connections to native AI agents use **dashed** lines; connections to REST APIs use **solid** lines. This visually distinguishes "asking an AI agent" from "making a deterministic API call" (per paper Section 2.3 — prioritize REST over recursive LLM reasoning).

### 3.5 Layer 3 → Layer 4 (data and model calls)

| From | To | Meaning | Style |
|---|---|---|---|
| `react-agent` | `llm-orchestration` | Orchestrator LLM call for reasoning | Animated purple |
| `react-agent` | `rag-tool` | RAG retrieval for context | Animated cyan |
| `rag-tool` | `vectordb` | Vector similarity search | Solid cyan |
| `rag-tool` | `embedder` | Query embedding | Solid cyan |
| `llm-orchestration` | `nim-services` | LLM inference via NIM | Thin gray |
| `llm-summarize` | `nim-services` | Summarization inference via NIM | Thin gray |
| `embedder` | `nim-services` | Embedding inference via NIM | Thin gray |

### 3.6 Response path (bottom → top)

When a platform tool returns data, the response flows back:

| From | To | Style |
|---|---|---|
| Platform node | Domain agent | Solid cyan (completed) |
| Domain agent | `a2a-delegate` | Solid cyan |
| `react-agent` | `llm-summarize` | Animated purple (if synthesizing) |
| `react-agent` | `nat-serve` | Solid cyan |
| `nat-serve` | `helpbot-chat` | Solid green (final answer) |

---

## 4. Event Trace Panel — NeMo-Specific Events

The right-side Event Trace shows one card per NeMo operation, with real latency:

| Event | Icon | Color | Example message |
|---|---|---|---|
| `nat serve` receives request | server | gray | "`nat serve` received POST /chat" |
| YAML config loaded | file-code | gray | "Loaded workflow config: `meta_orchestrator.yml`" |
| `react_agent` starts | brain | purple | "`react_agent` workflow started" |
| Intent classified | share-2 | cyan | "Intent: `IT / incident_lookup`" |
| Tool selected | git-branch | cyan | "Selected tools: `servicenow_rest_get_incidents`, `jira_rest_search`" |
| Approval gate triggered | hand | amber | "High-risk action detected: `grant_admin_access`. Awaiting confirmation." |
| Approval confirmed | shield-check | green | "User confirmed. Proceeding." |
| A2A delegation | arrow-right-left | purple | "Delegating to `domain-it` agent" |
| Native agent call | bot | indigo | "Calling `servicenow_now_assist` (Virtual Agent entrypoint)" |
| REST API call | globe | slate | "GET `/api/now/table/incident?sysparm_query=active=true` → 200 OK (142ms)" |
| RAG retrieval | search | cyan | "Vector search: 8 passages retrieved (32ms)" |
| LLM call | cpu | purple | "LLM `llama3.2` orchestration call (1240ms)" |
| Embedding call | zap | cyan | "Embedding query via NIM (18ms)" |
| Summarization | cpu | purple | "Summarization LLM call (620ms)" |
| Profiler span | activity | gray | "OpenTelemetry span: `tool.servicenow_rest` 142ms" |
| `nat eval` test | check-circle | green | "Connector passed 12/12 synthetic tests" |
| Output ready | upload | green | "Response delivered to HelpBot" |

---

## 5. Conversation Flow Panel — NeMo Operations as Chat

The Conversation Flow (bottom-right) shows the dialogue interleaved with NeMo system messages:

| Role | Style | Content examples |
|---|---|---|
| **user** | Blue card | "Show me my open incidents and related Jira tickets" |
| **system** (intent) | Purple card | "Intent classified: IT / cross-platform lookup" |
| **system** (tool select) | Purple card | "Tools selected: `servicenow_rest_get_incidents`, `jira_rest_search`" |
| **system** (A2A) | Purple card | "Delegating to IT Agent (NeMo A2A)" |
| **system** (REST call) | Slate card | "ServiceNow: 3 active incidents found (142ms)" |
| **system** (REST call) | Slate card | "Jira: 5 open tickets found (89ms)" |
| **system** (RAG) | Cyan card | "RAG: 4 relevant KB articles retrieved" |
| **system** (approval) | Amber card | "Approval required: link incident INC001234 to JIRA-567" |
| **system** (LLM) | Purple card | "Generating cross-platform summary…" |
| **assistant** | Green card | "You have 3 open ServiceNow incidents. INC001234 is linked to JIRA-567…" |

---

## 6. Connector Contract — Visual Card in Registry View

Each connector in the Tool Registry is rendered as a card with:

```
┌──────────────────────────────────────────────────┐
│  [platform-icon]  ServiceNow ITSM Connector       │
│  ─────────────────────────────────────────────── │
│  Version: 1.2.0        Domain: IT                 │
│  Capability: full       Status: ● healthy         │
│  ─────────────────────────────────────────────── │
│  Metadata                                         │
│    Supported intents: incident_lookup,             │
│      incident_create, approval_check              │
│  ─────────────────────────────────────────────── │
│  Tools (NeMo functions)                           │
│    servicenow_rest_get_incidents                   │
│      GET /api/now/table/incident                   │
│      Input: { query: string, limit?: number }      │
│      Output: { incidents: Incident[] }             │
│    servicenow_now_assist                           │
│      POST /virtual_agent/invoke                    │
│      Input: { utterance: string }                  │
│      Output: { response: string }                  │
│  ─────────────────────────────────────────────── │
│  Runtime                                          │
│    invoke: HTTP handler (normalized results)       │
│    delegate_agent: Now Assist Virtual Agent        │
│  ─────────────────────────────────────────────── │
│  MCP mapping                                      │
│    MCP tool: servicenow.incidents.list             │
│    MCP resource: servicenow://incidents            │
│  ─────────────────────────────────────────────── │
│  Last used: 2 min ago     Calls today: 847        │
└──────────────────────────────────────────────────┘
```

This maps directly to the paper's Section 5 connector contract: Metadata, Tools, Runtime Interface, and MCP mapping.

---

## 7. AI-Assisted Onboarding Pipeline — Visual Flow

Rendered as a 5-node horizontal pipeline (separate view/tab), each node 110×110:

| Step | Node ID | Label | Icon | Status colors | Tooltip |
|---|---|---|---|---|---|
| 1 | `onboard-analyze` | API Analysis | `search` | dormant → active → completed | "NeMo workflow ingests OpenAPI spec, clusters endpoints, queries platform metadata APIs for tenant-specific custom fields." |
| 2 | `onboard-schema` | Schema Gen | `file-code` | dormant → active → completed | "Agent writes candidate JSON schemas for inputs/outputs aligned with NeMo functions format and MCP tool schemas." |
| 3 | `onboard-config` | Config Synthesis | `settings` | dormant → active → completed | "Drafts YAML fragment: base URLs, HTTP methods, auth structures for NeMo config." |
| 4 | `onboard-review` | Human Review | `hand` | dormant → active (amber pulse) → completed | "Platform owner reviews generated config. `nat eval` runs synthetic tests to validate connector." |
| 5 | `onboard-promote` | Promote to Registry | `package` | dormant → active → completed (green) | "Approved connector enters the Tool Registry for meta-orchestrator consumption." |

Connections: linear left-to-right. Step 4 uses the same amber pulsing approval-gate style.

---

## 8. Governance & Observability — Visual Overlays

### 8.1 OpenTelemetry traces

A thin dotted gray line connects `observability` node to every other node in Layer 2 and Layer 3. When a span completes, a small latency badge (`142ms`) appears on the connection briefly (fade-in/fade-out animation, 2 seconds).

### 8.2 NeMo Profiler

The `observability` node tooltip expands to show a mini flame chart:
```
react_agent         ████████████████████ 2400ms
  intent_classify   ██████               600ms
  tool_select       ███                  300ms
  a2a_delegate      ████████████         1200ms
    snow_rest       ████                 400ms
    jira_rest       ███                  300ms
  llm_summarize     █████                500ms
```

### 8.3 `nat eval` testing indicator

When a connector is being tested, the `tool-registry` node shows a small badge: "Testing 12/12" with a progress ring. On completion: green checkmark.

### 8.4 SSO / Auth flow

When a platform requires step-up authentication (e.g. Oracle OTP), the platform node border turns amber and a small lock icon overlay appears. The connection from the domain agent pauses (dashed amber). The Event Trace shows: "Step-up auth required: Oracle OTP. Session paused."

### 8.5 Tool Payload Inspector (Visual)

When a node of type `api_call` or `native_agent` is active or selected, a "Payload Inspector" side-panel slides in from the left:
- **Input JSON**: Pretty-printed JSON object sent to the platform API.
- **Output JSON**: Normalized result returned to NeMo.
- **Schema Validation**: Toggle to show the JSON schema from the NeMo `functions` config.
- **MCP Context**: If accessed via MCP, show the mapped MCP tool name and resource URI.

### 8.6 A2A Handshake Animation (Visual)

When `a2a-delegate` activates:
1. A small "packet" icon travels from `react-agent` to `a2a-delegate`.
2. The `a2a-delegate` node pulses purple.
3. Five arrows fan out to all domain agents in Layer 3 simultaneously in a "searching" scan (faint gray).
4. The **selected** domain agent arrow turns solid purple and stays animated.
5. A text label "Delegating Intent: IT_LOOKUP" appears briefly over the connection line.

### 8.7 YAML-to-Graph Visualization (Visual)

On initial load or when `workflow-config` is clicked:
1. A small code editor window shows the YAML workflow definition.
2. When a line in the `functions:` or `llms:` section is hovered, the corresponding node in the map glows.
3. This visually reinforces the **NeMo declarative paradigm** — that the graph is directly generated from the YAML config.

---

## 9. Node Type System — Extended Types for BlueprintNode

Current visualizer types: `intake | process | classify | route | model | execute | validate | output | retrieval | assembly`

New types to add:

```
'orchestrator'    — react_agent, nat serve
'domain_agent'    — IT, HR, Finance, Vendor Risk, Identity agents
'platform'        — ServiceNow, Salesforce, Atlassian, M365, Oracle, SailPoint, ProcessUnity
'native_agent'    — Now Assist, Agentforce, Copilot, Harbor Pilot, PU Evidence AI, Expense Assistant
'api_call'        — REST/SOQL/SCIM/Graph endpoints
'approval'        — Human-in-the-loop confirmation gate
'vectordb'        — Vector store
'llm'             — LLM nodes (orchestration, summarization)
'embedder'        — Embedding model
'nim'             — NeMo Microservices / NIM runtime
'registry'        — Tool Registry
'mcp'             — MCP server/mapping
'config'          — YAML workflow config
'observability'   — OpenTelemetry / Profiler
'helpbot'         — HelpBot UI panels
```

---

## 10. New Lucide Icons Needed

Icons already in the visualizer: `download`, `align-left`, `share-2`, `git-branch`, `cpu`, `zap`, `layers`, `settings`, `check-circle`, `upload`, `database`, `file-text`, `lightbulb`, `brain`, `shield-check`

Icons to add for the meta-orchestrator blueprint:

| Icon name | Used for |
|---|---|
| `message-square` | HelpBot Chat |
| `list-todo` | My To-Do |
| `bell` | IT Updates |
| `clipboard-list` | Vendor Tasks |
| `calendar` | My Day |
| `server` | nat serve |
| `file-code` | Workflow YAML, Schema Gen |
| `arrow-right-left` | A2A Delegation |
| `hand` | Approval Gate, Human Review |
| `activity` | Observability / Profiler |
| `monitor` | IT Agent |
| `users` | HR Agent |
| `dollar-sign` | Finance Agent |
| `shield-alert` | Vendor Risk Agent |
| `fingerprint` | Identity Agent |
| `bot` | Native AI agents (Now Assist, Agentforce, etc.) |
| `globe` | REST API endpoints |
| `search` | RAG Search, API Analysis |
| `package` | Tool Registry, Promote |
| `lock` | Auth overlay |

---

## 11. Color Palette Summary

| Element | Color | Tailwind class |
|---|---|---|
| NeMo orchestrator nodes | Purple | `border-purple-500` / `text-purple-400` |
| Domain agent nodes | Amber | `border-amber-400` / `text-amber-400` |
| Native AI agent nodes | Indigo | `border-indigo-400` / `text-indigo-400` |
| REST API nodes | Slate | `border-slate-400` / `text-slate-400` |
| Data/model nodes | Cyan | `border-cyan-400` / `text-cyan-400` |
| HelpBot UI nodes | Blue | `border-blue-400` / `text-blue-400` |
| Approval gate (waiting) | Amber pulsing | `border-amber-500` + glow |
| Chosen path | Green | `border-green-400` |
| Skipped nodes | Gray | `border-gray-600` |
| Error nodes | Red | `border-red-500` + glow |
| Active (running) | Purple glow | `border-purple-500` + glow-pulse |

---

## 12. Working POC — Platforms to Connect

| Platform | What we connect | API | Auth | Free tier |
|---|---|---|---|---|
| **Atlassian (Jira/Confluence)** | Create/read issues, search Confluence | REST v3 | API token | Free cloud |
| **Microsoft Graph** | Emails, calendar, Teams messages | Graph REST | OAuth2 app reg | Free dev tenant |
| **ServiceNow** | Read incidents, create tickets | Table API | Basic auth | Personal Dev Instance |
| **Ollama (inference.ccrolabs.com)** | Orchestration LLM, summarization, embeddings | OpenAI-compat | None | Self-hosted |

### What we reuse from the llm-router work

- `TraceStore`, `TraceSnapshot`, `TraceStep` schemas (extend with new step types)
- `span()` async context manager for step instrumentation
- `routerTraceService` polling client (rename/extend to `orchestratorTraceService`)
- `AnimationEngine` pattern (extend to `MetaOrchestratorAnimationEngine`)
- Next.js proxy route pattern (`/api/orchestrator/run` and `/api/orchestrator/latest`)
- `model_clients.py` pattern for calling downstream APIs

---

## 13. Implementation Order

1. Extend `types.ts` with new node types, add new icons to `BlueprintMap.tsx`
2. New blueprint definition in `blueprints.ts` — `meta-orchestrator` with full 4-layer layout
3. Backend orchestrator service (FastAPI or NAT) — accepts chat, classifies, delegates, emits trace
4. Platform connectors — Atlassian first (simplest), then ServiceNow, then Graph
5. `MetaOrchestratorAnimationEngine` extending the llm-router pattern
6. Next.js proxy routes `/api/orchestrator/run` and `/api/orchestrator/latest`
7. Approval gate interactive UI (Confirm/Deny buttons on node)
8. Connector Registry view (secondary tab/page)
9. Onboarding Pipeline view (secondary tab/page)
10. Observability overlays (latency badges, mini flame chart in tooltip)
