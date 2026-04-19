# API 认证与权限模型 v1

## 1. 目标

这份文档定义 `tikpal-speaker` ambient OS 的 API 认证与权限边界。

目标是解决三类问题：

- 谁可以访问系统 API
- 谁可以执行哪些动作
- 如何在本机 UI、便携控制器、管理操作之间建立清晰边界

它不追求第一版就有企业级安全体系，但必须保证：

- 普通控制与管理控制分离
- token 与第三方凭据不混用
- OTA、connector 配置等高风险操作默认受限

---

## 2. 基本原则

## 2.1 认证与授权分离

### 认证

回答：

- 你是谁
- 你是否持有有效凭证

### 授权

回答：

- 你能做什么
- 你是否能执行当前动作

---

## 2.2 最小权限原则

默认只授予完成当前任务所需的最低权限。

例如：

- portable 默认应拥有普通控制权限
- 本机 kiosk 前端默认不应拥有 OTA 管理权限
- 第三方 connector token 不应拥有系统管理权限

---

## 2.3 设备 API 不应默认裸开放

即使在局域网内，系统 API 也应有明确的认证策略。

至少需要：

- 访问凭证
- 会话边界
- 角色区分

---

## 2.4 权限以系统动作为中心

权限控制不应围绕页面，而应围绕动作：

- `set_mode`
- `toggle_play`
- `screen_start_pomodoro`
- `ota_apply`

这样才能和 `Actions` 文档一致。

---

## 3. 参与主体

建议把调用方分为五类：

- `local_ui`
- `portable_controller`
- `admin_client`
- `system_internal`
- `integration_connector`

---

## 4. 角色模型

建议定义四种角色：

- `viewer`
- `controller`
- `operator`
- `admin`

---

## 4.1 viewer

能力：

- 只读状态
- 读取 capabilities
- 读取公开健康状态

典型主体：

- 只读调试工具
- 只读监控看板

---

## 4.2 controller

能力：

- 模式切换
- 播放控制
- Flow 控制
- Screen 控制

典型主体：

- 本机前台 UI
- `tikpal portable`

---

## 4.3 operator

能力：

- 拥有 `controller` 全部权限
- 可触发某些系统级操作
- 可读更多运行态信息

典型主体：

- 本地维护工具
- 受信调试客户端

---

## 4.4 admin

能力：

- 拥有全部权限
- OTA
- connector 配置
- token 管理
- 调试与恢复

典型主体：

- 管理后台
- 设备维护端

---

## 5. 凭证模型

建议第一版支持三种凭证形态：

- 静态 API key
- Bearer token
- controller session token

---

## 5.1 静态 API key

用途：

- 开发阶段
- 局域网内受控设备联调
- 设备管理端

优点：

- 简单
- 容易落地

缺点：

- 粒度粗
- 旋转麻烦

建议：

- 仅用于 `admin` 或 `operator`
- 不建议长期给 portable 直接使用静态主 key

---

## 5.2 Bearer token

用途：

- 更正式的 API 访问
- 管理端或可信客户端

建议：

- token 内至少隐含角色信息
- 可包含过期时间

第一版不一定要做 JWT，但语义上建议按 Bearer token 设计。

---

## 5.3 controller session token

用途：

- `tikpal portable`
- 受控设备控制器

特点：

- 临时
- 可撤销
- 作用域有限

建议由：

- `POST /api/v1/system/controller-sessions`

创建。

---

## 6. 会话模型

建议 controller session 至少包含：

```ts
type ControllerSession = {
  id: string;
  deviceId: string;
  name: string;
  role: "controller";
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastSeenAt?: string;
  revoked?: boolean;
};
```

### 说明

- portable 默认拿到的是 `controller`
- 不应通过普通 controller session 直接执行 admin 动作

---

## 7. 作用域（Scopes）建议

除了角色，还建议引入 scope，便于更细粒度控制。

推荐 scope：

- `system:read`
- `system:control`
- `playback:control`
- `flow:control`
- `screen:control`
- `screen:focus`
- `ota:read`
- `ota:apply`
- `integrations:read`
- `integrations:manage`
- `admin:debug`

---

## 8. 路径权限建议

## 8.1 只读路径

### `GET /api/v1/system/health`

最低要求：

- 可允许匿名或 `viewer`

### `GET /api/v1/system/state`

最低要求：

- `viewer`

### `GET /api/v1/system/capabilities`

最低要求：

- `viewer`

### `GET /api/v1/system/version`

最低要求：

- `viewer`

### `GET /api/v1/system/screen/context`

最低要求：

- `viewer`

但应注意：

- 返回内容应是 ambient 级摘要
- 不暴露第三方原始隐私字段

---

## 8.2 控制路径

### `POST /api/v1/system/actions`

最低要求：

- `controller`

但要进一步按动作 scope 判定。

例如：

- `toggle_play` 需要 `playback:control`
- `set_flow_state` 需要 `flow:control`
- `screen_complete_current_task` 需要 `screen:control`

---

## 8.3 controller session 路径

### `POST /api/v1/system/controller-sessions`

建议：

- 初次注册可由受信流程放行
- 或由本机配对流程生成

### `GET /api/v1/system/controller-sessions/:id`

最低要求：

- `operator`
或
- 当前 session 自己可读取自己

