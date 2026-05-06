# CreateWizard Service Rename (Basics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 CreateWizardModal 的 Basics 阶段支持对已有 Service 进行重命名，并确保相关状态（resources/entry/展开状态）一致更新。

**Architecture:** 在 `CreateWizardModal.tsx` 内增加“重命名中的 service”局部状态与 `renameService(old,new)` 纯前端同步函数；UI 在 service 卡片标题处提供编辑/保存/取消入口，并进行 DNS label + 重名校验。

**Tech Stack:** React + TypeScript（现有 Zustand/逻辑不变），无新增依赖。

---

### Task 1: 增加重命名状态与同步更新函数

**Files:**
- Modify: `/Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx`

- [ ] **Step 1: 新增 state**

在组件 state 区域新增：

- `renamingService: { from: string; to: string } | null`
- `renameError: string | null`

- [ ] **Step 2: 新增 renameService(oldName, newName)**

函数需同步更新：

- `commandDraft.services[].name`
- `serviceResources` key（旧名迁移到新名）
- `touchedServices`、`expandedServices`（Set 内元素替换）
- `entry.targetServiceName`（若命中旧名）

### Task 2: 在 Basics 的 Service 标题处加入“编辑/保存/取消”

**Files:**
- Modify: `/Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx`（service 列表渲染处）

- [ ] **Step 1: 将标题区域从 button 改为 div click（避免 button 嵌套）**
- [ ] **Step 2: 增加编辑入口**
  - 进入编辑：填充 `renamingService`
  - 保存：校验（DNS label、重名），成功则调用 `renameService` 并退出编辑
  - 取消：退出编辑不改
- [ ] **Step 3: 展示错误**
  - `renameError` 显示在当前 service 标题或卡片内（仅编辑态显示）

### Task 3: 验证

**Files:**
- Verify: `/Users/csm/Desktop/Project/PaaS/frontend/src/components/CreateWizardModal.tsx`

- [ ] **Step 1: 类型检查**

Run: `cd /Users/csm/Desktop/Project/PaaS/frontend && npm run check`  
Expected: exit code 0

- [ ] **Step 2: 手工验证（浏览器）**

在 `http://localhost:3008/` 打开 CreateWizard → Basics：

- 将 `web` 重命名为 `api`：标题更新、展开状态正常、资源面板仍可编辑
- 重命名为非法值（含大写/下划线等）：提示错误且不更新
- 重命名为已存在的 service 名称：提示错误且不更新

