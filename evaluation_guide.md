# Real-Time Video Support Platform — Evaluation Guide

This document contains the default login credentials and the system architecture diagram for evaluating the standalone local video support platform.

---

## 1. Evaluation Login Credentials

These credentials are pre-seeded into your local SQLite database:

### 👤 Support Agent (For testing support calls)
* **Email:** `agent@vsp.com`
* **Password:** `AgentPass123!`

### ⚙️ System Administrator (For dashboard monitoring)
* **Email:** `admin@vsp.com`
* **Password:** `AdminPass123!`

---

## 2. System Architecture Diagram (Standalone Fallback Mode)

This diagram shows how components communicate locally without Docker:

```mermaid
graph TD
    %% Styling
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef server fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef storage fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;

    %% Nodes
    C1["Next.js Web Client (Port 3000)"]:::client
    API["NestJS Backend API (Port 4000)"]:::server
    SocketIO["Socket.IO Server (Gateway)"]:::server
    DB[("SQLite Database<br>(packages/db/prisma/dev.db)")]:::storage
    FS[("Local Disk Fallback<br>(apps/api/uploads/)")]:::storage
    MemoryCache[("In-Memory Presence Cache<br>(Local Map Store)")]:::storage

    %% Connections
    C1 -->|"HTTP Requests (JSON Auth)"| API
    C1 <-->|"WebSocket Connection"| SocketIO
    API -->|"Prisma Client"| DB
    API -->|"Local Uploads / Downloads"| FS
    SocketIO -->|"Active Session State"| MemoryCache
    
    %% Fallback annotation
    subgraph Self-Healing Webcam Loopback [Media Server Offline Fallback]
        C1 -.->|"getUserMedia Loopback"| C1
    end
```

### Flow Explanation:
1. **Authentication**: Next.js client authenticates using JWT credentials. Token checks are processed natively by NestJS.
2. **Database Calls**: Schema matches and queries resolve to the local SQLite database client.
3. **Presence Cache**: Socket.IO maps user join/leave/reconnect rooms to a memory-based cache, avoiding Redis server requirements.
4. **File sharing**: Image/PDF attachments uploaded inside chat are saved directly inside `apps/api/uploads/` on your computer.
5. **RTC Media Loopback**: When the media server is offline, the client renders the local webcam stream side-by-side to simulate a call.