### `DELETE /api/v1/system/controller-sessions/:id`

最低要求：

- `operator`
或
- `admin`

---

## 8.4 OTA 路径

### `GET /api/v1/system/ota/status`

最低要求：

- `viewer`
或 `operator`

### `POST /api/v1/system/ota/check`

最低要求：

- `operator`

### `POST /api/v1/system/ota/apply`

最低要求：

- `admin`

### `POST /api/v1/system/ota/rollback`

最低要求：

- `admin`

---

## 8.5 connector / integration 管理路径

如果后续增加：

- 连接 Calendar
- 连接 Todoist
- 更新 token
- 删除绑定

这些动作建议最低要求：

- `admin`

普通 controller 不应有权限。

---

## 9. 动作权限矩阵

| Action | viewer | controller | operator | admin |
|---|---:|---:|---:|---:|
| `set_mode` | no | yes | yes | yes |
| `return_overview` | no | yes | yes | yes |
| `show_controls` | no | yes | yes | yes |
| `hide_controls` | no | yes | yes | yes |
| `toggle_play` | no | yes | yes | yes |
| `set_volume` | no | yes | yes | yes |
| `next_track` | no | yes | yes | yes |
| `prev_track` | no | yes | yes | yes |
| `set_flow_state` | no | yes | yes | yes |
| `screen_start_pomodoro` | no | yes | yes | yes |
| `screen_pause_pomodoro` | no | yes | yes | yes |
| `screen_reset_pomodoro` | no | yes | yes | yes |
| `screen_complete_current_task` | no | yes | yes | yes |
| `screen_set_focus_item` | no | yes | yes | yes |
| `ota_check` | no | no | yes | yes |
| `ota_apply` | no | no | no | yes |
| `ota_rollback` | no | no | no | yes |

---

## 10. portable 默认权限建议

`tikpal portable` 默认应获得：

- 角色：`controller`
- scopes：
  - `system:read`
  - `system:control`
  - `playback:control`
  - `flow:control`
  - `screen:control`

不应默认获得：

- `ota:apply`
- `integrations:manage`
- `admin:debug`

---

## 11. 本机 UI 权限建议

本机 kiosk 前端本质上也是系统控制端，但不应无限制。

建议默认：

- 角色：`controller`
- 可读状态
- 可控制前台与播放

不建议前台默认拥有：

- OTA apply
- connector 管理
- token 管理

若要开放管理入口，建议进入单独的维护模式或 admin 页面。

---

## 12. system_internal 权限建议

内部系统模块例如：

- connector sync worker
- OTA worker
- playback bridge

应使用 `system_internal` 身份，不走外部 controller 权限。

它们可拥有：

- 必要的内部写权限
- 不暴露给外部的内部 scope

例如：

- `state:internal`
- `integrations:internal`
- `ota:internal`

---

## 13. 第三方 connector 凭据隔离

Calendar / Todoist token 不应：

- 进入前端
- 进入 portable
- 混入系统 controller token

必须做到：

- token 仅保存在服务层
- 前端和 portable 只看到 ambient 结果
- connector 管理接口单独走 admin 权限

---

## 14. 会话生命周期

建议 controller session 有明确过期时间。

### 推荐字段

- `createdAt`
- `expiresAt`
- `lastSeenAt`
- `revoked`

### 行为建议

- 过期会话不能继续发控制动作
- 被撤销会话立即失效
- 长时间不活动可自动清理

---

## 15. 本机与远端的认证差异

建议把“来源”与“权限”区分开。

例如：

- `source = touch`
  不等于匿名调用 API

- 本机触摸是本机系统已认证输入
- 远端 portable 是 controller 会话
- 外部 admin 客户端是高权限 token

这有助于避免把“本机 UI”误建模成普通匿名 API 调用者。

---

## 16. 错误模型建议

认证 / 授权相关错误建议统一为：

- `UNAUTHORIZED`
- `FORBIDDEN`
- `SESSION_EXPIRED`
- `SESSION_REVOKED`
- `INSUFFICIENT_SCOPE`

### 示例

普通 controller 触发 OTA：

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin permission required for OTA apply"
  }
}
```

会话过期：

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Controller session has expired"
  }
}
```

---

## 17. 日志建议

认证与授权相关日志至少应记录：

- principal id
- role
- scopes
- source
- action
- result
- error code
- timestamp

但必须注意：

- 不记录原始 token
- 不记录敏感第三方凭据

---

## 18. 第一版实施建议

## P0

- 静态 API key 或 Bearer token
- controller session
- 普通控制 / 管理控制分层

## P1

- scope 细化
- session 过期
- revoke 机制

## P2

- 更完整的配对流程
- 管理端权限体系
- 更细粒度审计

---

## 19. 最小可交付模型

如果先求落地，第一版至少做到：

- `viewer` / `controller` / `admin` 三角色
- `controller-sessions`
- `ota_apply` 仅 `admin`
- `portable` 默认只拿 `controller`
- 第三方 connector token 与系统 token 隔离

---

## 20. 结论

认证与权限模型的核心不是“做多复杂”，而是先把边界定清楚：

- 谁是读者
- 谁是控制者
- 谁是管理员
- 谁是系统内部模块

一句话总结：

系统控制权必须分层，portable 只能控制，不应默认管理。
