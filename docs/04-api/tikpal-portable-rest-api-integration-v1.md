# tikpal portable REST API 对接手册 v1

## 1. 目标

这份文档面向真正运行在独立便携设备上的 `tikpal portable` 客户端。

目标是提供一份可直接落地的对接手册，覆盖：

- 配对
- 会话建立
- 首屏 bootstrap
- 状态轮询
- 动作调用
- 会话读取与注销

它不讨论主屏 UI，也不要求 portable 复刻设备大屏布局。

---

## 2. 当前可用接口

基地址示例：

`http://<speaker-host>:8787/api/v1/system`

当前 portable 设备应使用这组接口：

- `GET /api/v1/system`
- `GET /api/v1/system/health`
- `GET /api/v1/system/capabilities`
- `GET /api/v1/system/state`
- `GET /api/v1/system/portable/bootstrap`
- `POST /api/v1/system/actions`
- `GET /api/v1/system/ota/status`
- `POST /api/v1/system/ota/check`
- `POST /api/v1/system/ota/apply`
- `POST /api/v1/system/ota/rollback`
- `POST /api/v1/system/controller-sessions`
- `GET /api/v1/system/controller-sessions/current`
- `GET /api/v1/system/controller-sessions/:id`
- `DELETE /api/v1/system/controller-sessions/:id`

OpenAPI：

- `GET /api/v1/system/openapi.json`

---

## 3. 鉴权模型

### 3.1 读接口

这几个接口允许匿名只读或带 session 读取：

- `GET /api/v1/system`
- `GET /api/v1/system/health`
- `GET /api/v1/system/state`
- `GET /api/v1/system/capabilities`
- `GET /api/v1/system/portable/bootstrap`
- `GET /api/v1/system/ota/status`

说明：

- 匿名读时，`bootstrap.session` 会是 `null`
- 如果带有效 controller session token，`bootstrap.session` 会返回当前 session

### 3.2 写接口

这些接口要求 controller session 或 admin key：

- `POST /api/v1/system/actions`
- `GET /api/v1/system/controller-sessions/current`
- `GET /api/v1/system/controller-sessions/:id`
- `DELETE /api/v1/system/controller-sessions/:id`

OTA check/apply/rollback 属于 admin 维护路径，不属于普通 portable controller 日常权限。

### 3.3 配对接口

创建 portable session 需要 admin key：

- `POST /api/v1/system/controller-sessions`

请求头：

- `X-Tikpal-Key: <admin-api-key>`

或：

- `Authorization: Bearer <admin-api-key>`

### 3.4 controller session token

portable 正常工作时应使用：

- `Authorization: Bearer <controller-session-token>`

不要让便携设备长期直接持有 admin key。

---

## 4. 推荐接入流程

portable 的最小接入流程建议固定为：

1. `GET /api/v1/system`
2. 读取 endpoint links 和 auth 提示
3. 如果还没配对，使用 admin key 调 `POST /controller-sessions`
4. 保存返回的 `token`
5. 使用 `Bearer <token>` 调 `GET /portable/bootstrap`
6. 渲染控制界面
7. 周期性轮询 `GET /portable/bootstrap` 或 `GET /state`
8. 用户触发控制时调用 `POST /actions`
9. 需要退出控制时，调用 `DELETE /controller-sessions/:id`

---

## 5. API Descriptor

### 请求

```bash
curl http://<speaker-host>:8787/api/v1/system
```

### 响应示例

```json
{
  "service": "tikpal-speaker-system-api",
  "version": "1.0.0",
  "auth": {
    "read": "anonymous viewer or authenticated session",
    "write": "controller session or admin api key",
    "pairing": "admin api key required for controller session creation"
  },
  "endpoints": {
    "health": "/api/v1/system/health",
    "openapi": "/api/v1/system/openapi.json",
    "state": "/api/v1/system/state",
    "capabilities": "/api/v1/system/capabilities",
    "otaStatus": "/api/v1/system/ota/status",
    "otaCheck": "/api/v1/system/ota/check",
    "otaApply": "/api/v1/system/ota/apply",
    "otaRollback": "/api/v1/system/ota/rollback",
    "actions": "/api/v1/system/actions",
    "bootstrap": "/api/v1/system/portable/bootstrap",
    "controllerSessions": "/api/v1/system/controller-sessions",
    "currentSession": "/api/v1/system/controller-sessions/current"
  }
}
```

