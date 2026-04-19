# GlobalOverlay 信息架构规格 v1

## 1. 目标

这份文档定义 ambient OS 中系统级 `GlobalOverlay` 的职责、层级、显示规则与信息边界。

`GlobalOverlay` 的作用不是做一个浮在页面上的杂项容器，而是：

- 提供跨模式统一控制
- 承接系统提示
- 承接模式切换器
- 在不打断主页面语义的前提下提供最小操作与反馈

它必须服务：

- `Overview`
- `Listen`
- `Flow`
- `Screen`

同时还要兼容：

- 多点触摸
- 遥控器
- portable 控制
- OTA 状态

---

## 2. 定位

`GlobalOverlay` 是系统壳的一部分，不属于任何单独页面。

它不是：

- Listen 的子组件
- Flow 的控制条
- Screen 的任务工具栏

它是整个 ambient OS 的跨模式前台控制层。

---

## 3. 设计原则

## 3.1 Overlay 必须轻，不应喧宾夺主

尤其在 `Flow` 中，Overlay 如果太重，会直接破坏沉浸感。

因此：

- 默认隐藏
- 唤醒后短暂可见
- 只提供高价值控制

---

## 3.2 Overlay 是系统层，不承载模式专属复杂功能

例如：

- 不在 Overlay 中展开完整队列
- 不在 Overlay 中展开完整任务列表
- 不在 Overlay 中展开完整设置页

复杂操作应回到对应模式页面。

---

## 3.3 Overlay 应统一不同输入方式

它是本机触摸、遥控器和 portable 思维模型之间的重要桥梁。

所以：

- 本机用户点空白可以唤醒 Overlay
- 遥控器用户可以通过 OK / Back 与 Overlay 交互
- API 可间接触发 Overlay 状态变化，但不应把它变成远端主界面

---

## 4. 组成结构

建议 `GlobalOverlay` 拆成四个子层：

```text
GlobalOverlay
  ├─ ControlStrip
  ├─ ModeSwitcher
  ├─ SystemNotice
  └─ StatusHintLayer
```

---

## 5. ControlStrip

## 5.1 角色

这是最常见的 overlay 形态。

职责：

- 播放 / 暂停
- 音量
- 当前模式的最小控制
- 返回 Overview 或切模式入口

---

## 5.2 允许内容

跨模式统一控制建议只保留：

- 播放 / 暂停
- 音量
- 模式切换入口
- 返回 Overview

### 按模式附加的轻控件

#### Listen

- 上一首 / 下一首

#### Flow

- `focus / flow / relax / sleep`

#### Screen

- 开始 / 暂停番茄钟
- 完成当前任务

---

## 5.3 不允许内容

- 完整播放队列
- 完整媒体浏览
- 完整任务清单
- 设置页
- connector 管理

---

## 5.4 出现规则

默认：

- 隐藏

唤醒方式：

- 单击空白区
- 遥控器 OK
- 进入新模式后的短暂自动显示，可选

自动隐藏：

- 3 秒或 5 秒无操作后隐藏

---

## 6. ModeSwitcher

## 6.1 角色

这是系统级模式切换器，不应散落在各页面里各做一套。

职责：

- 呈现 `Overview / Listen / Flow / Screen`
- 提供当前模式高亮
- 支持模式切换动作

---

## 6.2 显示形式

建议：

- 作为 `ControlStrip` 的一部分或可展开段

推荐顺序：

- `Overview`
- `Listen`
- `Flow`
- `Screen`

### 说明

在 `Overview` 中，三卡本身已经是模式入口，因此 mode switcher 可以弱化甚至不常显。

在聚焦态中，它更有价值。

---

## 6.3 可见性规则

### Focus 模式

应允许显示。

### Overview

第一版可以默认不显示，避免重复导航。

---

## 7. SystemNotice

## 7.1 角色

承接系统级重要状态，不属于任何单独模式。

例如：

- `Update available`
- `Applying update`
- `Controller connected`
- `Sync stale`
- `Performance reduced`

---

## 7.2 显示原则

SystemNotice 分两类：

### 非阻塞提示

例如：

- `Portable connected`
- `Calendar sync stale`

特点：

- 短暂显示
- 不阻断操作

### 阻塞型系统提示

例如：

- `Applying update`
- `Restarting`
- `Rollback in progress`

特点：

- 优先级高
- 必须压过普通 ControlStrip
- 期间可能限制交互

---

## 7.3 不建议内容

- 技术日志大段文本
- 复杂错误堆栈
- 大量设置说明

SystemNotice 应只提供：

- 状态
- 是否可操作
- 是否需要等待

---

## 8. StatusHintLayer

## 8.1 角色

承接极短暂、低干扰的状态反馈。

例如：

- `Switched to Flow`
- `Pomodoro started`
- `Task completed`
- `Volume 62%`

这类提示比 SystemNotice 更轻、更短。

---

## 8.2 显示原则

- 出现快
- 持续短
- 自动消失
- 不抢主视觉

推荐时长：

- `900ms - 1800ms`

---

## 9. 各模式下的 Overlay 差异

