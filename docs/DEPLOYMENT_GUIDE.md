# VAJRA Systems Engineering & Production Deployment Guide

**Target Environment:** Linux (Ubuntu 22.04 LTS / RHEL 9 / Rocky Linux 9)  
**System Architecture:** Asynchronous Microservices (FastAPI Engine + Next.js 14 Frontend)  
**Sponsor:** NCMRWF / Ministry of Earth Sciences (MoES)

---

## 1. Hardware & System Requirements

### 1.1 Regional Meteorological Centre (Single Radar Node)
- **CPU:** 8-core x86_64 processor (Intel Xeon Silver / AMD EPYC)
- **RAM:** 32 GB DDR4/DDR5 ECC RAM
- **GPU (Optional but Recommended):** 1x NVIDIA RTX 4000 / A4000 (16 GB VRAM) for accelerated PyTorch ML U-Net inference
- **Storage:** 500 GB NVMe SSD for fast HDF5 I/O and rolling 7-day circular buffer
- **Network:** 100 Mbps dedicated link to radar site and MOSDAC gateway

### 1.2 National Mosaic Hub (37+ Radar Multi-Node)
- **CPU:** 32-core dual-socket server
- **RAM:** 128 GB ECC RAM
- **GPU:** 2x NVIDIA A100 / L40S (48 GB VRAM)
- **Storage:** 4 TB NVMe SSD in RAID-10 for nationwide 1 km grid mosaics

---

## 2. Linux OS Prerequisites & Native Dependencies

On Ubuntu 22.04 LTS:
```bash
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    python3-dev \
    python3-pip \
    python3-venv \
    libhdf5-dev \
    libnetcdf-dev \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    curl \
    git \
    nodejs \
    npm
```

---

## 3. Deployment via Docker Compose (Recommended)

VAJRA includes production-ready Docker containers for both backend and frontend.

### 3.1 Clone & Launch
```bash
git clone https://github.com/Srujanmirji/VAJRA.git
cd VAJRA

# Build and start services in background
docker compose up -d --build

# View container logs
docker compose logs -f
```

### 3.2 Services & Ports
- **Backend API:** `http://localhost:8000` (FastAPI with OpenAPI docs at `/docs`)
- **Frontend Dashboard:** `http://localhost:3000` (Next.js 14 Mission Control at `/console`)
- **WebSocket Gateway:** `ws://localhost:8000/ws/cycle`

---

## 4. Ingest Configuration & Network Adapters

The system configuration is stored in `backend/app/config.py` and environment variables.

### 4.1 Ingest Directories
Configure incoming directories for real radar and satellite feeds:
```bash
# Environment variables (.env)
VAJRA_DATA_MODE=LIVE
RADAR_INGEST_DIR=/var/data/vajra/incoming/radar
MOSDAC_INGEST_DIR=/var/data/vajra/incoming/mosdac
LIGHTNING_STREAM_URL=wss://lightning.imd.gov.in/stream
NWP_FILE_PATH=/var/data/vajra/nwp/latest_hrrr.nc
```

### 4.2 Ingest File Formats
1. **Radar Scans:** Must adhere to WMO ODIM HDF5 version 2.2+ with dataset groups:
   - `/dataset1/data1/data` (Reflectivity $Z$)
   - `/dataset1/data2/data` (Radial Velocity $V$)
2. **INSAT Satellites:** ISRO MOSDAC HDF5 format:
   - `/IMG_TIR1` (Thermal Infrared 10.8 µm radiance counts)
3. **NWP Models:** CF-1.8 compliant NetCDF-4 grids containing surface precipitation rate.

---

## 5. Kubernetes Helm / Manifest Deployment (National Scaled)

For high-availability multi-region cluster deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vajra-backend
  namespace: weather-nowcast
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vajra-backend
  template:
    metadata:
      labels:
        app: vajra-backend
    spec:
      containers:
      - name: api
        image: ghcr.io/srujanmirji/vajra-api:latest
        ports:
        - containerPort: 8000
        resources:
          limits:
            cpu: "4"
            memory: 8Gi
            nvidia.com/gpu: 1
          requests:
            cpu: "2"
            memory: 4Gi
        volumeMounts:
        - name: radar-feed
          mountPath: /var/data/vajra/incoming
      volumes:
      - name: radar-feed
        nfs:
          server: nfs.imd.gov.in
          path: /exports/dwr_volumes
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vajra-frontend
  namespace: weather-nowcast
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vajra-frontend
  template:
    metadata:
      labels:
        app: vajra-frontend
    spec:
      containers:
      - name: web
        image: ghcr.io/srujanmirji/vajra-web:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.vajra.imd.gov.in"
```

---

## 6. Security & CAP Cryptographic Sign-Off

1. **Authentication:** All administrative actions (e.g. `/api/v1/alerts/{id}/approve`) require a valid forecaster JSON Web Token (JWT) bearing the role `ROLE_IMD_DUTY_FORECASTER`.
2. **Audit Logging:** Every alert approval or rejection is logged with forecaster ID, client IP address, and SHA-256 hash of the generated CAP XML.
3. **NDMA Gateway Security:** Communications with the NDMA SACHET gateway use mTLS (Mutual TLS 1.3) with client certificates issued by the National Informatics Centre (NIC).