用途：

- 自发现
- 动态配置 API links
- 避免 portable 把路径硬编码散落在多个地方

---

## 6. 创建 portable controller session

### 请求

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/controller-sessions \
  -H 'Content-Type: application/json' \
  -H 'X-Tikpal-Key: <admin-api-key>' \
  -d '{
    "deviceId": "tikpal-portable-001",
    "name": "Bedroom Portable",
    "role": "controller",
    "capabilities": [
      "mode_switch",
      "playback",
      "flow_control",
      "screen_control"
    ],
    "ttlSec": 86400
  }'
```

### 响应示例

```json
{
  "id": "ctrl_ab12cd34",
  "deviceId": "tikpal-portable-001",
  "name": "Bedroom Portable",
  "role": "controller",
  "scopes": [
    "state:read",
    "capabilities:read",
    "actions:control"
  ],
  "capabilities": [
    "mode_switch",
    "playback",
    "flow_control",
    "screen_control"
  ],
  "source": "portable_controller",
  "createdAt": "2026-04-21T08:00:00.000Z",
  "expiresAt": "2026-04-22T08:00:00.000Z",
  "lastSeenAt": null,
  "revoked": false,
  "token": "sess_xxxxxxxxxxxxxxxx",
  "stateUrl": "/api/v1/system/state",
  "actionsUrl": "/api/v1/system/actions"
}
```

portable 至少要保存：

- `id`
- `token`
- `expiresAt`

---

## 7. 首屏 bootstrap

这是 portable 设备最推荐的首屏接口。

### 请求

```bash
curl http://<speaker-host>:8787/api/v1/system/portable/bootstrap \
  -H 'Authorization: Bearer <controller-session-token>'
```

### 响应示例

```json
{
  "ok": true,
  "session": {
    "id": "ctrl_ab12cd34",
    "deviceId": "tikpal-portable-001",
    "name": "Bedroom Portable",
    "role": "controller",
    "scopes": [
      "state:read",
      "capabilities:read",
      "actions:control"
    ],
    "capabilities": [
      "mode_switch",
      "playback",
      "flow_control",
      "screen_control"
    ],
    "source": "portable_controller",
    "createdAt": "2026-04-21T08:00:00.000Z",
    "expiresAt": "2026-04-22T08:00:00.000Z",
    "lastSeenAt": "2026-04-21T08:02:10.000Z",
    "revoked": false
  },
  "capabilities": {
    "modes": ["overview", "listen", "flow", "screen"],
    "flowStates": ["focus", "flow", "relax", "sleep"],
    "touch": {
      "multiTouch": true
    },
    "screenFeatures": {
      "tasks": true,
      "schedule": true,
      "pomodoro": true
    },
    "integrations": {
      "calendar": true,
      "todoist": true
    },
    "ota": {
      "supported": true,
      "rollback": true
    },
    "performance": {
      "tier": "normal"
    }
  },
  "state": {
    "activeMode": "flow",
    "focusedPanel": "flow",
    "playback": {
      "state": "play",
      "volume": 58,
      "trackTitle": "Low Light Corridor"
    },
    "flow": {
      "state": "focus",
      "subtitle": "Deep Work"
    },
    "screen": {
      "currentTask": "Write Ambient OS Spec",
      "pomodoroRemainingSec": 1124
    },
    "lastSource": "portable_controller"
  },
  "links": {
    "actions": "/api/v1/system/actions",
    "state": "/api/v1/system/state",
    "capabilities": "/api/v1/system/capabilities"
  }
}
```

portable 首屏通常只需要：

- `state.activeMode`
- `playback.state`
- `playback.volume`
- `playback.trackTitle`
- `flow.state`
- `screen.currentTask`
- `screen.pomodoroRemainingSec`
- `capabilities.modes`
- `capabilities.flowStates`

---

## 8. 动作调用

所有控制动作都通过：

`POST /api/v1/system/actions`

### 8.1 切模式

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "set_mode",
    "payload": {
      "mode": "screen"
    },
    "source": "portable_controller",
    "requestId": "portable-req-001",
    "timestamp": "2026-04-21T08:05:00.000Z"
  }'
```

### 8.2 返回 Overview

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "return_overview",
    "payload": {},
    "source": "portable_controller"
  }'
```

### 8.3 播放/暂停

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "toggle_play",
    "payload": {},
    "source": "portable_controller"
  }'
```