## 9.1 Overview

### 原则

- Overlay 最弱
- 不应和三卡争夺注意力

### 建议

- 默认不常显 ModeSwitcher
- 只在需要时显示 SystemNotice 或 StatusHint

---

## 9.2 Listen

### 原则

- Overlay 可稍强一些
- 因为 Listen 本来就是控制态

### 建议

- ControlStrip 可完整显示
- 支持模式切换
- 支持播放快捷动作

---

## 9.3 Flow

### 原则

- Overlay 必须最克制
- 默认隐藏
- 显示时也应轻量半透明

### 建议

- 只显示最必要控制
- 状态切换入口可保留
- 不显示复杂技术信息

---

## 9.4 Screen

### 原则

- Overlay 要兼顾任务控制与系统控制
- 但不能让 Screen 变成工具栏堆叠页面

### 建议

- 保留番茄钟快捷动作
- 保留模式切换
- 保留返回 Overview

---

## 10. 信息优先级

Overlay 中的信息优先级应固定：

### 一级

- 当前模式切换
- 播放 / 暂停
- 返回 Overview

### 二级

- 音量
- 当前模式专属快捷动作

### 三级

- 短时状态提示
- OTA / 同步 / 控制器提示

### 不应进入 Overlay 的信息

- 大段曲目信息
- 大段任务说明
- 大量技术参数

---

## 11. 布局建议

## 11.1 ControlStrip

建议位置：

- 底部居中

适合：

- 触摸
- 遥控器焦点移动
- 全模式统一

---

## 11.2 SystemNotice

建议位置：

- 顶部中间
或
- 顶部右侧

要求：

- 足够醒目
- 不压主内容

---

## 11.3 StatusHintLayer

建议位置：

- 顶部中间
或
- 当前焦点区域附近

---

## 12. 输入规则

## 12.1 触摸

- 单击空白区：显示或刷新 `ControlStrip`
- 单击 overlay 控件：优先命中 overlay
- overlay 可见时，优先交互 overlay，不应误判为页面主区点击

---

## 12.2 遥控器

- `OK`：显示 overlay 或激活当前 overlay 控件
- `Back`：优先隐藏 overlay；若已隐藏，再返回 Overview
- `Left / Right / Up / Down`：在 overlay 中导航

---

## 12.3 API / portable

API 不建议直接“显示某个 overlay 面板”作为常用控制方式。

它应主要通过：

- actions 改系统状态

而 Overlay 由本机 UI 根据状态选择是否显示。

可保留少量系统动作：

- `show_controls`
- `hide_controls`

但不建议把 portable 设计成靠驱动本机 overlay 完成全部交互。

---

## 13. 状态机关系

Overlay 相关状态应至少包含：

```ts
type OverlayState = {
  visibility: "hidden" | "controls" | "mode_switcher";
  reason?: "touch" | "remote" | "portable" | "system";
  lastShownAt?: string;
};
```

### 说明

- `controls`：ControlStrip 为主
- `mode_switcher`：模式切换为主
- SystemNotice / StatusHint 不一定独占 `visibility`，可作为独立叠层逻辑

---

## 14. OTA 与 Overlay 的关系

OTA 是 Overlay 的重要系统职责之一。

### 可用状态

- `Update available`
- `Downloading update`
- `Verifying`
- `Applying update`
- `Restarting`
- `Rollback in progress`
- `Update failed`

### 规则

- OTA apply / restart / rollback 期间，普通 ControlStrip 优先级降低
- 必要时 OTA notice 覆盖普通 overlay
- 用户应始终知道当前是否还能操作

---

## 15. 性能降级与 Overlay

Overlay 需要适配性能档位。

### normal

- 可有轻模糊、轻淡入

### reduced

- 降低模糊
- 减少非必要动画

### safe

- 最简透明度与位移动画
- 优先可读性和输入响应

---

## 16. 错误与边界情况

## 16.1 页面与 Overlay 同时可交互冲突

处理规则：

- overlay 可见时优先命中 overlay

## 16.2 转场中 Overlay

建议：

- 模式切换过程中短暂冻结 overlay 输入
- 转场完成后恢复

## 16.3 SystemNotice 与 ControlStrip 同时出现

建议：

- 阻塞型 SystemNotice 优先
- 非阻塞型可与 ControlStrip 共存，但应弱化

---

## 17. 第一版最小范围

## P0

- ControlStrip
- 基础 ModeSwitcher
- StatusHint
- OTA 基础提示
- 控制层自动隐藏

## P1

- 更完整的 SystemNotice 层次
- 遥控器焦点行为细化
- 与 portable 控制的更强协同

## P2

- 更精细的动画
- 更复杂的状态优先级
- 更丰富的系统提示模板

---

## 18. 结论

`GlobalOverlay` 的正确角色不是“把所有控制浮在页面上”，而是：

在不破坏各模式主语义的前提下，提供统一、轻量、系统级的控制与反馈层。

一句话总结：

- 页面负责主体验
- Overlay 负责统一控制与系统提示
- 它必须轻、统一、可随时出现、可快速退场
