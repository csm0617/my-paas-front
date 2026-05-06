# Runtime & Local Development

## 前端工程位置

- `/Users/csm/Desktop/Project/PaaS/frontend/`

## 依赖安装与运行

脚本定义见 [frontend/package.json](file:///Users/csm/Desktop/Project/PaaS/frontend/package.json#L1-L45)。

- 安装依赖：`npm install`
- 本地开发（HMR）：`npm run dev`
- 构建：`npm run build`
- 预览构建产物：`npm run preview`
- 类型检查：`npm run check`
- Lint：`npm run lint`

入口与路由：

- React 挂载：[main.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/main.tsx#L1-L10)
- 路由与页面注册：[App.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/App.tsx#L1-L34)

## 环境变量

### 1) 后端地址

`VITE_API_BASE_URL`：后端 API 根路径（包含版本前缀）。

- 默认值：`http://localhost:8080/api/v1`
- 使用位置：
  - Axios baseURL：[api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L3-L11)
  - SSE watch：[useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L3-L21)

### 2) 入口域名配置（CreateWizard）

CreateWizardModal 用于“自动推导对外域名/URL”，依赖：

- `VITE_BASE_DOMAIN`：基础域名（可带 scheme，也可仅 host）
  - 示例见 [.env.example](file:///Users/csm/Desktop/Project/PaaS/frontend/.env.example#L1-L3)
  - 解析逻辑：[parseBaseDomain](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/domain.ts#L6-L18)
- `VITE_DEFAULT_ENTRY_SCHEME`：URL scheme（默认 `https`）  
  使用位置：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L45-L48)
- `VITE_DEFAULT_ENTRY_PATH`：入口路径（默认 `/`）  
  使用位置：[CreateWizardModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx#L45-L48)

### 3) Istio 网关默认值（DeployModal）

DeployModal 的 Istio Entry 默认引用：

- `VITE_ISTIO_GATEWAY_NAMESPACE`（默认 `istio-system`）
- `VITE_ISTIO_GATEWAY_NAME`（默认 `istio-ingressgateway`）

使用位置：[DeployModal.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/DeployModal.tsx#L127-L129)

## 常见联调方式（仅前端视角）

由于后端不在本仓库内，前端联调通常依赖：

- 确保 `VITE_API_BASE_URL` 指向可访问的后端地址
- 确保后端已允许跨域（或在 Vite 侧配置代理；当前仓库未看到显式代理配置）

如果你提供后端仓库或部署方式，可补齐“端到端联调/部署”章节。

