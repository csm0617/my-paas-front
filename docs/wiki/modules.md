# Modules

本章节按目录解释模块职责、依赖方向与关键导出，便于快速定位“改动应该落在哪个文件”。

## 顶层结构

仓库仅包含一个前端工程：

- `frontend/`：React + TypeScript + Vite 项目（见 [frontend/package.json](file:///Users/csm/Desktop/Project/PaaS/frontend/package.json#L1-L45)）

## frontend/src 目录分层

### 入口与路由

- React 挂载入口：[main.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/main.tsx#L1-L10)
- 路由表：[App.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/App.tsx#L1-L34)
- 全局布局（侧边栏导航、页头标题）：[Layout.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/Layout.tsx#L1-L156)

依赖方向：

- `main.tsx` → `App.tsx`
- `App.tsx` → `Layout.tsx` + 各 `pages/*`

### pages/（页面层）

页面通常负责：

- 选择当前 namespace（通过 `useNamespaceStore` 或 `useAppStore`）
- 触发加载（调用 store 的 `fetch*`）
- 展示列表/表格
- 触发弹窗/抽屉

关键页面与职责：

- Applications（聚合应用）
  - Dashboard：[Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx)
  - 依赖：`useAppStore`、`useNamespaceStore`、`useK8sWatch`、核心组件（CreateWizard/Logs/Terminal/Yaml/Events）
- K8s 原生资源
  - Nodes：[NodeList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/NodeList.tsx)
  - Namespaces：[NamespaceList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/NamespaceList.tsx)
  - Deployments：[DeploymentList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/DeploymentList.tsx)
  - Pods：[PodList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/PodList.tsx)
  - Services：[ServiceList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/ServiceList.tsx)
  - Ingresses：[IngressList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/IngressList.tsx)
  - Config Groups（ConfigMaps）：[ConfigMapList.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/ConfigMapList.tsx)

### components/（组件层）

组件大致分为三类：

#### 1) 核心业务弹窗（创建/发布/治理）

- Create Wizard（模板化创建）：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx)
  - 依赖：`createTemplates.ts`、`domain.ts`、`istioYaml.ts`、`serviceResources.ts`、多种通用组件
- Deploy（高级发布）：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx)
  - 依赖：`istioYaml.ts`、`useAppStore/useNamespaceStore`、网络/调度相关组件
- Service Network（流量治理入口/网络）：[ServiceNetworkModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/ServiceNetworkModal.tsx)

#### 2) 资源创建/编辑弹窗

- CreateDeploymentModal：[CreateDeploymentModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateDeploymentModal.tsx)
- CreateServiceModal：[CreateServiceModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateServiceModal.tsx)
- CreateIngressModal：[CreateIngressModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateIngressModal.tsx)
- ConfigMapModal：[ConfigMapModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/ConfigMapModal.tsx)

#### 3) 通用交互与辅助组件

- 确认/输入弹窗：[ConfirmDialog.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/ConfirmDialog.tsx)、[InputDialog.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/InputDialog.tsx)
- Logs/Terminal 抽屉：[LogsDrawer.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/LogsDrawer.tsx)、[TerminalDrawer.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/TerminalDrawer.tsx)
- YAML/Events 查看：[YamlModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/YamlModal.tsx)、[EventsModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/EventsModal.tsx)
- 调度配置：[SchedulingSection.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/SchedulingSection.tsx)
- 配置挂载：[ConfigMountSection.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/ConfigMountSection.tsx)

### store/（状态与副作用）

特点：store 把“请求 + 状态”聚合在一起，页面/组件调用 store action 即可。

- Applications：`useAppStore`  
  [appStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/appStore.ts#L1-L143)
- Namespaces：`useNamespaceStore`  
  [namespaceStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/namespaceStore.ts#L1-L51)
- Services/Ingresses：`useNetworkStore`  
  [networkStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/networkStore.ts#L1-L66)
- Deployments：`useDeploymentStore`  
  [deploymentStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/deploymentStore.ts#L1-L79)
- Pods：`usePodStore`  
  [podStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/podStore.ts#L1-L37)

### lib/（纯逻辑/契约/生成器）

一般不包含 UI，只做可复用逻辑：

- API 与 DTO：`api.ts`  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts)
- Istio YAML 生成：`istioYaml.ts`  
  [istioYaml.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/istioYaml.ts)
- 入口域名/URL 组装：`domain.ts`  
  [domain.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/domain.ts)
- 创建模板：`createTemplates.ts`  
  [createTemplates.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/createTemplates.ts)
- 资源规格（CPU/内存解析、预设映射、写回 DeployCommand）：`serviceResources.ts`  
  [serviceResources.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/serviceResources.ts)
- Tailwind class 合并工具：`utils.ts`  
  [utils.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/utils.ts#L1-L6)

### hooks/（跨组件副作用）

- SSE watch：`useK8sWatch`  
  [useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L1-L55)

依赖方向建议（已有实现也基本遵循）：

- `pages/components` 可以依赖 `store/lib/hooks`
- `store` 可以依赖 `lib`
- `lib/hooks` 不应依赖 `pages/components`（避免循环依赖）

