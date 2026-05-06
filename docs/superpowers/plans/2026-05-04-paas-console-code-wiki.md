# PaaS Console Code Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前仓库（仅包含 `frontend/`）生成结构化、多文件的 Code Wiki（Markdown），覆盖架构、模块、关键类/函数、依赖关系与运行方式，并对外部后端依赖保留占位说明。

**Architecture:** 在 `docs/wiki/` 下生成多篇文档，由 `docs/wiki/README.md` 统一组织目录与阅读路径；Wiki 内容基于源码静态分析（入口/路由/核心组件/store/api 契约）产出，不包含 Mermaid 图。

**Tech Stack:** Markdown、现有源码引用（`file:///...#Lx-Ly`）。

---

## Task 1: 仓库扫描与信息提取

**Files:**
- Inspect: `/Users/csm/Desktop/Project/PaaS/frontend/src/*`
- Inspect: `/Users/csm/Desktop/Project/PaaS/frontend/package.json`
- Inspect: `/Users/csm/Desktop/Project/PaaS/frontend/.env.example`

- [ ] 收集入口/路由与页面结构（`main.tsx`、`App.tsx`、`Layout.tsx`、`pages/*`）
- [ ] 收集数据层与接口契约（`src/lib/api.ts`、SSE watch `useK8sWatch.ts`）
- [ ] 收集状态层（`src/store/*`）与 UI 组件（`src/components/*`）的职责划分
- [ ] 收集运行方式与配置项（`package.json` scripts、Vite config、env）

## Task 2: 生成 Wiki 总目录

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/README.md`

- [ ] 写明 Wiki 范围（仅本仓库前端 + 外部后端占位）
- [ ] 给出阅读路径、术语表、快速开始（如何运行前端、如何配置 API_BASE_URL）
- [ ] 链接到各分篇文档

## Task 3: 生成架构与概览文档

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/overview.md`

- [ ] 描述 SPA 架构：React Router 页面层 → Zustand store → Axios API → 后端
- [ ] 描述关键业务对象：Namespace / Application / Service / Workload / ConfigMap / Node 等
- [ ] 描述核心数据流（Dashboard 刷新 + SSE watch）与错误处理策略（store 内 try/catch）

## Task 4: 生成模块拆解文档

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/modules.md`

- [ ] 按目录（pages/components/store/lib/hooks）解释职责与依赖方向
- [ ] 列出每个模块的关键文件、关键导出（函数/组件/store action）

## Task 5: 生成关键流程与组件说明

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/key-flows.md`

- [ ] CreateWizardModal：模板 → basics → plan → deploy → exposure 的状态机与校验点
- [ ] DeployModal：分步/分阶段 Apply（workloads/exposure/istio/securityObs）
- [ ] Dashboard：应用列表、操作入口（scale/image/logs/terminal/yaml/events）

## Task 6: 生成 API 契约文档（含后端占位）

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/api-contract.md`

- [ ] 总结 API_BASE_URL、Result<T> 结构与主要 DTO（Application/Service/Pod/Node…）
- [ ] 按 api 分组列出核心 REST 路径（nodes/namespaces/pods/applications/network/configmaps…）
- [ ] “后端实现待补充”章节：需要的后端仓库/接口文档/鉴权方式等信息清单

## Task 7: 生成运行与依赖文档

**Files:**
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/runtime.md`
- Create: `/Users/csm/Desktop/Project/PaaS/docs/wiki/dependencies.md`

- [ ] runtime：安装/开发/构建/预览命令，env 配置项与默认值
- [ ] dependencies：React/Router/Zustand/Axios/Tailwind 等依赖的使用位置与作用

## Task 8: 校验与交付

**Files:**
- Inspect: `/Users/csm/Desktop/Project/PaaS/docs/wiki/*`

- [ ] 校验文档内部链接与源码引用路径正确
- [ ] 校验运行说明与脚本/配置一致
- [ ] 交付后询问是否需要按 Conventional Commits 提交本地 git 记录

