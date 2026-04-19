# 日志、遥测与调试面板规格 v1

## 1. 目标

这份文档定义 `tikpal-speaker` ambient OS 的观测体系，包括：

- 运行日志
- 实时遥测
- 本机调试面板
- API / connector / OTA / 性能相关排障信息

目标不是做一个重型运维平台，而是确保后续开发、联调、验收和树莓派真机排障时，能快速回答这些问题：

- 当前系统到底处于什么状态
- 最近发生了什么动作
- 是谁触发了变化
- 为什么当前模式没变 / 为什么页面没更新
- 是 API、connector、权限、性能，还是 OTA 导致的问题

---

## 2. 基本原则

## 2.1 观测能力是系统基础设施，不是事后补丁

日志和调试面板不能等系统复杂后再补，否则：

- 动作冲突难排
- portable 联调会很痛苦
- OTA 问题难定位
- 树莓派性能退化难复现

---

## 2.2 记录“状态变化的原因”，而不是只记录结果

必须知道：

- 谁触发了动作
- 动作是否被应用
- 状态从什么变成什么
- 为什么被忽略或拒绝

---

## 2.3 调试输出必须分层

建议至少拆成：

- action logs
- state transition logs
- integration sync logs
- performance telemetry
- ota logs
- auth / session logs

---

## 2.4 默认观测应轻量、安全

必须避免：

- 暴露第三方 token
- 输出敏感个人数据全文
- 在正常运行时产生过高日志开销

---

## 3. 观测对象

建议覆盖以下对象：

- `SystemState`
- `Actions`
- `Playback bridge`
- `ScreenContext`
- `Calendar / Todoist connectors`
- `Portable controller sessions`
- `Performance tier`
- `OTA lifecycle`
- `Auth / authorization`

---

## 4. 日志分类

## 4.1 Action Log

记录所有进入系统动作层的请求。

### 目的

- 排查“动作有没有发到系统”
- 排查“portable 到底有没有成功触发动作”
- 排查“动作被忽略还是被拒绝”

### 建议字段

```ts
type ActionLog = {
  timestamp: string;
  requestId?: string;
  source: "touch" | "remote" | "portable_controller" | "api" | "system";
  actionType: string;
  payloadSummary?: Record<string, unknown>;
  result: "applied" | "ignored" | "rejected";
  errorCode?: string;
  durationMs?: number;
};
```

### 示例

```json
{
  "timestamp": "2026-04-20T10:00:00Z",
  "requestId": "portable-req-001",
  "source": "portable_controller",
  "actionType": "set_mode",
  "payloadSummary": { "mode": "flow" },
  "result": "applied",
  "durationMs": 14
}
```

---

## 4.2 State Transition Log

记录系统状态的关键变化。

### 目的

- 排查“动作发了，但为什么 UI 没变”
- 排查 activeMode / focusedPanel / overlay / performanceTier 的变化

### 建议字段

```ts
type StateTransitionLog = {
  timestamp: string;
  source: string;
  reasonAction?: string;
  from: {
    activeMode?: string;
    overlay?: string;
    flowState?: string;
    pomodoroState?: string;
    performanceTier?: string;
    otaStatus?: string;
  };
  to: {
    activeMode?: string;
    overlay?: string;
    flowState?: string;
    pomodoroState?: string;
    performanceTier?: string;
    otaStatus?: string;
  };
};
```

### 原则

- 只记录关键字段摘要
- 不必把整个大状态树每次完整 dump

---

## 4.3 Playback Log

记录播放桥接相关状态变化。

### 关注点

- 播放 / 暂停
- 曲目切换
- 音量变化
- 来源变化

### 示例字段

- `trackTitle`
- `artist`
- `state`
- `volume`
- `source`
- `bridgeLatencyMs`

---

## 4.4 Screen Sync Log

记录 `ScreenContext` 生成过程。

### 目的

- 排查 Calendar / Todoist 到底有没有同步
- 排查为什么当前任务不是预期值
- 排查 stale 的来源

### 建议字段

```ts
type ScreenSyncLog = {
  timestamp: string;
  connector: "calendar" | "todoist" | "screen-mapper";
  status: "ok" | "stale" | "error";
  summary?: string;
  itemCount?: number;
  durationMs?: number;
  errorCode?: string;
};
```

### 示例

```json
{
  "timestamp": "2026-04-20T10:02:00Z",
  "connector": "screen-mapper",
  "status": "ok",
  "summary": "focusItem from todoist, currentBlock from calendar, nextBlock from calendar",
  "durationMs": 8
}
```

---

## 4.5 Auth / Session Log

记录会话注册、过期、拒绝访问等安全相关事件。

### 关注点

- portable session 创建
- session 过期
- 权限不足
- token 验证失败

### 建议字段

- `principalId`
- `role`
- `scopes`
- `action`
- `result`
- `errorCode`

---

## 4.6 OTA Log

记录升级完整生命周期。

### 关注点

- check
- download
- verify
- apply
- restart
- health check
- rollback

### 建议字段

- `currentVersion`
- `targetVersion`
- `status`
- `progress`
- `step`
- `errorCode`

---

## 4.7 Performance Log

记录性能档位与关键遥测变化。

### 建议字段

```ts
type PerformanceLog = {
  timestamp: string;
  previousTier?: "normal" | "reduced" | "safe";
  nextTier?: "normal" | "reduced" | "safe";
  avgFps?: number;
  temperatureC?: number;
  interactionLatencyMs?: number;
  reason?: "fps" | "temperature" | "latency" | "manual";
};
```

