# Runtime PaaS MVP UI Design

## Core Objective

MVP is NOT the fewest features. It is the **smallest but complete core loop**.

MVP must complete:
1. Create Service
2. Deploy Revision
3. View Runtime Status
4. Release New Revision
5. Canary Traffic
6. Rollback

---

## What MVP Absolutely Does NOT Do

First version must NOT include:
- Complex permissions
- Complex multi-tenancy
- Complex approval workflows
- Complex pipelines
- Complex GitOps
- Complex policy systems
- Complex plugin systems
- Complex config centers
- Complex service catalogs

Only do: **Runtime Core**

---

## MVP Core Model

First version only keeps:

```
Application
  └── Service
        └── Revision
```

Temporarily exclude: Environment, Cluster Federation, Multi Workspace.

---

## MVP Page Structure

Left sidebar (minimal):
- Applications
- Releases
- Monitoring

NOT: Deployment, Pod, Ingress, Gateway

---

## MVP Pages (6 Core Pages)

### 1. Application List

Purpose: View business systems

UI:
```
mall-system
payment-system
```

Actions: Create Application, Enter Application

---

### 2. Application Runtime (Core)

This is the **most important MVP page**.

UI:
```
mall-system

Services: 6    QPS: 12k

Service Grid:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ reviews  │ │ payment  │ │  user    │
│          │ │          │ │          │
│ v1 100%  │ │ v2 100%  │ │ v1 100% │
│ Healthy  │ │ Healthy  │ │ Healthy │
└──────────┘ └──────────┘ └──────────┘
```

Actions per Service Card: View, Release New Version

---

### 3. Create Service (MVP Soul)

Must use: Wizard / Stepper

**Step 1 — Service Info**
- Service Name: `[ reviews ]`
- Service Type: ( ) Internal Service  ( ) Entry Service
- Protocol: HTTP / gRPC / TCP

**Step 2 — Initial Revision**
- Revision: `[ v1 ]`
- Image: Repository / Image / Tag
- Replicas
- Runtime Profile: Small / Medium / Large
- Environment Variables: KEY / VALUE

**Step 3 — Network Access** (only shown for Entry Service)
- Domain
- Path
- HTTPS

**Step 4 — Confirm**
- Summary: reviews / v1 / reviews:v1
- Button: [Create Service]

---

### 4. Service Runtime (MVP Core)

This is the **most important MVP page**.

Header:
```
reviews

QPS: 12k  |  Error: 0.1%  |  Latency: 23ms

[Release New Version]  [Rollback]
```

**Traffic Overview** (MVP must natively support multi-Revision):
```
v1 ████████ 80%
v2 ██       20%
```

**Revision Table:**

| Revision | Image      | Replicas | Traffic | Status |
|----------|-----------|----------|---------|--------|
| v1       | reviews:v1 | 3       | 80%     | Stable |
| v2       | reviews:v2 | 1       | 20%     | Canary |

Actions: Scale, Rollback, Offline

---

### 5. Release Wizard (MVP Highlight)

Header: Release v2 based on v1

**Auto-inherit** (key feature): ports, resources, env vars

User only changes: Tag, Replicas, Traffic

**Release Mode:**
- Rolling
- Canary

Canary:
```
v1 ████████ 90%
v2 ██       10%
```

---

### 6. Monitoring (Simplified)

MVP does NOT build a full observability platform. Only:

**Service Metrics:** QPS, Error Rate, Latency, CPU, Memory

**Logs:** Real-time logs

---

## MVP Backend Model (Core)

Do NOT directly expose: Deployment, VirtualService

Backend must abstract:

**Service:**
```json
{
  "name": "reviews",
  "type": "http"
}
```

**Revision:**
```json
{
  "revision": "v2",
  "image": "reviews:v2",
  "traffic": 20
}
```

**Release:**
```json
{
  "mode": "canary",
  "steps": [10, 50, 100]
}
```

---

## MVP True Core

MVP's true value is NOT deploying containers. It is **Runtime Abstraction**.

User perception must be:
- I am creating a service
- I am releasing a version
- I am controlling traffic

NOT:
- I am creating a Deployment
- I am modifying YAML

---

## MVP Ultimate Goal

First version does ONE thing: **make "releasing a microservice" extremely simple**.

If you achieve: **3 minutes to create service → release v2 → canary 10% → rollback**, your MVP already surpasses most enterprise internal platforms.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Tailwind + shadcn/ui |
| Topology | ReactFlow |
| Table | TanStack Table |
| State | Zustand |
| Charts | ECharts |

---

## Gap Analysis: Current vs. MVP

| Area | Current | MVP Target |
|------|---------|------------|
| Navigation | Deployment/Pod/Ingress/Service lists | Applications / Releases / Monitoring |
| Data Model | Application → Service → Container | Application → Service → Revision |
| Create Flow | DeployModal (flat form) | Create Service Wizard (4 steps) |
| Service View | None | Service Runtime with traffic visualization |
| Release | None | Release Wizard with canary support |
| Monitoring | None | Service Metrics + Logs |
| Traffic | Istio YAML preview | Visual traffic bar (draggable) |
| Revision | Single version only | Multi-version native |
