#!/bin/bash

# Konfiguracja
PROJECT_ID="okazje-plus"
REGION="europe-west1"
VPC_CONNECTOR_NAME="redis-connector"
REDIS_INSTANCE_NAME="okazje-plus-cache"
NETWORK="default"

echo "🚀 Rozpoczynam konfigurację Redis (Memorystore) dla projektu: $PROJECT_ID w regionie $REGION"

# 1. Włączanie API
echo "📦 Włączanie wymaganych API..."
gcloud services enable \
    redis.googleapis.com \
    vpcaccess.googleapis.com \
    servicenetworking.googleapis.com \
    compute.googleapis.com \
    --project=$PROJECT_ID

# 2. Tworzenie VPC Connector (dla komunikacji Cloud Run <-> Redis)
echo "🌐 Sprawdzanie VPC Connectora..."
if gcloud compute networks vpc-access connectors describe $VPC_CONNECTOR_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "✅ VPC Connector '$VPC_CONNECTOR_NAME' już istnieje."
else
    echo "item Tworzenie VPC Connectora '$VPC_CONNECTOR_NAME'..."
    gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
        --network=$NETWORK \
        --region=$REGION \
        --range="10.8.0.0/28" \
        --project=$PROJECT_ID
fi

# 3. Tworzenie instancji Redis
echo "💾 Sprawdzanie instancji Redis..."
if gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "✅ Instancja Redis '$REDIS_INSTANCE_NAME' już istnieje."
else
    echo "item Tworzenie instancji Redis '$REDIS_INSTANCE_NAME' (Tier: BASIC, Size: 1GB)..."
    gcloud redis instances create $REDIS_INSTANCE_NAME \
        --size=1 \
        --region=$REGION \
        --tier=BASIC \
        --redis-version=redis_6_x \
        --network=$NETWORK \
        --connect-mode=DIRECT_PEERING \
        --project=$PROJECT_ID
fi

# 4. Pobieranie IP
echo "🔍 Pobieranie IP Redisa..."
REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(host)")
REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(port)")
REDIS_URL="redis://$REDIS_HOST:$REDIS_PORT"

echo ""
echo "🎉 ZAKOŃCZONO SUKCESEM!"
echo "===================================================="
echo "🏠 VPC Connector: projects/$PROJECT_ID/locations/$REGION/connectors/$VPC_CONNECTOR_NAME"
echo "🔗 Redis IP:      $REDIS_HOST"
echo "🔌 Redis Port:    $REDIS_PORT"
echo "🔗 REDIS_URL:     $REDIS_URL"
echo "===================================================="
echo ""
echo "⚠️  AUTOMATYCZNA AKTUALIZACJA apphosting.yaml trwałaby ryzykownie długo w skrypcie shellowym."
echo "👉 Proszę ręcznie dodaj poniższą sekcję do apphosting.yaml:"
echo ""
echo "env:"
echo "  - variable: REDIS_URL"
echo "    value: $REDIS_URL"
echo "    availability:"
echo "      - RUNTIME"
echo ""
echo "runConfig:"
echo "  network:"
echo "    vpcAccess:"
echo "      connector: projects/$PROJECT_ID/locations/$REGION/connectors/$VPC_CONNECTOR_NAME"
echo "      egress: ALL_TRAFFIC"
echo ""
