# HealthChat Kubernetes Deployment Guide

Before deploying to production:
2. Update `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` 
3. Set `DEBUG=False`
4. Configure proper `CORS_ORIGINS` for your NodePort URL
5. Update `NEXT_PUBLIC_API_URL` to your production backend URL

## Prerequisites

- Access to the private Docker registry: `10.130.200.141:5000`
- Access to Kubernetes cluster with `team-romania` namespace
- VPN connection (hatfield-data-center-appliance-cpbvqpctpt.dynamic-m.com) for LLM and Embedding services
- kubectl configured to access the cluster

## Deployment Overview

The application consists of 4 services:
1. **MySQL** (StatefulSet) - Database on port 3306 (internal)
2. **ChromaDB** (StatefulSet) - Vector database on port 8000 (internal)
3. **Backend** (Deployment) - FastAPI service exposed on NodePort 30087
4. **Frontend** (Deployment) - Next.js application exposed on NodePort 30037

## Step 1: Build Docker Images

Build the images from your local machine or a server with fast network connection.

### Build Backend Image

```bash
cd /path/to/case-ai-can-chat
docker build --platform linux/amd64 \
  -t 10.130.200.141:5000/healthchat-backend:latest \
  ./be
```

### Build Frontend Image

**Important:** Frontend needs API URL at build time:

```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=http://10.130.200.141:30087 \
  -t 10.130.200.141:5000/healthchat-frontend:latest \
  ./fe
```

### Notes on image building

If you build the image from Apple Silicon (ARM64) be aware to use the --platform flag accordingly to the Kubernetes nodes which are running on AMD64/x86_64

## Step 2: Push Images to Private Registry

Tag and push both images to the private Docker registry.

```bash
docker push 10.130.200.141:5000/healthchat-backend:latest
docker push 10.130.200.141:5000/healthchat-frontend:latest
```

Apply this in Docker Desktop -> Settings -> Docker engine if you get certificates errors on pushing from your local machine:
```bash
{
  "insecure-registries": ["10.130.200.141:5000"]
}
```

**Note:** If push is slow from your local machine, consider using a server within the same network as the registry.

## Step 3: Deploy to Kubernetes

### Files to Head Node

You can find the deployment manifest files for backend, frontend, chromadb and mysql on cluster inside /Projects/can-chat-deployment.
For documentation purposes, I also let a version of these files on the /k8s folder inside this project. If you want to update anything, please update them here (also push it to GitHub for other developers to see) then SSH to the head node and copy the YAML files from the `k8s/` directory.

### Deploy Services in Order

**Important:** Deploy in this specific order to ensure dependencies are ready.

#### 1. Deploy MySQL

```bash
kubectl apply -f mysql.yaml
```

Wait for MySQL to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=healthchat-mysql -n team-romania --timeout=300s
```

#### 2. Deploy ChromaDB

```bash
kubectl apply -f chromadb.yaml
```

Wait for ChromaDB to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=healthchat-chromadb -n team-romania --timeout=300s
```

#### 3. Deploy Backend

```bash
kubectl apply -f backend.yaml
```

Wait for backend to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=healthchat-backend -n team-romania --timeout=300s
```

#### 4. Deploy Frontend

```bash
kubectl apply -f frontend.yaml
```

Wait for frontend to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=healthchat-frontend -n team-romania --timeout=300s
```

## Step 4: Verify Deployment

### Check All Pods

```bash
kubectl get pods -n team-romania
```

Expected output:
```
NAME                                  READY   STATUS    RESTARTS   AGE
healthchat-mysql-0                     1/1     Running   0          5m
healthchat-chromadb-0                  1/1     Running   0          4m
healthchat-backend-xxxxxxxxxx-xxxxx    1/1     Running   0          3m
healthchat-backend-xxxxxxxxxx-xxxxx    1/1     Running   0          3m
healthchat-frontend-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
healthchat-frontend-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### Check Services

```bash
kubectl get svc -n team-romania
```

Expected output:
```
NAME                  TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
healthchat-mysql      ClusterIP   10.x.x.x         <none>        3306/TCP         5m
healthchat-chromadb   ClusterIP   10.x.x.x         <none>        8000/TCP         4m
healthchat-backend    NodePort    10.x.x.x         <none>        8000:30087/TCP   3m
healthchat-frontend   NodePort    10.x.x.x         <none>        3000:30037/TCP   2m
```

### Check Persistent Volumes

```bash
kubectl get pvc -n team-romania
```

Expected output:
```
NAME                                STATUS   VOLUME              CAPACITY   ACCESS MODES
mysql-data-healthchat-mysql-0        Bound    pvc-xxxxx           10Gi       RWO
chromadb-data-healthchat-chromadb-0  Bound    pvc-xxxxx           5Gi        RWO
```

## Step 5: Access the Application

### Get Node IP

```bash
kubectl get nodes -o wide
```

Note the `INTERNAL-IP` or `EXTERNAL-IP` of any node (e.g., 10.130.200.141).

### Access URLs

- **Frontend:** `http://10.130.200.141:30037`
- **Backend API:** `http://10.130.200.141:30087`
- **Backend Health:** `http://10.130.200.141:30087/api/v1/health`

