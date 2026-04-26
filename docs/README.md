# tikpal-speaker Docs

本目录用于沉淀 `tikpal-speaker` 的产品、架构、交互、API、平台与实施规划文档，作为后续开发与评审的统一参考。

## 目录

### 01 Architecture

- [Ambient OS 架构与模式切换规格 v1](./01-architecture/ambient-os-architecture-and-mode-switching-v1.md)
- [页面与组件边界规格 v1](./01-architecture/page-and-component-boundaries-v1.md)
- [设备端服务拆分与部署拓扑规格 v1](./01-architecture/device-services-and-deployment-topology-v1.md)
- [SystemState Schema 与字段字典 v1](./01-architecture/system-state-schema-and-field-dictionary-v1.md)

### 02 Product

- [Overview 视觉与交互规格 v1](./02-product/overview-visual-and-interaction-v1.md)
- [Overview 三卡片线框与信息层级规格 v1](./02-product/overview-card-wireframes-v1.md)
- [Listen 全屏信息架构规格 v1](./02-product/listen-fullscreen-information-architecture-v1.md)
- [Flow 全屏信息架构与视觉层级规格 v1](./02-product/flow-fullscreen-information-architecture-v1.md)
- [Screen 信息架构与外部 API 接入规格 v1](./02-product/screen-information-architecture-and-api-integration-v1.md)
- [ScreenContext 映射规则明细 v1](./02-product/screen-context-mapping-rules-v1.md)

### 03 Interaction

- [统一导航与模式切换规则 v1](./03-interaction/unified-navigation-and-mode-switching-v1.md)
- [Overview 到 Focus 的转场与手势规格 v1](./03-interaction/overview-to-focus-transitions-and-gestures-v1.md)
- [多点触摸手势优先级与误触防护规格 v1](./03-interaction/multi-touch-priority-and-mistouch-prevention-v1.md)
- [GlobalOverlay 信息架构规格 v1](./03-interaction/global-overlay-information-architecture-v1.md)

### 04 API

- [System API Contract v1](./04-api/system-api-contract-v1.md)
- [Actions 语义字典与状态转换表 v1](./04-api/actions-semantics-and-state-transitions-v1.md)
- [API 认证与权限模型 v1](./04-api/api-authentication-and-authorization-v1.md)
- [便携控制器（tikpal portable）交互与 API 对接规格 v1](./04-api/tikpal-portable-controller-integration-v1.md)
- [tikpal portable REST API 对接手册 v1](./04-api/tikpal-portable-rest-api-integration-v1.md)

### 05 Platform

- [树莓派 4 性能预算与降级实施细则 v1](./05-platform/raspberry-pi-4-performance-and-degradation-v1.md)
- [OTA 升级与回滚流程规格 v1](./05-platform/ota-upgrade-and-rollback-v1.md)
- [日志、遥测与调试面板规格 v1](./05-platform/logging-telemetry-and-debug-panel-v1.md)
- [连接器配置与绑定流程规格 v1](./05-platform/connector-configuration-and-binding-v1.md)

### 06 Planning

- [实施路线与里程碑规划 v1](./06-planning/implementation-roadmap-v1.md)
- [技术选型与实现建议 v1](./06-planning/technical-selection-and-implementation-v1.md)
- [风险清单与决策记录 v1](./06-planning/risks-and-decision-log-v1.md)
- [文档缺口与下一步规格清单 v1](./06-planning/documentation-gaps-and-next-specs-v1.md)
- [开发任务拆解与 Backlog v1](./06-planning/development-backlog-v1.md)
- [Issue 拆解与执行清单 v1](./06-planning/issue-breakdown-and-execution-checklist-v1.md)

### 07 Scenarios

- [Screen / Flow / Listen / portable 端到端用户场景脚本 v1](./07-scenarios/end-to-end-user-scenarios-v1.md)
- [目标设备联调与验收记录 v1](./07-scenarios/target-device-validation-runbook-v1.md)

## 使用建议

- 架构与接口开发前，优先读 `01-architecture` 与 `04-api`
- UI 和交互实现前，优先读 `02-product` 与 `03-interaction`
- 上树莓派、做 OTA、做长期运行优化前，优先读 `05-platform`
- 排期、拆任务和评审时，优先读 `06-planning`