### 8.4 调音量

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "set_volume",
    "payload": {
      "volume": 42
    },
    "source": "portable_controller"
  }'
```

### 8.5 切换 Flow 状态

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "set_flow_state",
    "payload": {
      "state": "sleep"
    },
    "source": "portable_controller"
  }'
```

### 8.6 开始番茄钟

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "screen_start_pomodoro",
    "payload": {
      "durationSec": 1500
    },
    "source": "portable_controller"
  }'
```

### 8.7 完成当前任务

```bash
curl -X POST http://<speaker-host>:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <controller-session-token>' \
  -d '{
    "type": "screen_complete_current_task",
    "payload": {},
    "source": "portable_controller"
  }'
```

### ActionResponse 示例

```json
{
  "ok": true,
  "result": "applied",
  "state": {
    "activeMode": "screen"
  },
  "appliedAction": {
    "type": "set_mode",
    "requestId": "portable-req-001",
    "timestamp": "2026-04-21T08:05:00.000Z"
  }
}
```

`result` 的含义：

- `applied`：状态已变化
- `ignored`：请求合法，但当前状态无需变化
- `rejected`：请求被拒绝

---

## 9. 读取当前 session

### 请求

```bash
curl http://<speaker-host>:8787/api/v1/system/controller-sessions/current \
  -H 'Authorization: Bearer <controller-session-token>'
```

用途：

- 启动时确认本地 token 仍有效
- 读取 `expiresAt`
- 读取 `lastSeenAt`
- 读取当前角色和 scope

---

## 10. 注销 session

### 请求

```bash
curl -X DELETE http://<speaker-host>:8787/api/v1/system/controller-sessions/<session-id> \
  -H 'Authorization: Bearer <controller-session-token>'
```

### 成功响应

```json
{
  "ok": true
}
```

推荐时机：

- 用户主动退出 portable
- 设备换绑
- 本地检测到 token 泄露风险

---

## 11. 错误处理建议

portable 至少要处理这几类响应：

### 401

常见原因：

- session token 失效
- session 已过期
- token 格式不对

建议行为：

- 清空本地 session
- 回到“重新连接”流程

### 403

常见原因：

- `viewer` role 试图执行 controller action
- 访问了不属于自己的 session

建议行为：

- 提示“当前凭证无权执行此操作”
- 不自动重试

### 400

常见原因：

- action payload 非法
- mode / panel / flow state 非法

建议行为：

- 记录错误码
- 前端修正输入，不盲目重试

---

## 12. 推荐轮询策略

第一版 portable 推荐轮询，不强依赖 WebSocket。

建议：

- 前台控制页：`1000ms`
- 锁屏/后台：`3000ms - 5000ms`
- 发动作后立即触发一次 bootstrap 或 state 刷新

优先级：

1. `GET /api/v1/system/portable/bootstrap`
2. `GET /api/v1/system/state`

原因：

- `bootstrap` 可以一次拿齐首屏所需信息
- `state` 更轻，适合动作后的快速刷新

---

## 13. 最小客户端实现建议

portable 设备端至少持有：

```ts
type PortableLocalState = {
  apiBase: string;
  sessionId?: string;
  sessionToken?: string;
  expiresAt?: string;
};
```

最小状态机：

- `unpaired`
- `pairing`
- `connected`
- `expired`
- `forbidden`
- `offline`

---

## 14. 不建议 portable 第一版直接做的事

- 使用 admin key 直接长期控制系统
- 直接调 OTA 相关接口
- 直接暴露第三方 connector 凭据
- 把主屏 UI 结构镜像到 portable

portable 的正确职责仍然是：

- 控制
- 轻状态感知
- 快速恢复连接

---

## 15. 最小 demo

仓库里提供了一个独立静态示例：

- [examples/portable-rest-client-demo.html](/Users/pom/Code/speaker/examples/portable-rest-client-demo.html)

这个 demo 的特点：

- 不依赖 React 或主屏前端打包结果
- 只调用 portable 相关 REST API
- 可直接在独立便携设备浏览器里打开
- 覆盖配对、bootstrap、动作调用、session 注销

推荐用法：

1. 先把文件放到便携设备或任意静态服务器上打开
2. 填入 `http://<speaker-host>:8787/api/v1/system`
3. 用 admin key 创建 controller session
4. 后续只靠 session token 做读写