Open your browser and navigate to the frontend URL to access HealthChat.

## Configuration Details

### Namespace
All resources are deployed in: `team-romania`

### NodePort Allocations
- Frontend: 30037
- Backend: 30087

### Internal Service URLs (within cluster)
- MySQL: `healthchat-mysql:3306`
- ChromaDB: `healthchat-chromadb:8000`
- Backend: `healthchat-backend:8000`

### External Dependencies (Requires VPN)
- LLM: `https://ollama.cc-demos.com` (Nemotron 70B via Ollama) 
! Be aware that inside the cluster, you can access the inference with http://ollama.default.svc.cluster.local:11434 !
- Embeddings: `http://10.130.200.141:30020/v1/embeddings` (NVIDIA NIM)

### Database Credentials
- MySQL User: `healthchat`
- MySQL Password: `healthchat123`
- MySQL Database: `healthchat_db`
- MySQL Root Password: `rootpassword`

## Troubleshooting

### View Pod Logs

Backend logs:
```bash
kubectl logs -f deployment/healthchat-backend -n team-romania
```

Frontend logs:
```bash
kubectl logs -f deployment/healthchat-frontend -n team-romania
```

MySQL logs:
```bash
kubectl logs -f statefulset/healthchat-mysql -n team-romania
```

ChromaDB logs:
```bash
kubectl logs -f statefulset/healthchat-chromadb -n team-romania
```

### Describe Pod Issues

```bash
kubectl describe pod <pod-name> -n team-romania
```

### Check Health Status

```bash
curl http://10.130.200.141:30087/api/v1/health
```

### Restart Deployments

If a service is not working properly:

```bash
kubectl rollout restart deployment/healthchat-backend -n team-romania
kubectl rollout restart deployment/healthchat-frontend -n team-romania
```

### Delete StatefulSet (preserves data)

```bash
kubectl delete statefulset healthchat-mysql -n team-romania
kubectl delete statefulset healthchat-chromadb -n team-romania
```

The PersistentVolumeClaims will remain, so data is preserved when you redeploy.

## Updating the Application

### Update Backend

```bash
# Build new image
docker build -t 10.130.200.141:5000/healthchat-backend:latest ./be

# Push to registry
docker push 10.130.200.141:5000/healthchat-backend:latest

# Force Kubernetes to pull new image
kubectl rollout restart deployment/healthchat-backend -n team-romania
```

### Update Frontend

```bash
# Build new image
docker build -t 10.130.200.141:5000/healthchat-frontend:latest ./fe

# Push to registry
docker push 10.130.200.141:5000/healthchat-frontend:latest

# Force Kubernetes to pull new image
kubectl rollout restart deployment/healthchat-frontend -n team-romania
```

## Cleanup / Uninstall

### Delete All Resources (Preserves PVCs)

```bash
kubectl delete -f k8s/frontend.yaml
kubectl delete -f k8s/backend.yaml
kubectl delete -f k8s/chromadb.yaml
kubectl delete -f k8s/mysql.yaml
```

### Delete Persistent Data (WARNING: Data Loss!)

```bash
kubectl delete pvc -l app=healthchat-mysql -n team-romania
kubectl delete pvc -l app=healthchat-chromadb -n team-romania
```

## Notes

1. **VPN Required:** The application requires VPN access to reach the LLM (Ollama) and Embedding (NIM) services.
2. **StatefulSets:** MySQL and ChromaDB use StatefulSets with persistent volumes. Data survives pod restarts and redeployments.
3. **Init Containers:** Backend deployment includes init containers that wait for MySQL and ChromaDB to be ready before starting.
4. **ChromaDB Connection:** Backend has built-in retry logic (10 attempts, 20 seconds total) to wait for ChromaDB to become ready. No health checks needed for ChromaDB itself.
5. **Health Checks:** MySQL and Backend services have liveness and readiness probes configured for automatic recovery.
5. **Resource Limits:** Resource requests and limits are configured. Adjust in YAML files if needed based on cluster capacity.
6. **Image Pull Policy:** Set to `Always` for backend and frontend to ensure latest images are pulled on each deployment.
7. **Scaling:** To scale backend or frontend:
   ```bash
   kubectl scale deployment/healthchat-backend --replicas=3 -n team-romania
   kubectl scale deployment/healthchat-frontend --replicas=3 -n team-romania
   ```

## Support

For issues or questions, check:
- Pod logs: `kubectl logs -f <pod-name> -n team-romania`
- Pod events: `kubectl describe pod <pod-name> -n team-romania`
- Health endpoint: `http://10.130.200.141:30087/api/v1/health`

