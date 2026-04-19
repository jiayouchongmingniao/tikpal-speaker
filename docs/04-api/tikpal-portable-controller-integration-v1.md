# 便携控制器（tikpal portable）交互与 API 对接规格 v1

## 1. 目标

这份规格定义 `tikpal portable` 作为便携可移动控制器时，与 `tikpal-speaker` ambient OS 的交互模型、权限边界和 REST API 对接方式。

目标不是把 portable 做成设备镜像，而是让它成为：

- 本机触摸之外的第二控制入口
- 更适合近距离操作的伴随式控制器
- 用于模式切换、播放控制、任务节奏控制的系统遥控端

它不应该替代本机屏幕，也不应该直接绑定前端页面结构。

---

## 2. 产品角色

`tikpal portable` 的定位不是“远程浏览器”，而是：

- 一个低摩擦控制器
- 一个近身辅助输入设备
- 一个在本机屏幕不方便操作时的控制表面

所以它负责：

- 切模式
- 调播放
- 管当前状态
- 管 Screen 的当前节奏

它不负责：

- 承担完整主界面显示
- 承担全部内容浏览
- 直接暴露第三方服务复杂结构

---

## 3. 使用场景

## 3.1 房间内近身控制

用户不想走到设备屏幕前操作时，用 portable：

- 切到 `Listen`
- 调音量
- 暂停 / 播放
- 切到 `Flow`

## 3.2 专注任务控制

在 `Screen` 场景下：

- 开始番茄钟
- 暂停番茄钟
- 完成当前任务
- 切下一个 focus item

## 3.3 沉浸场景中的轻控制

在 `Flow` 下：

- 改 `focus / relax / sleep / flow`
- 显示控制层
- 回到 `Overview`

---

## 4. 控制边界

portable 应优先承载“系统级动作”，而不是页面内细节点按。

### 适合 portable 的动作

- `set_mode`
- `return_overview`
- `toggle_play`
- `set_volume`
- `next_track`
- `prev_track`
- `set_flow_state`
- `screen_start_pomodoro`
- `screen_pause_pomodoro`
- `screen_reset_pomodoro`
- `screen_complete_current_task`
- `screen_set_focus_item`

### 不适合第一版 portable 的动作

- 完整媒体库浏览
- 完整任务项目树浏览
- 复杂日历编辑
- OTA 管理默认入口
- 高级系统设置

---

## 5. 交互模型

portable 的交互建议分为三层：

## 5.1 系统层

固定存在：

- 当前模式
- 播放状态
- 音量
- 返回 `Overview`

这是 portable 的最低保真控制层。

## 5.2 模式层

根据当前 `activeMode` 动态显示最关键的动作。

### Listen

- 播放/暂停
- 上一首/下一首
- 音量
- 切到 Flow
- 切到 Screen

### Flow

- 当前状态显示
- `focus / flow / relax / sleep`
- 播放/暂停
- 回 Overview

### Screen

- 当前任务
- 剩余时间
- 开始/暂停番茄钟
- 完成当前任务
- 切下一个任务

## 5.3 弱信息层

便携控制器可以显示：

- 当前曲目
- 当前任务
- 下一个时间块

但这些都是辅助信息，不应把 portable 变成信息大屏。

---

## 6. 与本机屏幕的关系

portable 不是第二主屏。

它和本机屏幕的关系应是：

- 本机屏幕：主表现层
- portable：主控制层

即：

- 主视觉永远在设备屏幕
- 主控制可在 portable 上完成

因此 portable 不需要完全复刻：

- Overview 三卡完整视觉
- Flow 大视觉
- Listen 完整布局
- Screen 完整排版

它只需要展示控制所需的最小状态。

---

## 7. 与 REST API 的关系

portable 不应直接操纵页面组件，而应只调用系统级 API。

推荐只依赖：

- `GET /api/v1/system/state`
- `GET /api/v1/system/capabilities`
- `POST /api/v1/system/actions`
- `POST /api/v1/system/controller-sessions`

可选：

- `GET /api/v1/system/screen/context`

---

## 8. 连接流程

建议 portable 的接入流程如下：

1. 创建设备会话
2. 读取能力声明
3. 读取当前系统状态
4. 根据当前模式渲染控制面
5. 发系统动作
6. 轮询或订阅最新状态

---

## 9. 会话模型

portable 必须先注册 controller session。

### 请求

`POST /api/v1/system/controller-sessions`

```json
{
  "deviceId": "tikpal-portable-001",
  "name": "Tikpal Portable Controller",
  "capabilities": [
    "mode_switch",
    "playback",
    "flow_control",
    "screen_control"
  ]
}
```

### 响应

```json
{
  "id": "ctrl_ab12cd34",
  "deviceId": "tikpal-portable-001",
  "name": "Tikpal Portable Controller",
  "createdAt": "2026-04-19T14:00:00Z",
  "expiresAt": "2026-04-20T14:00:00Z",
  "stateUrl": "/api/v1/system/state",
  "actionsUrl": "/api/v1/system/actions"
}
```

### 作用

- 标记控制来源
- 便于权限和审计
- 支持多控制器扩展

---

## 10. 状态读取策略

portable 启动后必须先读：

- `GET /api/v1/system/capabilities`
- `GET /api/v1/system/state`

原因：

- 不假设设备功能齐全
- 不假设当前模式
- 不依赖前端实现

### 最低需要的状态字段

