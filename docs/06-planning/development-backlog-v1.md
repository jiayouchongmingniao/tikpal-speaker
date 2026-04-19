# 开发任务拆解与 Backlog v1

## 1. 目标

这份文档把当前已沉淀的产品、架构、交互、API、平台规格，收敛成可执行的开发 backlog。

目标不是列所有想法，而是给出：

- 先做什么
- 后做什么
- 哪些是 P0
- 哪些依赖哪些前置项
- 每个任务完成后如何判断是否可进入下一步

---

## 2. Backlog 使用原则

### 2.1 先做系统骨架，再做表现层

优先级必须是：

1. SystemState
2. Actions
3. System API
4. Overview + Focus 结构
5. Listen / Flow / Screen 各自页面
6. portable / connectors / OTA

### 2.2 优先完成闭环，而不是完成单点功能

例如：

- 先让 `Overview -> Flow -> Overview` 完整可用
- 再去细化 Flow 的视觉高级效果

### 2.3 所有任务都要能映射到已存在规格

不从空想拆任务，所有任务都应能追溯到 `docs/` 中的对应规格。

---

## 3. Epic 划分

建议 backlog 按 8 个 Epic 拆：

- `E1` 系统状态与动作层
- `E2` System API 与权限
- `E3` Overview + Focus 基础前台
- `E4` Listen 模式
- `E5` Flow 模式
- `E6` Screen 模式
- `E7` portable 与外部控制
- `E8` 平台能力：性能 / OTA / connectors / debug

---

## 4. E1 系统状态与动作层

## 目标

建立 ambient OS 的核心控制平面。

### P0-1 定义 `SystemState`

来源文档：

- `SystemState Schema 与字段字典 v1`

任务：

- 建立统一 `SystemState` 数据结构
- 建立系统 store
- 建立 slice / selector 方案

完成标准：

- 页面不再靠零散 hook 拼状态
- 能输出完整 `SystemState`

---

### P0-2 建立 `Actions` 分发器

来源文档：

- `Actions 语义字典与状态转换表 v1`

任务：

- 实现统一 action dispatcher
- 支持最小动作集
- 记录 `lastSource / lastUpdatedAt`

完成标准：

- 本机输入和 API 都能通过统一动作改状态

---

### P0-3 建立转场状态控制器

来源文档：

- `Overview 到 Focus 的转场与手势规格 v1`

任务：

- 建立 `transition` 状态
- 处理转场锁
- 支持 `Overview <-> Focus` 与 `Focus <-> Focus`

完成标准：

- 模式切换不是硬切

---

## 5. E2 System API 与权限

## 目标

把当前本地原型提升为系统级可控设备。

### P0-4 落地 `/api/v1/system/state`

来源文档：

- `System API Contract v1`

任务：

- 输出统一 `SystemState`
- 去掉页面专属语义

完成标准：

- UI 与 portable 都能读同一份状态

---

### P0-5 落地 `/api/v1/system/actions`

任务：

- 接 `Actions` dispatcher
- 统一错误码
- 返回 action result + 最新 state

完成标准：

- curl / 本机 UI / portable 可共用

---

### P1-1 落地 `capabilities`

任务：

- 输出 modes / flowStates / touch / screenFeatures / ota / performance

完成标准：

- portable 可以先读能力再决定 UI

---

### P1-2 落地权限分层

来源文档：

- `API 认证与权限模型 v1`

任务：

- viewer / controller / admin 角色
- controller session
- action 级权限检查

完成标准：

- portable 默认只能控制，不能管理

---

## 6. E3 Overview + Focus 基础前台

## 目标

建立 ambient OS 的第一版核心体验。

### P0-6 实现 `SystemShell`

来源文档：

- `Ambient OS 架构与模式切换规格 v1`
- `页面与组件边界规格 v1`

任务：

- `BackgroundStage`
- `ModeViewport`
- `GlobalOverlay`
- `ApiSyncBridge`

完成标准：

- 前台页面挂在同一系统壳中

---

### P0-7 实现 `OverviewPage`

来源文档：

- `Overview 视觉与交互规格 v1`
- `Overview 三卡片线框与信息层级规格 v1`

任务：

- 三分屏布局
- `ListenCard / FlowCard / ScreenCard`
- 主区与控件区分离

完成标准：

- `Overview` 成为默认主层

---

### P0-8 实现 `Overview -> Focus` 转场

来源文档：

- `Overview 到 Focus 的转场与手势规格 v1`

任务：

- 卡片放大全屏
- 全屏收束回卡片

完成标准：

- 无白屏、无硬切

---

## 7. E4 Listen 模式

## 目标

把设备真正做出“像数播”的前台。

### P0-9 实现 `ListenPage` 第一版

来源文档：

- `Listen 全屏信息架构规格 v1`

任务：

- 当前曲目 / 艺术家
- 播放状态
- 音量
- 来源
- 进度条
- 播放控制

完成标准：

- 进入 Listen 后用户能清晰控制声音

---

### P1-3 Listen 技术信息与队列摘要

任务：

- `format / sampleRate / bitDepth`
- `nextTrackTitle`
- Queue 入口摘要

完成标准：

- 数播感增强，但不过度堆叠信息

---

## 8. E5 Flow 模式

## 目标

把当前已有 Flow 原型重构成 ambient OS 中的正式模式。

### P0-10 重构 `FlowPage`

来源文档：

- `Flow 全屏信息架构与视觉层级规格 v1`

任务：

