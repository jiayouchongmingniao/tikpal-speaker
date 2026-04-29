# Actions 语义字典与状态转换表 v1

## 1. 目标

这份文档定义 ambient OS 的统一动作语言。

它回答四个问题：

- 系统有哪些标准动作
- 每个动作能由哪些输入源触发
- 每个动作会改哪些 `SystemState` 字段
- 在什么条件下动作应被拒绝、忽略或延迟

这是把：

- 本机触摸
- 遥控器
- `tikpal portable`
- REST API
- 系统自动事件

统一到同一套状态机的关键文档。

---

## 2. 总体原则

## 2.1 动作是系统级语义，不是页面级事件

动作不应叫：

- `clickFlowButton`
- `openListenPage`
- `showScreenPanel`

而应叫：

- `set_mode`
- `return_overview`
- `set_flow_state`
- `screen_start_pomodoro`

这样才能保持：

- 页面实现解耦
- API 稳定
- OTA 可演进

---

## 2.2 动作改变目标状态，UI 决定如何过渡

例如：

- `set_mode(flow)` 决定目标模式是 `flow`
- 转场控制器决定是：
  - `Overview -> Flow`
  - `Listen -> Flow`
  - `Screen -> Flow`

动作层不负责视觉实现。

---

## 2.3 所有动作都应记录来源

建议所有动作请求都带：

- `source`
- `requestId`
- `timestamp`

来源可为：

```ts
type ControlSource = "touch" | "remote" | "portable_controller" | "api" | "system";
```

---

## 2.4 动作执行结果只有三种

- `applied`
- `ignored`
- `rejected`

### applied

动作有效，状态已改变或已进入转场。

### ignored

动作语义有效，但当前不需要重复执行。

例如：
- 当前已经在 `flow`，再次 `set_mode(flow)`

### rejected

动作在当前上下文不允许执行。

例如：
- OTA apply 期间请求复杂模式切换
- 权限不足执行 OTA

---

## 3. 动作基础结构

```ts
type ActionRequest = {
  type: string;
  payload?: Record<string, unknown>;
  source: ControlSource;
  requestId?: string;
  timestamp?: string;
};
```

建议动作响应：

```ts
type ActionResponse = {
  ok: boolean;
  result: "applied" | "ignored" | "rejected";
  state?: SystemState;
  error?: {
    code: string;
    message: string;
  };
};
```

---

## 4. 动作分组

建议将动作分为六类：

- 模式类
- Overlay 类
- 播放类
- Flow 类
- Screen 类
- 系统类

---

## 5. 模式类动作

## 5.1 set_mode

### 目的

切换系统前台模式。

### 请求

```json
{
  "type": "set_mode",
  "payload": {
    "mode": "flow"
  },
  "source": "portable_controller"
}
```

### payload

```ts
{
  mode: "overview" | "listen" | "flow" | "screen";
}
```

### 前置条件

- `mode` 合法
- 当前不在不可打断的系统关键阶段

### 状态变化

主要影响：

- `transition.phase`
- `transition.from`
- `transition.to`
- 最终 `activeMode`
- `focusedPanel`
- `lastSource`
- `lastUpdatedAt`

### ignored 条件

- `activeMode` 已经等于目标模式且不需要刷新

### rejected 条件

- OTA apply / restart / rollback 关键阶段
- 动作权限不足

---

## 5.2 return_overview

### 目的

从任意聚焦态返回 `Overview`。

### 请求

```json
{
  "type": "return_overview",
  "payload": {},
  "source": "touch"
}
```

### 前置条件

- 当前不在 `overview`

### 状态变化

- `transition.phase = to_overview`
- 最终 `activeMode = overview`
- `focusedPanel = null` 或保留高亮卡片
- `overlay.visibility` 按规则重置

### ignored 条件

- 当前已在 `overview`

### 优先级说明

- 本机双指捏合 / 遥控器 `Back` 触发时优先级高

---

## 5.3 focus_panel

### 目的

在 `Overview` 中只改变高亮焦点，不进入全屏。

### payload

```ts
{
  panel: "listen" | "flow" | "screen";
}
```

### 主要影响

- `focusedPanel`
- `lastSource`
- `lastUpdatedAt`

### 典型来源

- 遥控器左右切换
- 可选单指轻触高亮

---

## 5.4 next_mode / prev_mode

### 目的

沿固定模式顺序切到相邻模式。

### 顺序建议

- `listen -> flow -> screen`

`overview` 不建议作为顺序模式参与环切，由专门动作处理。

### 主要影响

