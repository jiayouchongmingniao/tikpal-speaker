# Screen / Flow / Listen / portable 端到端用户场景脚本 v1

## 1. 目标

这份文档用于后续：

- 验收
- 联调
- Demo 演示
- 回归测试

它不定义组件细节，而是定义一组“完整用户路径”，确保 `Overview / Listen / Flow / Screen / tikpal portable / System API` 能串起来工作。

---

## 2. 参与对象

### 本机屏幕

- `Overview`
- `Listen`
- `Flow`
- `Screen`

### 本机输入

- 多点触摸
- 遥控器

### 远端控制

- `tikpal portable`
- REST API

### 后端能力

- System API
- 播放桥接
- ScreenContext
- OTA 状态

---

## 3. 场景 1：开机进入系统总览

### 目标

验证设备启动后能进入 ambient OS 主层。

### 前置条件

- 设备上电
- system service 正常
- UI 静态资源正常

### 步骤

1. 系统启动
2. 浏览器 / kiosk 自动打开前台入口
3. 页面加载 `Overview`
4. 三张卡 `Listen / Flow / Screen` 可见

### 预期结果

- 默认进入 `Overview`
- 三卡都能显示摘要
- 当前系统状态可通过 `GET /api/v1/system/state` 读取
- 没有白屏或静态错误页

### 验收点

- `activeMode = overview`
- 系统可响应本机触摸

---

## 4. 场景 2：从 Overview 进入 Listen，再回到 Overview

### 目标

验证 `Overview -> focused_listen -> Overview` 的完整闭环。

### 步骤

1. 用户在 `Overview` 单击 `ListenCard` 主区
2. `ListenCard` 放大全屏
3. 进入 `focused_listen`
4. 用户点击 `Overview` 入口或遥控器 `Back`
5. 返回 `Overview`

### 预期结果

- 进入 Listen 是空间放大，不是硬切页
- `Listen` 显示当前曲目、来源、音量、播放控制
- 返回 `Overview` 时三卡恢复

### 验收点

- `activeMode` 从 `overview -> listen -> overview`
- 播放不中断
- 返回过程无白屏、无布局闪断

---

## 5. 场景 3：在 Listen 完成声音准备后进入 Flow

### 目标

验证数播前台到沉浸前台的高频路径。

### 前置条件

- 当前有播放内容
- `Listen` 可见

### 步骤

1. 用户在 `Listen` 确认曲目与音量
2. 用户通过本机触摸、遥控器或 portable 触发 `set_mode(flow)`
3. 系统执行 `focused_listen -> focused_flow` 转场

### 预期结果

- 进入 `Flow` 后，信息密度明显下降
- 当前 Flow 状态可见
- 播放状态保持
- Listen 中的播放控制不再占主视觉

### 验收点

- `activeMode = flow`
- `playback.state` 不变
- `Flow` 主视觉正常启动

---

## 6. 场景 4：在 Flow 中切换状态并返回 Overview

### 目标

验证 `Flow` 的本机与 API 控制闭环。

### 步骤

1. 用户进入 `focused_flow`
2. 用户切换 `focus -> relax`
3. 页面完成状态过渡
4. 用户双指捏合返回 `Overview`

### API 联调步骤

1. 远端调用：

```bash
curl -X POST /api/v1/system/actions \
  -d '{"type":"set_flow_state","payload":{"state":"relax"},"source":"portable_controller"}'
```

2. 页面自动同步到 `relax`

### 预期结果

- Flow 状态切换有明确反馈
- 本机与 API 控制都能生效
- 双指捏合可稳定回到 `Overview`

### 验收点

- `flow.state = relax`
- `activeMode` 从 `flow -> overview`
- `lastSource` 正确记录

---

## 7. 场景 5：从 Overview 进入 Screen，开始一个番茄钟

### 目标

验证 `Screen` 作为任务节奏表面的核心闭环。

### 前置条件

- ScreenContext 可用
- 至少有一个 focus item

### 步骤

1. 用户在 `Overview` 进入 `Screen`
2. Screen 显示当前任务与倒计时
3. 用户点击 `Start Pomodoro`
4. 番茄钟开始倒计时

### 预期结果

- `Screen` 显示当前任务
- 倒计时开始运行
- 今日摘要和下一项可见

### 验收点

- `activeMode = screen`
- `screen.pomodoroState = running`
- `screen.pomodoroRemainingSec` 递减

---

## 8. 场景 6：通过 portable 控制 Screen 的当前任务

### 目标

验证 `tikpal portable` 对 Screen 的真实价值。

### 前置条件

- 便携控制器已注册 session
- `Screen` 模式可用

### 步骤

1. portable 创建 controller session
2. portable 拉取 `capabilities` 和 `state`
3. portable 显示当前任务与倒计时
4. 用户在 portable 上触发：
   - `screen_pause_pomodoro`
   - `screen_complete_current_task`
5. 设备主屏同步变化

### 预期结果

- portable 不需要打开主页面，也能控制当前任务节奏
- 本机 Screen 页面与系统状态同步更新

### 验收点

- `lastSource = portable_controller`
- 当前任务完成后，下一任务或空状态正确出现

---

## 9. 场景 7：从 Screen 切到 Flow，进入低干扰专注

