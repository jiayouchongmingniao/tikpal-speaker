# Issue 拆解与执行清单 v1

## 1. 目标

这份文档把 [开发任务拆解与 Backlog v1](./development-backlog-v1.md) 进一步拆成可直接执行的 issue/checklist。

使用方式：

- 可直接复制到 GitHub Issues / Projects
- 可作为本地开发顺序清单
- 可作为每轮开发完成后的验收列表

---

## 2. 使用规则

每个 issue 都包含：

- `ID`
- `Title`
- `Priority`
- `Depends on`
- `References`
- `Checklist`
- `Done when`

建议执行顺序：

1. 先完成 `P0 Core`
2. 再完成 `P1 Product`
3. 再接 `P1/P2 Integrations`
4. 最后做 `Platform Hardening`

---

## 3. P0 Core

## ISSUE-001 建立统一 SystemState store

**Priority**

`P0`

**Depends on**

- 无

**References**

- [SystemState Schema 与字段字典 v1](../01-architecture/system-state-schema-and-field-dictionary-v1.md)
- [Ambient OS 架构与模式切换规格 v1](../01-architecture/ambient-os-architecture-and-mode-switching-v1.md)

**Checklist**

- [ ] 建立统一 `SystemState` 类型定义
- [ ] 定义 `activeMode / focusedPanel / transition / overlay`
- [ ] 定义 `playback / flow / screen / system / integrations / controller`
- [ ] 建立基础 selectors
- [ ] 提供初始化默认状态
- [ ] 提供状态更新入口

**Done when**

- 前端存在唯一系统状态入口
- 不再依赖多个页面私有全局状态

---

## ISSUE-002 建立统一 ActionDispatcher

**Priority**

`P0`

**Depends on**

- `ISSUE-001`

**References**

- [Actions 语义字典与状态转换表 v1](../04-api/actions-semantics-and-state-transitions-v1.md)

**Checklist**

- [ ] 定义 action request / response 结构
- [ ] 实现 `set_mode`
- [ ] 实现 `return_overview`
- [ ] 实现 `show_controls / hide_controls`
- [ ] 实现 `toggle_play / set_volume`
- [ ] 实现 `set_flow_state`
- [ ] 实现 `screen_start_pomodoro / pause / reset`
- [ ] 记录 `lastSource / lastUpdatedAt`

**Done when**

- 本机 UI 与 API 都能通过同一套 action 改系统状态

---

## ISSUE-003 建立转场状态与输入锁

**Priority**

`P0`

**Depends on**

- `ISSUE-001`
- `ISSUE-002`

**References**

- [Overview 到 Focus 的转场与手势规格 v1](../03-interaction/overview-to-focus-transitions-and-gestures-v1.md)

**Checklist**

- [ ] 定义 `transition.phase`
- [ ] 定义 `transition.from / to`
- [ ] 定义 `transition.locked`
- [ ] 支持 `Overview -> Focus`
- [ ] 支持 `Focus -> Overview`
- [ ] 支持 `Focus -> Focus`
- [ ] 转场期间阻止模式切换重入

**Done when**

- 模式切换期间不会重复触发导致状态抖动

---

## ISSUE-004 建立 `/api/v1/system/state`

**Priority**

`P0`

**Depends on**

- `ISSUE-001`

**References**

- [System API Contract v1](../04-api/system-api-contract-v1.md)

**Checklist**

- [ ] 输出完整 `SystemState`
- [ ] 统一 `Content-Type`
- [ ] 补基础错误模型
- [ ] 本机 curl 可读
- [ ] 前端可读

**Done when**

- `GET /api/v1/system/state` 返回稳定系统快照

---

## ISSUE-005 建立 `/api/v1/system/actions`

**Priority**

`P0`

**Depends on**

- `ISSUE-002`
- `ISSUE-004`

**References**

- [System API Contract v1](../04-api/system-api-contract-v1.md)
- [Actions 语义字典与状态转换表 v1](../04-api/actions-semantics-and-state-transitions-v1.md)

**Checklist**

- [ ] 接 action dispatcher
- [ ] 返回 `applied / ignored / rejected`
- [ ] 返回最新 state
- [ ] 覆盖最小动作集
- [ ] 统一错误码

