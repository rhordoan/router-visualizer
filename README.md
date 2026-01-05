# router-visualizer

Monorepo that combines:

- **`case-ai-blueprint-visualizer/`**: a Next.js UI that visualizes “blueprints” (workflows) and can run the LLM Router in real time.
- **`llm-router/`**: NVIDIA’s LLM Router stack (router-controller + optional Triton router-server models).

## Quickstart (recommended): Visualizer + router-controller via Docker

This starts:

- **Blueprint Visualizer** on `http://localhost:3000`
- **llm-router router-controller** on `http://localhost:8084`

From the repo root:

```bash
docker compose -f docker-compose.visualizer-llm-router.yml up --build
```

Open:

- Visualizer: `http://localhost:3000`

Then select **LLM Routing**, type a prompt, and click **Send**.

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

## Repo layout

- `docker-compose.visualizer-llm-router.yml`: combined compose for running the visualizer + router-controller together (and optional Triton profile).
- `case-ai-blueprint-visualizer/README.md`: visualizer-specific docs.
- `llm-router/README.md`: llm-router docs.


