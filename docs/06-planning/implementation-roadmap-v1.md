# 实施路线与里程碑规划 v1

## M0 基础系统骨架

- `SystemState`
- `SystemShell`
- `InputRouter`
- `ApiSyncBridge`
- 系统级 API 骨架
- 性能档位字段

## M1 Overview + 三模式切换闭环

- `OverviewPage`
- `ListenCard / FlowCard / ScreenCard`
- `ListenPage` 第一版
- `FlowPage` 第一版
- `ScreenPage` 占位版
- 进入全屏 / 返回 Overview

## M2 Screen 任务节奏层

- `ScreenContext`
- 本机番茄钟
- 当前任务 / 下一项 / 今日摘要

## M3 外部连接与便携控制器

- Calendar connector
- Todoist connector
- controller sessions
- 统一 actions 接入

## M4 OTA 与系统稳定化

- OTA check / apply / rollback
- 自动降级
- 长稳测试

## 总原则

- 先系统骨架，后视觉复杂度
- 先本机闭环，后外部集成
- 先做低成本正确版，再慢慢增强