**Done when**

- curl / 前端 / portable 都可调用统一 actions 接口

---

## ISSUE-006 建立 SystemShell

**Priority**

`P0`

**Depends on**

- `ISSUE-001`
- `ISSUE-002`

**References**

- [页面与组件边界规格 v1](../01-architecture/page-and-component-boundaries-v1.md)

**Checklist**

- [ ] 建立 `BackgroundStage`
- [ ] 建立 `ModeViewport`
- [ ] 建立 `GlobalOverlay` 挂载点
- [ ] 建立 `InputRouter`
- [ ] 建立 `ApiSyncBridge`

**Done when**

- 页面已经运行在统一壳层里，而不是单页原型模式

---

## ISSUE-007 实现 OverviewPage 与三卡布局

**Priority**

`P0`

**Depends on**

- `ISSUE-006`

**References**

- [Overview 视觉与交互规格 v1](../02-product/overview-visual-and-interaction-v1.md)
- [Overview 三卡片线框与信息层级规格 v1](../02-product/overview-card-wireframes-v1.md)

**Checklist**

- [ ] 三分屏布局
- [ ] `ListenCard`
- [ ] `FlowCard`
- [ ] `ScreenCard`
- [ ] 卡片主区和控件区热区分离
- [ ] 默认模式为 `overview`

**Done when**

- 开机能看到稳定的三分屏总览

---

## ISSUE-008 实现 Overview <-> Focus 转场

**Priority**

`P0`

**Depends on**

- `ISSUE-003`
- `ISSUE-007`

**References**

- [Overview 到 Focus 的转场与手势规格 v1](../03-interaction/overview-to-focus-transitions-and-gestures-v1.md)

**Checklist**

- [ ] 点击卡片进入全屏
- [ ] 返回 Overview 收束动画
- [ ] 无白屏
- [ ] 无硬切页

**Done when**

- 用户能清楚感受到“卡片被拉到前台”

---

## 4. P0 Product

## ISSUE-009 ListenPage MVP

**Priority**

`P0`

**Depends on**

- `ISSUE-006`
- `ISSUE-008`

**References**

- [Listen 全屏信息架构规格 v1](../02-product/listen-fullscreen-information-architecture-v1.md)

**Checklist**

- [ ] 当前曲目名
- [ ] 艺术家
- [ ] 播放状态
- [ ] 音量
- [ ] 来源
- [ ] 进度条
- [ ] 播放控制
- [ ] 返回 Overview / 去 Flow / 去 Screen

**Done when**

- Listen 看起来像数播控制前台，而不是普通 App 页面

---

## ISSUE-010 FlowPage MVP

**Priority**

`P0`

**Depends on**

- `ISSUE-006`
- `ISSUE-008`

**References**

- [Flow 全屏信息架构与视觉层级规格 v1](../02-product/flow-fullscreen-information-architecture-v1.md)

**Checklist**

- [ ] Background layer
- [ ] Main visual layer
- [ ] State title
- [ ] Minimal overlay entry points
- [ ] 四个 Flow 状态

**Done when**

- Flow 成为独立完整聚焦态

---

## ISSUE-011 FlowCard 与 FlowPage 解耦

**Priority**

`P0`

**Depends on**

- `ISSUE-007`
- `ISSUE-010`

**References**

- [页面与组件边界规格 v1](../01-architecture/page-and-component-boundaries-v1.md)
- [树莓派 4 性能预算与降级实施细则 v1](../05-platform/raspberry-pi-4-performance-and-degradation-v1.md)

**Checklist**

- [ ] Overview 中的 FlowCard 不复用完整 FlowPage
- [ ] FlowCard 为低成本摘要实现
- [ ] 只有 `focused_flow` 跑完整主视觉

**Done when**

- Overview 不再同时运行重 Flow 引擎

---

## ISSUE-012 ScreenPage MVP

**Priority**

`P0`

**Depends on**

- `ISSUE-006`
- `ISSUE-008`

**References**

- [Screen 信息架构与外部 API 接入规格 v1](../02-product/screen-information-architecture-and-api-integration-v1.md)

**Checklist**

- [ ] 当前任务主区
- [ ] 番茄钟区域
- [ ] 下一项
- [ ] 今日摘要
- [ ] 返回 Overview / 去 Listen / 去 Flow

