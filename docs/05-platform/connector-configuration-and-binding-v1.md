# 连接器配置与绑定流程规格 v1

## 1. 目标

这份文档定义 `tikpal-speaker` 如何接入外部服务连接器，重点覆盖：

- Calendar
- Todoist

以及它们的：

- 绑定流程
- 授权模型
- 本机表现
- 凭据存储
- 失效与恢复

目标不是设计一个复杂账户中心，而是让设备能稳定、可恢复地接入用户的外部时间与任务结构。

---

## 2. 范围

第一版只讨论应用层连接器，不讨论：

- 用户主账号体系
- 云端多设备同步平台
- 第三方深度写回工作流

第一版重点是：

- 让设备拿到足够的读权限
- 映射出 `ScreenContext`
- 在授权失效时可恢复

---

## 3. 设计原则

## 3.1 连接器是系统服务能力，不是前端能力

前端不应：

- 直接调用第三方 API
- 保存第三方 token
- 解析第三方复杂 schema

前端只负责：

- 显示连接状态
- 引导绑定流程
- 消费映射后的 `ScreenContext`

---

## 3.2 绑定流程应尽量低摩擦，但必须明确

用户必须知道：

- 当前连了什么
- 连的是哪个账号
- 是否还有效
- 如何重连

---

## 3.3 凭据必须最小暴露

必须做到：

- token 仅存服务层
- 不暴露给 portable
- 不暴露给前端
- 不写进普通日志

---

## 3.4 连接失败不能让 Screen 失效

即使连接器不可用，也应：

- 保留本地番茄钟
- 保留最后一次有效摘要
- 明确提示 stale / disconnected

---

## 4. 连接器角色

建议把每个 connector 理解为一个系统模块，包含：

- `auth handler`
- `sync worker`
- `mapper`
- `status reporter`

### auth handler

负责：

- 建立授权
- 更新 token
- 撤销 token

### sync worker

负责：

- 拉取第三方数据
- 失败重试
- 写入本地缓存

### mapper

负责：

- 将第三方原始数据映射为：
  - `CalendarBlock`
  - `TodoTask`
  - 最终 `ScreenContext`

### status reporter

负责：

- 输出 `connected / syncing / ok / stale / error`

---

## 5. 连接器类型

第一版建议先支持：

- `calendar`
- `todoist`

长期可扩展：

- `google_tasks`
- `apple_reminders`
- `ticktick`
- `notion`

但无论多少连接器，系统只应向前台暴露统一状态结构。

---

## 6. 绑定方式建议

建议第一版支持两种绑定方式：

## 6.1 受控设备管理入口

通过本机管理页或受信管理端完成。

适合：

- 开发阶段
- 内测
- 本地网络中的真实设备

## 6.2 外部引导式授权

设备显示一个简短引导状态，用户通过手机或管理端完成授权。

适合：

- 正式产品化
- 不适合在设备上输入账号密码的场景

---

## 7. 推荐用户路径

## 7.1 连接 Calendar

1. 用户进入受信管理入口
2. 选择 `Connect Calendar`
3. 系统跳转或生成授权流程
4. 用户完成授权
5. 系统获得 token
6. 系统开始初次同步
7. Screen 可读取 Calendar 时间结构

## 7.2 连接 Todoist

1. 用户进入管理入口
2. 选择 `Connect Todoist`
3. 完成授权
4. 系统获得 token
5. 初次同步 Today / focus 候选
6. Screen 可展示任务摘要

---

## 8. 连接器状态模型

建议每个连接器都统一输出：

```ts
type ConnectorStatus = {
  connected: boolean;
  accountLabel?: string;
  status: "idle" | "authorizing" | "syncing" | "ok" | "stale" | "error" | "revoked";
  lastSyncAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};
```

### 字段说明

#### connected

- 是否已有有效绑定

#### accountLabel

- 用于前台或管理页显示当前连接账号的弱标识
- 例如邮箱、昵称、工作区名

#### status

- 当前运行态

#### lastSyncAt

- 最近一次成功同步时间

#### lastErrorCode / lastErrorMessage

- 仅用于调试或管理页

---

## 9. 系统状态中的映射

这些连接器状态应进入：

- `SystemState.integrations`

例如：

```ts
integrations: {
  calendar: {
    connected: true,
    lastSyncAt: "...",
    status: "ok"
  },
  todoist: {
    connected: false,
    status: "idle"
  }
}
```

这样：

- Screen 可感知 stale
- DebugPanel 可展示状态
- OTA 与故障诊断也有统一出口

