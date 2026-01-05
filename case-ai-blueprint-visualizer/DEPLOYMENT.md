# NVIDIA Blueprint Visualizer - Kubernetes Deployment Guide

Interactive visualization tool for AI workflow patterns (LLM Router, Enterprise RAG, HealthChat).

## Prerequisites

- Access to the private Docker registry: `10.130.200.141:5000`
- Access to Kubernetes cluster with `team-romania` namespace
- kubectl configured to access the cluster
- Optional: HealthChat backend for real-time integration

## Deployment Overview

The application consists of a single Next.js frontend service:
1. **Frontend** (Deployment) - Next.js application exposed on NodePort 30038

The application is **fully standalone** and includes:
- 3 pre-configured blueprints (LLM Router, Enterprise RAG, HealthChat)
- Mock data scenarios for demonstration
- Optional real-time integration with HealthChat backend (port 30087)

## Step 1: Build Docker Image

Build the image from your local machine or a server with fast network connection.

### Build Frontend Image

The build includes HealthChat backend integration (internal cluster service):

```bash
cd /path/to/case-ai-blueprint-visualizer

docker build --platform linux/amd64 \
  --build-arg HEALTHCHAT_BACKEND_URL=http://healthchat-backend:8000 \
  -t 10.130.200.141:5000/blueprint-visualizer:latest \
  .
```

### Notes on Image Building

- **Platform:** Use `--platform linux/amd64` when building from Apple Silicon (ARM64) machines
- **Registry:** The image will be pushed to the private Docker registry at `bcm10-headnode:5000`
- **Size:** Final image is ~150MB (optimized with standalone Next.js build)
- **HealthChat Backend:** Uses internal cluster service `healthchat-backend:8000`

## Step 2: Push Image to Private Registry

Push the image to the private Docker registry.

```bash
docker push 10.130.200.141:5000/blueprint-visualizer:latest
```

### Registry Configuration

If you get certificate errors when pushing from your local machine, configure Docker:

**Docker Desktop → Settings → Docker Engine:**
```json
{
  "insecure-registries": ["10.130.200.141:5000"]
}
```

**Note:** If push is slow from your local machine, consider using a server within the same network as the registry.

## Step 3: Deploy to Kubernetes

### Files Location

Deployment manifest is located in the `k8s/` directory:
- `frontend.yaml` - Frontend deployment and NodePort service

### Deploy Application

```bash
# Deploy the frontend application
kubectl apply -f k8s/frontend.yaml
```

Wait for deployment to be ready:

```bash
kubectl wait --for=condition=available deployment/blueprint-visualizer -n team-romania --timeout=300s
```

### Verify Deployment

Check if pods are running:

```bash
kubectl get pods -n team-romania -l app=blueprint-visualizer
```

Check service:

```bash
kubectl get svc -n team-romania -l app=blueprint-visualizer
```

Expected output:
```
NAME                   TYPE       CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
blueprint-visualizer   NodePort   10.x.x.x         <none>        3000:30038/TCP   1m
```

## Step 4: Access the Application

### Get Node IP

```bash
kubectl get nodes -o wide
```

Note the `INTERNAL-IP` or `EXTERNAL-IP` of any node (e.g., 10.130.200.141).

### Access URLs

- **Frontend:** `http://10.130.200.141:30038`
- **HealthChat Backend:** `http://10.130.200.141:30087` (if deployed)

Open your browser and navigate to the frontend URL to access the Blueprint Visualizer.

### Test Connectivity

```bash
curl http://10.130.200.141:30038
```

You should see the HTML response from the Next.js application.

## Configuration Details

### Namespace
All resources are deployed in: `team-romania`

### NodePort Allocations
- Frontend: 30038
- HealthChat Backend: 30087

### Internal Service URLs (within cluster)
- Frontend: `blueprint-visualizer:3000`
- Backend: `healthchat-backend:8000`

### Resources
- **Requests:** 200m CPU, 256Mi RAM
- **Limits:** 500m CPU, 512Mi RAM
- **Replicas:** 2 (for high availability)

### Health Checks
- **Liveness Probe:** HTTP GET `/` on port 3000 (every 30s)
- **Readiness Probe:** HTTP GET `/` on port 3000 (every 10s)

### HealthChat Integration

The application connects to HealthChat backend using internal cluster service:
- **Backend Service:** `healthchat-backend:8000`
- **Backend NodePort:** `http://10.130.200.141:30087`
- **Connection:** Automatic if HealthChat is deployed in the same namespace

## Troubleshooting

### View Pod Logs

```bash
kubectl logs -f deployment/blueprint-visualizer -n team-romania
```

### View All Pods

```bash
kubectl get pods -n team-romania -l app=blueprint-visualizer
```

### Describe Pod Issues

```bash
kubectl describe pod <pod-name> -n team-romania
```

### Check Application Status

```bash
curl http://10.130.200.141:30038
```

### Restart Deployment

If the application is not working properly:

```bash
kubectl rollout restart deployment/blueprint-visualizer -n team-romania
```

### Check Service Status

```bash
kubectl describe svc blueprint-visualizer -n team-romania
```

### Common Issues

#### 1. Pods Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n team-romania

# Check for image pull errors
kubectl get events -n team-romania --sort-by='.lastTimestamp'
```

#### 2. Application Not Accessible via NodePort

```bash
# Check service status
kubectl get svc blueprint-visualizer -n team-romania