---

## 5. 遥测指标建议

## 5.1 系统级

- `currentVersion`
- `activeMode`
- `focusedPanel`
- `overlay.visibility`
- `lastSource`
- `lastUpdatedAt`

## 5.2 性能级

- `performanceTier`
- `avgFps`
- `temperatureC`
- `interactionLatencyMs`
- `memoryUsageMb`

## 5.3 播放级

- `playback.state`
- `playback.source`
- `playback.trackTitle`
- `playback.volume`

## 5.4 Screen 级

- `screen.currentTask`
- `screen.pomodoroState`
- `screen.pomodoroRemainingSec`
- `sync.stale`

## 5.5 OTA 级

- `otaStatus`
- `targetVersion`
- `canRollback`

---

## 6. 调试面板目标

建议提供一个仅开发 / 调试可见的本机 Debug Panel。

它不面向终端用户，而面向：

- 开发
- 联调
- QA
- 真机测试

---

## 7. 调试面板信息结构

建议分为六块：

```text
DebugPanel
  ├─ RuntimeSummary
  ├─ StateInspector
  ├─ ActionTimeline
  ├─ ScreenSyncInspector
  ├─ PerformanceInspector
  └─ OtaInspector
```

---

## 8. RuntimeSummary

### 目的

一眼看当前系统总况。

### 建议显示

- `activeMode`
- `focusedPanel`
- `overlay`
- `playback.state`
- `flow.state`
- `screen.currentTask`
- `performanceTier`
- `otaStatus`
- `lastSource`

### 作用

适合快速回答：

- 现在系统到底处在哪

---

## 9. StateInspector

### 目的

查看当前 `SystemState` 的结构化快照。

### 建议显示

- `SystemState` 的可折叠树
- 关键字段高亮

### 原则

- 只在调试模式显示
- 默认收起复杂字段

---

## 10. ActionTimeline

### 目的

查看最近动作与状态变化。

### 建议显示

- 时间
- 来源
- 动作
- 结果
- 错误码

### 作用

最适合排查：

- “为什么页面没切”
- “portable 明明点了为什么没反应”

---

## 11. ScreenSyncInspector

### 目的

查看 `ScreenContext` 的来源与映射结果。

### 建议显示

- 当前 `focusItem` 来源
- 当前 `currentBlock` 来源
- 当前 `nextBlock` 来源
- Calendar 状态
- Todoist 状态
- stale 标记

### 作用

最适合排查：

- “为什么显示的是这个任务”
- “为什么 next 不是我预期那个”

---

## 12. PerformanceInspector

### 目的

查看当前设备是否处在性能压力下。

### 建议显示

- 当前 `performanceTier`
- 最近 30s 平均 FPS
- 温度
- 输入延迟
- 最近一次降级原因

### 作用

最适合真机调优。

---

## 13. OtaInspector

### 目的

查看升级相关运行态。

### 建议显示

- 当前版本
- 目标版本
- otaStatus
- canRollback
- 最近一次升级结果

---

## 14. 调试面板呈现方式

建议支持两种方式：

## 14.1 本机隐藏入口

例如：

- 开发模式下从角落手势或 query 参数打开

适合：

- 真机调试

## 14.2 独立调试路由

例如：

- `/debug`

适合：

- 开发环境
- 联调环境

### 原则

- 生产默认关闭或受权限限制

---

## 15. 采样与保留策略

不建议无限制保留所有日志。

### 推荐

- ActionTimeline：只保留最近 `100 - 500` 条
- Performance 样本：滚动窗口
- ScreenSync：只保留最近若干次同步结果
- OTA：保留完整最近若干次升级记录

### 原因

- 节省设备资源
- 树莓派 4 上不能无限堆日志

---

## 16. 日志级别建议

建议分级：

- `debug`
- `info`
- `warn`
- `error`

### debug

- 开发期详细动作与映射过程

### info

- 正常关键状态变化

### warn

- stale、降级、权限不足、依赖异常但未致命

### error

- OTA 失败
- connector 持续失败
- 严重状态不一致

---

## 17. 安全与隐私要求

日志和调试面板必须避免泄露：

- 第三方 token
- Bearer token
- API key
- 第三方原始敏感数据全文
- 用户完整私人备注内容

### 建议

- `payloadSummary` 只保留必要字段
- 长文本截断
- 机密字段用占位符替代

---

## 18. 真机排障优先问题

后续真机上最常见的问题，大概率会是这些：

1. API 动作发出，但页面没变
2. portable 改状态，本机没同步
3. Screen 当前任务不符合预期
4. Flow 卡顿
5. OTA 后状态不一致

调试面板应优先帮助回答这些问题，而不是堆一堆通用指标。

---

## 19. 第一版最小可交付范围

## P0

- Action log
- State transition log
- RuntimeSummary
- Performance tier 显示

## P1

- ScreenSyncInspector
- Auth / session log
- OTA log

## P2

- 更完整的历史筛选
- 导出日志
- 远端诊断入口

---

## 20. 结论

日志、遥测与调试面板的核心价值不是“看很多数据”，而是让团队在面对设备问题时能快速判断：

- 是动作问题
- 是状态问题
- 是同步问题
- 是性能问题
- 还是 OTA / 权限问题

一句话总结：

必须让系统“可观察”，否则后面的联调、验收和真机优化都会变得非常低效。