### 目标

验证“任务节奏 -> 沉浸状态”的核心工作流。

### 步骤

1. 用户在 `Screen` 中确认当前任务与剩余时间
2. 用户触发 `set_mode(flow)`
3. 页面切到 `Flow`

### 预期结果

- 当前任务结构不再占主视觉
- Flow 进入沉浸态
- 如果需要，Screen 的当前任务可作为弱上下文保留在状态层，不直接显示

### 验收点

- `activeMode = flow`
- ScreenContext 没丢
- 用户返回 `Screen` 后仍可继续当前 session

---

## 10. 场景 8：通过 portable 完成日常专注闭环

### 目标

验证一个完整的跨设备工作流。

### 步骤

1. 用户在本机进入 `Listen`
2. 选择播放内容并确认音量
3. 使用 portable 切到 `Screen`
4. portable 启动番茄钟
5. 用户用 portable 再切到 `Flow`
6. 设备屏幕进入沉浸态
7. 番茄钟结束后，用户用 portable 切回 `Screen`
8. 完成当前任务

### 预期结果

- 本机屏幕承担主表现
- portable 承担主控制
- 不需要频繁走到设备前操作

### 验收点

- `Listen -> Screen -> Flow -> Screen` 路径完整可用
- 所有动作都有一致的系统状态变化

---

## 11. 场景 9：Calendar / Todoist 同步驱动 Screen

### 目标

验证 Screen 不是本地假数据，而是第三方结构的 ambient 呈现。

### 前置条件

- Calendar connector 可用
- Todoist connector 可用

### 步骤

1. 系统拉取当天日历事件
2. 系统拉取 Todoist Today 任务
3. 映射得到 `ScreenContext`
4. Screen 页面显示：
   - 当前任务
   - 当前时间块
   - 下一项
   - 剩余任务数 / 事件数

### 预期结果

- Screen 不暴露第三方复杂结构
- 只显示当前最相关信息

### 验收点

- `GET /api/v1/system/screen/context` 返回整理后的结果
- UI 不直接消费第三方 schema

---

## 12. 场景 10：本机触摸与 portable 同时操作冲突

### 目标

验证输入冲突规则。

### 步骤

1. 用户在本机执行双指捏合，准备从 `Flow` 返回 `Overview`
2. 同时 portable 发出 `set_mode(screen)`
3. 系统根据优先级规则处理

### 预期结果

- 本机系统级返回动作优先完成
- 不出现中途切页或动画抖动
- 最后目标状态有清晰记录

### 验收点

- `lastSource` 正确
- 状态转场不抖动
- 冲突处理可在日志里追踪

---

## 13. 场景 11：性能降级下仍可完成主要用户路径

### 目标

验证树莓派 4 在 `reduced / safe` 档位下仍能完成关键路径。

### 步骤

1. 系统进入 `reduced`
2. 用户完成：
   - Overview -> Listen
   - Listen -> Flow
   - Flow -> Overview
   - Overview -> Screen
3. 系统再进入 `safe`
4. 重复上述路径

### 预期结果

- 动效减弱但核心路径不丢
- 输入响应优先保留
- Screen 倒计时与播放控制仍可用

### 验收点

- `performanceTier` 切换后系统仍可用
- 没有因降级导致模式切换失效

---

## 14. 场景 12：OTA 前后台状态提示与回滚

### 目标

验证 OTA 不会破坏前台体验与恢复能力。

### 步骤

1. 系统发现可升级版本
2. Overlay 提示 `Update available`
3. 管理权限触发 `ota/apply`
4. UI 显示 `applying / restarting`
5. 新版本启动并健康检查
6. 若失败，则回滚到旧版本

### 预期结果

- OTA 状态可见
- apply 期间不允许复杂模式切换
- 回滚后系统恢复可用

### 验收点

- `otaStatus` 状态流正确
- 升级失败可自动恢复

---

## 15. 场景 13：设备离线或依赖失败时的退化行为

### 目标

验证外部依赖异常时，系统仍可用。

### 场景 A：portable 离线

- 本机仍可操作
- 页面不受影响

### 场景 B：Calendar / Todoist 拉取失败

- Screen 保留本地番茄钟
- 保留最后一次有效摘要
- 显示轻度 stale 提示

### 场景 C：API 服务不可达

- 本机 UI 至少保留本地控制能力

### 验收点

- 不出现空白主屏
- 不出现阻塞式错误页

---

## 16. 推荐验收顺序

建议后续联调按这个顺序执行：

1. 开机进入 Overview
2. Overview <-> Listen
3. Listen -> Flow
4. Flow 状态切换与返回
5. Overview -> Screen
6. Screen 番茄钟
7. portable session + 基础控制
8. portable 控制 Screen
9. Calendar / Todoist ScreenContext
10. 冲突处理
11. 性能降级
12. OTA 状态流

---

## 17. 结论

这组场景脚本的核心作用是保证：

- `Overview / Listen / Flow / Screen`
- `本机触摸 / 遥控器 / portable / REST API`
- `ScreenContext / Playback / OTA / Performance`

不是各自可用，而是作为一套系统一起工作。

一句话总结：

验收的对象不是页面，而是完整的 ambient OS 闭环。