- 等同于转换为 `set_mode(target)`

### 典型来源

- 遥控器左右
- 可选单指横滑

---

## 6. Overlay 类动作

## 6.1 show_controls

### 目的

显示控制层。

### 状态变化

- `overlay.visibility = controls`
- `overlay.reason = source`
- `overlay.lastShownAt = now`
- `lastSource`
- `lastUpdatedAt`

### ignored 条件

- controls 已可见，可只刷新时间戳

---

## 6.2 hide_controls

### 目的

隐藏控制层。

### 状态变化

- `overlay.visibility = hidden`

### rejected 条件

- 若系统策略规定关键提示必须可见，可拒绝隐藏

---

## 6.3 show_mode_switcher

### 目的

显示模式切换器。

### 状态变化

- `overlay.visibility = mode_switcher`

### 使用场景

- 遥控器唤起系统切换层
- portable 或 API 触发提示性切换层

---

## 6.4 hide_mode_switcher

### 目的

隐藏模式切换器。

### 状态变化

- `overlay.visibility = hidden`

---

## 7. 播放类动作

## 7.1 toggle_play

### 目的

在 `play` / `pause` 间切换。

### 状态变化

- `playback.state`
- `lastSource`
- `lastUpdatedAt`

### ignored 条件

- `stop` 状态下若系统不支持直接 toggle，可转为 rejected 或按策略转 `play`

---

## 7.2 set_volume

### payload

```ts
{
  volume: number;
}
```

### 约束

- 范围 `0 - 100`

### 状态变化

- `playback.volume`
- `lastSource`
- `lastUpdatedAt`

### rejected 条件

- `volume` 非法

---

## 7.3 next_track

### 目的

切到下一首。

### 状态变化

- `playback.trackTitle`
- `playback.artist`
- `playback.album`
- `playback.progress`
- `playback.nextTrackTitle`
- `lastSource`
- `lastUpdatedAt`

### rejected 条件

- 当前来源不支持跳曲

---

## 7.4 prev_track

同 `next_track`，目标为上一首。

---

## 7.5 set_playback_source

### 目的

切换播放来源。

### 说明

第一版可只保留接口位，不一定立即开放 UI。

### payload

```ts
{
  source: string;
}
```

### 风险

- 这是相对高影响动作，第一版可限制权限或仅在 Listen 深层使用

---

## 8. Flow 类动作

## 8.1 set_flow_state

### payload

```ts
{
  state: "focus" | "relax" | "sleep" | "flow";
}
```

### 状态变化

- `flow.state`
- 可选 `flow.subtitle`
- `lastSource`
- `lastUpdatedAt`

### 额外规则

- 若当前不在 `flow`，动作仍可成功，只改变内部 Flow 状态
- 进入 `focused_flow` 时应使用最新 Flow 状态
- 本机 `Flow` 双指下滑可触发该动作，推荐沿固定顺序切到下一个状态
- 推荐本机顺序：`focus -> flow -> relax -> sleep -> focus`
- 本机双指捏合返回 `Overview` 的优先级高于本动作

### ignored 条件

- 新状态与旧状态相同

---

## 9. Screen 类动作

## 9.1 screen_start_pomodoro

### payload

```ts
{
  durationSec?: number;
}
```

### 状态变化

- `screen.pomodoroState = running`
- `screen.pomodoroDurationSec`
- `screen.pomodoroRemainingSec`
- `lastSource`
- `lastUpdatedAt`

### 说明

- 未传 `durationSec` 时可使用默认值

---

## 9.2 screen_pause_pomodoro

### 状态变化

- `screen.pomodoroState = paused`

### ignored 条件

- 当前已是 `paused`

---

## 9.3 screen_reset_pomodoro

### 状态变化

- `screen.pomodoroState = idle`
- `screen.pomodoroRemainingSec = screen.pomodoroDurationSec` 或默认值

---

## 9.4 screen_complete_current_task

### payload

```ts
{
  taskId?: string;
}
```

### 状态变化

- `screen.currentTask`
- `screen.currentTaskId`
- `screen.nextTask`
- `screen.remainingTasks`
- `lastSource`
- `lastUpdatedAt`

### 说明

- 若外部 Todoist connector 可写，则应同步外部状态
- 若第一版暂不写回第三方，至少更新本地 session 状态

---

## 9.5 screen_set_focus_item

### payload

```ts
{
  taskId: string;
  title?: string;
}
```

### 状态变化

- `screen.currentTask`
- `screen.currentTaskId`
- `lastSource`
- `lastUpdatedAt`

### 使用场景

