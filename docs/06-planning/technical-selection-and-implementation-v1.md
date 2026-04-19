# 技术选型与实现建议 v1

## 推荐路线

- 前端：`React + Vite`
- 状态：轻量集中式 store
- 动画：`DOM/CSS + Canvas 2D`
- 服务层：`Node.js`
- API：REST first
- 部署：`nginx + Node + systemd`
- OTA：应用层版本包升级

## 前端建议

- React 负责结构和状态映射
- 高频视觉动画不由 React 重渲染驱动
- Flow 主视觉用 `Canvas 2D`
- Listen / Screen 以 DOM/CSS 为主

## 状态管理建议

可选：

- `Zustand`
- 自建 `useSyncExternalStore` 小型 store

建议 slice：

- `systemStore`
- `playbackStore`
- `flowStore`
- `screenStore`

## 服务层建议

```text
server/
  api/
  system/
  integrations/
  sync/
  ota/
  auth/
```

## 原则

- 前端不直接打第三方 API
- 所有输入统一进入动作层
- REST 优先，SSE/WebSocket 后评估
