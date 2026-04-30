# 目标设备联调与验收记录 v1

## 1. 目标

这份 runbook 用于把当前工程闭环推进到真实设备验收：

- 真实 Calendar / Todoist 账号
- 真实播放器或 moOde-compatible HTTP 控制面
- 树莓派 4 性能 trace
- OTA release / restart / health check / rollback

它不是产品规格，而是现场联调记录模板。每轮真机验证都应复制一份结果，填入日期、设备、commit 和证据。

---

## 2. 验收版本

| 项目 | 记录 |
| --- | --- |
| 日期 |  |
| 设备 | Raspberry Pi 4 / 其他 |
| 系统版本 |  |
| Git commit |  |
| API URL |  |
| UI URL |  |
| Flow renderer |  |
| Chromium experiment |  |
| Render profile |  |
| 负责人 |  |

---

## 3. 启动前检查

```bash
git rev-parse --short HEAD
npm run build
npm run test:smoke
npm run test:http-smoke
npm run test:screen-context
npm run test:connectors
npm run test:player
npm run test:player-server
npm run test:ota
npm run test:performance
npm run test:persistence
npm run validation:preflight
npm run validation:release-gate
```

可选：生成一份目标设备验收快照，作为本轮记录附件：

```bash
npm run validation:capture -- --api-base http://localhost:8787/api/v1/system --api-key dev-admin-key --out validation-capture.md
```

如果需要在本机生成一份 OTA / portable 控制闭环辅助报告，可运行：

```bash
npm run validation:device -- --out validation-device.md
```

如果现场有播放器 HTTP 控制面，可在 capture 中加入播放器证据：

```bash
npm run validation:capture -- --api-base http://localhost:8787/api/v1/system --api-key dev-admin-key --player-api-base http://localhost:9001/player --exercise-portable --out validation-capture.md
```

通过标准：

- 所有命令退出码为 `0`
- `git status --short` 无未提交运行产物
- `tikpal-api.service` 和 `tikpal-web.service` 可启动

记录：

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| build |  |  |
| smoke |  |  |
| http-smoke |  |  |
| services |  |  |

验收快照：

| 文件 | 记录 |
| --- | --- |
| `validation-capture.md` |  |

---

## 4. 真实 Calendar / Todoist

### 环境变量

| 变量 | Calendar | Todoist |
| --- | --- | --- |
| connector mode | `TIKPAL_CALENDAR_CONNECTOR_MODE=real` | `TIKPAL_TODOIST_CONNECTOR_MODE=real` |
| API base | `TIKPAL_CALENDAR_API_BASE` | `TIKPAL_TODOIST_API_BASE` |
| token URL | `TIKPAL_CALENDAR_TOKEN_URL` | `TIKPAL_TODOIST_TOKEN_URL` |
| client id | `TIKPAL_CALENDAR_CLIENT_ID` | `TIKPAL_TODOIST_CLIENT_ID` |
| client secret | `TIKPAL_CALENDAR_CLIENT_SECRET` | `TIKPAL_TODOIST_CLIENT_SECRET` |

### 步骤

1. 启动 API：

```bash
TIKPAL_API_KEY=dev-admin-key npm run dev:api
```

2. 通过 debug surface 或 API 完成 `connect`。
3. 触发 sync：

```bash
curl -s -X POST http://localhost:8787/api/v1/system/integrations/calendar/refresh \
  -H 'Content-Type: application/json' \
  -H 'X-Tikpal-Key: dev-admin-key' \
  -d '{"maxAttempts":3,"retryDelayMs":500}'
```

4. 读取 `ScreenContext`：

```bash
curl -s http://localhost:8787/api/v1/system/screen/context \
  -H 'X-Tikpal-Key: dev-admin-key'
```

通过标准：

- token 不出现在 `SystemState`、runtime log、HTTP response
- sync job 最终 `status = ok`
- 失败后保留 last-good snapshot，并显示 `stale` 或 `error`
- `ScreenContext` 不暴露第三方原始 schema

记录：

| Connector | connect | refresh | sync | ScreenContext | 备注 |
| --- | --- | --- | --- | --- | --- |
| Calendar |  |  |  |  |  |
| Todoist |  |  |  |  |  |

---

## 5. 真实播放器

### 环境变量

```bash
export TIKPAL_PLAYER_BACKEND=mpc
export TIKPAL_MPD_HOST=127.0.0.1
export TIKPAL_MPD_PORT=6600
```

若现场已有独立 HTTP 播放器桥接服务，再改用：

```bash
export TIKPAL_PLAYER_API_BASE=http://localhost:9001/player
```

前端也可用：

```text
?playerApiBase=http://localhost:9001/player
```

### 后端选择

- 树莓派 / moOde 默认：`TIKPAL_PLAYER_BACKEND=mpc`
- 外部兼容控制面：`TIKPAL_PLAYER_API_BASE=http://...`

### HTTP bridge contract（仅外部桥接时需要）

- `GET /status`
- `POST /actions`

`POST /actions` 接收：

```json
{ "action": "toggle_play" }
```

或：

```json
{ "action": "set_volume", "volume": 72 }
```

通过标准：

- `toggle_play / set_volume / next_track / prev_track` 可从 portable 和主屏触发
- `SystemState.playback` 显示真实播放器状态
- 无用户操作时，曲目进度/自然切歌也会持续同步到 `SystemState.playback`
- 播放器不可达时，系统保留 last-good playback，不白屏、不阻断其他控制

