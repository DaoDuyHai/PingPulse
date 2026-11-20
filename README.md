# ⚡ PingPulse — High-Performance Uptime & Incident Monitoring Service

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-FF4438?style=for-the-badge&logo=redis&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-84%20Passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**An enterprise-grade, event-driven Uptime and Incident Monitoring platform engineered for high-throughput, sub-millisecond status dispatch, and fault-tolerant background scheduling.**

[Key Features](#-architectural-highlights) • [Architecture](#-system-architecture) • [Benchmarks](#-performance-benchmarks-autocannon) • [Quick Start](#-quick-start) • [Testing](#-testing--quality-assurance)

</div>

---

## 🌟 Executive Overview

**PingPulse** is an asynchronous monitoring engine designed to track website availability, latency metrics, and operational incidents at scale. Rather than relying on naive blocking API requests, PingPulse enforces a decoupled **Producer-Consumer architecture** using **BullMQ** and **Redis**, backed by **PostgreSQL** query optimizations, pure functional state transitions, and in-memory Cache-Aside acceleration.

### 🎯 Key Engineering Pillars
- **Decoupled Asynchronous Processing:** Express API processes zero network I/O requests directly. All HTTP ping operations are offloaded to an isolated background worker pool running in a dedicated OS process.
- **Data Integrity & Consistency:** Pure state machine (`decideIncident`) evaluates downtime patterns; state changes, check logs, and incidents are committed atomically via PostgreSQL ACID transactions.
- **High-Throughput Caching:** Public status pages leverage a Redis Cache-Aside layer with active invalidation, delivering a **~2.84x throughput boost (3,365 req/s)** and **55% lower p99 latency (17ms)**.
- **Industrial Rate Limiting:** Sliding-window rate limiter powered by atomic Redis Lua scripts (`INCR` + `EXPIRE` + `TTL`) returning standard IETF rate-limit headers with fail-open fallback.

---

## 🏗️ System Architecture

PingPulse separates API ingestion from background network pinging across isolated Node.js Event Loops:

```mermaid
flowchart TD
    Client["🌐 Client / DevOps Dashboard"] -->|REST API Requests| API["⚡ Express API Process (Port 5000)"]
    
    subgraph Ingestion_Layer["1. Ingestion & Orchestration Layer"]
        API -->|CRUD & Metadata| DB[("🐘 PostgreSQL (Prisma ORM)")]
        API -->|Upsert Job Schedulers| Queue["📬 BullMQ Queue (monitor-checks)"]
        API -->|Sliding-Window Rate Limit| RedisCache[("⚡ Redis 7 (In-Memory Data Store)")]
    end

    subgraph Background_Worker["2. Independent Worker Process (src/worker.ts)"]
        Queue -->|Fetch Jobs - concurrency: 5| Worker["⚙️ BullMQ Worker Engine"]
        Worker -->|HTTP Ping (Non-blocking I/O)| Target["🌍 External Targets (Internet)"]
        Worker -->|Pure Evaluation| Brain["🧠 decideIncident() State Machine"]
        Brain -->|Atomic Commit (ACID)| DB
        Brain -->|Bust Stale Cache| RedisCache
    end

    subgraph Public_Status["3. High-Throughput Public Status Page"]
        Visitor["👥 Public Traffic / Consumers"] -->|GET /api/status/:slug| CacheCheck{"Redis Cache Hit?"}
        CacheCheck -->|YES (2ms)| ReturnCache["⚡ Return JSON from RAM"]
        CacheCheck -->|NO (Cache Miss)| ReadDB["🐘 Query Postgres + Set Redis (TTL 30s)"]
    end
```

---

## 🚀 Architectural Highlights

### 1. Multi-Process Background Worker & Repeatable Schedulers
* **Process Decoupling:** The API server (`src/index.ts`) handles authentication, validation, and scheduler registration in `< 10ms`. Heavy network ping I/O is delegated to `src/worker.ts`.
* **Repeatable Job Schedulers:** Uses BullMQ's modern `upsertJobScheduler` to trigger checks dynamically based on each monitor's configured `interval_sec`. Schedulers automatically sync when monitors are created, interval-updated, or deleted—preventing "ghost check" jobs.
* **Controlled Concurrency:** Configured with `concurrency: 5` to process up to 5 concurrent target pings without saturating network sockets or exhausting DB connection pools.
* **Graceful Shutdown:** Intercepts `SIGINT` / `SIGTERM` to drain active jobs safely before closing Redis and Database socket connections.

### 2. Pure State Machine & ACID Transaction Guarantees
* **Deterministic Decision Logic:** Incident transitions are evaluated by `decideIncident(recentChecks, hasOpenIncident)`—a zero-dependency pure function verified by comprehensive edge-case tests.
  - **Open incident:** Triggered on **3 consecutive failed checks**.
  - **Resolve incident:** Triggered on **2 consecutive successful checks**.
* **ACID Transactions (`prisma.$transaction`):** Check insertion, monitor status updates (`up` / `down`), and incident record operations occur atomically. Zero risk of phantom states or inconsistent dashboards.

### 3. Database Optimization & Index Engineering
* **Composite B-Tree Indexes:** High-volume time-series queries utilize composite index `(monitor_id, checked_at DESC)` for instantaneous index scans.
* **LATERAL JOIN Optimization:** Eliminated N+1 query bottlenecks when retrieving monitors with their latest check, extracting top-1 records in a single query pass.
* **Cursor-Based Pagination:** Replaced offset-based pagination with `WHERE id < :cursor ORDER BY id DESC LIMIT :limit`, guaranteeing $O(1)$ sub-millisecond retrieval regardless of page depth.

### 4. Atomic Rate Limiting (Redis Lua)
* Sliding-window rate limiter executed atomically inside Redis via a single Lua script (`INCR` + `EXPIRE` + `TTL`), eliminating race conditions and minimizing network round-trips.
* Injects standard IETF headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on `429 Too Many Requests`.
* **Fail-Open Strategy:** If Redis experiences downtime, the middleware gracefully logs warnings and allows requests to pass through, preserving system availability.

---

## 📊 Performance Benchmarks (Autocannon)

Public status page throughput was benchmarked under heavy synthetic load using **Autocannon** (30 concurrent connections over 5 seconds):

| Metric | 🐘 Direct Database (Postgres) | ⚡ Cache-Aside (Redis RAM) | Improvement |
| :--- | :---: | :---: | :---: |
| **Throughput (Requests/sec)** | **1,185 req/s** | **3,365 req/s** | 🚀 **+184% (~2.84x)** |
| **Total Requests Handled** | 5,926 requests | **16,820 requests** | **+10,894 requests** |
| **Average Latency** | 24.85 ms | **8.42 ms** | 🎯 **~3x Faster** |
| **p99 Latency** | 38.00 ms | **17.00 ms** | ⚡ **55% Latency Reduction** |
| **Success Rate (2xx)** | 100% (0 errors) | 100% (0 errors) | **Zero Dropped Requests** |

> **Conclusion:** Active cache invalidation guarantees zero stale data, while Redis in-memory acceleration shields PostgreSQL from 95%+ of read traffic during traffic spikes or outage storms.

---

## 📂 Project Structure

```text
PingPulse/
├── backend/
│   ├── src/
│   │   ├── checker/              # Network ping engine (checkUrl)
│   │   ├── config/               # Database (Prisma), Redis, and Pino logger
│   │   ├── controllers/          # Express route controllers (Monitors, Status, Users)
│   │   ├── incident/             # Pure functional state machine (decideIncident)
│   │   ├── middlewares/          # Auth JWT & Redis Lua Rate Limiter
│   │   ├── queues/               # BullMQ queue producer definitions
│   │   ├── routes/               # API endpoint route declarations
│   │   ├── tests/                # 84 automated Vitest test cases
│   │   ├── utils/                # Pure utility functions (pick, omit, chunk, retry)
│   │   ├── workers/              # BullMQ worker processor (checkProcessor)
│   │   ├── worker.ts             # Standalone background worker process
│   │   └── index.ts              # API server entrypoint (Express)
│   ├── prisma/
│   │   └── schema.prisma         # Database schema, relations, & indexes
│   └── package.json
├── docker-compose.yml            # Multi-container orchestration (PostgreSQL 16 & Redis 7)
├── devlog.md                     # Comprehensive backend engineering journal (8 sections)
├── REPORT_WEEK5.md               # Autocannon load testing benchmark report
└── README.md
```

---

## 🛠️ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [Docker](https://www.docker.com/) & Docker Compose
- `npm`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/DaoDuyHai/PingPulse.git
cd PingPulse/backend
npm install
```

### 2. Launch Infrastructure (Docker Compose)
Start PostgreSQL 16 and Redis 7 containers:
```bash
# In project root
docker compose up -d
```

### 3. Configure Environment Variables
Create `.env` in `backend/`:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pingpulse_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-secret-jwt-key"
NODE_ENV="development"
```

### 4. Run Database Migrations
```bash
cd backend
npx prisma migrate dev
```

### 5. Launch the Platform
In **Terminal 1** (API Server):
```bash
npm run dev
# Server running at http://localhost:5000
```

In **Terminal 2** (Background Worker Process):
```bash
npm run worker
# Worker initialized with concurrency: 5
```

---

## 🧪 Testing & Quality Assurance

PingPulse enforces strict automated testing across unit, integration, and concurrency scenarios with **100% pass rate**:

```bash
cd backend
npm test
```

### Test Suite Coverage (17 Files / 84 Passing Tests):
- **Core Logic:** Pure state machine edge cases (`decideIncident`), backoff retry, debouncing, and collection utilities.
- **Database & Indices:** Prisma queries, cursor pagination, and composite index traversal.
- **Redis Cache & Rate Limiter:** Cache-Aside lifecycle, active invalidation, and Lua sliding-window rate limit enforcement.
- **Queue & Worker Engine:** BullMQ job scheduling, repeatable scheduler lifecycle, and graceful worker failure handling.

---

## 👤 Author

**Dao Duy Hai**  
- **Role:** Backend Developer  
- **Email:** haicoder.journey@gmail.com  
- **GitHub:** [@DaoDuyHai](https://github.com/DaoDuyHai)  
- **Institution:** Posts and Telecommunications Institute of Technology (PTIT)
