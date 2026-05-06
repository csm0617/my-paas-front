# PaaS Console Code Wiki

## 目录

- [项目概述](#项目概述)
- [技术架构](#技术架构)
- [目录结构](#目录结构)
- [核心模块说明](#核心模块说明)
- [关键数据流](#关键数据流)
- [API 契约](#api-契约)
- [环境配置](#环境配置)
- [本地开发](#本地开发)
- [依赖说明](#依赖说明)

---

## 项目概述

### 定位

PaaS Console 是一个面向 Kubernetes 的 PaaS 平台管理前端（React SPA），提供以下核心能力：

- **应用管理**：创建、发布、停止、启动、重启、回滚、扩缩容
- **Kubernetes 资源管理**：Namespace、Node、Pod、Deployment、Service、Ingress、ConfigMap
- **Istio 集成**：网关、流量治理、安全策略配置

### 范围说明

- 本仓库仅包含前端工程：`/Users/csm/Desktop/Project/PaaS/frontend/`
- 后端代码不在本仓库内，前端通过 `VITE_API_BASE_URL` 调用外部后端 API

### 术语表（前端视角）

| 术语 | 说明 |
|------|------|
| Namespace | Kubernetes 命名空间，作为大多数资源的