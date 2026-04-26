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
- `creativeCare`
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
- `voice_capture_submit`
- `voice_mood_set`
- `voice_care_mode_set`
- `voice_reflection_clear`
- `ota_check`
- `ota_apply`
- `ota_rollback`

## Capabilities

客户端必须先读 `capabilities` 再决定显示哪些控制项。

`capabilities.creativeCare` 暴露 portable voice capture 能力：

- `supported: true`
- `moods: ["clear", "scattered", "stuck", "tired", "calm", "energized"]`
- `careModes: ["focus", "flow", "unwind", "sleep"]`
- `speechRecognition: "optional"`

## CreativeCare

`SystemState.creativeCare` 是 Tikpal creative wellness loop 的最小状态层。它的 personalization 来源是用户主动提交的 voice capture 或手动 transcript，不包含心率、HRV、EEG、睡眠阶段等传感器声明。

字段：

- `latestTranscript`：最近一次用户主动提交的 transcript。它可以出现在 state response 中，但不得进入 runtime action log。
- `moodLabel`：`clear | scattered | stuck | tired | calm | energized`
- `moodIntensity`：`0..1`
- `inspirationSummary`：用于 Listen / Screen 的短摘要
- `suggestedFlowState`：仍使用兼容枚举 `focus | flow | relax | sleep`
- `currentCareMode`：`focus | flow | unwind | sleep`
- `insightSentence`：Flow 中显示的一句 calm insight
- `metadata.source`
- `metadata.captureLength`

推荐映射固定为：

- `clear / energized -> flow`
- `scattered / stuck -> focus`
- `tired / calm -> unwind -> relax`
- 显式 `sleep` care mode -> `sleep`

日志要求：

- `voice_capture_submit` 的 `payloadSummary` 只能记录 `moodLabel`、`moodIntensity`、`careMode`、`captureLength`
- 不记录完整 transcript
- 不添加隐藏医疗、生物识别或传感器字段

## 错误码建议

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `UNSUPPORTED_ACTION`
- `INVALID_VOICE_MOOD`
- `INVALID_CARE_MODE`
- `INVALID_STATE`
- `OTA_IN_PROGRESS`
- `DEPENDENCY_UNAVAILABLE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
