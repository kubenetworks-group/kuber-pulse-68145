# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (React)
```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run lint       # ESLint check
npm run preview    # Preview production build
```

### Go Agent
```bash
cd agent
go run main.go                         # Run locally
go build -o kodo-agent .               # Build binary
./scripts/build-and-push.sh <version>  # Build Docker image and push (e.g. v0.1.79)
./scripts/deploy.sh                    # Deploy/redeploy to Kubernetes
./scripts/update-secret.sh <API_KEY> <CLUSTER_ID>  # Update API key secret
```

Agent env vars for local dev:
```bash
export API_ENDPOINT=http://localhost:54321/functions/v1
export API_KEY=your-dev-key
export CLUSTER_ID=test-cluster
```

### Supabase Edge Functions
Functions are deployed to Supabase; edit files under `supabase/functions/<name>/index.ts`. Each function is a Deno script. Functions listed under `verify_jwt = false` in `supabase/config.toml` are publicly callable (used by the Go agent). Agent-facing functions: `agent-receive-metrics`, `agent-get-commands`, `agent-update-command`, `agent-retry-failed-commands`, `agent-report-startup`, `agent-check-update`.

## Architecture

### System Overview

Kodo is a SaaS platform for AI-powered Kubernetes cluster management. It has three main components:

1. **React Frontend** (`src/`) — dashboard UI built with Vite + React + TypeScript + shadcn-ui + Tailwind CSS
2. **Supabase Backend** (`supabase/`) — PostgreSQL database + Deno Edge Functions as the API layer
3. **Go Agent** (`agent/`) — lightweight Go binary deployed inside each customer's Kubernetes cluster; version `v0.1.78` as of the latest release

### Data Flow (Auto-Heal Pipeline)

```
Go Agent → agent-receive-metrics (Edge Fn)
        → stores metrics + triggers anomaly detection
        → auto-heal-continuous (Edge Fn) evaluates pod health
        → queues remediation commands in DB
Go Agent ← agent-get-commands polls for pending commands
        → executes restart/scale on cluster
        → agent-update-command reports result back
```

The agent polls for commands every 15–30 seconds. Command types include pod restarts and deployment scaling.

### React App Structure

**Context hierarchy** (wrap order in `App.tsx`):
`QueryClientProvider → AuthProvider → SessionGuard → SubscriptionProvider → ClusterProvider`

- `AuthContext` — Supabase session with Google OAuth support; detects session expiry vs. manual sign-out
- `ClusterContext` — globally selected cluster (`selectedClusterId`); auto-selects first cluster on load
- `SubscriptionContext` — plan/limits enforcement

**Routing**: All app routes require `<ProtectedRoute>`. Admin routes use `<AdminProtectedRoute>`. Public routes: `/`, `/sobre`, `/auth`, `/diagnostico`, `/blog/*`, `/plans`, `/terms`, `/privacy`.

**Path alias**: `@/` maps to `src/`.

**i18n**: `pt-BR` (default), `en-US`, `es-ES` via react-i18next. Translations live in `src/i18n/locales/`.

**Data fetching**: TanStack Query + Supabase client (`src/integrations/supabase/client.ts`). The Supabase client uses dual storage (localStorage + sessionStorage) for session persistence.

### Supabase Edge Functions

Functions in `supabase/functions/` are standalone Deno scripts. The `_shared/` directory contains utilities shared across functions. Functions that need the service role key (admin operations) use `SUPABASE_SERVICE_ROLE_KEY` from Deno env.

### Go Agent Details

Single-file agent in `agent/main.go`. Uses `client-go` to interact with Kubernetes API. Key behaviors:
- Collects CPU/memory, pod status, node health, events, and PVC usage every 15–30s
- PVC usage uses Kubelet Stats API first; falls back to `df` exec inside containers (cached 5 min, max 10 exec calls per cycle, skips system namespaces and distroless containers)
- Authenticates to Supabase via `x-agent-key` header (SHA-256 hashed and matched in DB)
- Receives and executes remediation commands (pod delete/restart, deployment scale)

Agent version constant is at the top of `agent/main.go`: `const AgentVersion = "v0.x.xx"` — increment before each release.

### Design System

Dark-first UI. Brand accent: `#00E5A0` (terminal green). Design tokens documented in `DESIGN.md`. Components use shadcn-ui with Tailwind; custom theme overrides in `src/index.css`.
