# HealthChat - RAG-Powered AI Assistant

Enterprise RAG (Retrieval-Augmented Generation) application for healthcare using NVIDIA NeMo stack with Nemotron 70B LLM and NIM embeddings.

### Services

The application consists of 5 containerized services orchestrated via Docker Compose:

1. **MySQL 8.0** - Relational database for user data, conversations, and document metadata
2. **ChromaDB** - Vector database for document embeddings and semantic search
3. **Backend (FastAPI)** - Python API server with RAG pipeline implementation
4. **Frontend (Next.js)** - React-based web interface
6. **External Services**:
   - LLM: Nemotron 70B via Ollama at `https://ollama.cc-demos.com`
   - Embeddings: NVIDIA NIM endpoint at `http://10.130.200.141:30020/v1/embeddings`

### Technology Stack

**Backend:**
- FastAPI (Python 3.11)
- SQLAlchemy + Alembic (ORM & migrations)
- ChromaDB client for vector operations
- NVIDIA NeMo Guardrails for safety
- JWT authentication
- DuckDuckGo search integration (optional, not available for the models hosted at https://ollama.cc-demos.com)

**Frontend:**
- Next.js 14 with TypeScript
- React Server Components
- TailwindCSS for styling
- Axios for API communication
- Server-Sent Events (SSE) for streaming responses

## Quick Start

Create a `.env` file in the 'be' folder and `.env.local` in the frontend folder. Use values from both .env.example
docker-compose up -d build --no-cache

### Database Ports (Host Access)

- **MySQL**: localhost:3306
  - User: `healthchat`
  - Password: `healthchat123`
  - Database: `healthchat_db`
- **ChromaDB**: localhost:8001

## External Dependencies

### NVIDIA Nemotron 70B LLM

- Endpoint: `https://ollama.cc-demos.com`
- Model: `nemotron:70b`

The application connects to an external Ollama instance hosting Nemotron 70B. If this endpoint is unavailable, the application will start but LLM features will not work. Be aware you should be connected to the VPN before trying to use this.

### NVIDIA NIM Embeddings

- Endpoint: `http://10.130.200.141:30020/v1/embeddings`
- Model: `nvidia/llama-3.2-nv-embedqa-1b-v2`

This NIM endpoint must be accessible from the backend container. If unavailable, document upload and RAG features will fail. Be aware you should be connected to the VPN before trying to use this.
You can test the endpoint with:
curl -X POST http://nemo-embedder-nvidia-nim-llama-32-nv-embedqa-1b-v2:8000/v1/embeddings \
    -H "accept: application/json" \
    -H "Content-Type: application/json" \
    -d '{
        "input": "hello world", 
        "model": "nvidia/llama-3.2-nv-embedqa-1b-v2", 
        "input_type": "passage", 
        "modality": "text"
    }'



## Health Checks

Backend health endpoint (`/api/v1/health`) returns status for:
- Database connection
- Vector store availability
- LLM connectivity
- Embedding service connectivity


---- IMPORTANT ----
For information about the deployment of HealthChat on Solution Center cluster check the DEPLOYMENT.md documentation
