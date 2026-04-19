# SystemState Schema 与字段字典 v1

## 1. 目标

这份文档用于固定 `tikpal-speaker` ambient OS 的统一状态模型。

它解决的问题是：

- 前端页面到底依赖哪些字段
- 系统服务需要维护哪些状态
- REST API 返回的系统快照应该长什么样
- OTA、性能降级、portable 控制器、ScreenContext 这些能力如何挂接到同一套状态里

这是一份开发用“状态字典”，目标是可直接指导：

- store 设计
- API schema
- selector 设计
- 状态同步逻辑
- 调试面板设计

---

## 2. 顶层原则

## 2.1 SystemState 是系统唯一真实前台快照

所有前台状态：

- `Overview`
- `Listen`
- `Flow`
- `Screen`

都应该消费同一个 `SystemState`，而不是各自维护私有全局状态。

---

## 2.2 SystemState 不等于所有业务原始数据

它不是：

- Todoist 原始任务全集
- Calendar 原始事件全集
- 完整播放器内部状态树

它只保留前台运行真正需要的当前快照。

---

## 2.3 第三方复杂数据应映射后再进入 SystemState

例如：

- Calendar 原始数据 -> `ScreenContext` 摘要
- Todoist 原始数据 -> `ScreenContext` 摘要
- moOde / 播放器内部状态 -> `playback`

---

## 3. 顶层 Schema

建议统一结构如下：

```ts
type SystemState = {
  activeMode: SystemMode;
  focusedPanel: FocusedPanel;
  transition: TransitionState;
  overlay: OverlayState;
  playback: PlaybackState;
  flow: FlowState;
  screen: ScreenState;
  integrations: IntegrationState;
  controller: ControllerState;
  system: RuntimeSystemState;
  lastSource: ControlSource;
  lastUpdatedAt: string;
};
```

---

## 4. 顶层字段定义

## 4.1 activeMode

类型：

```ts
type SystemMode = "overview" | "listen" | "flow" | "screen";
```

说明：

- 当前系统主前台模式

用途：

- 决定当前渲染哪个主页面
- 决定 portable 当前控制语义
- 决定哪些 overlay 和快捷动作可见

示例：

```json
"activeMode": "flow"
```

---

## 4.2 focusedPanel

类型：

```ts
type FocusedPanel = "listen" | "flow" | "screen" | null;
```

说明：

- 当前是否有某个面板处于聚焦态
- 在 `overview` 下可为 `null` 或当前高亮卡片

用途：

- 控制 Overview 高亮
- 控制 Focus <-> Focus 的转场目标

---

## 4.3 transition

类型：

```ts
type TransitionState = {
  phase: "idle" | "to_overview" | "to_listen" | "to_flow" | "to_screen";
  from: SystemMode | null;
  to: SystemMode | null;
  startedAt?: string;
  locked: boolean;
};
```

说明：

- 当前模式切换状态
- 用于输入锁、动画控制和冲突处理

用途：

- 转场控制器
- portable / 本机输入冲突规避
- 调试日志

---

## 4.4 overlay

类型：

```ts
type OverlayState = {
  visibility: "hidden" | "controls" | "mode_switcher";
  reason?: "touch" | "remote" | "portable" | "system";
  lastShownAt?: string;
};
```

说明：

- 控制系统级 overlay 显示状态

用途：

- 控制层显示/隐藏
- 模式切换条
- 后续 OTA 提示层协同

---

## 5. playback 字段组

## 5.1 Schema

```ts
type PlaybackState = {
  state: "play" | "pause" | "stop";
  volume: number;
  muted?: boolean;
  trackTitle?: string;
  artist?: string;
  album?: string;
  source?: string;
  progress?: number;
  durationSec?: number;
  format?: string;
  sampleRate?: number;
  bitDepth?: number;
  nextTrackTitle?: string;
  updatedAt?: string;
};
```

---

## 5.2 字段说明

### state

- 当前播放状态
- `play | pause | stop`

### volume

- 0 到 100
- 整个系统统一使用同一音量归一范围