- `activeMode`
- `playback.state`
- `playback.volume`
- `playback.trackTitle`
- `flow.state`
- `screen.currentTask`
- `screen.pomodoroRemainingSec`
- `system.performanceTier`
- `lastSource`

---

## 11. 动作调用规范

所有 portable 发出的控制都通过：

`POST /api/v1/system/actions`

### 基础结构

```json
{
  "type": "set_mode",
  "payload": {
    "mode": "flow"
  },
  "source": "portable_controller",
  "requestId": "portable-req-001"
}
```

### 示例

切到 Screen：

```json
{
  "type": "set_mode",
  "payload": {
    "mode": "screen"
  },
  "source": "portable_controller"
}
```

切 Flow 状态：

```json
{
  "type": "set_flow_state",
  "payload": {
    "state": "sleep"
  },
  "source": "portable_controller"
}
```

开始番茄钟：

```json
{
  "type": "screen_start_pomodoro",
  "payload": {
    "durationSec": 1500
  },
  "source": "portable_controller"
}
```

完成当前任务：

```json
{
  "type": "screen_complete_current_task",
  "payload": {
    "taskId": "focus_123"
  },
  "source": "portable_controller"
}
```

---

## 12. UI 映射建议

portable 端 UI 不应直接按页面分块，而应按系统动作分组。

## 12.1 顶部系统区

- 当前模式
- 当前播放状态
- 返回 Overview

## 12.2 中部模式区

根据当前模式动态展示：

### Listen

- 曲目
- 播放控制
- 音量

### Flow

- 当前 Flow 状态
- 四状态切换

### Screen

- 当前任务
- 倒计时
- 当前任务操作

## 12.3 底部快捷区

- 切模式
- 播放/暂停
- 音量

这样即使用户不理解全部产品结构，也能快速做关键动作。

---

## 13. 权限模型

portable 默认只应拥有普通控制权限。

### 允许

- 模式切换
- 播放控制
- Flow 控制
- Screen 控制

### 默认不允许

- OTA apply / rollback
- connector 配置
- token 管理
- 系统管理接口

如果后续需要管理权限，必须通过更高权限会话或独立管理模式。

---

## 14. 冲突处理规则

由于便携控制器和本机触摸会同时存在，必须提前定义：

## 14.1 模式切换

- 最后一次明确输入优先
- 正在转场时，记录最后目标，不应中途硬抢动画

## 14.2 返回 Overview

- 本机双指捏合或 Back 的优先级高于 portable 的建议性切换

## 14.3 播放与音量

- 最后写入优先

## 14.4 状态记录

所有 portable 动作都必须在 `SystemState.lastSource` 中可见。

---

## 15. 同步策略

第一版建议 portable 使用轮询，不强依赖 WebSocket。

### 推荐

- `state`：1 秒级轮询
- `screen/context`：1 秒到 2 秒

### 不建议第一版强依赖

- 双向实时 socket
- 页面级细粒度事件流

原因：

- REST 足够支撑第一版
- 更容易调试
- 更适合设备端稳定性

---

## 16. 与 Screen 的集成边界

portable 可以控制：

- 当前 focus item
- 番茄钟
- 当前任务完成
- 下一项切换

但不建议第一版支持：

- 完整 Todoist 项目浏览
- 完整 Calendar 编辑
- 多列表筛选

这类深交互应交给手机或 Web 管理端。

---

## 17. 与 Flow 的集成边界

portable 在 Flow 模式下非常有价值，因为用户通常不希望碰本机屏幕打断沉浸。

推荐 portable 可做：

- 切 `focus / flow / relax / sleep`
- 播放/暂停
- 音量
- 回 Overview

不建议做：

- 复杂播放浏览
- 复杂系统设置

---

## 18. 与 Listen 的集成边界

portable 在 Listen 模式下适合做高频控制：

- 播放/暂停
- 上一首/下一首
- 音量
- 来源摘要查看
- 快速切到 Flow / Screen

不建议第一版在 portable 上承担完整媒体浏览树。

---

## 19. 错误与异常处理

portable 必须能处理这些情况：

- 设备不可达
- 会话过期
- 动作不支持
- 设备正在 OTA
- 权限不足

### 推荐错误反馈

- `Device offline`
- `Session expired`
- `Action unavailable`
- `Update in progress`
- `Permission denied`

不要直接暴露复杂系统错误文本给用户。

---

## 20. 安全建议

### 必须

- 会话注册
- token 或密钥
- 会话过期
- 来源标识

### 建议

- 普通控制和管理控制分权
- OTA 相关能力默认隐藏
- 设备 API 通过受控入口访问，不直接裸暴露内部端口

---

## 21. 第一版最小可交付范围

## P0

- controller session
- 读取 `state`
- 读取 `capabilities`
- `set_mode`
- `toggle_play`
- `set_volume`

## P1

- `set_flow_state`
- `screen_start_pomodoro`
- `screen_pause_pomodoro`
- `screen_complete_current_task`

## P2

- 更细的 `screen_set_focus_item`
- 多控制器支持
- 更完整的错误恢复与配对流程

---

## 22. 结论

`tikpal portable` 的正确角色不是“第二主界面”，而是：

一个围绕系统动作设计的近身控制器。

一句话总结：

- 本机屏幕负责表现
- portable 负责控制
- REST API 负责统一动作语义

这样它才能和 `Overview / Listen / Flow / Screen` 清晰配合，而不会把系统搞成两套 UI。
