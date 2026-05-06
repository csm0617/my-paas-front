# Overview

## 项目定位

本项目是一个面向 Kubernetes 的 PaaS Console（前端单页应用），主要提供：

- Applications（平台抽象应用）的创建/发布/启停/扩缩/回滚
- Kubernetes 资源的基础管理：Namespaces / Nodes / Pods / Deployments / Services / Ingresses / ConfigMaps
- （可选）Istio 流量入口与治理能力：Gateway / VirtualService / DestinationRule 以及部分安全与观测 YAML

## 技术栈

- React 18 + TypeScript（SPA）
- React Router（前端路由）：[App.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/App.tsx#L1-L34)
- Zustand（状态管理）：例如 [appStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/appStore.ts#L1-L143)
- Axios（HTTP）：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L1-L377)
- Tailwind CSS（样式）：[index.css](file:///Users/csm/Desktop/Project/PaaS/frontend/src/index.css)
- Vite（构建与开发服务器）：[vite.config.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/vite.config.ts#L1-L30)

## 整体架构（逻辑分层）

### 1) 页面层（Pages）

页面组件位于 `frontend/src/pages/*`，与路由一一对应：

- Dashboard：[Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx)
- 资源列表：Nodes/Namespaces/Deployments/Pods/Services/Ingresses/ConfigMaps

页面主要职责：

- 选择/展示资源（表格、卡片视图）
- 触发动作（创建、删除、扩缩容、修改镜像等）
- 打开弹窗/抽屉（Logs/Terminal/YAML/Events 等）
- 调用对应 store action 以完成与后端的交互

### 2) 状态层（Stores）

状态与副作用集中在 `frontend/src/store/*`（Zustand）：

- `useAppStore`：Application 维度的发布与运维动作（deploy/scale/updateImage/stop/start/restart/rollback）  
  参考：[appStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/appStore.ts#L1-L143)
- `useNamespaceStore`：namespace 列表与当前 namespace  
  参考：[namespaceStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/namespaceStore.ts#L1-L51)
- `useNetworkStore`：Services 与 Ingresses  
  参考：[networkStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/networkStore.ts#L1-L66)
- `useDeploymentStore` / `usePodStore` / `useNodeStore` / `useConfigMapStore`：分别管理对应资源（模式相似）

通用模式：

- store 内维护 `loading/error`，并将数据写入 store state
- 通过 `api.ts` 的 API client 发起请求
- 关键写操作后触发刷新（例如 `get().fetchDeployments()`）

### 3) 数据访问层（lib/api.ts）

[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L1-L566) 负责两件事：

- 定义前端使用的 DTO 类型（例如 `Application`/`K8sNode`/`Pod`/`K8sService` 等）
- 提供 API 分组调用（例如 `namespaceApi`/`podApi`/`deploymentApi`/`networkApi`/`api`）

该文件同时体现了“前后端契约”：URL、参数结构、返回包装 `Result<T>`。

### 4) 组件层（Components）

`frontend/src/components/*` 为页面提供可复用的 UI 组件，包含：

- 业务核心弹窗：Create Wizard / Deploy / ServiceNetwork / CreateDeployment 等
- 辅助弹窗与抽屉：LogsDrawer / TerminalDrawer / YamlModal / EventsModal / ConfirmDialog / InputDialog

## 关键数据流

### Dashboard 的数据刷新

- Dashboard 在 `namespace` 变化时触发拉取：  
  [Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L49-L57)
- 同时订阅 SSE watch，当后端推送 deployment 事件时刷新：  
  [useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L1-L55)

### “创建/发布”两条主路径

- CreateWizardModal：偏“快速创建 + 模板化”，引导式流程  
  [CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L25-L706)
- DeployModal：偏“高级发布 + 分阶段 Apply”，支持更细的网络/调度/Istio/安全观测参数  
  [DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L123-L820)

## 外部依赖（后端占位）

前端默认会调用 `VITE_API_BASE_URL`（未配置时 fallback 到 `http://localhost:8080/api/v1`）：

- [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L3-L11)
- [useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L3-L21)

后端的实现、鉴权方式、部署方式不在本仓库内，详见 [api-contract.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/api-contract.md) 的“后端待补充”章节。

