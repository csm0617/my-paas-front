# Enterprise Runtime PaaS UI Design Principles

## Core Positioning

This platform is **NOT** a Kubernetes management platform, nor an Istio management platform.

It is an **Application Runtime Platform**.

The core objective: make developers feel they are managing **business systems, services, versions, releases, and traffic governance** — NOT Deployments, Pods, YAML, or VirtualServices.

---

## Principle 1: Runtime First

Traditional K8s UIs are resource-centric (Deployment, StatefulSet, Service, Ingress). This is an infrastructure perspective, not an application perspective.

Runtime PaaS must be runtime-centric. Users should see:
- Is the service healthy?
- Is the version stable?
- How is traffic distributed?
- Is the release safe?

**UI consequence:** The platform homepage should be **Application Runtime**, not a Deployment List.

---

## Principle 2: Service is Stable

Service is a stable business abstraction representing:
- Stable business name
- Stable access domain
- Stable call relationships
- Stable permission model

Examples: `reviews`, `payment`, `user`

**Revision is what changes.** Example:
```
reviews
  ├── v1
  ├── v2
  └── v3
```

Release ≠ Creating a service. Release = Adding a new Revision to a Service.

This is the biggest difference between an enterprise release platform and a plain K8s UI.

**UI consequence:** The platform must natively support multi-version coexistence. The model `reviews-v1`, `reviews-v2` is WRONG.

---

## Principle 3: Progressive Disclosure

80% of users only need simple capabilities. Therefore, the default must be minimal.

- **Default user** sees: service name, image, replicas, domain
- **Advanced user** expands: health checks, HPA, circuit breaking, rate limiting, mTLS
- **Expert user** sees last: YAML, VirtualService, DestinationRule

---

## Principle 4: Traffic as Product

Traditional platforms treat traffic governance as low-level networking. This is wrong.

Runtime PaaS must treat Traffic as a core product capability because in modern cloud-native: **Release = Traffic Control** (Canary, Blue-Green, A/B Testing are all Traffic Control).

**UI consequence:**
- Traffic must have its own page
- Traffic must be visualized (e.g., `v1 ████████ 80%  v2 ██ 20%`)
- Traffic must be draggable, not `weight: 80`

---

## Principle 5: Release-Centric

Traditional K8s has no release model — only `kubectl apply`. This is a very low-level abstraction.

Enterprise platforms must have a built-in Release model including: create version, health check, gradual rollout, rollback.

**UI consequence:** The platform must have a **Release Page**, not just Deployment YAML.

---

## Principle 6: Observability Native

In traditional platforms, monitoring is bolted on. This is wrong.

Runtime Platform must have built-in observability because release and traffic governance both depend on Metrics, Tracing, and Logs.

**UI consequence:** Every Service, Revision, and Release must natively associate with QPS, Error Rate, P99, Traces, and Logs.

---

## Principle 7: Infrastructure Invisible

Users should NOT care about Deployment, Ingress, Gateway, or VirtualService. Users only care about: service, version, traffic.

Kubernetes is just the Runtime Engine. Istio is just the Governance Engine. Both must hide implementation details.

---

## Principle 8: Everything is Runtime State

All pages should essentially be Runtime State Visualization.

- **Service Page** shows: active versions, current traffic, current health, current error rate
- **Release Page** shows: current release stage, current rollout percentage, current health gate

NOT configuration pages.

---

## Principle 9: Platform as Product

Many platforms fail because they just wrap Kubernetes with a UI layer.

A real platform must feel like a **product** (Vercel, Heroku, AWS AppRunner, Cloudflare), NOT an ops tool (kubectl dashboard).

---

## Principle 10: Multi-Revision Native

Many platforms support canary but the UI still uses single-version thinking. This is wrong.

The correct model: **Multi-Revision is always the normal state.**

The UI must natively support multiple Revisions coexisting under a single Service.

---

## Current Status vs. Target

| # | Principle | Current Status | Target |
|---|-----------|---------------|--------|
| 1 | Runtime First | Homepage is Application List | Runtime Dashboard |
| 2 | Service is Stable | No Revision concept | Service + Revision model |
| 3 | Progressive Disclosure | HPA/Mounts collapsible | Full progressive disclosure |
| 4 | Traffic as Product | Istio in separate step | Independent Traffic page |
| 5 | Release-Centric | No Release Page | Built-in Release workflow |
| 6 | Observability Native | No Metrics/Trace/Log | Native observability |
| 7 | Infrastructure Invisible | YAML still exposed | Full abstraction |
| 8 | Everything is Runtime State | Configuration-style pages | Runtime state visualization |
| 9 | Platform as Product | Basic framework | Product-grade UX |
| 10 | Multi-Revision Native | Single-version model | Multi-version native |
