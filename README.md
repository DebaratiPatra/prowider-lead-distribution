# Prowider — Mini Lead Distribution System

A full-stack lead generation and distribution system built with Next.js 14, PostgreSQL, and Prisma.

---

## Live Demo

> Add your deployed URL here after deploying to Vercel / Railway / Render.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Next.js API Routes |
| Database | PostgreSQL (via Prisma ORM) |
| Real-Time | Server-Sent Events (SSE) |
| Styling | Custom CSS (no UI framework) |

---

## Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/your-username/prowider-lead-distribution
cd prowider-lead-distribution
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your PostgreSQL connection string:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/prowider?schema=public"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

> **Recommended local setup**: Use [Supabase](https://supabase.com) (free tier) or a local PostgreSQL instance.

### 4. Push schema + seed data

```bash
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run seed             # Insert services, providers, allocation state
```

### 5. Run development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Home — architecture overview |
| `/request-service` | Customer lead submission form |
| `/dashboard` | Real-time provider dashboard |
| `/test-tools` | Webhook testing, bulk leads, idempotency |

---

## Allocation Algorithm

### Rules

| Service | Mandatory | Pool |
|---|---|---|
| Service 1 | Provider 1 | P2, P3, P4 |
| Service 2 | Provider 5 | P6, P7, P8 |
| Service 3 | Provider 1 + Provider 4 | P2, P3, P5, P6, P7, P8 |

Every lead is assigned to **exactly 3 providers**.

### How it works

1. **Mandatory assignment**: The mandatory provider(s) for the selected service are assigned first, provided they have remaining quota. If a mandatory provider's quota is full, they are skipped (graceful degradation).

2. **Fair pool allocation**: The remaining slots (3 − mandatory count) are filled from the service's pool using a **position-based round-robin**:
   - Each pool entry has a `position` integer stored in the `AllocationState` table.
   - Providers are sorted by ascending position — the lowest position goes first.
   - After a provider is selected, their `position` is set to `max(position) + 1`, rotating them to the back of the queue.
   - This state persists in the database, surviving server restarts.

3. **Quota enforcement**: Any provider at `usedQuota >= monthlyQuota` is skipped automatically.

### Why not random?

Random selection is stateless and unfair over time — one provider could receive many more leads than another. Round-robin with DB-persisted position guarantees mathematical fairness across restarts, crashes, and deployments.

---

## Concurrency Handling

All allocation logic runs inside a **Serializable PostgreSQL transaction** combined with a **PostgreSQL advisory lock** (`pg_advisory_xact_lock`) keyed to the service ID.

```
BEGIN SERIALIZABLE
  → pg_advisory_xact_lock(serviceId)  ← blocks other transactions for this service
  → read pool positions
  → assign providers
  → rotate positions
  → increment usedQuota
COMMIT
```

This guarantees:
- No two leads assign the same pool slot simultaneously.
- Quota increments are atomic.
- No phantom reads or write skew.

The advisory lock is per-service, so Service 1 and Service 2 leads can be created concurrently without blocking each other.

---

## Webhook Idempotency

The `/api/webhook` endpoint expects an `Idempotency-Key` header (like Stripe's API).

**Flow:**
1. Check `WebhookEvent` table for the given key.
2. If found → return `{ alreadyProcessed: true }` without re-processing.
3. If not found → insert the key and reset quotas **in the same transaction**.

The key insertion and quota reset are wrapped in a single transaction, so even if two simultaneous requests race, only one will successfully insert the key (the other will hit a unique constraint and be handled gracefully).

```
POST /api/webhook
Headers:
  Idempotency-Key: quota-reset-1234567890

# First call → resets all quotas
# Subsequent calls with same key → returns "already processed"
```

---

## Database Design

```
Service         (id, name)
Provider        (id, name, monthlyQuota, usedQuota)
Lead            (id, name, phone, city, description, serviceId)
                UNIQUE(phone, serviceId)  ← duplicate prevention at DB level
LeadAssignment  (id, leadId, providerId)
                UNIQUE(leadId, providerId)  ← no double-assignment
AllocationState (id, serviceId, providerId, position)
                ← persisted round-robin cursor
WebhookEvent    (id, idempotencyKey, type, processedAt)
                UNIQUE(idempotencyKey)  ← idempotency guard
```

---

## Real-Time Architecture

Server-Sent Events (SSE) over a persistent HTTP connection:

1. Dashboard connects to `/api/sse` → response stays open.
2. When `POST /api/leads` completes, it calls `broadcastUpdate('lead_assigned', data)`.
3. All connected SSE clients receive the event and re-fetch provider data.
4. Cards animate to highlight affected providers.

SSE was chosen over WebSockets for simplicity — it's unidirectional (server → client), which is all we need, and works natively in Next.js without additional infrastructure.

---

## Deployment (Vercel + Supabase)

```bash
# 1. Create a Supabase project at https://supabase.com
# 2. Copy the PostgreSQL connection string (Session mode, port 5432)
# 3. Deploy to Vercel:
vercel deploy

# 4. Add environment variables in Vercel dashboard:
DATABASE_URL=...
NEXT_PUBLIC_BASE_URL=https://your-vercel-url.vercel.app

# 5. Run seed on production:
DATABASE_URL=... node prisma/seed.js
```

---

## What We Evaluated

- ✅ Correct provider allocation (mandatory + fair round-robin)
- ✅ Concurrency safety (serializable tx + advisory locks)
- ✅ Webhook idempotency (DB-level unique key guard)
- ✅ Real-time dashboard (SSE broadcast)
- ✅ Duplicate prevention (DB unique constraint on phone+serviceId)
- ✅ Monthly quota enforcement
- ✅ Persistent allocation state (survives server restart)
"# prowider-lead-distribution" 