- portable 选定当前 focus item
- Screen 本机轻切换 focus item

---

## 9.6 screen_refresh_context

### 目的

主动请求 ScreenContext 刷新。

### 状态变化

- `integrations.calendar.status`
- `integrations.todoist.status`
- `screen.stale`
- `lastSource`
- `lastUpdatedAt`

### 说明

- 主要是 hint 动作，具体上下文刷新由 connectors 完成

---

## 10. 系统类动作

## 10.1 ota_check

### 权限

- 管理权限

### 状态变化

- `system.otaStatus = checking`
- 若发现新版本：
  - `system.updateAvailable = true`
  - `system.targetVersion = ...`

---

## 10.2 ota_apply

### 权限

- 管理权限

### 状态变化

- `system.otaStatus = downloading / verifying / applying / restarting`

### rejected 条件

- 权限不足
- 无可用版本
- 当前正在应用或回滚

---

## 10.3 ota_rollback

### 权限

- 管理权限

### 状态变化

- `system.otaStatus = rollback`

### rejected 条件

- `system.canRollback = false`

---

## 11. 动作优先级与冲突规则

## 11.1 系统级返回优先

本机双指捏合返回 Overview 或遥控器 Back，应高于普通远端建议性切换。

### 结果

- 若本机正在执行 `return_overview`
- 远端 `set_mode(screen)` 不应中途打断当前转场

---

## 11.2 转场锁

当：

- `transition.locked = true`

时：

- 模式切换类动作不应立即重入
- 可记录最后目标，待转场结束后再评估

---

## 11.3 最后写入优先

适用于：

- `set_volume`
- `toggle_play`
- `set_flow_state`
- `screen_start_pomodoro / pause / reset`

---

## 12. 状态转换表

## 12.1 模式转换

| 当前 activeMode | 动作 | 目标 |
|---|---|---|
| overview | set_mode(listen) | listen |
| overview | set_mode(flow) | flow |
| overview | set_mode(screen) | screen |
| listen | return_overview | overview |
| flow | return_overview | overview |
| screen | return_overview | overview |
| listen | set_mode(flow) | flow |
| flow | set_mode(screen) | screen |
| screen | set_mode(listen) | listen |

---

## 12.2 Overlay 转换

| 当前 overlay | 动作 | 目标 |
|---|---|---|
| hidden | show_controls | controls |
| controls | hide_controls | hidden |
| hidden | show_mode_switcher | mode_switcher |
| mode_switcher | hide_mode_switcher | hidden |
| controls | show_mode_switcher | mode_switcher |

---

## 12.3 番茄钟转换

| 当前 pomodoroState | 动作 | 目标 |
|---|---|---|
| idle | screen_start_pomodoro | running |
| paused | screen_start_pomodoro | running |
| running | screen_pause_pomodoro | paused |
| running | screen_reset_pomodoro | idle |
| paused | screen_reset_pomodoro | idle |
| break | screen_reset_pomodoro | idle |

---

## 13. 失败条件字典

推荐错误码映射：

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_STATE`
- `UNSUPPORTED_ACTION`
- `OTA_IN_PROGRESS`
- `DEPENDENCY_UNAVAILABLE`

### 常见示例

#### set_mode 在 OTA apply 期间

- `rejected`
- `code = OTA_IN_PROGRESS`

#### portable 调 OTA apply

- `rejected`
- `code = FORBIDDEN`

#### 非法音量值

- `rejected`
- `code = BAD_REQUEST`

---

## 14. 日志建议

每个动作执行都建议记录：

- `requestId`
- `source`
- `action.type`
- `action.payload`
- `result`
- `oldState summary`
- `newState summary`
- `error.code`（若有）
- `timestamp`

---

## 15. MVP 最小动作集合

第一版必须先固定：

- `set_mode`
- `return_overview`
- `show_controls`
- `hide_controls`
- `toggle_play`
- `set_volume`
- `next_track`
- `prev_track`
- `set_flow_state`
- `screen_start_pomodoro`
- `screen_pause_pomodoro`
- `screen_reset_pomodoro`
- `screen_complete_current_task`

管理动作可先预留：

- `ota_check`
- `ota_apply`
- `ota_rollback`

---

## 16. 结论

动作层的作用不是“代替页面事件”，而是给整个 ambient OS 提供一套稳定的控制语言。

一句话总结：

- 页面消费 `SystemState`
- 外部调用 `Actions`
- `Actions` 改变 `SystemState`
- UI 再根据状态做过渡和呈现

这就是系统级交互一致性的基础。