---

## 10. 凭据存储策略

## 10.1 存储位置

第三方凭据必须仅存于服务层安全存储中。

建议：

- 本机受控配置目录
- 仅服务进程可读

不应：

- 存于前端 localStorage
- 存于前端配置文件
- 暴露给 portable

---

## 10.2 存储内容

至少需要：

- access token
- refresh token（若有）
- token 过期时间
- account label
- provider metadata

### 建议附加

- createdAt
- updatedAt
- lastRefreshAt

---

## 10.3 安全要求

- 不把 token 打进日志
- 不回传到 UI
- 管理接口只返回状态和账号摘要

---

## 11. 同步策略

## 11.1 Calendar

建议同步频率：

- `30s - 120s`

同步内容：

- 当前事件
- 下一事件
- 今日剩余事件

## 11.2 Todoist

建议同步频率：

- `30s - 120s`

同步内容：

- Today 未完成任务
- 当前 focus 候选
- 优先级摘要

## 11.3 手动刷新

建议提供：

- 管理接口触发 refresh
- 可选 `screen_refresh_context` hint 动作

---

## 12. 失效场景处理

## 12.1 Token 过期

处理：

- 尝试 refresh
- 若成功，恢复 `ok`
- 若失败，进入 `error` 或 `revoked`

## 12.2 用户撤销授权

处理：

- 标记 `revoked`
- 清除无效 token
- 引导重新绑定

## 12.3 第三方服务暂时不可达

处理：

- 标记 `stale`
- 保留最后一次有效摘要
- 不要立即清空 Screen

## 12.4 数据为空

处理：

- 不视为错误
- 仅代表当下无可展示数据

---

## 13. 本机前台表现

前台应只显示低干扰状态，不做复杂管理界面。

### Screen 中可弱化显示

- `Calendar stale`
- `Todoist disconnected`

### 不应在主前台显示

- OAuth 技术错误细节
- token 信息
- 长篇失败说明

---

## 14. 管理入口信息架构

后续若做管理入口，建议每个连接器显示：

- provider 名称
- 连接状态
- 当前账号摘要
- 最近同步时间
- 重连按钮
- 断开按钮

### 示例

```text
Calendar
Connected as user@example.com
Last sync: 10:22
[ Refresh ] [ Reconnect ] [ Disconnect ]
```

---

## 15. REST API 建议

建议未来增加这些管理接口：

- `GET /api/v1/system/integrations`
- `POST /api/v1/system/integrations/calendar/connect`
- `POST /api/v1/system/integrations/todoist/connect`
- `POST /api/v1/system/integrations/:provider/refresh`
- `DELETE /api/v1/system/integrations/:provider`

### 权限要求

- 最低 `admin`

普通 controller 不应有 connector 管理权限。

---

## 16. 与 ScreenContext 的关系

connector 不直接驱动 UI。

正确链路：

1. Connector 拉第三方数据
2. 写入本地缓存
3. Mapper 生成 `ScreenContext`
4. `SystemState.integrations` 同步状态
5. Screen 页面消费 `ScreenContext`

这样可以保证：

- UI 简洁
- API 稳定
- 连接器可独立替换

---

## 17. portable 的边界

portable 不应承担连接器绑定角色。

第一版 portable：

- 可读 Screen 结果
- 可控制当前 Screen session

不应：

- 发起 OAuth
- 修改 connector 配置
- 查看 token 状态细节

如果未来要支持，也应通过高权限管理模式，而不是默认 portable 控制层。

---

## 18. 调试与日志建议

每个 connector 至少记录：

- 绑定成功
- 绑定失败
- refresh 成功
- refresh 失败
- token 失效
- 用户撤销
- mapper 输出摘要

### 推荐日志字段

- `provider`
- `accountLabel`
- `status`
- `durationMs`
- `errorCode`
- `syncItemCount`

---

## 19. 第一版最小可交付范围

## P0

- connector 状态模型
- 本地安全存储
- sync worker
- `SystemState.integrations`
- `ScreenContext` 映射

## P1

- 管理接口
- refresh / reconnect / disconnect
- 更好的错误恢复

## P2

- 更完整账号选择
- 多账户支持
- 更多 provider

---

## 20. 结论

连接器配置与绑定流程的关键不是“接了多少服务”，而是：

- 绑定是否清楚
- 状态是否可观察
- 凭据是否安全
- 失效后是否可恢复

一句话总结：

连接器应是系统服务层的受控能力，前台只看结果，不直接接触第三方复杂性。
