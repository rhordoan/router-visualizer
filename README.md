# router-visualizer

Monorepo that combines:

- **`case-ai-blueprint-visualizer/`**: a Next.js UI that visualizes “blueprints” (workflows) and can run the LLM Router in real time.
- **`llm-router/`**: NVIDIA’s LLM Router stack (router-controller + optional Triton router-server models).

## Quickstart (recommended): Visualizer + router-controller via Docker

This starts (everything you need for the demo):

- **Blueprint Visualizer** on `http://localhost:3000`
- **llm-router router-controller** on `http://localhost:8084`
- **CanChat (HealthChat) backend** on `http://localhost:8005` (also provides real-time CoT for the visualizer)
- **CanChat (HealthChat) frontend** on `http://localhost:3001`

From the repo root:

```bash
docker compose -f docker-compose.visualizer-llm-router.yml up --build
```

Open:

- Visualizer: `http://localhost:3000`
- CanChat: `http://localhost:3001`

Then:

- **LLM Router demo**: in the visualizer, select **LLM Routing**, type a prompt, click **Send**.
- **HealthChat/CoT demo**:
  - open CanChat (`http://localhost:3001`) and send a message
  - open the visualizer and select **HealthChat** to see real-time CoT updates

### Configure routing targets (Ollama / NIM / vLLM)

The router-controller forwards OpenAI-compatible requests to each configured LLM backend via:

`{api_base}/v1/chat/completions`

Edit:

- `llm-router/src/router-controller/config.yaml`

Typical dev setups:

- **Ollama on your host**: set `api_base: http://host.docker.internal:11434`
- **Remote NIM/vLLM**: set `api_base` to your remote OpenAI-compatible endpoint

Notes:

- If you use Ollama, set each LLM’s `model` field to your Ollama model name (e.g. `llama3.1:8b`).
- `api_key` can be an empty string for Ollama.

## Optional: Triton router-server (classifier-based routing)

If you want `routing_strategy: triton`, you need the Triton **router-server** running (it serves the router models used for classification).

Bring it up with the profile:

```bash
docker compose -f docker-compose.visualizer-llm-router.yml --profile triton up --build
```

## How “real-time trace” works in the visualizer

The visualizer calls:

- `POST /api/router/run` → forwards to router-controller `POST /v1/chat/completions`
- `GET /api/router/latest` → returns the latest synthesized `RouterTraceSnapshot`

The trace is stored **in memory** in the Next.js server process. That’s perfect for local demos; for multi-replica/serverless deployments you’d replace it with a shared store (Redis/DB).

## Configure CanChat (HealthChat) LLM + embeddings

CanChat runs as part of the root compose and is what powers the **HealthChat** blueprint’s `/api/v1/cot/realtime/latest` endpoint.

By default the compose uses the same environment variables as `case-ai-can-chat/docker-compose.yml`. You’ll most commonly want to override:

- **`LLM_BASE_URL`**: your OpenAI-compatible LLM endpoint (Ollama/NIM/vLLM)
- **`LLM_MODEL`**: model name at that endpoint
- **`EMBEDDING_API_URL`** and **`EMBEDDING_MODEL`**: your embedding endpoint + model

Example (PowerShell):

```powershell
$env:LLM_BASE_URL="http://host.docker.internal:11434"
$env:LLM_MODEL="llama3.1:8b"
docker compose -f docker-compose.visualizer-llm-router.yml up --build
```

## Repo layout

- `docker-compose.visualizer-llm-router.yml`: combined compose for running the visualizer + router-controller together (and optional Triton profile).
- `case-ai-blueprint-visualizer/README.md`: visualizer-specific docs.
- `llm-router/README.md`: llm-router docs.


