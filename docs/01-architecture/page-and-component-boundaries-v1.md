# 页面与组件边界规格 v1

## 顶层结构

```text
AmbientOSApp
  ├─ SystemShell
  │  ├─ BackgroundStage
  │  ├─ ModeViewport
  │  ├─ GlobalOverlay
  │  ├─ InputRouter
  │  └─ ApiSyncBridge
  └─ DeviceServices
```

## 页面边界

### OverviewPage

职责：

- 展示 `ListenCard / FlowCard / ScreenCard`
- 提供轻操作
- 作为进入全屏模式的入口

禁止：

- 三个完整页面并行运行
- 完整 Flow 主视觉
- 完整任务管理界面

### ListenPage

职责：

- 当前播放信息
- 音量与来源
- 基础播放控制

禁止：

- 复杂任务结构
- Flow 沉浸视觉

### FlowPage

职责：

- 沉浸视觉
- 状态标题
- 最少必要控制

禁止：

- 高密度列表
- 播放器后台式信息

### ScreenPage

职责：

- 当前任务
- 番茄钟
- 下一步提示
- 今日摘要

禁止：

- 完整 Todoist / Calendar 客户端
- 深度编辑

## 共享组件边界

- `BackgroundStage`：全局氛围底盘
- `GlobalOverlay`：模式切换、控制层、OTA 提示
- `InputRouter`：触摸 / 遥控器 / API 的统一动作入口
- `ApiSyncBridge`：系统状态同步与冲突处理

## 硬规则

- Card 与 Page 必须强分离
- 非当前模式不能长期保留重资源实例
- Flow 完整渲染只能在 `focused_flow` 下启用
