# API Contract（前端视角）

本章节基于前端实现整理接口契约，用于：

- 前后端联调时快速确认 URL、参数与返回结构
- 新增/调整后端接口时快速定位受影响的页面与 store

接口定义集中在 [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts)。

## Base URL 与通用返回

### API_BASE_URL

前端使用环境变量 `VITE_API_BASE_URL` 指定后端地址；未配置时默认：

- `http://localhost:8080/api/v1`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L3-L11)、[useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L3-L21)

### Result<T>

大多数接口返回被包装为：

- `Result<T> = { code: number; message: string; data: T }`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L151-L155)

## 主要 DTO（节选）

### 平台侧聚合对象

- `Application`：应用聚合对象（包含 services 与状态）  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L142-L149)
- `DeployCommand`：创建/发布请求体  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L127-L132)
- `ApplicationService` / `ContainerSpec`：服务与 workload 定义（前端把 container 作为 workload 使用）  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L78-L125)

### Kubernetes 资源（前端 DTO）

- `Namespace` / `CreateNamespaceRequest`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L31-L47)
- `Pod`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L214-L225)
- `K8sNode`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L157-L180)
- `K8sService` / `K8sIngress`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L378-L403)
- `K8sConfigMap` / `K8sSecret`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L457-L513)
- `K8sDeployment`：  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L515-L566)

## API 分组与路径（节选）

说明：以下路径均相对于 `API_BASE_URL`。

### Nodes（nodeApi）

- `GET /nodes`
- `POST /nodes/{name}/cordon`
- `POST /nodes/{name}/uncordon`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L182-L193)

### Namespaces（namespaceApi）

- `GET /namespaces/`
- `GET /namespaces/{name}`
- `POST /namespaces/`（body: `CreateNamespaceRequest`）
- `DELETE /namespaces/{name}`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L196-L212)

### Pods（podApi）

- `GET /namespaces/{namespace}/pods`（query params: labels）
- `GET /namespaces/{namespace}/pods/{name}`
- `DELETE /namespaces/{namespace}/pods/{name}`
- `GET /namespaces/{namespace}/pods/{name}/logs`（params: `tailLines`）
- `GET /namespaces/{namespace}/pods/{name}/terminal`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L227-L249)

### Events（eventApi）

- `GET /namespaces/{namespace}/events`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L263-L268)

### Applications / Deployments（api）

该分组是 Console 的“平台能力核心”：

- `GET /applications/deployments/{namespace}`：查询应用列表
- `POST /applications/deployments`：提交 `DeployCommand` 创建/更新应用（返回 deploymentId）
- `DELETE /applications/deployments/{namespace}/{name}`：删除应用
- `POST /applications/deployments/{namespace}/{name}/stop`：停止
- `POST /applications/deployments/{namespace}/{name}/start`：启动
- `POST /applications/deployments/{namespace}/{name}/services/{serviceName}/network`：更新网络暴露（Service/Ingress）
- `POST /applications/deployments/{namespace}/{name}/istio/apply`：apply Istio/Security/Obs YAML

并包含 scale/image/restart/rollback/yaml/logs/terminal 等运维路径，详见：  
[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L270-L377)

### Network（networkApi）

用于直接管理 K8s Service/Ingress（非 Application 聚合对象）：

- Services:
  - `GET /namespaces/{namespace}/services`
  - `GET /namespaces/{namespace}/services/{name}`
  - `POST /namespaces/{namespace}/services`（body: `CreateServiceCommand`）
  - `DELETE /namespaces/{namespace}/services/{name}`
- Ingresses:
  - `GET /namespaces/{namespace}/ingresses`
  - `GET /namespaces/{namespace}/ingresses/{name}`
  - `POST /namespaces/{namespace}/ingresses`（body: `CreateIngressCommand`）
  - `DELETE /namespaces/{namespace}/ingresses/{name}`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L424-L455)

### ConfigMaps / Secrets

- ConfigMaps：`GET/POST/PUT/DELETE /namespaces/{namespace}/configmaps...`  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L464-L484)
- Secrets：`GET/POST/PUT/DELETE /namespaces/{namespace}/secrets...`  
  [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L493-L513)

### Deployments（deploymentApi）

- `GET /namespaces/{namespace}/deployments`
- `POST /namespaces/{namespace}/deployments`（body: `CreateDeploymentRequest`）
- `PUT /namespaces/{namespace}/deployments/{name}/scale`（params: `replicas`）
- `PUT /namespaces/{namespace}/deployments/{name}/image`（params: `image`）
- `POST /namespaces/{namespace}/deployments/{name}/restart`
- `DELETE /namespaces/{namespace}/deployments/{name}`

参考：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L541-L566)

## 后端待补充（占位）

为补齐端到端架构与“项目运行方式（含后端）”，需要你提供以下任一信息：

- 后端仓库地址/本地路径
- 后端接口文档（OpenAPI/Swagger/Markdown 均可）
- 鉴权方式（是否需要登录、token/header、cookie 等）
- 后端启动方式（本地、容器、K8s 部署），以及与集群的连接方式（kubeconfig/ServiceAccount 等）

拿到后端信息后，Wiki 可以进一步补充：

- 前后端联调的完整步骤（含环境变量与代理）
- 后端模块划分与关键实现（K8s client、应用编排、Istio YAML apply 等）
- 典型故障定位链路（日志、事件、watch、重试策略）