- 背景层
- 主视觉层
- 状态标题层
- 控制层

完成标准：

- Flow 成为独立聚焦态，而不是单独页面原型

---

### P0-11 让 `FlowCard` 与 `FlowPage` 分离

来源文档：

- `页面与组件边界规格 v1`
- `树莓派 4 性能预算与降级实施细则 v1`

任务：

- `FlowCard` 改成低成本摘要态
- 仅 `focused_flow` 运行完整版视觉

完成标准：

- Overview 不再跑重 Flow 引擎

---

### P1-4 音频映射与性能档位接入

任务：

- `normal / reduced / safe`
- lowEnergy / highEnergy 映射
- 降级可切换

完成标准：

- Flow 在树莓派 4 上长时间可用

---

## 9. E6 Screen 模式

## 目标

把 Screen 做成真正的任务与节奏表面。

### P0-12 实现 `ScreenPage` 第一版

来源文档：

- `Screen 信息架构与外部 API 接入规格 v1`

任务：

- 当前任务
- 倒计时
- 下一项
- 今日摘要

完成标准：

- 不依赖外部 API 也能运行

---

### P0-13 实现番茄钟本地闭环

任务：

- start / pause / reset
- 绑定当前任务
- 同步到 `SystemState.screen`

完成标准：

- 本机和 portable 都能控制番茄钟

---

### P1-5 实现 `ScreenContext` 服务

来源文档：

- `ScreenContext 映射规则明细 v1`

任务：

- focusItem / currentBlock / nextBlock / todaySummary 映射
- stale 策略

完成标准：

- Screen 页面只消费 ScreenContext，不处理第三方 schema

---

## 10. E7 portable 与外部控制

## 目标

让 `tikpal portable` 成为可靠的第二控制入口。

### P1-6 controller session

来源文档：

- `tikpal portable 交互与 API 对接规格 v1`
- `API 认证与权限模型 v1`

任务：

- session 创建 / 读取 / 删除
- controller 角色

完成标准：

- portable 可获得临时控制权限

---

### P1-7 portable 最小控制闭环

任务：

- `set_mode`
- `toggle_play`
- `set_volume`
- `set_flow_state`
- `screen_start_pomodoro`

完成标准：

- portable 可完成主控制路径

---

### P2-1 portable Screen 增强

任务：

- `screen_complete_current_task`
- `screen_set_focus_item`

完成标准：

- portable 能承担 Screen 的主要控制角色

---

## 11. E8 平台能力

## 目标

让系统可长期运行、可升级、可调试。

### P1-8 连接器状态与本地缓存

来源文档：

- `连接器配置与绑定流程规格 v1`

任务：

- `SystemState.integrations`
- connector 状态模型
- 本地缓存与 stale 标记

---

### P2-2 Calendar / Todoist connectors

任务：

- sync worker
- mapper
- ScreenContext 输入层

完成标准：

- Screen 可消费真实外部数据

---

### P1-9 Debug 面板与日志基础

来源文档：

- `日志、遥测与调试面板规格 v1`

任务：

- Action log
- State transition log
- RuntimeSummary

完成标准：

- 联调时能快速定位动作与状态问题

---

### P2-3 Performance telemetry

任务：

- avgFps
- performanceTier
- 最近一次降级原因

完成标准：

- 树莓派真机可观测性能退化

---

### P2-4 OTA check/status

来源文档：

- `OTA 升级与回滚流程规格 v1`

任务：

- status
- check
- overlay 提示

完成标准：

- UI 和 API 能表达升级状态

---

### P3-1 OTA apply / rollback

任务：

- 版本目录切换
- health check
- rollback

完成标准：

- 应用层 OTA 可用

---

## 12. 建议迭代顺序

## 第一轮：系统骨架可跑

- P0-1
- P0-2
- P0-4
- P0-5
- P0-6

产出：

- 有统一状态、动作和 API 的壳

---

## 第二轮：Overview + Listen + Flow 闭环

- P0-7
- P0-8
- P0-9
- P0-10
- P0-11

产出：

- Ambient OS 主体验最小闭环

---

## 第三轮：Screen 本地闭环

- P0-12
- P0-13
- P1-5

产出：

- Screen 任务节奏模式成型

---

## 第四轮：portable 与权限

- P1-1
- P1-2
- P1-6
- P1-7

产出：

- 远端可安全控制设备

---

## 第五轮：平台化

- P1-8
- P1-9
- P2-2
- P2-3
- P2-4

产出：

- 可调试、可接外部数据、可准备 OTA

---

## 13. 验收组织建议

每个 Epic 完成后建议至少做三类验收：

### 架构验收

- 是否符合对应规格

### 交互验收

- 本机触摸 / 遥控器 / portable 是否一致

### 平台验收

- 树莓派上是否可运行
- 是否可调试

---

## 14. 当前开发建议

如果马上开始实现，我建议从这 6 项先做：

1. `SystemState`
2. `Actions`
3. `/api/v1/system/state`
4. `/api/v1/system/actions`
5. `SystemShell + OverviewPage`
6. `ListenPage / FlowPage` 的最低闭环

这样能最快把项目从“Flow 原型”推进到“ambient OS 雏形”。

---

## 15. 结论

这份 backlog 的核心不是列出所有事情，而是明确：

- 哪些是系统底座
- 哪些是模式体验
- 哪些是平台化能力

一句话总结：

先把系统壳和状态语言做对，再逐步补 Listen、Flow、Screen 和 portable，最后再上 connectors、OTA 和长期运行能力。
