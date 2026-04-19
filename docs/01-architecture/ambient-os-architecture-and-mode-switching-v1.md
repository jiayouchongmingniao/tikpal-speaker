# Ambient OS 架构与模式切换规格 v1

## 产品角色

- `Overview`：三分屏总览工作台
- `Listen`：数播与播放控制中心
- `Flow`：状态进入与沉浸界面
- `Screen`：任务与节奏显示界面

## 核心状态机

- `overview`
- `focused_listen`
- `focused_flow`
- `focused_screen`
- `transitioning`

辅助状态：

- `overlay_hidden`
- `overlay_controls`
- `overlay_mode_switcher`

## 系统状态建议

```ts
type SystemMode = "overview" | "listen" | "flow" | "screen";
type OverlayState = "hidden" | "controls" | "mode_switcher";
type ControlSource = "touch" | "remote" | "portable_controller" | "system" | "api";
```

系统状态至少包含：

- `activeMode`
- `focusedPanel`
- `overlay`
- `playback`
- `flow`
- `screen`
- `system.version`
- `system.otaStatus`
- `system.performanceTier`
- `lastSource`
- `lastUpdatedAt`

## 总体分层

### UI Layer

- Overview / Listen / Flow / Screen
- GlobalOverlay
- BackgroundStage

### Control Layer

- SystemState
- InputRouter
- ActionDispatcher
- REST API

### Device Layer

- 播放桥接
- Screen connectors
- OTA
- 监控与降级

## 关键原则

- `Overview` 是系统母层，不是附属页面
- `Overview` 只展示三张摘要卡片，不复用完整页面
- 所有输入统一映射成系统动作
- API 必须是系统级 API，不是某个页面的私有接口
- OTA 与树莓派 4 性能约束必须作为架构前提
