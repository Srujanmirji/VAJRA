# Deploying VAJRA to Vercel (Step-by-Step Guide)

**System:** VAJRA (वज्र) · Multi-Source Convective Nowcasting System (0–6 h)  
**Platform:** Vercel (Serverless Edge + Next.js 14 App Router)  
**GitHub Repository:** [https://github.com/Srujanmirji/VAJRA](https://github.com/Srujanmirji/VAJRA)

---

## 🚀 Quick Deploy (1-Click via Vercel Web Dashboard)

### Step 1: Open Vercel & Import Project
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** → **"Project"**.
3. Under **Import Git Repository**, select `Srujanmirji/VAJRA` (or paste `https://github.com/Srujanmirji/VAJRA.git`).

---

### Step 2: Configure Project Settings

In the **Configure Project** screen:

| Setting | Value | Rationale |
|---|---|---|
| **Framework Preset** | `Next.js` | Automatically detected |
| **Root Directory** | `frontend` *(Click "Edit" and choose `frontend`)* | Tells Vercel where the Next.js app lives |
| **Build Command** | `npm run build` (Default) | Prerenders all static pages & serverless routes |
| **Output Directory** | `.next` (Default) | Next.js output |
| **Install Command** | `npm install` (Default) | Installs dependencies |

> **Tip:** If you leave Root Directory as `./` (the repo root), VAJRA's root [`vercel.json`](../vercel.json) will automatically route the build to the `frontend/` directory. Setting **Root Directory: `frontend`** is the standard Vercel recommended approach.

---

### Step 3: Environment Variables (Optional)

Under **Environment Variables**:
- **Option 1: Standalone Serverless Mode (Zero Config / Recommended for Demo)**  
  Leave environment variables **EMPTY**.  
  VAJRA will run completely standalone using its built-in Next.js Serverless Route Handlers (`/api/v1/...`) on Vercel. All radar maps, storm cell tracking, arrival countdowns, hazard engines, and CAP 1.2 alerts will work 100% interactively without requiring any external server!

- **Option 2: Hybrid Mode (Connected to External Python FastAPI Backend)**  
  If you have deployed the Python backend to Render, Railway, Fly.io, or AWS:
  - Key: `NEXT_PUBLIC_API_URL`
  - Value: `https://your-vajra-backend.onrender.com`

---

### Step 4: Click Deploy!
Click **"Deploy"**. Vercel will build the project in ~45 seconds and give you a live production URL:
```
https://vajra-ind.vercel.app
```

---

## 💻 Alternative: Deploying via Vercel CLI

If you have the Vercel CLI installed on your terminal:

```bash
# 1. Install Vercel CLI globally (if not already installed)
npm install -g vercel

# 2. Navigate to the frontend directory
cd frontend

# 3. Log in to Vercel
vercel login

# 4. Deploy directly to production
vercel --prod
```

The CLI will prompt you to link your project and output your live deployment URL instantly.

---

## ⚡ What Works on the Vercel Deployment

When deployed on Vercel, the application includes:
1. **Overview Landing Page (`/`):** Hero section, 3-source fusion architecture, honest lead-time bands, live Recharts verification skill curves, and end-to-end pipeline diagrams.
2. **Forecaster Mission Control Console (`/console`):**
   - High-performance raster radar canvas overlay with SVG storm track vectors and 15/30/45/60 min uncertainty ellipses.
   - Lead time scrubber (0–360 min) with dynamic confidence degradation.
   - Active convective cells panel with real-time dBZ sparklines and trend indicators.
   - Live location arrival countdowns with calibrated arrival windows and probabilities (e.g. Kolkata NSCBI Airport, Howrah, Haldia).
   - Multi-hazard tabs: Hail (Waldvogel POH/MESH), Downburst (Doppler divergence dipole), Cloudburst (IMD $\ge 100\text{ mm/h}$ over $\ge 20\text{ km}^2$), and Schultz $2\sigma$ lightning jump.
   - OASIS CAP 1.2 XML alerts with forecaster approval sign-off and multi-lingual templates (English, Hindi, Bengali, Kannada).
3. **Interactive Scientific Methodology (`/method`):**
   - Live 0–6 h lead-time blending slider calculating real-time sigmoid observation-to-NWP weight transitions.
   - Plain-language hazard diagnostic formulas and sensor specifications.
   - Explicit scientific limitations documentation.
4. **Pipeline Health & Replay Controls (`/status`):**
   - Stage-by-stage timing budget telemetry vs 60 s SLA.
   - Multi-sensor ingest health chips (DWR, MOSDAC INSAT, Lightning stream, NWP).
   - Step, play, pause, and speed multiplier (1x, 5x, 10x, 30x, 60x) replay controls.