# Verify NodePort is assigned
kubectl describe svc blueprint-visualizer -n team-romania | grep NodePort

# Check service endpoints
kubectl get endpoints blueprint-visualizer -n team-romania

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n team-romania -- curl http://blueprint-visualizer:3000
```

#### 3. HealthChat Integration Not Working

Check if HealthChat backend is accessible:

```bash
# Test connection from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n team-romania -- curl http://healthchat-backend:8000/api/v1/health

# Check HealthChat pods
kubectl get pods -n team-romania -l app=healthchat-backend
```

The HealthChat blueprint will show "Waiting for real-time data" if the backend is not accessible. The other 2 blueprints (LLM Router, Enterprise RAG) work with pre-configured mock data.

## Updating the Application

### Update Frontend

```bash
# Build new image
docker build --platform linux/amd64 \
  --build-arg HEALTHCHAT_BACKEND_URL=http://healthchat-backend:8000 \
  -t 10.130.200.141:5000/blueprint-visualizer:latest .

# Push to registry
docker push 10.130.200.141:5000/blueprint-visualizer:latest

# Force Kubernetes to pull new image
kubectl rollout restart deployment/blueprint-visualizer -n team-romania
```

### Monitor Rollout

```bash
kubectl rollout status deployment/blueprint-visualizer -n team-romania
```

### Rollback if Needed

```bash
kubectl rollout undo deployment/blueprint-visualizer -n team-romania
```

## Scaling

Scale the application based on load:

```bash
# Scale to 3 replicas
kubectl scale deployment/blueprint-visualizer --replicas=3 -n team-romania

# Or use autoscaling
kubectl autoscale deployment blueprint-visualizer --min=2 --max=5 --cpu-percent=80 -n team-romania
```

## Cleanup / Uninstall

### Delete All Resources

```bash
kubectl delete -f k8s/frontend.yaml
```

### Or Delete by Label

```bash
kubectl delete all -l app=blueprint-visualizer -n team-romania
```

## Testing Locally with Docker

### Using Docker Compose

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

Access at: `http://localhost:3000`

### Using Docker Directly

```bash
# Build
docker build --build-arg HEALTHCHAT_BACKEND_URL=http://healthchat-backend:8000 -t blueprint-visualizer .

# Run
docker run -p 3000:3000 blueprint-visualizer
```

## Features

The application includes 3 interactive blueprint visualizations:

1. **LLM Router** - Intelligent query routing to optimal language models
   - Marketing Q&A scenario
   - Technical Support scenario
   - General Query scenario
   - Healthcare Query scenario

2. **Enterprise RAG** - Retrieval-Augmented Generation for enterprise knowledge
   - Product Documentation scenario
   - Policy Inquiry scenario
   - Knowledge Base Query scenario
   - Healthcare Protocol scenario

3. **HealthChat** - Real-time Chain-of-Thought visualization
   - Connects to HealthChat backend if available
   - Shows live CoT steps for healthcare queries
   - Displays real-time LLM processing

## Architecture

```
┌─────────────────┐
│   Browser       │
└────────┬────────┘
         │ HTTP
         ▼
┌──────────────────────────────┐
│  Kubernetes NodePort         │
│  10.130.200.141:30038        │
└─────────┬────────────────────┘
          │
          ▼
┌─────────────────────────┐
│  Blueprint Visualizer   │
│  (Next.js Frontend)     │
│  Port: 3000             │
│  NodePort: 30038        │
│  Replicas: 2            │
└─────────────────────────┘
          │ Internal HTTP
          ▼
┌─────────────────────────┐
│  HealthChat Backend     │
│  Service: healthchat-   │
│  backend:8000           │
│  NodePort: 30087        │
└─────────────────────────┘
```

## Performance

- **Load Time:** ~1-2s for initial page load
- **Animation:** Smooth 60fps animations
- **Memory:** ~50-100MB per pod
- **CPU:** Low usage, spikes during animation rendering

## Security

- All traffic is HTTPS via Nginx Ingress
- No authentication required (public showcase application)
- No sensitive data stored
- Read-only operation (no write access to backend)

## Monitoring

### Check Resource Usage

```bash
kubectl top pod -n team-romania -l app=blueprint-visualizer
```

### View Metrics

```bash
# CPU and Memory
kubectl describe pod <pod-name> -n team-romania | grep -A 5 "Limits:"
```

## Support

For issues or questions:
- Pod logs: `kubectl logs -f <pod-name> -n team-romania`
- Pod events: `kubectl describe pod <pod-name> -n team-romania`
- Service status: `kubectl describe svc blueprint-visualizer -n team-romania`
- Application: `http://10.130.200.141:30038`

## Notes

1. **Standalone Application:** Works independently, no external dependencies required
2. **HealthChat Integration:** Optional, connects to internal cluster service if available
3. **NodePort:** Exposed on port 30038 for external access
4. **Internal Communication:** Uses Kubernetes service DNS for backend connectivity
5. **Replicas:** Configured for 2 replicas for high availability
6. **Health Checks:** Automatic pod restart if application becomes unresponsive
7. **Resource Limits:** Configured for efficient resource usage (200m-500m CPU)
8. **Image Pull Policy:** Set to `Always` to ensure latest version is deployed
9. **Build Time:** Image build takes ~2-3 minutes
10. **Deployment Time:** Full deployment takes ~30-60 seconds
11. **Network:** HTTP only (TLS can be added via reverse proxy if needed)

