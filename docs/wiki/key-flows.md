# Key Flows

本章节聚焦“用户点击后到底发生了什么”，帮助定位关键逻辑与可扩展点。

## 1) Dashboard：应用管理主入口

入口页面：[Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx)

### 关键状态与动作

- 通过 `useAppStore` 获取：
  - `namespace`、`deployments`、`fetchDeployments`
  - `deploy/scale/updateImage/deleteDeployment/start/stop/restart/rollback`
  - 参考：[Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L18-L37)、[appStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/appStore.ts#L1-L143)
- 通过 `useNamespaceStore` 拉取 namespace 列表，用于切换 scope  
  参考：[Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L20-L52)

### 数据刷新机制

- Dashboard 在 namespace 变化时刷新 deployments：  
  [Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L49-L52)
- 同时订阅 SSE watch：当后端推送 `deployment` 事件时触发刷新：  
  [Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L53-L57)  
  watch 实现：[useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L1-L55)

### 弹窗/抽屉

- 新建应用：打开 `CreateWizardModal`（模板化创建）  
  [Dashboard.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/pages/Dashboard.tsx#L281-L286)
- 日志/终端：打开 `LogsDrawer` / `TerminalDrawer`（内部会调用 `podApi.getLogs` / `podApi.getTerminalUrl`）  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L214-L249)
- YAML/Events：打开 `YamlModal` / `EventsModal`（通过 API 拉取 YAML 与事件）  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L263-L377)

## 2) CreateWizardModal：模板化创建（引导式）

核心组件：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx)

### Step 状态机

`Step = 'template' | 'basics' | 'plan' | 'deploy' | 'exposure'`  
参考：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L25-L215)

典型流程：

- template：选择模板（来自 [createTemplates.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/createTemplates.ts#L1-L179)）
- basics：填写 appName / namespace / description；可在已有 draft 上“增量新增 service/version”
- plan：生成 DeployCommand 预览（可 Operator view 展示 JSON/YAML）
- deploy：调用 `onDeploy(finalCommand)`；轮询/刷新 deployments 观察状态  
  参考轮询：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L168-L185)
- exposure：可选启用 public access，并 apply Istio YAML（走 `api.applyIstioYaml`）  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L285-L288)

### 关键逻辑点

- 基础命名校验：`isDnsLabel`  
  [CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L41-L43)
- “入口域名”推导：`buildEntryDomain(app, ns, baseDomain)`  
  [domain.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/domain.ts#L20-L26)
- 将 entry 配置“收敛写回” DeployCommand：`ensureEntryInCommand`  
  [CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L381-L405)
- 资源规格写回 DeployCommand：`applyServiceResourcesToCommand`  
  [serviceResources.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/serviceResources.ts#L125-L143)
- Istio YAML 生成：`buildCreateEntryIstioDraft` + `buildIstioYaml`  
  [istioYaml.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/istioYaml.ts#L59-L274)

## 3) DeployModal：高级发布（分阶段 Apply + 可编辑现有服务）

核心组件：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx)

### 两类使用方式

- 新建应用：`initialApp` 为空，从 step=0 开始
- 编辑已有应用的某个 service：传入 `initialApp` 与 `initialServiceName`，会将现有配置映射回表单 state  
  映射逻辑入口：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L191-L307)

### 分阶段 Apply（核心差异点）

DeployModal 设计了 4 个 stage（Workloads → Exposure → Istio → Security/Obs），用以将复杂配置拆分为可回滚/可定位的步骤：

- Stage 1：`applyStageWorkloads` 仅下发 Workload（强制 enableService=true、关闭 ingress）  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L672-L689)
- Stage 2：`applyStageExposure` 对每个 service 调用 `api.updateServiceNetwork`  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L691-L753)  
  API：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L281-L283)
- Stage 3：`applyStageIstioTraffic` apply Istio YAML（来自 `buildIstioYaml`）  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L755-L787)
- Stage 4：`applyStageSecurityObs` apply 安全与观测 YAML（PeerAuthentication STRICT / Telemetry）  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L789-L809)  
  YAML 生成：[istioYaml.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/istioYaml.ts#L276-L313)

### DeployCommand 的构建（表单 → 契约）

`buildCommand()` 将表单 state 转换为后端契约 `DeployCommand`：

- service/container 层的 ingress 选择逻辑：`ingressTargetWorkloadId` 决定入口指向哪个 workload  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L380-L487)
- 调度策略：
  - simple 模式下自动生成 affinity/tolerations（固定节点或反亲和）
  - advanced 模式下直接透传 JSON（需校验 JSON 格式）  
  参考：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L406-L538)

