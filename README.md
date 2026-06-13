# Real-Time Video Support Platform

A high-performance, real-time customer support platform enabling visual calls, persistent chat, file sharing, recording, observability dashboards, and admin control. Built entirely on self-hosted infrastructure.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, TailwindCSS, Zustand (State), TanStack React Query (Fetching), Socket.IO Client, LiveKit Client SDK.
- **Backend:** NestJS, TypeScript, Socket.IO, Prisma ORM, LiveKit Server SDK.
- **Database:** PostgreSQL.
- **Caching & Presence:** Redis.
- **Media Layer:** Self-Hosted LiveKit SFU ( Selective Forwarding Unit).
- **Object Storage:** MinIO (S3-compatible, for files and recordings).
- **Observability:** Prometheus, Grafana, Loki.

---

## 📁 Project Structure

```text
apps/
  api/                    # NestJS Backend API
  web/                    # Next.js 15 Frontend Client
packages/
  db/                     # Shared Prisma Schema and Database Client
  shared/                 # Shared types, DTO schemas, and socket events
infrastructure/
  docker/                 # Dockerfiles for production builds
  docker-compose.yml      # Backing services orchestration
  kubernetes/             # Kubernetes deployment manifests
  livekit/                # LiveKit SFU media server configurations
  prometheus/             # Metrics scraping configs
  loki/                   # Loki log configuration
```

---

## 🚀 Getting Started

### 1. Requirements
- Node.js (v20+)
- Docker and Docker Compose

### 2. Setup Backing Infrastructure
Orchestrate Postgres, Redis, LiveKit, MinIO, Prometheus, Grafana, and Loki using Docker Compose:
```bash
docker-compose -f infrastructure/docker-compose.yml up --build -d
```

### 3. Install Workspace Dependencies
Run this in the root folder of the repository:
```bash
npm install
```

### 4. Build Database Layer & Seed Users
Compile the database models and run the seeding script to populate testing accounts:
```bash
# Generate Prisma Client
npm run prisma:generate -w @vsp/db

# Apply database migration
npm run prisma:migrate -w @vsp/db

# Seed Admin & Agent accounts
npm run db:seed -w @vsp/db
```

### 5. Launch Application in Development Mode
Start both NestJS API and Next.js frontend concurrently:
```bash
npm run dev
```

- **Next.js Web Client:** `http://localhost:3000`
- **NestJS REST & Socket API:** `http://localhost:4000`
- **MinIO Console:** `http://localhost:9001` (user: `minioadmin` / pass: `minioadminpassword`)
- **Grafana Dashboards:** `http://localhost:3001`

---

## 🔑 Seeded Credentials

- **Admin Account:**
  - **Email:** `admin@vsp.com`
  - **Password:** `AdminPass123!`
  
- **Agent Account:**
  - **Email:** `agent@vsp.com`
  - **Password:** `AgentPass123!`
