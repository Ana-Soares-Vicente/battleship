#!/bin/bash
set -e

echo "======================================"
echo "  BATTLESHIP - Deploy no Kubernetes"
echo "======================================"

# Caminho do projeto (acessível via WSL)
PROJECT_DIR="/mnt/c/Users/avicente/Documents/battleship"
K8S_DIR="$PROJECT_DIR/k8s"
API_DIR="$PROJECT_DIR/battleship-api"

# 1. Deletar cluster antigo se existir e criar novo com porta mapeada
echo ""
echo "[1/7] Configurando cluster kind..."
if kind get clusters 2>/dev/null | grep -q "kind"; then
    echo "  Cluster 'kind' já existe. Deletando..."
    kind delete cluster
fi

cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
EOF

echo "  Cluster criado com sucesso!"

# 2. Instalar NGINX Ingress Controller
echo ""
echo "[2/7] Instalando NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "  Aguardando Ingress Controller ficar pronto..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# 3. Buildar imagem Docker do backend
echo ""
echo "[3/7] Buildando imagem Docker do backend..."
cd "$API_DIR"
docker build -t battleship-api:latest .

# 4. Carregar imagem no cluster kind
echo ""
echo "[4/7] Carregando imagem no cluster kind..."
kind load docker-image battleship-api:latest

# 5. Aplicar manifests do namespace e PostgreSQL
echo ""
echo "[5/7] Aplicando manifests do PostgreSQL..."
kubectl apply -f "$K8S_DIR/namespace.yaml"
kubectl apply -f "$K8S_DIR/postgres-secret.yaml"
kubectl apply -f "$K8S_DIR/postgres-pvc.yaml"
kubectl apply -f "$K8S_DIR/postgres-deployment.yaml"
kubectl apply -f "$K8S_DIR/postgres-service.yaml"

echo "  Aguardando PostgreSQL ficar pronto..."
kubectl wait --namespace battleship \
  --for=condition=ready pod \
  --selector=app=postgres \
  --timeout=120s

# 6. Aplicar manifests do backend
echo ""
echo "[6/7] Aplicando manifests do backend..."
kubectl apply -f "$K8S_DIR/backend-deployment.yaml"
kubectl apply -f "$K8S_DIR/backend-service.yaml"

echo "  Aguardando backend ficar pronto..."
kubectl wait --namespace battleship \
  --for=condition=ready pod \
  --selector=app=battleship-api \
  --timeout=180s

# 7. Aplicar Ingress
echo ""
echo "[7/7] Aplicando Ingress..."
kubectl apply -f "$K8S_DIR/ingress.yaml"

# Resultado final
echo ""
echo "======================================"
echo "  DEPLOY COMPLETO!"
echo "======================================"
echo ""
echo "Pods rodando:"
kubectl get pods -n battleship
echo ""
echo "Services:"
kubectl get svc -n battleship
echo ""
echo "Ingress:"
kubectl get ingress -n battleship
echo ""
echo "--------------------------------------"
echo "Para acessar a aplicação, adicione ao"
echo "arquivo C:\\Windows\\System32\\drivers\\etc\\hosts:"
echo ""
echo "  127.0.0.1 battleship.local"
echo ""
echo "Depois acesse: http://battleship.local"
echo "--------------------------------------"
