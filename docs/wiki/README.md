# Code Wiki - PaaS Console

本 Wiki 用于帮助新加入的开发者与平台使用者快速理解本仓库的代码结构与运行方式。

## 范围说明

- 本仓库当前仅包含前端工程：`/Users/csm/Desktop/Project/PaaS/frontend/`
- 前端通过 `VITE_API_BASE_URL` 调用外部后端 API（后端代码不在本仓库内），Wiki 中会基于前端接口使用情况整理“API 契约”，并保留“后端待补充”章节。

## 阅读路径

- 先读 [overview.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/overview.md)：了解整体架构、关键概念、数据流
- 再读 [modules.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/modules.md)：按目录理解模块职责与依赖方向
- 再读 [key-flows.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/key-flows.md)：掌握核心功能流程（创建/发布/治理）
- 然后按需查阅：
  - [api-contract.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/api-contract.md)：前后端接口契约、主要 DTO、后端占位
  - [runtime.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/runtime.md)：本地运行、构建与配置
  - [dependencies.md](file:///Users/csm/Desktop/Project/PaaS/docs/wiki/dependencies.md)：依赖清单与在代码中的落点

## 快速开始（本地运行前端）

- 进入前端目录：`/Users/csm/Desktop/Project/PaaS/frontend/`
- 安装依赖：`npm install`
- 启动开发服务：`npm run dev`
- 构建：`npm run build`
- 预览构建产物：`npm run preview`

相关脚本见 [package.json](file:///Users/csm/Desktop/Project/PaaS/frontend/package.json#L1-L45)。

## 关键入口

- React 挂载入口：[main.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/main.tsx#L1-L10)
- 路由入口：[App.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/App.tsx#L1-L34)
- 全局布局与左侧导航：[Layout.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/Layout.tsx#L1-L156)
- API 客户端与 DTO 定义：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L1-L566)

## 术语表（前端视角）

- Namespace：Kubernetes 命名空间，作为大多数资源的作用域
- Application：平台侧聚合概念（由若干 Service/Workload 组成），由后端返回 `Application` DTO
- Service：Application 下的服务单元；在后端/前端 DTO 中是 `ApplicationService`
- Workload：Service 下的运行实例定义（在前端 DTO 中是 `ContainerSpec`，通常映射到 Deployment/Pod）
- Exposure：对外暴露（K8s Service / Ingress）与（可选）Istio Gateway/VirtualService 相关配置