### muted

- 是否静音
- 第一版可选

### trackTitle / artist / album

- 当前媒体主体信息

### source

- 当前来源
- 例如 `Spotify Connect / AirPlay / Local Library / Radio`

### progress

- 0 到 1
- 当前播放进度比例

### durationSec

- 当前曲目总时长

### format / sampleRate / bitDepth

- 用于 Listen 的技术信息
- Overview 和 Flow 只做弱消费或不消费

### nextTrackTitle

- 下一首摘要

---

## 5.3 消费方

- `ListenPage`
- `ListenCard`
- `Overview`
- `portable`
- `System API / state`

---

## 6. flow 字段组

## 6.1 Schema

```ts
type FlowState = {
  state: "focus" | "relax" | "sleep" | "flow";
  subtitle?: string;
  motionStyle?: "linear_wave" | "fluid_cloud" | "near_static" | "layered_wave";
  motionSpeed?: number;
  motionAmplitude?: number;
  particleDensity?: number;
  uiTone?: "sharp" | "soft" | "dim" | "floating";
  updatedAt?: string;
};
```

---

## 6.2 字段说明

### state

- 当前 Flow 状态
- 是 Flow 模式的一级语义字段

### subtitle

- UI 文案辅助字段

### motionStyle / motionSpeed / motionAmplitude / particleDensity

- 主要给渲染层和性能降级层使用
- 不要求所有 API 客户端都消费

### uiTone

- 主要影响 UI 氛围与 overlay 风格

---

## 6.3 消费方

- `FlowPage`
- `FlowCard`
- portable 的 Flow 控制区
- 系统日志与调试

---

## 7. screen 字段组

## 7.1 Schema

```ts
type ScreenState = {
  currentTask?: string;
  currentTaskId?: string;
  nextTask?: string;
  currentBlockTitle?: string;
  pomodoroState?: "idle" | "running" | "paused" | "break";
  pomodoroRemainingSec?: number;
  pomodoroDurationSec?: number;
  remainingTasks?: number;
  remainingEvents?: number;
  stale?: boolean;
  updatedAt?: string;
};
```

---

## 7.2 字段说明

### currentTask / currentTaskId

- 当前最重要任务

### nextTask

- 下一个任务或提示项

### currentBlockTitle

- 当前时间块标题，通常来自 Calendar

### pomodoroState / pomodoroRemainingSec / pomodoroDurationSec

- 当前番茄钟状态

### remainingTasks / remainingEvents

- 今日剩余摘要

### stale

- 外部同步已陈旧但本地仍显示最后一次有效上下文

---

## 7.3 与 ScreenContext 的关系

`screen` 是轻量摘要，服务于：

- `SystemState`
- `Overview`
- portable 快速控制

更完整上下文应由独立的 `ScreenContext` 提供。

---

## 8. integrations 字段组

## 8.1 Schema

```ts
type IntegrationState = {
  calendar: {
    connected: boolean;
    lastSyncAt?: string;
    status: "idle" | "syncing" | "ok" | "stale" | "error";
  };
  todoist: {
    connected: boolean;
    lastSyncAt?: string;
    status: "idle" | "syncing" | "ok" | "stale" | "error";
  };
};
```

---

## 8.2 作用

- 给系统调试和 admin 面板用
- 给 Screen 的 stale / error 提示用
- 一般不需要在主前台大面积显示

---

## 9. controller 字段组

## 9.1 Schema

```ts
type ControllerState = {
  activeSessionId?: string;
  connected: boolean;
  lastControllerName?: string;
  lastControllerSeenAt?: string;
};
```

---

## 9.2 作用

- 记录 portable 控制器当前连接态
- 为 overlay 或状态提示提供依据

---

## 10. system 字段组

## 10.1 Schema

```ts
type RuntimeSystemState = {
  version: string;
  compatibleApiVersion: string;
  otaStatus:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "verifying"
    | "ready"
    | "applying"
    | "restarting"
    | "rollback"
    | "error";
  performanceTier: "normal" | "reduced" | "safe";
  temperatureC?: number;
  avgFps?: number;
  interactionLatencyMs?: number;
  canRollback: boolean;
  updateAvailable?: boolean;
  targetVersion?: string;
};
```