记录：

| 动作 | 结果 | `SystemState.playback` 证据 | 备注 |
| --- | --- | --- | --- |
| toggle_play |  |  |  |
| set_volume |  |  |  |
| next_track |  |  |  |
| prev_track |  |  |  |
| passive sync (no action) |  |  |  |

---

## 6. 性能校准（树莓派稳定阶段）

### 6.1 运行档与目标

- 默认运行档：`RPI_RENDER_PROFILE=balanced`
- 高温或高负载兜底：`RPI_RENDER_PROFILE=stable`
- 目标：在无可见频闪前提下，Pi4 Flow 真机采样 `p10Fps >= 30`
- Flow renderer 实验入口：`flowRenderer=image|canvas|auto|webgl`
- Chromium 预设实验入口：`TIKPAL_CHROMIUM_EXPERIMENT=baseline|pi4-gpu-balanced|pi4-gpu-conservative|pi4-low-memory`
- 默认 kiosk 发布候选组合：`flowRenderer=image` + `TIKPAL_CHROMIUM_EXPERIMENT=pi4-gpu-balanced`
- 当前 Pi4 宽屏默认输出：`TIKPAL_KIOSK_XRANDR_MODE=2560x720`
- 原生 GPU 对照：`python3 scripts/native-flow-gpu-poc.py --width 2560 --height 720 --duration 30 --out ./native-flow-gpu-poc.json`

每轮 Pi4 对比都必须记录四元组：

- renderer lane
- Chromium experiment
- render profile
- physical output mode

### 6.2 三个 5 分钟场景采样

1. `overview -> flow -> screen -> overview` 循环
2. 长驻 `flow`
3. 混合交互（音量 / 切歌 / 番茄钟）

每个场景采样后导出：

```bash
curl -s 'http://localhost:8787/api/v1/system/runtime/performance-samples?limit=200' \
  -H 'X-Tikpal-Key: dev-admin-key' \
  > performance-loop.json
```

同理得到：

- `performance-flow.json`
- `performance-mixed.json`

### 6.3 单场景快速汇总

```bash
npm run performance:trace -- ./performance-loop.json
npm run performance:trace -- ./performance-flow.json
npm run performance:trace -- ./performance-mixed.json
```

### 6.4 30 分钟长时观察（建议发布前必做）

```bash
curl -s 'http://localhost:8787/api/v1/system/runtime/performance-samples?limit=200' \
  -H 'X-Tikpal-Key: dev-admin-key' \
  > performance-soak-30m.json
```

### 6.5 生成一份校准报告

```bash
npm run validation:rpi-report -- \
  --scenario-loop ./performance-loop.json \
  --scenario-flow ./performance-flow.json \
  --scenario-mixed ./performance-mixed.json \
  --soak ./performance-soak-30m.json \
  --profile balanced \
  --api-base http://localhost:8787/api/v1/system \
  --ui-base http://localhost:4173 \
  --out ./rpi-calibration-report.md
```

通过标准：

- `p10Fps >= 30`
- `recommendedTier` 与主观体验一致
- `tier` 在 10 分钟窗口内不频繁往返（默认阈值：每 10 分钟 <= 6 次切换）
- 模式切换无可见白闪/亮闪，交互路径持续可用

记录：

| 场景 | avgFps | p10Fps | latency max | recommendedTier | switches/10m | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| loop-5m |  |  |  |  |  |  |
| flow-5m |  |  |  |  |  |  |
| mixed-5m |  |  |  |  |  |  |
| soak-30m |  |  |  |  |  |  |

---

## 7. OTA

### 环境变量

```bash
export TIKPAL_OTA_RELEASE_ROOT=/opt/tikpal/app/releases
export TIKPAL_OTA_CURRENT_PATH=/opt/tikpal/app/current
export TIKPAL_OTA_PREVIOUS_PATH=/opt/tikpal/app/previous
export TIKPAL_OTA_RESTART_COMMAND='sudo systemctl restart tikpal-api tikpal-web'
```

### Release 目录

```text
/opt/tikpal/app/releases/
  0.1.2/
    manifest.json
    health.json
```

`manifest.json` 至少包含：

```json
{ "version": "0.1.2" }
```

`health.json` 可用于模拟失败：

```json
{ "ok": false }
```

通过标准：

- `ota/check` 能发现目标版本
- `ota/apply` 切换 `current`，执行 restart，完成 health check
- restart 失败会恢复 `current / previous`
- health check 失败会恢复 `current / previous`
- `ota/rollback` 可恢复前一版本

记录：

| 操作 | 结果 | symlink 证据 | `lastOperation` 证据 | 备注 |
| --- | --- | --- | --- | --- |
| check |  |  |  |  |
| apply |  |  |  |  |
| failed restart |  |  |  |  |
| failed health |  |  |  |  |
| rollback |  |  |  |  |

---

## 8. 最终结论

| 项目 | 通过 / 失败 | 阻塞项 |
| --- | --- | --- |
| 真实 Screen integrations |  |  |
| 真实播放器 |  |  |
| 性能降级 |  |  |
| OTA |  |  |
| portable 端到端闭环 |  |  |
| 树莓派性能校准 |  |  |
| 发布门禁 (`validation:release-gate`) |  |  |

最终判定：

- [ ] 可进入长期试运行
- [ ] 需要继续工程修复
- [ ] 需要调整产品 / 交互假设
- [ ] 触发 GPU PoC 门控（WebGL 与原生 GPU 并行对照）