**Done when**

- 不接外部服务时，Screen 仍可工作

---

## ISSUE-013 本地番茄钟闭环

**Priority**

`P0`

**Depends on**

- `ISSUE-002`
- `ISSUE-012`

**References**

- [Actions 语义字典与状态转换表 v1](../04-api/actions-semantics-and-state-transitions-v1.md)

**Checklist**

- [ ] start
- [ ] pause
- [ ] reset
- [ ] 绑定当前任务
- [ ] 写回 `SystemState.screen`

**Done when**

- Screen 与 portable 都能控制番茄钟

---

## 5. P1 Interaction & Overlay

## ISSUE-014 实现 GlobalOverlay MVP

**Priority**

`P1`

**Depends on**

- `ISSUE-006`

**References**

- [GlobalOverlay 信息架构规格 v1](../03-interaction/global-overlay-information-architecture-v1.md)

**Checklist**

- [ ] ControlStrip
- [ ] 基础 ModeSwitcher
- [ ] StatusHint
- [ ] 自动隐藏策略

**Done when**

- 任何聚焦态都可统一唤醒最小控制层

---

## ISSUE-015 实现多点触摸基础手势

**Priority**

`P1`

**Depends on**

- `ISSUE-008`
- `ISSUE-014`

**References**

- [多点触摸手势优先级与误触防护规格 v1](../03-interaction/multi-touch-priority-and-mistouch-prevention-v1.md)

**Checklist**

- [ ] Overview 单击卡片主区进入
- [ ] 聚焦态单击空白唤醒 overlay
- [ ] 双指捏合返回 Overview
- [ ] 手势优先级与误触阈值

**Done when**

- 触摸主路径稳定，不误判

---

## ISSUE-016 遥控器导航与焦点流

**Priority**

`P1`

**Depends on**

- `ISSUE-007`
- `ISSUE-014`

**References**

- [统一导航与模式切换规则 v1](../03-interaction/unified-navigation-and-mode-switching-v1.md)

**Checklist**

- [ ] Overview 左右高亮卡片
- [ ] OK 进入
- [ ] Focus 态 Back 返回
- [ ] Overlay 中的焦点移动

**Done when**

- 遥控器可完成核心闭环

---

## 6. P1 API & Security

## ISSUE-017 实现 capabilities

**Priority**

`P1`

**Depends on**

- `ISSUE-004`

**References**

- [System API Contract v1](../04-api/system-api-contract-v1.md)

**Checklist**

- [ ] `modes`
- [ ] `flowStates`
- [ ] `touch.multiTouch`
- [ ] `screenFeatures`
- [ ] `ota`
- [ ] `performance`

**Done when**

- portable 可根据能力决定 UI

---

## ISSUE-018 实现 controller sessions

**Priority**

`P1`

**Depends on**

- `ISSUE-005`

**References**

- [便携控制器（tikpal portable）交互与 API 对接规格 v1](../04-api/tikpal-portable-controller-integration-v1.md)
- [API 认证与权限模型 v1](../04-api/api-authentication-and-authorization-v1.md)

**Checklist**

- [ ] create session
- [ ] get session
- [ ] revoke / delete session
- [ ] 过期时间
- [ ] 记录 `lastSeenAt`

**Done when**

- portable 能以会话方式访问系统 API

---

## ISSUE-019 实现最小权限分层

**Priority**

`P1`

**Depends on**

- `ISSUE-005`
- `ISSUE-018`

**References**

- [API 认证与权限模型 v1](../04-api/api-authentication-and-authorization-v1.md)

**Checklist**

- [ ] `viewer / controller / admin`
- [ ] action 权限检查
- [ ] OTA 仅 admin
- [ ] portable 默认 controller

**Done when**

- portable 无法触发高权限管理动作

---

## 7. P1/P2 Screen Integrations

## ISSUE-020 建立 ScreenContext service

**Priority**

`P1`

**Depends on**

- `ISSUE-001`
- `ISSUE-012`

**References**

- [ScreenContext 映射规则明细 v1](../02-product/screen-context-mapping-rules-v1.md)

**Checklist**

