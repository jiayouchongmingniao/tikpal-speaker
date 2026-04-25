# System API Contract v1

## 目标

系统 API 服务于整个 ambient OS，而不是某个页面。

## 路径建议

- `GET /api/v1/system/health`
- `GET /api/v1/system/state`
- `GET /api/v1/system/capabilities`
- `GET /api/v1/system/version`
- `POST /api/v1/system/actions`
- `POST /api/v1/system/controller-sessions`
- `GET /api/v1/system/screen/context`
- `GET /api/v1/system/integrations`
- `POST /api/v1/system/integrations/:provider/connect`
- `POST /api/v1/system/integrations/:provider/refresh`
- `DELETE /api/v1/system/integrations/:provider`
- `GET /api/v1/system/ota/status`
- `POST /api/v1/system/ota/check`
- `POST /api/v1/system/ota/apply`
- `POST /api/v1/system/ota/rollback`

## SystemState 关键字段

- `activeMode`
- `focusedPanel`
- `overlay`
- `playback`
- `flow`
- `screen`
- `system.version`
- `system.otaStatus`
- `system.performanceTier`
- `lastSource`
- `lastUpdatedAt`

## Actions

推荐动作：

- `set_mode`
- `return_overview`
- `focus_panel`
- `toggle_play`
- `set_volume`
- `set_flow_state`
- `screen_set_focus_item`
- `screen_complete_current_task`
- `screen_start_pomodoro`
- `screen_pause_pomodoro`
- `screen_reset_pomodoro`
- `ota_check`
- `ota_apply`
- `ota_rollback`

## Capabilities

客户端必须先读 `capabilities` 再决定显示哪些控制项。

## 错误码建议

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `UNSUPPORTED_ACTION`
- `INVALID_STATE`
- `OTA_IN_PROGRESS`
- `DEPENDENCY_UNAVAILABLE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