---

## 10.2 字段说明

### version

- 当前运行版本

### compatibleApiVersion

- 当前 System API 兼容版本

### otaStatus

- OTA 生命周期状态

### performanceTier

- 当前性能档位

### temperatureC / avgFps / interactionLatencyMs

- 运行态遥测
- 第一版可选，但建议保留字段位

### canRollback

- 当前是否可回滚

### updateAvailable / targetVersion

- OTA 可视化辅助字段

---

## 11. lastSource

类型：

```ts
type ControlSource = "touch" | "remote" | "portable_controller" | "api" | "system";
```

说明：

- 最后一次影响系统状态的输入来源

用途：

- 冲突处理调试
- portable 联调
- UI 提示

---

## 12. lastUpdatedAt

类型：

- ISO 8601 string

说明：

- 当前系统快照最后变更时间

用途：

- 状态同步
- 日志关联
- stale 检测

---

## 13. 字段消费矩阵

## Overview

主要消费：

- `activeMode`
- `focusedPanel`
- `playback.trackTitle`
- `playback.state`
- `playback.volume`
- `flow.state`
- `screen.currentTask`
- `screen.pomodoroRemainingSec`

## Listen

主要消费：

- `playback.*`
- `system.performanceTier`

## Flow

主要消费：

- `flow.*`
- `playback.volume`
- `playback.state`
- `overlay`
- `system.performanceTier`

## Screen

主要消费：

- `screen.*`
- `system.performanceTier`
- `integrations.*`

## portable

主要消费：

- `activeMode`
- `playback.state`
- `playback.volume`
- `flow.state`
- `screen.currentTask`
- `screen.pomodoroRemainingSec`
- `system.otaStatus`

---

## 14. 字段更新来源

## 本机输入

可改：

- `activeMode`
- `focusedPanel`
- `overlay`
- `playback.volume`
- `flow.state`
- `screen.pomodoroState`

## portable / API

可改：

- `activeMode`
- `playback`
- `flow.state`
- `screen`

## 系统服务

负责改：

- `system.*`
- `integrations.*`
- `lastUpdatedAt`
- `lastSource`

## connectors

负责影响：

- `screen.*`
- `integrations.*`

---

## 15. 与 API 的关系

`GET /api/v1/system/state` 应返回 `SystemState`

要求：

- 不暴露第三方原始 schema
- 不暴露不必要敏感 token / 配置
- 只暴露前台与控制需要的快照

---

## 16. 与 store 的关系

前端建议：

- 系统只有一个主状态入口
- 内部可拆 slice
- 但最终仍可合成完整 `SystemState`

例如：

- `systemStore`
- `playbackStore`
- `flowStore`
- `screenStore`

---

## 17. 第一版最小必要字段

如果先做 MVP，至少要有：

- `activeMode`
- `focusedPanel`
- `overlay.visibility`
- `playback.state`
- `playback.volume`
- `playback.trackTitle`
- `playback.artist`
- `playback.source`
- `flow.state`
- `screen.currentTask`
- `screen.pomodoroState`
- `screen.pomodoroRemainingSec`
- `system.version`
- `system.otaStatus`
- `system.performanceTier`
- `lastSource`
- `lastUpdatedAt`

---

## 18. 后续扩展建议

后续新增字段时，优先：

- 增加可选字段
- 增加 `capabilities`
- 不随意删除已有字段

避免：

- 因 UI 改版就推翻字段结构
- 让前端直接依赖第三方 API 字段

---

## 19. 结论

`SystemState` 的作用不是把所有内部细节都暴露出来，而是提供一份统一、稳定、前台友好的系统快照。

一句话总结：

- 页面消费它
- API 返回它
- 控制器读取它
- 动作改变它
- OTA 和性能策略也挂在它上面

它是 ambient OS 的统一状态语言。