- [ ] 定义 `ScreenContext` 结构
- [ ] 支持本地任务 / 番茄钟输入
- [ ] 输出给 UI 和 API

**Done when**

- Screen 页面不再直接拼凑来自多个来源的字段

---

## ISSUE-021 Calendar connector

**Priority**

`P2`

**Depends on**

- `ISSUE-020`

**References**

- [连接器配置与绑定流程规格 v1](../05-platform/connector-configuration-and-binding-v1.md)

**Checklist**

- [ ] 连接状态模型
- [ ] sync worker
- [ ] 当前事件 / 下一事件抽取
- [ ] `remainingEvents`
- [ ] stale / error 策略

**Done when**

- `currentBlock / nextBlock` 可从 Calendar 生成

---

## ISSUE-022 Todoist connector

**Priority**

`P2`

**Depends on**

- `ISSUE-020`

**References**

- [连接器配置与绑定流程规格 v1](../05-platform/connector-configuration-and-binding-v1.md)

**Checklist**

- [ ] 连接状态模型
- [ ] Today 任务同步
- [ ] focus task 候选
- [ ] `remainingTasks`
- [ ] stale / error 策略

**Done when**

- `focusItem` 和任务摘要可从 Todoist 生成

---

## ISSUE-023 ScreenContext 映射器

**Priority**

`P2`

**Depends on**

- `ISSUE-021`
- `ISSUE-022`

**References**

- [ScreenContext 映射规则明细 v1](../02-product/screen-context-mapping-rules-v1.md)

**Checklist**

- [ ] 手动 focus 优先
- [ ] 番茄钟绑定优先
- [ ] Calendar 当前 block 规则
- [ ] nextBlock 优先级规则
- [ ] stale 行为

**Done when**

- ScreenContext 合并逻辑稳定、可测试

---

## 8. P1/P2 Portable

## ISSUE-024 portable 最小控制闭环

**Priority**

`P1`

**Depends on**

- `ISSUE-017`
- `ISSUE-018`
- `ISSUE-019`

**References**

- [便携控制器（tikpal portable）交互与 API 对接规格 v1](../04-api/tikpal-portable-controller-integration-v1.md)
- [Screen / Flow / Listen / portable 端到端用户场景脚本 v1](../07-scenarios/end-to-end-user-scenarios-v1.md)

**Checklist**

- [ ] 读 `state`
- [ ] 读 `capabilities`
- [ ] 切模式
- [ ] 播放/暂停
- [ ] 音量
- [ ] Flow 状态切换

**Done when**

- portable 能完成日常主控制

---

## ISSUE-025 portable 的 Screen 控制增强

**Priority**

`P2`

**Depends on**

- `ISSUE-024`
- `ISSUE-020`

**Checklist**

- [ ] 启动 / 暂停番茄钟
- [ ] 完成当前任务
- [ ] 切 focus item

**Done when**

- portable 能承担 Screen 的主要近身控制入口

---

## 9. P1/P2 Platform Hardening

## ISSUE-026 Action / State / Runtime 调试面板

**Priority**

`P1`

**Depends on**

- `ISSUE-001`
- `ISSUE-002`
- `ISSUE-005`

**References**

- [日志、遥测与调试面板规格 v1](../05-platform/logging-telemetry-and-debug-panel-v1.md)

**Checklist**

- [ ] Action log
- [ ] State transition log
- [ ] RuntimeSummary
- [ ] 调试入口

**Done when**

- 联调时能回答“动作到了没、状态变了没”

---

## ISSUE-027 Performance telemetry

**Priority**

`P2`

**Depends on**

- `ISSUE-010`
- `ISSUE-011`

**References**

- [树莓派 4 性能预算与降级实施细则 v1](../05-platform/raspberry-pi-4-performance-and-degradation-v1.md)

**Checklist**

- [ ] `performanceTier`
- [ ] `avgFps`
- [ ] 最近一次降级原因
- [ ] 手动切档测试

**Done when**

- 能在真机上观察与验证降级逻辑

---

## ISSUE-028 OTA status / check

**Priority**

`P2`

**Depends on**

- `ISSUE-004`
- `ISSUE-019`

**References**

- [OTA 升级与回滚流程规格 v1](../05-platform/ota-upgrade-and-rollback-v1.md)

**Checklist**

