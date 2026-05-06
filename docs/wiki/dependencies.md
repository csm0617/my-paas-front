# Dependencies

本文从“为什么需要它 / 在哪里用到它”的角度梳理本仓库前端依赖。

依赖清单来源：[frontend/package.json](file:///Users/csm/Desktop/Project/PaaS/frontend/package.json#L13-L25)。

## 核心框架

- React / React DOM
  - 应用入口：[main.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/main.tsx#L1-L10)
- react-router-dom
  - 路由定义：[App.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/App.tsx#L1-L34)
  - 导航与当前路由信息：[Layout.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/Layout.tsx#L1-L156)

## 状态管理

- zustand
  - stores 位于 `frontend/src/store/*`，例如：
    - Application store：[appStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/appStore.ts#L1-L143)
    - Namespace store：[namespaceStore.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/store/namespaceStore.ts#L1-L51)

## 网络与后端交互

- axios
  - 统一 API client 与 DTO： [api.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/api.ts#L1-L377)
- 浏览器原生 EventSource（SSE）
  - watch hook： [useK8sWatch.ts](file:///Users/csm/Desktop/Project/PaaS/frontend/src/hooks/useK8sWatch.ts#L1-L55)
- 浏览器原生 WebSocket
  - Web Terminal： [TerminalDrawer.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/TerminalDrawer.tsx#L1-L78)

## UI 与样式

- tailwindcss / postcss / autoprefixer
  - 全局样式入口：[index.css](file:///Users/csm/Desktop/Project/PaaS/frontend/src/index.css)
- clsx + tailwind-merge
  - Tailwind class 合并工具： [cn](file:///Users/csm/Desktop/Project/PaaS/frontend/src/lib/utils.ts#L1-L6)
- lucide-react
  - 主要用于 Icon（例如 Layout、Dashboard、各列表页、弹窗按钮）

## 终端组件

- @xterm/xterm + @xterm/addon-fit
  - 用于在浏览器中展示并交互 Web Terminal： [TerminalDrawer.tsx](file:///Users/csm/Desktop/Project/PaaS/frontend/src/components/TerminalDrawer.tsx#L1-L78)

## 其他

- agent-browser
  - 当前在 `frontend/src` 内未发现引用（可能为历史遗留或未来功能预留）。

