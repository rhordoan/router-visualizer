# NVIDIA Blueprints Visualizer

Interactive visualization tool for AI workflow patterns, demonstrating LLM Router, Enterprise RAG, and HealthChat blueprints.

## Features

- Real-time animation of workflow execution
- Interactive node status visualization
- Step-by-step event trace with chat simulation
- Multiple scenarios per blueprint
- Adjustable playback speed
- Optional real-time CoT integration with HealthChat

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Lucide React Icons

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### LLM Router (real-time mode)

The **LLM Routing** blueprint can visualize real runs by calling the llm-router **router-controller** (OpenAI-compatible).

- Run the llm-router router-controller (from this repo, see `llm-router/docker-compose.yaml`) which exposes `POST /v1/chat/completions` on port `8084`.
- Point the visualizer at it:

```bash
# Windows PowerShell example
$env:LLM_ROUTER_BACKEND_URL="http://localhost:8084"
npm run dev
```

By default, the visualizer will use **manual routing** (no Triton required) and will pick the **first LLM** listed under the selected policy in the router-controller `/config` if you don’t provide a model.

Then select **LLM Routing**, type a prompt, and hit **Send**.

### Docker

```bash
docker-compose up -d
```

### Docker (Visualizer + llm-router together)

There is a repo-root compose file that runs:
- `router-controller` on `8084`
- `blueprint-visualizer` on `3000`

From the repo root:

```bash
docker compose -f docker-compose.visualizer-llm-router.yml up --build
```

Notes:
- The “full” llm-router compose (`llm-router/docker-compose.yaml`) also starts Grafana on `3000`, which will **conflict** with the visualizer’s `3000`. The combined compose above avoids that.
- To enable Triton-based routing, run with the Triton profile:

```bash
docker compose -f docker-compose.visualizer-llm-router.yml --profile triton up --build
```

### Kubernetes

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Blueprints

**LLM Router** - Intelligent routing of queries to optimal language models
- Marketing Q&A
- Technical Support
- General Query
- Healthcare Query

**Enterprise RAG** - Knowledge base retrieval and generation
- Product Documentation
- Policy Inquiry
- Knowledge Base Query
- Healthcare Protocol

**HealthChat** - Real-time Chain-of-Thought visualization
- Real-time connection to HealthChat backend
- Live CoT step visualization
- Healthcare-focused scenarios