- [ ] `GET ota/status`
- [ ] `POST ota/check`
- [ ] 将状态写入 `SystemState.system`
- [ ] Overlay 提示

**Done when**

- 系统能表达是否有可用升级

---

## ISSUE-029 OTA apply / rollback

**Priority**

`P3`

**Depends on**

- `ISSUE-028`

**Checklist**

- [ ] 版本目录结构
- [ ] apply
- [ ] restart
- [ ] health check
- [ ] rollback

**Done when**

- 应用层 OTA 完整闭环可跑通

---

## 10. 建议迭代批次

## Batch A

- ISSUE-001
- ISSUE-002
- ISSUE-003
- ISSUE-004
- ISSUE-005
- ISSUE-006

目标：

- 先把系统骨架做起来

## Batch B

- ISSUE-007
- ISSUE-008
- ISSUE-009
- ISSUE-010
- ISSUE-011

目标：

- 做出 Overview + Listen + Flow 主闭环

## Batch C

- ISSUE-012
- ISSUE-013
- ISSUE-014
- ISSUE-015
- ISSUE-016

目标：

- 把 Screen 与统一交互层补齐

## Batch D

- ISSUE-017
- ISSUE-018
- ISSUE-019
- ISSUE-024

目标：

- 让 portable 安全接入

## Batch E

- ISSUE-020
- ISSUE-021
- ISSUE-022
- ISSUE-023
- ISSUE-025

目标：

- 接入真实 Screen 外部上下文

## Batch F

- ISSUE-026
- ISSUE-027
- ISSUE-028
- ISSUE-029

目标：

- 平台化与长期运行能力

---

## 11. 当前实现状态（2026-04-26）

当前代码已经不是“从 Batch A 开始”的空白状态，而是一个可运行的 ambient OS 系统原型。

- Batch A：已完成。`SystemState`、ActionDispatcher、转场锁、`/api/v1/system/state`、`/api/v1/system/actions`、`SystemShell` 已落地，并由 `npm run test:smoke` 和 `npm run test:http-smoke` 覆盖。
- Batch B：已完成。`Overview / Listen / Flow` 主闭环、卡片进入 focus、返回 Overview、FlowCard 与 FlowPage 分离已落地。
- Batch C：已完成。`ScreenPage`、本地番茄钟、`GlobalOverlay`、触摸/触摸板/遥控器式键盘导航已落地。
- Batch D：已完成。`capabilities`、controller sessions、pairing codes、`viewer / controller / operator / admin` 权限分层、portable 最小控制闭环已落地。
- Batch E：部分完成。`ScreenContext service`、映射器、portable Screen 控制、connector adapter contract、fixture Calendar/Todoist adapters、真实 Calendar/Todoist adapter 骨架、stale/error/last-good 行为已落地；真实 OAuth/token refresh/secret store 仍待实现。
- Batch F：部分完成。Action/runtime logs、runtime summary、performance telemetry action、前端 FPS/latency/memory 采样、Flow Canvas 性能档位降级、OTA status/check/apply/rollback state skeleton 已落地；真机阈值调优与真实 OTA release/restart/health-check/rollback 仍待实现。
- Phase 1 持久化准备：已新增本地 JSON 持久化层，覆盖 SystemState、controller sessions、pairing codes、connector credential metadata，并由 `npm run test:persistence` 验证重启恢复。

---

## 12. 当前建议

下一步建议进入真实设备/真实数据接入，而不是继续补静态页面细节。

最小启动顺序：

1. 真实 Calendar/Todoist 接入：在 `server/connectorAdapters.js` 已有 adapter 骨架上接服务端 secret store、OAuth/token refresh 和真实 API 拉取；继续保留 fixture adapter 作为测试通道。
2. 真实播放器桥接：用 moOde-backed implementation 替换 mock player bridge，保持现有 playback/action contract。
3. 真机性能调优：前端已上报 FPS/latency/memory 并驱动 `normal / reduced / safe` 渲染降级；下一步用树莓派 4 实测数据校准阈值。
4. 真实 OTA：将当前 state skeleton 扩展为 release 目录、服务重启、健康检查、失败回滚。

这会最快把项目从“可运行系统原型”推进到“可上真实设备联调的版本”。
